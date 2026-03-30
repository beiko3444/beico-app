const CARD_SOAP_URL = 'https://ws.baroservice.com/CARD.asmx'

function getCardConfig() {
  return {
    CERTKEY: process.env.BAROBILL_CERTKEY || '',
    CORP_NUM: process.env.BAROBILL_CORP_NUM || '',
    ID: process.env.BAROBILL_CARD_ID || process.env.BAROBILL_CONTACT_ID || '',
  }
}

function assertCardConfig() {
  const cfg = getCardConfig()
  if (!cfg.CERTKEY) throw new Error('BAROBILL_CERTKEY is not configured.')
  if (!cfg.CORP_NUM) throw new Error('BAROBILL_CORP_NUM is not configured.')
  if (!cfg.ID) throw new Error('BAROBILL_CARD_ID or BAROBILL_CONTACT_ID is not configured.')
  return cfg
}

function escapeXml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function decodeXml(str: string) {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim()
}

function toYmd(value: string) {
  const raw = value.trim()
  if (/^\d{8}$/.test(raw)) return raw
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.replace(/-/g, '')
  throw new Error(`Invalid date format: ${value}. Use YYYY-MM-DD or YYYYMMDD.`)
}

async function callCardSoap(action: string, bodyXml: string) {
  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
${bodyXml}
  </soap:Body>
</soap:Envelope>`

  const response = await fetch(CARD_SOAP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: `http://ws.baroservice.com/${action}`,
    },
    body: envelope,
  })

  const text = await response.text()
  if (!response.ok) {
    throw new Error(`[Barobill CARD] HTTP ${response.status}: ${text.slice(0, 300)}`)
  }

  const fault = extractTag(text, 'faultstring')
  if (fault) {
    throw new Error(`[Barobill CARD] SOAP Fault: ${decodeXml(fault)}`)
  }

  return text
}

function extractTag(xml: string, tag: string) {
  const regex = new RegExp(`<(?:\\w+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`, 'i')
  const match = xml.match(regex)
  return match ? match[1].trim() : null
}

function extractTagBlocks(xml: string, tag: string) {
  const regex = new RegExp(`<(?:\\w+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`, 'gi')
  const blocks: string[] = []
  let match: RegExpExecArray | null = null
  while ((match = regex.exec(xml)) !== null) {
    blocks.push(match[1])
  }
  return blocks
}

function toInt(value: string | null) {
  if (!value) return null
  const normalized = value.replace(/,/g, '').trim()
  const match = normalized.match(/-?\d+(?:\.\d+)?/)
  if (!match) return null
  const n = Number(match[0])
  if (!Number.isFinite(n)) return null
  return Math.round(n)
}

function toFloat(value: string | null) {
  if (!value) return null
  const normalized = value.replace(/,/g, '').trim()
  const match = normalized.match(/-?\d+(?:\.\d+)?/)
  if (!match) return null
  const n = Number(match[0])
  return Number.isFinite(n) ? n : null
}

