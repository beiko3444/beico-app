import { monitorRequest, requestTimeoutMs, resolveMonitorBase } from '@/lib/smartInventoryClient'
import { defaultDateRange, normalizeYmdDate } from '@/lib/naverSales'
import { buildNaverSalesDashboard, summarizeInsightRows } from '@/lib/naverSalesAnalytics.mjs'

type RawRecord = Record<string, unknown>
type NaverSalesRemoteDashboardOptions = {
  refresh?: boolean
  timeoutMs?: number
}

export type NaverSalesRemoteDashboard = {
  configured: boolean
  monitorUrl: string | null
  monitorSource: 'env' | 'gist' | null
  range: { start: string; end: string; periodDays: number }
  totals: ReturnType<typeof buildNaverSalesDashboard>['totals']
  products: ReturnType<typeof buildNaverSalesDashboard>['products']
  byDate: ReturnType<typeof buildNaverSalesDashboard>['byDate']
  keywords: ReturnType<typeof summarizeInsightRows>
  channels: ReturnType<typeof summarizeInsightRows>
  realtimeSnapshot: {
    payAmount: number
    orders: number
    quantity: number
    collectedAt: string
  } | null
  latestLog: {
    status: string
    sourceDevice: string
    createdAt: string
    rowsUpserted: number
    errorMessage?: string
  } | null
  logs: Array<{
    id: string
    status: string
    rowsUpserted: number
    createdAt: string
  }>
  warnings: string[]
}

type DashboardCacheEntry = {
  payload: NaverSalesRemoteDashboard
  cachedAt: string
}

const dashboardCache = new Map<string, DashboardCacheEntry>()
const DASHBOARD_CACHE_LIMIT = 8

export async function fetchNaverSalesRemoteDashboard(
  startText: string,
  endText: string,
  options: NaverSalesRemoteDashboardOptions = {},
): Promise<NaverSalesRemoteDashboard> {
  const range = normalizeRange(startText, endText)
  const cacheKey = `${range.start}:${range.end}`
  const cached = dashboardCache.get(cacheKey)
  if (cached && options.refresh !== true) {
    return fromCache(cached)
  }

  const timeoutMs = options.timeoutMs ?? requestTimeoutMs()
  const base = await resolveMonitorBase(timeoutMs)
  const now = new Date().toISOString()

  if (!base) {
    return emptyDashboard(range, now, ['라즈베리 주소를 찾지 못했습니다. SMARTINVENTORY_MONITOR_URL 또는 SMARTINVENTORY_MONITOR_URL_GIST를 확인해 주세요.'])
  }

  const shouldRefresh = options.refresh ?? process.env.NAVER_SALES_REMOTE_REFRESH === '1'
  const refresh = shouldRefresh ? '1' : '0'
  const query = `period_days=${range.periodDays}&refresh=${refresh}`
  const warnings = [...base.warnings]

  const [revenueResult, keywordResult] = await Promise.allSettled([
    monitorRequest<RawRecord>(base, `/revenue?${query}`, {}, timeoutMs),
    monitorRequest<RawRecord>(base, `/keywords?${query}`, {}, timeoutMs),
  ])

  const revenuePayload = settledValue(revenueResult, '매출 통계', warnings)
  const keywordPayload = settledValue(keywordResult, '검색어 통계', warnings)
  if (!revenuePayload && !keywordPayload && cached) {
    return fromCache(cached, warnings)
  }

  const dashboard = buildNaverSalesDashboard(extractRevenueProducts(revenuePayload, range.end))
  const keywords = summarizeInsightRows(extractKeywordRows(keywordPayload, range.end), 15)
  const generatedAt = readGeneratedAt(revenuePayload) || readGeneratedAt(keywordPayload) || now

  const payload = {
    configured: true,
    monitorUrl: base.url,
    monitorSource: base.source,
    range,
    totals: dashboard.totals,
    products: dashboard.products,
    byDate: dashboard.byDate,
    keywords,
    channels: [],
    realtimeSnapshot: null,
    latestLog: {
      status: warnings.length ? 'WARNING' : 'LIVE',
      sourceDevice: 'raspberry-pi',
      createdAt: generatedAt,
      rowsUpserted: dashboard.products.length + keywords.length,
      errorMessage: warnings.join(' / ') || undefined,
    },
    logs: [
      {
        id: 'live',
        status: warnings.length ? 'WARNING' : 'LIVE',
        rowsUpserted: dashboard.products.length + keywords.length,
        createdAt: generatedAt,
      },
    ],
    warnings,
  }
  cacheDashboard(cacheKey, payload)
  return payload
}

function cacheDashboard(key: string, payload: NaverSalesRemoteDashboard) {
  dashboardCache.set(key, { payload, cachedAt: new Date().toISOString() })
  while (dashboardCache.size > DASHBOARD_CACHE_LIMIT) {
    const oldestKey = dashboardCache.keys().next().value
    if (!oldestKey) break
    dashboardCache.delete(oldestKey)
  }
}

