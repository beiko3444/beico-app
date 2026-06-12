export type SmartInventoryChannel = 'naver' | 'coupang'

export type SmartInventoryLinkedProduct = {
  channel: SmartInventoryChannel
  productKey: string
  name: string
  imageUrl: string | null
  productUrl: string | null
  stock: number | null
  sales: number | null
  todaySales: number | null
  price: number | null
  multiplier: number
  syncedAt: string | null
}

export type SmartInventoryMasterRow = {
  id: number
  imageUrl: string | null
  name: string
  unitCost: number | null
  naverPrice: number | null
  coupangPrice: number | null
  naverStock: number | null
  coupangStock: number | null
  totalStock: number | null
  stockCost: number | null
  naverTodaySales: number | null
  coupangTodaySales: number | null
  totalTodaySales: number | null
  todayRevenue: number | null
  naverSales: number | null
  coupangSales: number | null
  totalSales: number | null
  linkCount: number
  naverUrl: string | null
  coupangUrl: string | null
  representativeChannel: string | null
  representativeProductKey: string | null
  memo: string | null
  updatedAt: string | null
  naverInboundPending: number | null
  coupangInboundPending: number | null
  totalInboundPending: number | null
  linked: SmartInventoryLinkedProduct[]
}

export type SmartInventoryChannelRow = {
  serial: number
  channel: SmartInventoryChannel
  productKey: string
  identityKey: string
  productId: string
  itemId: string | null
  name: string
  imageUrl: string | null
  productUrl: string | null
  stock: number | null
  todaySales: number | null
  sales: number | null
  price: number | null
  syncedAt: string | null
  linkedMasterId: number | null
  linkedMasterName: string | null
  linkMultiplier: number | null
}

export type SmartInventoryDashboardPayload = {
  configured: boolean
  monitorUrl: string | null
  monitorSource: 'env' | 'gist' | null
  health: Record<string, unknown> | null
  rows: SmartInventoryMasterRow[]
  channels: Record<SmartInventoryChannel, SmartInventoryChannelRow[]>
  unlinked: Record<SmartInventoryChannel, number>
  unlinkedRows: Record<SmartInventoryChannel, SmartInventoryChannelRow[]>
  stockInbounds: {
    items: Array<Record<string, unknown>>
    summaries: Array<Record<string, unknown>>
  }
  syncedAt: string
  cache: {
    hit: boolean
    cachedAt: string | null
    refreshing: boolean
  }
  warnings: string[]
  summary: {
    masterCount: number
    linkedCount: number
    naverProducts: number
    coupangProducts: number
    unlinkedProducts: number
    naverStock: number
    coupangStock: number
    totalStock: number
    totalInboundPending: number
    stockCost: number
    todaySales: number
    todayRevenue: number
  }
}

type RawRecord = Record<string, unknown>
type RawMasterLink = {
  channel: SmartInventoryChannel
  productKey: string
  masterId: number
  multiplier: number
}

type MonitorBase = {
  url: string
  source: 'env' | 'gist'
  warnings: string[]
}

type DashboardCacheEntry = {
  payload: SmartInventoryDashboardPayload
  cachedAt: string
}

const CHANNELS: SmartInventoryChannel[] = ['naver', 'coupang']
const TUNNEL_DOWN_STATUS = new Set([502, 503, 504, 530])
const DEFAULT_MONITOR_URL_GIST = 'https://gist.githubusercontent.com/beiko3444/5a69e99d96fa2ae34ba4af96c117d5e0/raw/monitor.json'
let dashboardCache: DashboardCacheEntry | null = null
let dashboardRefreshPromise: Promise<SmartInventoryDashboardPayload> | null = null

function withCacheMeta(
  payload: SmartInventoryDashboardPayload,
  cache: SmartInventoryDashboardPayload['cache'],
): SmartInventoryDashboardPayload {
  return {
    ...payload,
    warnings: [...payload.warnings],
    cache,
  }
}

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function stringOrNull(value: unknown): string | null {
  const text = cleanString(value)
  return text ? text : null
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'string') {
    const normalized = value.replace(/,/g, '').trim()
    if (!normalized) return null
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null
  }
  return null
}