function parseUseDate(useDT: string) {
  const raw = useDT.trim()
  if (!raw) return null

  if (/^\d{14}$/.test(raw)) {
    const y = raw.slice(0, 4)
    const m = raw.slice(4, 6)
    const d = raw.slice(6, 8)
    const hh = raw.slice(8, 10)
    const mm = raw.slice(10, 12)
    const ss = raw.slice(12, 14)
    return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}+09:00`)
  }

  if (/^\d{12}$/.test(raw)) {
    const y = raw.slice(0, 4)
    const m = raw.slice(4, 6)
    const d = raw.slice(6, 8)
    const hh = raw.slice(8, 10)
    const mm = raw.slice(10, 12)
    return new Date(`${y}-${m}-${d}T${hh}:${mm}:00+09:00`)
  }

  const direct = new Date(raw)
  if (!Number.isNaN(direct.getTime())) return direct
  return null
}

export type BarobillCardApprovalLog = {
  corpNum: string
  cardNum: string
  useKey: string
  useDT: string
  usedAt: Date | null
  approvalType: string | null
  approvalNum: string | null
  approvalAmount: number | null
  foreignApprovalAmount: number | null
  amount: number | null
  tax: number | null
  serviceCharge: number | null
  totalAmount: number | null
  useStoreNum: string | null
  useStoreCorpNum: string | null
  useStoreTaxType: number | null
  useStoreName: string | null
  useStoreCeo: string | null
  useStoreAddr: string | null
  useStoreBizType: string | null
  useStoreTel: string | null
  paymentPlan: string | null
  installmentMonths: string | null
  currencyCode: string | null
  memo: string | null
  raw: Record<string, string | number | null>
}

function resolveBarobillLogAmount(log: Pick<BarobillCardApprovalLog, 'totalAmount' | 'approvalAmount' | 'amount' | 'tax' | 'serviceCharge'>) {
  if (typeof log.totalAmount === 'number' && log.totalAmount > 0) return log.totalAmount
  if (typeof log.approvalAmount === 'number' && log.approvalAmount > 0) return log.approvalAmount
  if (
    typeof log.amount === 'number' ||
    typeof log.tax === 'number' ||
    typeof log.serviceCharge === 'number'
  ) {
    const summed = (log.amount || 0) + (log.tax || 0) + (log.serviceCharge || 0)
    if (summed > 0) return summed
  }
  return 0
}

function pickPositiveNumber(primary: number | null, fallback: number | null) {
  if (typeof primary === 'number' && primary > 0) return primary
  if (typeof fallback === 'number' && fallback > 0) return fallback
  return primary ?? fallback ?? null
}

function parseCardApprovalLog(block: string): BarobillCardApprovalLog {
  const corpNum = decodeXml(extractTag(block, 'CorpNum') || '')
  const cardNum = decodeXml(extractTag(block, 'CardNum') || '')
  const useDT = decodeXml(extractTag(block, 'UseDT') || '')
  const approvalNum = decodeXml(extractTag(block, 'ApprovalNum') || extractTag(block, 'CardApprovalNum') || '')
  const approvalType = decodeXml(extractTag(block, 'ApprovalType') || extractTag(block, 'CardApprovalType') || '')
  const approvalAmount = toInt(
    extractTag(block, 'ApprovalAmount') ||
    extractTag(block, 'CardApprovalCost') ||
    extractTag(block, 'ApprovalCost'),
  )
  const amount = toInt(extractTag(block, 'Amount')) ?? approvalAmount
  const tax = toInt(extractTag(block, 'Tax'))
  const serviceCharge = toInt(extractTag(block, 'ServiceCharge'))
  // TotalAmount 우선, 없으면 Amount+Tax+ServiceCharge 합산, 없으면 ApprovalAmount/CardApprovalCost
  const rawTotalAmount = toInt(extractTag(block, 'TotalAmount'))
  const summedAmount =
    typeof amount === 'number' || typeof tax === 'number' || typeof serviceCharge === 'number'
      ? (amount || 0) + (tax || 0) + (serviceCharge || 0)
      : null
  const totalAmount =
    (typeof rawTotalAmount === 'number' && rawTotalAmount > 0)
      ? rawTotalAmount
      : (typeof summedAmount === 'number' && summedAmount > 0)
        ? summedAmount
        : rawTotalAmount ?? approvalAmount
  const useKeyRaw = decodeXml(extractTag(block, 'UseKey') || '')
  const useKey = useKeyRaw || `${cardNum}:${useDT}:${approvalNum}:${totalAmount || 0}`

  return {
    corpNum,
    cardNum,
    useKey,
    useDT,
    usedAt: parseUseDate(useDT),
    approvalType: approvalType || null,
    approvalNum: approvalNum || null,
    approvalAmount,
    foreignApprovalAmount: toFloat(extractTag(block, 'ForeignApprovalAmount')),
    amount,
    tax,
    serviceCharge,
    totalAmount,
    useStoreNum: decodeXml(extractTag(block, 'UseStoreNum') || '') || null,
    useStoreCorpNum: decodeXml(extractTag(block, 'UseStoreCorpNum') || '') || null,
    useStoreTaxType: toInt(extractTag(block, 'UseStoreTaxType')),
    useStoreName: decodeXml(extractTag(block, 'UseStoreName') || '') || null,
    useStoreCeo: decodeXml(extractTag(block, 'UseStoreCeo') || '') || null,
    useStoreAddr: decodeXml(extractTag(block, 'UseStoreAddr') || '') || null,
    useStoreBizType: decodeXml(extractTag(block, 'UseStoreBizType') || '') || null,
    useStoreTel: decodeXml(extractTag(block, 'UseStoreTel') || '') || null,
    paymentPlan: decodeXml(extractTag(block, 'PaymentPlan') || '') || null,
    installmentMonths: decodeXml(extractTag(block, 'InstallmentMonths') || '') || null,
    currencyCode: decodeXml(extractTag(block, 'CurrencyCode') || extractTag(block, 'Currency') || '') || null,
    memo: decodeXml(extractTag(block, 'Memo') || '') || null,
    raw: {
      CorpNum: corpNum,
      CardNum: cardNum,
      UseKey: useKey,
      UseDT: useDT,
      ApprovalType: approvalType,
      ApprovalNum: approvalNum,
      ApprovalAmount: approvalAmount,
      ForeignApprovalAmount: toFloat(extractTag(block, 'ForeignApprovalAmount')),
      Amount: amount,
      Tax: tax,
      ServiceCharge: serviceCharge,
      TotalAmount: totalAmount,
      UseStoreNum: decodeXml(extractTag(block, 'UseStoreNum') || ''),
      UseStoreCorpNum: decodeXml(extractTag(block, 'UseStoreCorpNum') || ''),
      UseStoreTaxType: toInt(extractTag(block, 'UseStoreTaxType')),
      UseStoreName: decodeXml(extractTag(block, 'UseStoreName') || ''),
      UseStoreCeo: decodeXml(extractTag(block, 'UseStoreCeo') || ''),
      UseStoreAddr: decodeXml(extractTag(block, 'UseStoreAddr') || ''),
      UseStoreBizType: decodeXml(extractTag(block, 'UseStoreBizType') || ''),
      UseStoreTel: decodeXml(extractTag(block, 'UseStoreTel') || ''),
      PaymentPlan: decodeXml(extractTag(block, 'PaymentPlan') || ''),
      InstallmentMonths: decodeXml(extractTag(block, 'InstallmentMonths') || ''),
      CurrencyCode: decodeXml(extractTag(block, 'CurrencyCode') || ''),
      Memo: decodeXml(extractTag(block, 'Memo') || ''),
    },
  }
}

function parseLegacyCardLogEx3(block: string): BarobillCardApprovalLog {
  const corpNum = decodeXml(extractTag(block, 'CorpNum') || '')
  const cardNum = decodeXml(extractTag(block, 'CardNum') || '')
  const useDT = decodeXml(extractTag(block, 'UseDT') || '')
  const approvalNum = decodeXml(extractTag(block, 'CardApprovalNum') || '')
  const approvalType = decodeXml(extractTag(block, 'CardApprovalType') || '')
  const approvalAmount = toInt(extractTag(block, 'CardApprovalCost'))
  const amount = toInt(extractTag(block, 'Amount')) ?? approvalAmount
  const tax = toInt(extractTag(block, 'Tax'))
  const serviceCharge = toInt(extractTag(block, 'ServiceCharge'))
  // TotalAmount 우선, 없으면 Amount+Tax+ServiceCharge 합산, 없으면 CardApprovalCost
  const rawTotalAmount = toInt(extractTag(block, 'TotalAmount'))
  const summedAmount =
    typeof amount === 'number' || typeof tax === 'number' || typeof serviceCharge === 'number'
      ? (amount || 0) + (tax || 0) + (serviceCharge || 0)
      : null
  const totalAmount =
    (typeof rawTotalAmount === 'number' && rawTotalAmount > 0)
      ? rawTotalAmount
      : (typeof summedAmount === 'number' && summedAmount > 0)
        ? summedAmount
        : rawTotalAmount ?? approvalAmount
  const useKeyRaw = decodeXml(extractTag(block, 'UseKey') || '')
  const useKey = useKeyRaw || `${cardNum}:${useDT}:${approvalNum}:${totalAmount || 0}`

  return {
    corpNum,
    cardNum,
    useKey,
    useDT,
    usedAt: parseUseDate(useDT),
    approvalType: approvalType || null,
    approvalNum: approvalNum || null,
    approvalAmount,
    foreignApprovalAmount: null,
    amount,
    tax,
    serviceCharge,
    totalAmount,
    useStoreNum: decodeXml(extractTag(block, 'UseStoreNum') || '') || null,
    useStoreCorpNum: decodeXml(extractTag(block, 'UseStoreCorpNum') || '') || null,
    useStoreTaxType: toInt(extractTag(block, 'UseStoreTaxType')),
    useStoreName: decodeXml(extractTag(block, 'UseStoreName') || '') || null,
    useStoreCeo: decodeXml(extractTag(block, 'UseStoreCeo') || '') || null,
    useStoreAddr: decodeXml(extractTag(block, 'UseStoreAddr') || '') || null,
    useStoreBizType: decodeXml(extractTag(block, 'UseStoreBizType') || '') || null,
    useStoreTel: decodeXml(extractTag(block, 'UseStoreTel') || '') || null,
    paymentPlan: decodeXml(extractTag(block, 'PaymentPlan') || '') || null,
    installmentMonths: decodeXml(extractTag(block, 'InstallmentMonths') || '') || null,
    currencyCode: decodeXml(extractTag(block, 'Currency') || extractTag(block, 'CurrencyCode') || '') || null,
    memo: decodeXml(extractTag(block, 'Memo') || '') || null,
    raw: {
      CorpNum: corpNum,
      CardNum: cardNum,
      UseKey: useKey,
      UseDT: useDT,
      CardApprovalType: approvalType,
      CardApprovalNum: approvalNum,
      CardApprovalCost: approvalAmount,
      Amount: amount,
      Tax: tax,
      ServiceCharge: serviceCharge,
      TotalAmount: totalAmount,
      UseStoreNum: decodeXml(extractTag(block, 'UseStoreNum') || ''),
      UseStoreCorpNum: decodeXml(extractTag(block, 'UseStoreCorpNum') || ''),
      UseStoreTaxType: toInt(extractTag(block, 'UseStoreTaxType')),
      UseStoreName: decodeXml(extractTag(block, 'UseStoreName') || ''),
      UseStoreCeo: decodeXml(extractTag(block, 'UseStoreCeo') || ''),
      UseStoreAddr: decodeXml(extractTag(block, 'UseStoreAddr') || ''),
      UseStoreBizType: decodeXml(extractTag(block, 'UseStoreBizType') || ''),
      UseStoreTel: decodeXml(extractTag(block, 'UseStoreTel') || ''),
      PaymentPlan: decodeXml(extractTag(block, 'PaymentPlan') || ''),
      InstallmentMonths: decodeXml(extractTag(block, 'InstallmentMonths') || ''),
      Currency: decodeXml(extractTag(block, 'Currency') || ''),
      Memo: decodeXml(extractTag(block, 'Memo') || ''),
    },
  }
}

function parsePagedCardLogResult(
  xml: string,
  options: {
    resultTag: string
    itemTag: string
    parseItem: (block: string) => BarobillCardApprovalLog
  },
) {
  const resultBody = extractTag(xml, options.resultTag)

  if (!resultBody) {
    const nilResult = new RegExp(`${options.resultTag}[^>]*xsi:nil=['"]true['"]`, 'i').test(xml)
    if (nilResult) {
      return {
        currentPage: 1,
        maxPageNum: 1,
        countPerPage: 0,
        maxIndex: 0,
        logs: [] as BarobillCardApprovalLog[],
      }
    }
    throw new Error(`Failed to parse ${options.resultTag}.`)
  }

  const currentPage = toInt(extractTag(resultBody, 'CurrentPage'))
  if (typeof currentPage === 'number' && currentPage < 0) {
    throw new Error(`[Barobill CARD] ${options.resultTag} failed: ${currentPage}`)
  }

  const cardLogList = extractTag(resultBody, 'CardLogList') || ''
  const logBlocks = extractTagBlocks(cardLogList, options.itemTag)

  return {
    currentPage: currentPage || 1,
    maxPageNum: toInt(extractTag(resultBody, 'MaxPageNum')) || 1,
    countPerPage: toInt(extractTag(resultBody, 'CountPerPage')) || 0,
    maxIndex: toInt(extractTag(resultBody, 'MaxIndex')) || 0,
    logs: logBlocks.map(options.parseItem),
  }
}

