import { monitorRequest, requestTimeoutMs, resolveMonitorBase } from '@/lib/smartInventoryClient'
import { defaultDateRange, normalizeYmdDate } from '@/lib/naverSales'
import { buildNaverSalesDashboard, summarizeInsightRows } from '@/lib/naverSalesAnalytics.mjs'

type RawRecord = Record<string, unknown>

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

export async function fetchNaverSalesRemoteDashboard(startText: string, endText: string): Promise<NaverSalesRemoteDashboard> {
  const range = normalizeRange(startText, endText)
  const base = await resolveMonitorBase(requestTimeoutMs(90000))
  const now = new Date().toISOString()

  if (!base) {
    return emptyDashboard(range, now, ['라즈베리 주소를 찾지 못했습니다. SMARTINVENTORY_MONITOR_URL 또는 SMARTINVENTORY_MONITOR_URL_GIST를 확인해 주세요.'])
  }

  const refresh = process.env.NAVER_SALES_REMOTE_REFRESH === '0' ? '0' : '1'
  const query = `period_days=${range.periodDays}&refresh=${refresh}`
  const warnings = [...base.warnings]

  const [revenueResult, keywordResult] = await Promise.allSettled([
    monitorRequest<RawRecord>(base, `/revenue?${query}`, {}, requestTimeoutMs(90000)),
    monitorRequest<RawRecord>(base, `/keywords?${query}`, {}, requestTimeoutMs(90000)),
  ])

  const revenuePayload = settledValue(revenueResult, '매출 통계', warnings)
  const keywordPayload = settledValue(keywordResult, '검색어 통계', warnings)
  const dashboard = buildNaverSalesDashboard(extractRevenueProducts(revenuePayload, range.end))
  const keywords = summarizeInsightRows(extractKeywordRows(keywordPayload, range.end), 15)
  const generatedAt = readGeneratedAt(revenuePayload) || readGeneratedAt(keywordPayload) || now

  return {
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