function positiveInt(value: unknown, fallback = 1): number {
  const parsed = numberOrNull(value)
  if (parsed === null) return fallback
  return Math.max(1, parsed)
}

function rawArray(payload: unknown, key: string): RawRecord[] {
  if (!payload || typeof payload !== 'object') return []
  const value = (payload as RawRecord)[key]
  return Array.isArray(value) ? value.filter((row): row is RawRecord => row !== null && typeof row === 'object' && !Array.isArray(row)) : []
}

function normalizeBaseUrl(value: string | null | undefined): string | null {
  const text = cleanString(value)
  if (!text) return null
  try {
    const parsed = new URL(text)
    return parsed.toString().replace(/\/+$/, '')
  } catch {
    return null
  }
}

function requestTimeoutMs(override?: number): number {
  const raw = numberOrNull(process.env.SMARTINVENTORY_MONITOR_TIMEOUT_MS)
  return override ?? Math.max(3000, raw ?? 15000)
}

async function resolveMonitorUrlFromGist(gistRawUrl: string, timeoutMs: number): Promise<string | null> {
  const rawUrl = normalizeBaseUrl(gistRawUrl)
  if (!rawUrl) return null

  const url = new URL(rawUrl)
  url.searchParams.set('t', String(Date.now()))

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url.toString(), {
      cache: 'no-store',
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
      signal: controller.signal,
    })
    if (!response.ok) return null
    const payload = await response.json().catch(() => null)
    if (!payload || typeof payload !== 'object') return null
    return normalizeBaseUrl((payload as RawRecord).url as string | undefined)
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function resolveMonitorBase(timeoutMs = requestTimeoutMs()): Promise<MonitorBase | null> {
  const warnings: string[] = []
  const envUrl = normalizeBaseUrl(process.env.SMARTINVENTORY_MONITOR_URL)
  const configuredGistRawUrl = cleanString(process.env.SMARTINVENTORY_MONITOR_URL_GIST)
  const gistRawUrl = configuredGistRawUrl || (envUrl ? '' : DEFAULT_MONITOR_URL_GIST)

  if (gistRawUrl) {
    const gistUrl = await resolveMonitorUrlFromGist(gistRawUrl, Math.min(timeoutMs, 5000))
    if (gistUrl) return { url: gistUrl, source: 'gist', warnings }
    warnings.push('라즈베리 터널 Gist에서 현재 URL을 가져오지 못해 SMARTINVENTORY_MONITOR_URL로 시도합니다.')
  }

  if (envUrl) return { url: envUrl, source: 'env', warnings }
  return null
}

async function monitorRequest<T>(
  base: MonitorBase,
  path: string,
  init: RequestInit = {},
  timeoutMs = requestTimeoutMs(),
): Promise<T> {
  const url = new URL(path, `${base.url}/`)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url.toString(), {
      ...init,
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers || {}),
      },
      signal: controller.signal,
    })

    const text = await response.text()
    const payload = text ? JSON.parse(text) : {}
    if (!response.ok) {
      const message =
        payload && typeof payload === 'object' && 'error' in payload
          ? String((payload as RawRecord).error || '')
          : ''
      const tunnelHint = TUNNEL_DOWN_STATUS.has(response.status) ? ' 라즈베리 터널 URL을 확인해 주세요.' : ''
      throw new Error(message || `라즈베리 서버 응답 실패 HTTP ${response.status}.${tunnelHint}`)
    }
    return payload as T
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('라즈베리 서버 응답을 JSON으로 읽지 못했습니다.')
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('라즈베리 서버 응답 시간이 초과되었습니다.')
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