export async function getCardEx2(availableOnly = true) {
  const cfg = assertCardConfig()
  const body = `<GetCardEx2 xmlns="http://ws.baroservice.com/">
      <CERTKEY>${escapeXml(cfg.CERTKEY)}</CERTKEY>
      <CorpNum>${escapeXml(cfg.CORP_NUM)}</CorpNum>
      <AvailOnly>${availableOnly ? 1 : 0}</AvailOnly>
    </GetCardEx2>`

  const xml = await callCardSoap('GetCardEx2', body)
  const resultBody = extractTag(xml, 'GetCardEx2Result')
  if (!resultBody) return []

  const blocks = extractTagBlocks(resultBody, 'CardEx')
  const numbers = blocks
    .map((block) => decodeXml(extractTag(block, 'CardNum') || '').trim())
    .filter(Boolean)

  if (numbers[0] && /^-\d{5}$/.test(numbers[0])) {
    throw new Error(`[Barobill CARD] GetCardEx2 failed: ${numbers[0]}`)
  }

  return Array.from(new Set(numbers))
}

export async function refreshCard(cardNum: string) {
  const cfg = assertCardConfig()
  const body = `<RefreshCard xmlns="http://ws.baroservice.com/">
      <CERTKEY>${escapeXml(cfg.CERTKEY)}</CERTKEY>
      <CorpNum>${escapeXml(cfg.CORP_NUM)}</CorpNum>
      <ID>${escapeXml(cfg.ID)}</ID>
      <CardNum>${escapeXml(cardNum)}</CardNum>
    </RefreshCard>`

  const xml = await callCardSoap('RefreshCard', body)
  const resultText = extractTag(xml, 'RefreshCardResult') || ''
  const resultCode = parseInt(resultText, 10)
  if (!Number.isFinite(resultCode)) {
    throw new Error('Failed to parse RefreshCardResult.')
  }
  return resultCode
}

