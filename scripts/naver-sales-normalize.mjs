export function normalizeNaverSalesRows(saleDate, rows) {
  if (!isYmd(saleDate) || !Array.isArray(rows)) return []

  return rows
    .map((row) => normalizeNaverSalesRow(saleDate, row))
    .filter((row) => row !== null)
}

function normalizeNaverSalesRow(saleDate, row) {
  if (!row || typeof row !== 'object') return null

  const channelProductNo = toNonEmptyString(row.productId ?? row.channelProductNo)
  if (!channelProductNo) return null

  const payAmount = toRoundedInt(row.payAmount)
  const refundAmount = toRoundedInt(row.refundPayAmount ?? row.refundAmount)

  return {
    saleDate,
    channelProductNo,
    sellerManagementCode: normalizeCode(row.sellerManagementCode),
    productName: toNonEmptyString(row.productName ?? row.name),
    orders: toInt(row.numPurchases ?? row.orders),
    quantity: toInt(row.productQuantity ?? row.quantity),
    payAmount,
    refundAmount,
    netAmount: payAmount - refundAmount,
    raw: row,
  }
}

function toNonEmptyString(value) {
  if (value === null || value === undefined) return ''
  const text = String(value).trim()
  return text || ''
}

function normalizeCode(value) {
  return toNonEmptyString(value).toUpperCase()
}

function toInt(value) {
  if (value === null || value === undefined || value === '') return 0
  const parsed = Number.parseInt(String(value).replace(/,/g, ''), 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function toRoundedInt(value) {
  if (value === null || value === undefined || value === '') return 0
  const parsed = Number(String(value).replace(/,/g, ''))
  return Number.isFinite(parsed) ? Math.round(parsed) : 0
}

function isYmd(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}