function normalizeChannelRow(channel: SmartInventoryChannel, row: RawRecord, index: number): SmartInventoryChannelRow {
  const productId = String(row.product_id ?? row.productId ?? '').trim()
  const rawItemId = row.item_id ?? row.itemId
  const itemId = rawItemId === null || rawItemId === undefined || rawItemId === '' ? null : String(rawItemId)
  const productUrl = stringOrNull(row.product_url ?? row.productUrl)
  const name = cleanString(row.name)
  const productKey = `${productId}|${itemId || ''}`
  const identityKey = productId ? `id:${productId}|item:${itemId || ''}` : productUrl ? `url:${productUrl}` : `name:${name}`

  return {
    serial: index,
    channel,
    productKey,
    identityKey,
    productId,
    itemId,
    name,
    imageUrl: stringOrNull(row.image_url ?? row.imageUrl),
    productUrl,
    stock: numberOrNull(row.stock),
    todaySales: numberOrNull(row.today_sales ?? row.todaySales),
    sales: numberOrNull(row.sales),
    price: numberOrNull(row.price),
    syncedAt: stringOrNull(row.recorded_at ?? row.synced_at ?? row.syncedAt),
    linkedMasterId: null,
    linkedMasterName: null,
    linkMultiplier: null,
  }
}

function normalizeLink(row: RawRecord): RawMasterLink | null {
  const rawChannel = cleanString(row.channel).toLowerCase()
  if (rawChannel !== 'naver' && rawChannel !== 'coupang') return null

  const productKey = cleanString(row.product_key ?? row.productKey)
  const masterId = numberOrNull(row.master_id ?? row.masterId)
  if (!productKey || masterId === null) return null

  return {
    channel: rawChannel,
    productKey,
    masterId,
    multiplier: positiveInt(row.multiplier, 1),
  }
}

function makeEmptyMaster(row: RawRecord): SmartInventoryMasterRow | null {
  const id = numberOrNull(row.id)
  if (id === null) return null
  const unitCost = numberOrNull(row.unit_cost ?? row.unitCost)

  return {
    id,
    imageUrl: null,
    name: cleanString(row.name),
    unitCost,
    naverPrice: null,
    coupangPrice: null,
    naverStock: null,
    coupangStock: null,
    totalStock: null,
    stockCost: null,
    naverTodaySales: null,
    coupangTodaySales: null,
    totalTodaySales: null,
    todayRevenue: null,
    naverSales: null,
    coupangSales: null,
    totalSales: null,
    linkCount: 0,
    naverUrl: null,
    coupangUrl: null,
    representativeChannel: stringOrNull(row.representative_channel ?? row.representativeChannel),
    representativeProductKey: stringOrNull(row.representative_product_key ?? row.representativeProductKey),
    memo: stringOrNull(row.memo),
    updatedAt: stringOrNull(row.updated_at ?? row.updatedAt),
    naverInboundPending: null,
    coupangInboundPending: null,
    totalInboundPending: null,
    linked: [],
  }
}

function applyMultiplier(value: number | null, multiplier: number): number | null {
  return value === null ? null : value * multiplier
}

function accumulate(current: number | null, addition: number | null): number | null {
  if (current === null && addition === null) return null
  return (current ?? 0) + (addition ?? 0)
}

function sumNullable(...values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value !== null)
  if (!present.length) return null
  return present.reduce((sum, value) => sum + value, 0)
}

