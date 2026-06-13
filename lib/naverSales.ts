import type { Prisma } from '@prisma/client'

export type NormalizedNaverSalesRow = {
  saleDate: string
  channelProductNo: string
  sellerManagementCode: string
  productName: string
  orders: number
  quantity: number
  payAmount: number
  refundAmount: number
  netAmount: number
  raw: Prisma.InputJsonValue
}

export function normalizeNaverSalesRows(defaultSaleDate: string, rows: unknown): NormalizedNaverSalesRow[] {
  if (!isYmd(defaultSaleDate) || !Array.isArray(rows)) return []
  return rows
    .map((row) => normalizeNaverSalesRow(defaultSaleDate, row))
    .filter((row): row is NormalizedNaverSalesRow => row !== null)
}

export function normalizeYmdDate(value: unknown) {
  if (typeof value !== 'string') return ''
  const text = value.trim()
  return isYmd(text) ? text : ''
}

export function ymdToUtcDate(value: string) {
  if (!isYmd(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function toYmd(value: Date) {
  return value.toISOString().slice(0, 10)
}

export function defaultDateRange(days = 30) {
  const end = new Date()
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - Math.max(1, days) + 1)
  return {
    start: toYmd(start),
    end: toYmd(end),
  }
}

function normalizeNaverSalesRow(defaultSaleDate: string, row: unknown): NormalizedNaverSalesRow | null {
  if (!row || typeof row !== 'object') return null
  const record = row as Record<string, unknown>
  const saleDate = normalizeYmdDate(record.saleDate) || defaultSaleDate
  const channelProductNo = toNonEmptyString(record.channelProductNo ?? record.productId)
  if (!saleDate || !channelProductNo) return null

  const payAmount = toRoundedInt(record.payAmount)
  const refundAmount = toRoundedInt(record.refundAmount ?? record.refundPayAmount)

  return {
    saleDate,
    channelProductNo,
    sellerManagementCode: normalizeCode(record.sellerManagementCode),
    productName: toNonEmptyString(record.productName ?? record.name),
    orders: toInt(record.orders ?? record.numPurchases),
    quantity: toInt(record.quantity ?? record.productQuantity),
    payAmount,
    refundAmount,
    netAmount: toRoundedInt(record.netAmount) || payAmount - refundAmount,
    raw: normalizeJson(record.raw ?? record),
  }
}

function normalizeJson(value: unknown): Prisma.InputJsonValue {
  try {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue
  } catch {
    return {}
  }
}

function toNonEmptyString(value: unknown) {
  if (value === null || value === undefined) return ''
  const text = String(value).trim()
  return text || ''
}

function normalizeCode(value: unknown) {
  return toNonEmptyString(value).toUpperCase()
}

function toInt(value: unknown) {
  if (value === null || value === undefined || value === '') return 0
  const parsed = Number.parseInt(String(value).replace(/,/g, ''), 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function toRoundedInt(value: unknown) {
  if (value === null || value === undefined || value === '') return 0
  const parsed = Number(String(value).replace(/,/g, ''))
  return Number.isFinite(parsed) ? Math.round(parsed) : 0
}

function isYmd(value: unknown) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}