function fromCache(entry: DashboardCacheEntry, warnings: string[] = []): NaverSalesRemoteDashboard {
  const cacheMessage = `캐시된 통계를 표시합니다. 저장 시각: ${formatCacheTime(entry.cachedAt)}`
  const nextWarnings = warnings.length
    ? [...warnings, ...entry.payload.warnings, cacheMessage]
    : [...entry.payload.warnings]
  return {
    ...entry.payload,
    latestLog: entry.payload.latestLog
      ? {
          ...entry.payload.latestLog,
          status: warnings.length ? 'CACHE_WARNING' : 'CACHE',
        }
      : entry.payload.latestLog,
    logs: entry.payload.logs.map((log) => ({ ...log })),
    warnings: nextWarnings,
  }
}

function formatCacheTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function normalizeRange(startText: string, endText: string) {
  const fallback = defaultDateRange(30)
  const start = normalizeYmdDate(startText) || fallback.start
  const end = normalizeYmdDate(endText) || fallback.end
  const startMs = Date.parse(`${start}T00:00:00.000Z`)
  const endMs = Date.parse(`${end}T00:00:00.000Z`)
  const periodDays = Number.isFinite(startMs) && Number.isFinite(endMs) && startMs <= endMs
    ? Math.min(365, Math.max(1, Math.round((endMs - startMs) / 86_400_000) + 1))
    : 30
  return { start, end, periodDays }
}

function emptyDashboard(range: { start: string; end: string; periodDays: number }, now: string, warnings: string[]): NaverSalesRemoteDashboard {
  const dashboard = buildNaverSalesDashboard([])
  return {
    configured: false,
    monitorUrl: null,
    monitorSource: null,
    range,
    totals: dashboard.totals,
    products: [],
    byDate: [],
    keywords: [],
    channels: [],
    realtimeSnapshot: null,
    latestLog: {
      status: 'ERROR',
      sourceDevice: 'raspberry-pi',
      createdAt: now,
      rowsUpserted: 0,
      errorMessage: warnings.join(' / '),
    },
    logs: [],
    warnings,
  }
}

function settledValue(result: PromiseSettledResult<RawRecord>, label: string, warnings: string[]) {
  if (result.status === 'fulfilled') return result.value
  warnings.push(`${label}을 라즈베리에서 가져오지 못했습니다: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`)
  return null
}

function extractRevenueProducts(payload: RawRecord | null, saleDate: string) {
  const products = rawArray(readSnapshot(payload), 'products')
  return products
    .filter((row) => {
      const channel = String(row.channel || '').toLowerCase()
      return channel.includes('네이버') || channel.includes('naver')
    })
    .map((row) => ({
      saleDate,
      channelProductNo: stringValue(row.product_id ?? row.productId ?? row.name),
      sellerManagementCode: '',
      productName: stringValue(row.name),
      dbProductName: null,
      orders: numberValue(row.orders),
      quantity: numberValue(row.orders),
      payAmount: numberValue(row.gross ?? row.payAmount),
      refundAmount: numberValue(row.refund ?? row.refundAmount),
      netAmount: numberValue(row.net ?? row.netAmount),
    }))
}

function extractKeywordRows(payload: RawRecord | null, saleDate: string) {
  const rows = rawArray(readSnapshot(payload), 'rows')
  return rows.map((row) => ({
    saleDate,
    category: 'KEYWORD',
    label: stringValue(row.keyword ?? row.label),
    detail: stringValue(row.source),
    interactions: numberValue(row.inflow ?? row.interactions),
    inflow: numberValue(row.inflow),
    orders: numberValue(row.orders),
    quantity: 0,
    payAmount: numberValue(row.pay_amount ?? row.payAmount),
    refundAmount: 0,
    netAmount: numberValue(row.pay_amount ?? row.payAmount),
    raw: row,
  }))
}

function readSnapshot(payload: RawRecord | null): RawRecord | null {
  const snapshot = payload && typeof payload.snapshot === 'object' && payload.snapshot ? payload.snapshot : null
  return snapshot as RawRecord | null
}

function readGeneratedAt(payload: RawRecord | null) {
  const snapshot = readSnapshot(payload)
  return stringValue(snapshot?.generated_at ?? snapshot?.generatedAt)
}

function rawArray(payload: RawRecord | null, key: string): RawRecord[] {
  const value = payload?.[key]
  return Array.isArray(value) ? value.filter((row): row is RawRecord => row && typeof row === 'object' && !Array.isArray(row)) : []
}

function stringValue(value: unknown) {
  return value === null || value === undefined ? '' : String(value).trim()
}

function numberValue(value: unknown) {
  if (value === null || value === undefined || value === '') return 0
  const parsed = Number(String(value).replace(/,/g, ''))
  return Number.isFinite(parsed) ? Math.round(parsed) : 0
}