function applyLinkToMaster(master: SmartInventoryMasterRow, channel: SmartInventoryChannel, channelRow: SmartInventoryChannelRow, link: RawMasterLink) {
  const multiplier = Math.max(1, link.multiplier)
  master.linked.push({
    channel,
    productKey: link.productKey,
    name: channelRow.name,
    imageUrl: channelRow.imageUrl,
    productUrl: channelRow.productUrl,
    stock: channelRow.stock,
    sales: channelRow.sales,
    todaySales: channelRow.todaySales,
    price: channelRow.price,
    multiplier,
    syncedAt: channelRow.syncedAt,
  })

  const stockAdd = applyMultiplier(channelRow.stock, multiplier)
  const salesAdd = applyMultiplier(channelRow.sales, multiplier)
  const todaySalesAdd = applyMultiplier(channelRow.todaySales, multiplier)

  if (channel === 'naver') {
    master.naverStock = accumulate(master.naverStock, stockAdd)
    master.naverSales = accumulate(master.naverSales, salesAdd)
    master.naverTodaySales = accumulate(master.naverTodaySales, todaySalesAdd)
    if (!master.naverUrl && channelRow.productUrl) master.naverUrl = channelRow.productUrl
  } else {
    master.coupangStock = accumulate(master.coupangStock, stockAdd)
    master.coupangSales = accumulate(master.coupangSales, salesAdd)
    master.coupangTodaySales = accumulate(master.coupangTodaySales, todaySalesAdd)
    if (!master.coupangUrl && channelRow.productUrl) master.coupangUrl = channelRow.productUrl
  }
}

function finalizeMaster(master: SmartInventoryMasterRow) {
  if (master.linked.length) {
    const representative =
      master.linked.find(
        (link) =>
          link.channel === master.representativeChannel &&
          link.productKey === master.representativeProductKey,
      ) ||
      master.linked.find((link) => Boolean(link.imageUrl)) ||
      master.linked[0]

    master.imageUrl = representative?.imageUrl || null

    const naverPrice = master.linked.find((link) => link.channel === 'naver' && link.price !== null)?.price ?? null
    const coupangPrice = master.linked.find((link) => link.channel === 'coupang' && link.price !== null)?.price ?? null
    master.naverPrice = representative?.channel === 'naver' && representative.price !== null ? representative.price : naverPrice
    master.coupangPrice = representative?.channel === 'coupang' && representative.price !== null ? representative.price : coupangPrice
  }

  master.totalStock = sumNullable(master.naverStock, master.coupangStock)
  master.totalSales = sumNullable(master.naverSales, master.coupangSales)
  master.totalTodaySales = sumNullable(master.naverTodaySales, master.coupangTodaySales)
  master.linkCount = master.linked.length

  if (master.unitCost !== null && master.totalStock !== null) {
    master.stockCost = master.unitCost * master.totalStock
  }

  let todayRevenue = 0
  for (const link of master.linked) {
    if (link.todaySales === null || link.price === null) continue
    todayRevenue += link.todaySales * link.price
  }
  master.todayRevenue = todayRevenue || null
}

function addInboundPending(rows: SmartInventoryMasterRow[], summaries: RawRecord[]) {
  const pendingByMasterChannel = new Map<string, number>()
  for (const summary of summaries) {
    const masterId = numberOrNull(summary.master_id ?? summary.masterId)
    const channel = cleanString(summary.channel).toLowerCase()
    const pendingQty = numberOrNull(summary.pending_qty ?? summary.pendingQty) ?? 0
    if (masterId === null || (channel !== 'naver' && channel !== 'coupang')) continue
    pendingByMasterChannel.set(`${masterId}:${channel}`, pendingQty)
  }

  for (const row of rows) {
    const naverPending = pendingByMasterChannel.get(`${row.id}:naver`) ?? 0
    const coupangPending = pendingByMasterChannel.get(`${row.id}:coupang`) ?? 0
    row.naverInboundPending = naverPending || null
    row.coupangInboundPending = coupangPending || null
    row.totalInboundPending = naverPending + coupangPending || null
  }
}

function sumRows(rows: SmartInventoryMasterRow[], selector: (row: SmartInventoryMasterRow) => number | null): number {
  return rows.reduce((sum, row) => sum + (selector(row) ?? 0), 0)
}

