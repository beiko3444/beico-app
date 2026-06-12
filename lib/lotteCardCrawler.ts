import type { BarobillCardApprovalLog } from './barobillCard'

const DEFAULT_CDP_URL = 'http://127.0.0.1:9222'
const LOTTE_USAGE_URL = 'https://www.lottecard.co.kr/app/LPMCDAA_V100.lc'

type CdpTarget = {
  type: string
  title: string
  url: string
  webSocketDebuggerUrl?: string
}

type CdpResponse<T = unknown> = {
  result?: T
  error?: { message?: string; data?: string }
  exceptionDetails?: { text?: string; exception?: { description?: string } }
}

type CdpRuntimeResult<T = unknown> = {
  result: {
    type: string
    value?: T
    description?: string
  }
  exceptionDetails?: CdpResponse['exceptionDetails']
}

type LottePageRow = {
  idx: number
  object: Record<string, unknown> | null
  merchantText: string
  infoSpans: string[]
  amountText: string
  rowText: string
}

type LottePageData = {
  href: string
  title: string
  rowCount: number
  summaryText: string
  rows: LottePageRow[]
}

export type LotteCardScrapeResult = {
  source: 'lottecard-cdp'
  finalUrl: string
  pageTitle: string
  loadedRowCount: number
  loadMoreClicks: number
  targetCards: string[]
  logs: BarobillCardApprovalLog[]
}

export type LotteCardScrapeOptions = {
  startDate: string
  endDate: string
  cardNum?: string
  debugUrl?: string
}

class CdpPage {
  private nextId = 0
  private pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }
  >()

  constructor(private readonly ws: WebSocket) {}

  send<T = unknown>(method: string, params: Record<string, unknown> = {}, timeoutMs = 15000) {
    return new Promise<T>((resolve, reject) => {
      const id = ++this.nextId
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`${method} timed out after ${timeoutMs}ms.`))
      }, timeoutMs)
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  async evaluate<T>(expression: string, awaitPromise = true, timeoutMs = 15000) {
    const response = await this.send<CdpRuntimeResult<T>>('Runtime.evaluate', {
      expression,
      awaitPromise,
      returnByValue: true,
      userGesture: true,
    }, timeoutMs)
    if (response.exceptionDetails) {
      throw new Error(
        response.exceptionDetails.exception?.description ||
          response.exceptionDetails.text ||
          'Chrome DevTools Runtime.evaluate failed.',
      )
    }
    return response.result.value as T
  }

  close() {
    this.ws.close()
  }

  handleMessage(raw: string) {
    const msg = JSON.parse(raw) as { id?: number } & CdpResponse
    if (!msg.id || !this.pending.has(msg.id)) return
    const pending = this.pending.get(msg.id)
    this.pending.delete(msg.id)
    if (!pending) return
    clearTimeout(pending.timer)
    if (msg.error) {
      pending.reject(new Error(msg.error.data || msg.error.message || 'Chrome DevTools Protocol error.'))
      return
    }
    pending.resolve(msg.result)
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms.`)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

async function connectToPage(wsUrl: string) {
  return withTimeout(
    new Promise<CdpPage>((resolve, reject) => {
      const ws = new WebSocket(wsUrl)
      let page: CdpPage | null = null
      ws.onopen = () => {
        page = new CdpPage(ws)
        resolve(page)
      }
      ws.onerror = () => reject(new Error('Failed to connect to the browser debug WebSocket.'))
      ws.onmessage = (event) => page?.handleMessage(String(event.data))
    }),
    8000,
    'Browser debug WebSocket connection',
  )
}

async function getTargets(debugUrl: string) {
  const res = await fetch(`${debugUrl.replace(/\/$/, '')}/json/list`, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Browser debug endpoint is not available (${res.status}).`)
  }
  return (await res.json()) as CdpTarget[]
}

async function findLotteTarget(debugUrl: string) {
  const targets = await getTargets(debugUrl)
  const pages = targets.filter((target) => target.type === 'page' && target.webSocketDebuggerUrl)
  const isLoginPage = (target: CdpTarget) => /login|\uB85C\uADF8\uC778/i.test(target.title || '')
  const lottePages = pages.filter((target) => target.url.includes('lottecard.co.kr'))
  const usagePage = lottePages.find((target) => target.url.includes('LPMCDAA_V100') && !isLoginPage(target))
  const lottePage = lottePages.find((target) => !isLoginPage(target)) || lottePages[0]
  const target = usagePage || lottePage
  if (!target?.webSocketDebuggerUrl) {
    throw new Error(
      'LotteCard browser session was not found. Open Whale/Chrome with --remote-debugging-port=9222 and log in first.',
    )
  }
  return target
}