export async function getPeriodCardApprovalLog(params: {
  cardNum: string
  startDate: string
  endDate: string
  countPerPage?: number
  orderDirection?: number
}) {
  const cfg = assertCardConfig()
  const startDate = toYmd(params.startDate)
  const endDate = toYmd(params.endDate)
  const countPerPage = Math.max(1, Math.min(1000, params.countPerPage || 500))
  const orderDirection = params.orderDirection ?? 1

  let currentPage = 1
  let maxPage = 1
  const allLogs: BarobillCardApprovalLog[] = []

  while (currentPage <= maxPage) {
    const body = `<GetPeriodCardApprovalLog xmlns="http://ws.baroservice.com/">
      <CERTKEY>${escapeXml(cfg.CERTKEY)}</CERTKEY>
      <CorpNum>${escapeXml(cfg.CORP_NUM)}</CorpNum>
      <ID>${escapeXml(cfg.ID)}</ID>
      <CardNum>${escapeXml(params.cardNum)}</CardNum>
      <StartDate>${startDate}</StartDate>
      <EndDate>${endDate}</EndDate>
      <CountPerPage>${countPerPage}</CountPerPage>
      <CurrentPage>${currentPage}</CurrentPage>
      <OrderDirection>${orderDirection}</OrderDirection>
    </GetPeriodCardApprovalLog>`

    const xml = await callCardSoap('GetPeriodCardApprovalLog', body)
    const pageResult = parsePagedCardLogResult(xml, {
      resultTag: 'GetPeriodCardApprovalLogResult',
      itemTag: 'CardApprovalLog',
      parseItem: parseCardApprovalLog,
    })

    allLogs.push(...pageResult.logs)
    maxPage = Math.max(1, pageResult.maxPageNum)
    currentPage += 1

    if (currentPage > 2000) {
      throw new Error('Card usage pagination exceeded the safety limit.')
    }
  }

  return {
    logs: allLogs,
    maxPageNum: maxPage,
  }
}