async function buildDashboard(base: MonitorBase): Promise<SmartInventoryDashboardPayload> {
  const warnings = [...base.warnings]
  const [inventoryPayload, mastersResult, linksResult, inboundsResult, healthResult] = await Promise.all([
    monitorRequest<RawRecord>(base, '/inventory'),
    monitorRequest<RawRecord>(base, '/masters').catch((error) => {
      warnings.push(`마스터 상품을 불러오지 못했습니다: ${error instanceof Error ? error.message : String(error)}`)
      return {}
    }),
    monitorRequest<RawRecord>(base, '/master-links').catch((error) => {
      warnings.push(`마스터 링크를 불러오지 못했습니다: ${error instanceof Error ? error.message : String(error)}`)
      return {}
    }),
    monitorRequest<RawRecord>(base, '/stock-inbounds').catch((error) => {
      warnings.push(`입고대기 정보를 불러오지 못했습니다: ${error instanceof Error ? error.message : String(error)}`)
      return {}
    }),
    monitorRequest<Record<string, unknown>>(base, '/health').catch(() => null),
  ])

  const channels: Record<SmartInventoryChannel, SmartInventoryChannelRow[]> = {
    naver: rawArray(inventoryPayload, 'naver').map((row, index) => normalizeChannelRow('naver', row, index + 1)),
    coupang: rawArray(inventoryPayload, 'coupang').map((row, index) => normalizeChannelRow('coupang', row, index + 1)),
  }
  const masterRows = rawArray(mastersResult, 'masters').map(makeEmptyMaster).filter((row): row is SmartInventoryMasterRow => row !== null)
  const masterById = new Map(masterRows.map((row) => [row.id, row]))
  const rawLinks = rawArray(linksResult, 'links').map(normalizeLink).filter((link): link is RawMasterLink => link !== null)
  const masterNameById = new Map(masterRows.map((row) => [row.id, row.name]))
  const linksByChannelKey = new Map<string, RawMasterLink>()

  for (const link of rawLinks) {
    linksByChannelKey.set(`${link.channel}:${link.productKey}`, link)
  }

  const unlinkedRows: Record<SmartInventoryChannel, SmartInventoryChannelRow[]> = {
    naver: [],
    coupang: [],
  }

  for (const channel of CHANNELS) {
    for (const row of channels[channel]) {
      const link =
        linksByChannelKey.get(`${channel}:${row.identityKey}`) ||
        linksByChannelKey.get(`${channel}:${row.productKey}`)

      if (!link || !masterById.has(link.masterId)) {
        unlinkedRows[channel].push(row)
        continue
      }

      row.linkedMasterId = link.masterId
      row.linkedMasterName = masterNameById.get(link.masterId) ?? null
      row.linkMultiplier = link.multiplier
      applyLinkToMaster(masterById.get(link.masterId)!, channel, row, link)
    }
  }

  for (const row of masterRows) finalizeMaster(row)

  const inboundItems = rawArray(inboundsResult, 'items')
  const inboundSummaries = rawArray(inboundsResult, 'summaries')
  addInboundPending(masterRows, inboundSummaries)

  const sortedRows = [...masterRows].sort((a, b) => a.name.localeCompare(b.name, 'ko') || a.id - b.id)
  const unlinked = {
    naver: unlinkedRows.naver.length,
    coupang: unlinkedRows.coupang.length,
  }
  const syncedAt = new Date().toISOString()

  return {
    configured: true,
    monitorUrl: base.url,
    monitorSource: base.source,
    health: healthResult,
    rows: sortedRows,
    channels,
    unlinked,
    unlinkedRows,
    stockInbounds: {
      items: inboundItems,
      summaries: inboundSummaries,
    },
    syncedAt,
    cache: { hit: false, cachedAt: null, refreshing: false },
    warnings,
    summary: {
      masterCount: sortedRows.length,
      linkedCount: sumRows(sortedRows, (row) => row.linkCount),
      naverProducts: channels.naver.length,
      coupangProducts: channels.coupang.length,
      unlinkedProducts: unlinked.naver + unlinked.coupang,
      naverStock: sumRows(sortedRows, (row) => row.naverStock),
      coupangStock: sumRows(sortedRows, (row) => row.coupangStock),
      totalStock: sumRows(sortedRows, (row) => row.totalStock),
      totalInboundPending: sumRows(sortedRows, (row) => row.totalInboundPending),
      stockCost: sumRows(sortedRows, (row) => row.stockCost),
      todaySales: sumRows(sortedRows, (row) => row.totalTodaySales),
      todayRevenue: sumRows(sortedRows, (row) => row.todayRevenue),
    },
  }
}

