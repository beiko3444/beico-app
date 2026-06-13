export type NaverSalesMetricTotals = {
  orders: number
  quantity: number
  payAmount: number
  refundAmount: number
  netAmount: number
  averageOrderAmount: number
}

export type NaverSalesProductSummary = {
  channelProductNo: string
  sellerManagementCode: string
  productName: string
  naverProductName: string
  orders: number
  quantity: number
  payAmount: number
  refundAmount: number
  netAmount: number
  salesShare: number
}

export type NaverSalesDateSummary = {
  saleDate: string
  orders: number
  quantity: number
  payAmount: number
  refundAmount: number
  netAmount: number
}

export type NaverInsightRow = {
  saleDate: string
  category: string
  label: string
  detail: string
  interactions: number
  inflow: number
  orders: number
  quantity: number
  payAmount: number
  refundAmount: number
  netAmount: number
  raw: unknown
}

export function buildNaverSalesDashboard(rows: unknown[]): {
  totals: NaverSalesMetricTotals
  products: NaverSalesProductSummary[]
  byDate: NaverSalesDateSummary[]
}

export function normalizeNaverInsightRows(saleDate: string, category: string, rows: unknown): NaverInsightRow[]

export function summarizeInsightRows(rows: unknown[], limit?: number): NaverInsightRow[]