export async function getPeriodCardLogEx3(params: {
  cardNum: string
  startDate: string
  endDate: string
  countPerPage?: number
  orderDirection?: number
}) {
  const cfg = assertCardConfig()
  const startDate = toYmd(params.startDate)
  const endDate = toYmd(params.endDate)
  const countPerPage = Math.max(1, Math.min(1000, params.countPerPage || 500))
  const orderDirection = params.orderDirection ?? 1

  let currentPage = 1
  let maxPage = 1
  const allLogs: BarobillCardApprovalLog[] = []

  while (currentPage <= maxPage) {
    const body = `<GetPeriodCardLogEx3 xmlns="http://ws.baroservice.com/">
      <CERTKEY>${escapeXml(cfg.CERTKEY)}</CERTKEY>
      <CorpNum>${escapeXml(cfg.CORP_NUM)}</CorpNum>
      <ID>${escapeXml(cfg.ID)}</ID>
      <CardNum>${escapeXml(params.cardNum)}</CardNum>
      <StartDate>${startDate}</StartDate>
      <EndDate>${endDate}</EndDate>
      <CountPerPage>${countPerPage}</CountPerPage>
      <CurrentPage>${currentPage}</CurrentPage>
      <OrderDirection>${orderDirection}</OrderDirection>
    </GetPeriodCardLogEx3>`

    const xml = await callCardSoap('GetPeriodCardLogEx3', body)
    const pageResult = parsePagedCardLogResult(xml, {
      resultTag: 'GetPeriodCardLogEx3Result',
      itemTag: 'CardLogEx3',
      parseItem: parseLegacyCardLogEx3,
    })

    allLogs.push(...pageResult.logs)
    maxPage = Math.max(1, pageResult.maxPageNum)
    currentPage += 1

    if (currentPage > 2000) {
      throw new Error('Legacy card usage pagination exceeded the safety limit.')
    }
  }

  return {
    logs: allLogs,
    maxPageNum: maxPage,
  }
}