function toYmd(input: string) {
  const value = String(input || '').trim()
  if (/^\d{8}$/.test(value)) return value
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.replace(/-/g, '')
  throw new Error(`Invalid date format: ${input}`)
}

function dottedYmd(ymd: string) {
  return `${ymd.slice(0, 4)}.${ymd.slice(4, 6)}.${ymd.slice(6, 8)}`
}

function compact(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function toInt(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const match = String(value).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)
  if (!match) return null
  const n = Number(match[0])
  return Number.isFinite(n) ? Math.round(n) : null
}

function toFloat(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const match = String(value).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)
  if (!match) return null
  const n = Number(match[0])
  return Number.isFinite(n) ? n : null
}

function parseUsedAt(raw: Record<string, unknown>) {
  const aprDtti = compact(raw.aprDtti)
  if (/^\d{14,17}$/.test(aprDtti)) {
    const y = aprDtti.slice(0, 4)
    const m = aprDtti.slice(4, 6)
    const d = aprDtti.slice(6, 8)
    const hh = aprDtti.slice(8, 10)
    const mm = aprDtti.slice(10, 12)
    const ss = aprDtti.slice(12, 14)
    const ms = aprDtti.slice(14, 17).padEnd(3, '0') || '000'
    return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}.${ms}+09:00`)
  }

  const displayDate = compact(raw.displayDeDt).replace(/\./g, '-')
  const displayTime = compact(raw.displayDeHr)
  if (/^\d{4}-\d{2}-\d{2}$/.test(displayDate) && /^\d{2}:\d{2}$/.test(displayTime)) {
    return new Date(`${displayDate}T${displayTime}:00+09:00`)
  }

  const deDt = compact(raw.deDt)
  if (/^\d{8}$/.test(deDt)) {
    return new Date(`${deDt.slice(0, 4)}-${deDt.slice(4, 6)}-${deDt.slice(6, 8)}T00:00:00+09:00`)
  }

  return null
}

function hasMeaningfulValue(value: unknown) {
  const text = compact(value)
  return Boolean(text && text !== '-' && text !== '0' && text.toUpperCase() !== 'N')
}

function sanitizeRaw(raw: Record<string, unknown>, row: LottePageRow) {
  const safe: Record<string, string | number | null> = {
    source: 'lottecard-cdp',
    rowIndex: row.idx,
    merchantText: row.merchantText,
    amountText: row.amountText,
    rowText: row.rowText,
  }

  for (const [key, value] of Object.entries(raw)) {
    if (value === null || value === undefined) {
      safe[key] = null
    } else if (typeof value === 'string' || typeof value === 'number') {
      safe[key] = value
    } else if (typeof value === 'boolean') {
      safe[key] = value ? 'true' : 'false'
    } else {
      safe[key] = JSON.stringify(value)
    }
  }

  return safe
}

function normalizeRow(row: LottePageRow): BarobillCardApprovalLog | null {
  const raw = row.object || {}
  const amount = toInt(raw.aprDeAm ?? raw.displayAprAm ?? row.amountText) || 0
  const cancelAmount = toInt(raw.displaySlCanAm)
  const isCanceled =
    hasMeaningfulValue(raw.aprCanRc) ||
    hasMeaningfulValue(raw.byCanRc) ||
    (typeof cancelAmount === 'number' && cancelAmount > 0)
  const signedAmount = isCanceled ? -Math.abs(amount) : amount
  const cardName = compact(
    [
      compact(raw.cdDcNm),
      compact(raw.cdPdKndNm),
      compact(raw.maskCdno) ? `(${compact(raw.maskCdno)})` : '',
    ]
      .filter(Boolean)
      .join(' '),
  )
  const cardNum = process.env.LOTTE_CARD_NUM || cardName || 'LOTTECARD'
  const usedAt = parseUsedAt(raw)
  const useDT =
    compact(raw.aprDtti).slice(0, 14) ||
    (usedAt
      ? `${usedAt.getFullYear()}${String(usedAt.getMonth() + 1).padStart(2, '0')}${String(usedAt.getDate()).padStart(2, '0')}${String(usedAt.getHours()).padStart(2, '0')}${String(usedAt.getMinutes()).padStart(2, '0')}${String(usedAt.getSeconds()).padStart(2, '0')}`
      : compact(raw.deDt))
  const useKey = compact(
    [
      'LOTTE',
      compact(raw.aprDtti) || useDT,
      compact(raw.aprDeKeyV) || compact(raw.aprno),
      compact(raw.gramFlwSeq),
      isCanceled ? 'CANCEL' : '',
    ]
      .filter(Boolean)
      .join(':'),
  )

  if (!useDT || !useKey) return null

  return {
    corpNum: process.env.LOTTE_CARD_CORP_NUM || process.env.BAROBILL_CORP_NUM || 'LOTTECARD',
    cardNum,
    useKey,
    useDT,
    usedAt,
    approvalType: isCanceled ? 'CANCELED' : 'APPROVED',
    approvalNum: compact(raw.aprno) || compact(raw.aprDeKeyV) || null,
    approvalAmount: signedAmount,
    foreignApprovalAmount: toFloat(raw.displayDam),
    amount: signedAmount,
    tax: null,
    serviceCharge: null,
    totalAmount: signedAmount,
    useStoreNum: compact(raw.dafMcno) || null,
    useStoreCorpNum: null,
    useStoreTaxType: null,
    useStoreName: compact(raw.mcNm) || row.merchantText || null,
    useStoreCeo: null,
    useStoreAddr: null,
    useStoreBizType: null,
    useStoreTel: null,
    paymentPlan: compact(raw.intNm) || null,
    installmentMonths: compact(raw.intMt) || null,
    currencyCode: null,
    memo: null,
    raw: sanitizeRaw(raw, row),
  } satisfies BarobillCardApprovalLog
}

async function navigateToUsagePage(page: CdpPage) {
  await page.evaluate(
    `(async () => {
      if (!location.href.includes('LPMCDAA_V100.lc')) {
        if (typeof svcf_Link === 'function') {
          svcf_Link('/app/LPMCDAA_V100.lc')
        } else {
          location.href = '${LOTTE_USAGE_URL}'
        }
      }
      return true
    })()`,
  )

  await waitFor(page, async () => {
    const state = await page.evaluate<{ href: string; ready: string }>(
      `(() => ({ href: location.href, ready: document.readyState }))()`,
      false,
    )
    return state.href.includes('LPMCDAA_V100') && state.ready !== 'loading'
  }, 'LotteCard usage page')
}

async function waitFor(page: CdpPage, check: () => Promise<boolean>, label: string, timeoutMs = 20000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (await check()) return
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  const state = await page.evaluate<{ href: string; title: string }>(
    `(() => ({ href: location.href, title: document.title }))()`,
    false,
  )
  throw new Error(`${label} did not become ready. Current page: ${state.title} ${state.href}`)
}

async function searchPeriod(page: CdpPage, startDate: string, endDate: string) {
  const start = toYmd(startDate)
  const end = toYmd(endDate)
  await page.evaluate(
    `(async () => {
      const start = '${start}'
      const end = '${end}'
      const dot = (ymd) => ymd.slice(0, 4) + '.' + ymd.slice(4, 6) + '.' + ymd.slice(6, 8)
      const setValue = (selector, value) => {
        const el = document.querySelector(selector)
        if (!el) return false
        el.value = value
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
        return true
      }
      setValue('[name="startDt"]', start)
      setValue('[name="endDt"]', end)
      setValue('#startDtShow', dot(start))
      setValue('#endDtShow', dot(end))
      setValue('#startDtCalen', dot(start))
      setValue('#endDtCalen', dot(end))
      const manualRange = document.querySelector('#use_month10')
      if (manualRange) {
        manualRange.checked = true
        manualRange.dispatchEvent(new Event('change', { bubbles: true }))
      }
      document.querySelector('#searchFilterBtn')?.click()
      await new Promise((resolve) => setTimeout(resolve, 1800))
      return {
        href: location.href,
        rowCount: document.querySelectorAll('#useCardList > li.toggle').length,
        start: document.querySelector('[name="startDt"]')?.value || '',
        end: document.querySelector('[name="endDt"]')?.value || '',
      }
    })()`,
  )

  await waitFor(page, async () => {
    const state = await page.evaluate<{ hasList: boolean; start: string; end: string }>(
      `(() => ({
        hasList: Boolean(document.querySelector('#useCardList')),
        start: document.querySelector('[name="startDt"]')?.value || '',
        end: document.querySelector('[name="endDt"]')?.value || '',
      }))()`,
      false,
    )
    return state.hasList && state.start === start && state.end === end
  }, 'LotteCard period search')
}

async function loadAllRows(page: CdpPage) {
  let clicks = 0
  let staleClicks = 0
  let rowCount = 0

  for (; clicks < 100; clicks += 1) {
    const before = await page.evaluate<{ canClick: boolean; rowCount: number }>(
      `(() => {
      const visible = (el) => {
        if (!el) return false
        const style = getComputedStyle(el)
        return style.display !== 'none' && style.visibility !== 'hidden' && !el.disabled && el.offsetParent !== null
      }
      const btn = document.querySelector('#aprUseMoreBtn')
      return {
        canClick: visible(btn),
        rowCount: document.querySelectorAll('#useCardList > li.toggle').length,
      }
    })()`,
      false,
      5000,
    )

    rowCount = before.rowCount
    if (!before.canClick) break

    await page.evaluate(
      `(() => {
        const btn = document.querySelector('#aprUseMoreBtn')
        if (!btn) return false
        btn.scrollIntoView({ block: 'center' })
        btn.click()
        return true
      })()`,
      false,
      5000,
    )

    await new Promise((resolve) => setTimeout(resolve, 900))

    const after = await page.evaluate<{ canClick: boolean; rowCount: number }>(
      `(() => {
      const visible = (el) => {
        if (!el) return false
        const style = getComputedStyle(el)
        return style.display !== 'none' && style.visibility !== 'hidden' && !el.disabled && el.offsetParent !== null
      }
      const btn = document.querySelector('#aprUseMoreBtn')
      return {
        canClick: visible(btn),
        rowCount: document.querySelectorAll('#useCardList > li.toggle').length,
      }
    })()`,
      false,
      5000,
    )

    rowCount = after.rowCount
    if (after.rowCount > before.rowCount) {
      staleClicks = 0
      continue
    }

    staleClicks += 1
    if (staleClicks >= 2 || !after.canClick) break
  }

  return { clicks, rowCount }
}

async function extractRows(page: CdpPage) {
  return page.evaluate<LottePageData>(
    `(() => {
      const text = (el) => (el?.innerText || el?.textContent || '').replace(/\\s+/g, ' ').trim()
      const rows = Array.from(document.querySelectorAll('#useCardList > li.toggle')).map((li, idx) => {
        const button = li.querySelector('button.icoMore[data-object]')
        let object = null
        try {
          object = JSON.parse(button?.getAttribute('data-object') || '{}')
        } catch {
          object = null
        }
        return {
          idx: idx + 1,
          object,
          merchantText: text(li.querySelector(':scope > strong')),
          infoSpans: Array.from(li.querySelectorAll(':scope > .info > span')).map(text),
          amountText: text(li.querySelector(':scope > em')),
          rowText: text(li),
        }
      })
      return {
        href: location.href,
        title: document.title,
        rowCount: rows.length,
        summaryText: text(document.querySelector('.inner')),
        rows,
      }
    })()`,
    false,
  )
}

export async function scrapeLotteCardUsage(options: LotteCardScrapeOptions): Promise<LotteCardScrapeResult> {
  const debugUrl = options.debugUrl || process.env.LOTTE_CARD_CDP_URL || DEFAULT_CDP_URL
  const target = await findLotteTarget(debugUrl)
  const page = await connectToPage(target.webSocketDebuggerUrl as string)

  try {
    await page.send('Runtime.enable')
    await navigateToUsagePage(page)
    await searchPeriod(page, options.startDate, options.endDate)
    const loadResult = await loadAllRows(page)
    const pageData = await extractRows(page)
    const cardFilter = compact(options.cardNum)
    const logs = pageData.rows
      .map(normalizeRow)
      .filter((log): log is BarobillCardApprovalLog => Boolean(log))
      .filter((log) => !cardFilter || log.cardNum.includes(cardFilter))
    const targetCards = Array.from(new Set(logs.map((log) => log.cardNum))).sort()

    return {
      source: 'lottecard-cdp',
      finalUrl: pageData.href,
      pageTitle: pageData.title,
      loadedRowCount: pageData.rowCount || loadResult.rowCount,
      loadMoreClicks: loadResult.clicks,
      targetCards,
      logs,
    }
  } finally {
    page.close()
  }
}