async function fetchSmartInventoryDashboardLive(): Promise<SmartInventoryDashboardPayload> {
  const base = await resolveMonitorBase()
  if (!base) {
    const syncedAt = new Date().toISOString()
    return {
      configured: false,
      monitorUrl: null,
      monitorSource: null,
      health: null,
      rows: [],
      channels: { naver: [], coupang: [] },
      unlinked: { naver: 0, coupang: 0 },
      unlinkedRows: { naver: [], coupang: [] },
      stockInbounds: { items: [], summaries: [] },
      syncedAt,
      cache: { hit: false, cachedAt: null, refreshing: false },
      warnings: ['라즈베리 모니터 서버 주소를 확인하지 못했습니다. SMARTINVENTORY_MONITOR_URL 또는 SMARTINVENTORY_MONITOR_URL_GIST를 확인해 주세요.'],
      summary: {
        masterCount: 0,
        linkedCount: 0,
        naverProducts: 0,
        coupangProducts: 0,
        unlinkedProducts: 0,
        naverStock: 0,
        coupangStock: 0,
        totalStock: 0,
        totalInboundPending: 0,
        stockCost: 0,
        todaySales: 0,
        todayRevenue: 0,
      },
    }
  }

  return buildDashboard(base)
}

async function refreshDashboardCache(): Promise<SmartInventoryDashboardPayload> {
  const payload = await fetchSmartInventoryDashboardLive()
  const cachedAt = new Date().toISOString()
  dashboardCache = { payload, cachedAt }
  return withCacheMeta(payload, { hit: false, cachedAt, refreshing: false })
}

export async function fetchSmartInventoryDashboard(options: { refresh?: boolean } = {}): Promise<SmartInventoryDashboardPayload> {
  if (!options.refresh && dashboardCache) {
    if (!dashboardRefreshPromise) {
      dashboardRefreshPromise = refreshDashboardCache().catch((error) => {
        console.error('[smart-inventory] background cache refresh failed', error)
        if (dashboardCache) return dashboardCache.payload
        throw error
      }).finally(() => {
        dashboardRefreshPromise = null
      })
    }

    return withCacheMeta(dashboardCache.payload, {
      hit: true,
      cachedAt: dashboardCache.cachedAt,
      refreshing: true,
    })
  }

  try {
    return await refreshDashboardCache()
  } catch (error) {
    if (!dashboardCache) throw error
    return withCacheMeta(
      {
        ...dashboardCache.payload,
        warnings: [
          ...dashboardCache.payload.warnings,
          `새 재고 정보를 가져오지 못해 캐시 데이터를 표시합니다. ${error instanceof Error ? error.message : String(error)}`,
        ],
      },
      { hit: true, cachedAt: dashboardCache.cachedAt, refreshing: false },
    )
  }
}

export async function syncSmartInventory(): Promise<{ result: Record<string, unknown>; dashboard: SmartInventoryDashboardPayload }> {
  const base = await resolveMonitorBase(requestTimeoutMs(120000))
  if (!base) {
    throw new Error('SMARTINVENTORY_MONITOR_URL 또는 SMARTINVENTORY_MONITOR_URL_GIST 환경변수가 필요합니다.')
  }

  const result = await monitorRequest<Record<string, unknown>>(
    base,
    '/sync/inventory?wait=1',
    { method: 'POST' },
    requestTimeoutMs(120000),
  )
  const dashboard = await refreshDashboardCache()
  return { result, dashboard }
}