function mergeLegacyLogAmounts(currentLogs: BarobillCardApprovalLog[], legacyLogs: BarobillCardApprovalLog[]) {
  const legacyMap = new Map<string, BarobillCardApprovalLog>()
  for (const log of legacyLogs) {
    legacyMap.set(`${log.corpNum}|${log.cardNum}|${log.useKey}`, log)
  }

  return currentLogs.map((log) => {
    const legacy = legacyMap.get(`${log.corpNum}|${log.cardNum}|${log.useKey}`)
    if (!legacy) return log
    if (resolveBarobillLogAmount(log) > 0) return log

    return {
      ...log,
      approvalAmount: pickPositiveNumber(log.approvalAmount, legacy.approvalAmount),
      amount: pickPositiveNumber(log.amount, legacy.amount),
      tax: pickPositiveNumber(log.tax, legacy.tax),
      serviceCharge: pickPositiveNumber(log.serviceCharge, legacy.serviceCharge),
      totalAmount: pickPositiveNumber(log.totalAmount, legacy.totalAmount),
      currencyCode: log.currencyCode || legacy.currencyCode,
      raw: {
        ...legacy.raw,
        ...log.raw,
      },
    }
  })
}

export async function fetchCardUsageByPeriod(params: {
  startDate: string
  endDate: string
  cardNum?: string
  refreshBeforeFetch?: boolean
}) {
  const cardFilter = (params.cardNum || '').trim()
  const targetCards = cardFilter ? [cardFilter] : await getCardEx2(true)
  if (targetCards.length === 0) {
    return {
      targetCards: [] as string[],
      logs: [] as BarobillCardApprovalLog[],
      refreshResults: [] as Array<{ cardNum: string; resultCode: number; ok: boolean }>,
    }
  }

  const refreshResults: Array<{ cardNum: string; resultCode: number; ok: boolean }> = []
  const allLogs: BarobillCardApprovalLog[] = []

  for (const cardNum of targetCards) {
    if (params.refreshBeforeFetch) {
      try {
        const resultCode = await refreshCard(cardNum)
        refreshResults.push({ cardNum, resultCode, ok: resultCode > 0 })
      } catch {
        refreshResults.push({ cardNum, resultCode: -99999, ok: false })
      }
    }

    const { logs: approvalLogs } = await getPeriodCardApprovalLog({
      cardNum,
      startDate: params.startDate,
      endDate: params.endDate,
    })

    const needsLegacyFallback =
      approvalLogs.length === 0 ||
      approvalLogs.some((log) => resolveBarobillLogAmount(log) <= 0)

    if (!needsLegacyFallback) {
      allLogs.push(...approvalLogs)
      continue
    }

    try {
      const { logs: legacyLogs } = await getPeriodCardLogEx3({
        cardNum,
        startDate: params.startDate,
        endDate: params.endDate,
      })

      if (approvalLogs.length === 0) {
        allLogs.push(...legacyLogs)
        continue
      }

      allLogs.push(...mergeLegacyLogAmounts(approvalLogs, legacyLogs))
    } catch {
      allLogs.push(...approvalLogs)
    }
  }

  return {
    targetCards,
    logs: allLogs,
    refreshResults,
  }
}
