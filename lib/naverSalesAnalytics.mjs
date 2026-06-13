export function buildNaverSalesDashboard(rows) {
  const products = new Map()
  const dates = new Map()
  const totals = createTotals()

  for (const row of Array.isArray(rows) ? rows : []) {
    const saleDate = toYmd(row.saleDate)
    const key = String(row.channelProductNo || '').trim()
    if (!saleDate || !key) continue

    const orders = toInt(row.orders)
    const quantity = toInt(row.quantity)
    const payAmount = toInt(row.payAmount)
    const refundAmount = toInt(row.refundAmount)
    const netAmount = row.netAmount === null || row.netAmount === undefined ? payAmount - refundAmount : toInt(row.netAmount)

    addTotals(totals, { orders, quantity, payAmount, refundAmount, netAmount })

    const product = products.get(key) || {
      channelProductNo: key,
      sellerManagementCode: row.sellerManagementCode || '',
      productName: row.dbProductName || row.productName || '',
      naverProductName: row.productName || '',
      orders: 0,
      quantity: 0,
      payAmount: 0,
      refundAmount: 0,
      netAmount: 0,
      salesShare: 0,
    }
    product.orders += orders
    product.quantity += quantity
    product.payAmount += payAmount
    product.refundAmount += refundAmount
    product.netAmount += netAmount
    products.set(key, product)

    const byDate = dates.get(saleDate) || {
      saleDate,
      orders: 0,
      quantity: 0,
      payAmount: 0,
      refundAmount: 0,
      netAmount: 0,
    }
    byDate.orders += orders
    byDate.quantity += quantity
    byDate.payAmount += payAmount
    byDate.refundAmount += refundAmount
    byDate.netAmount += netAmount
    dates.set(saleDate, byDate)
  }

  totals.averageOrderAmount = totals.orders > 0 ? Math.round(totals.payAmount / totals.orders) : 0

  return {
    totals,
    products: Array.from(products.values())
      .map((product) => ({
        ...product,
        salesShare: totals.netAmount > 0 ? round2((product.netAmount / totals.netAmount) * 100) : 0,
      }))
      .sort((a, b) => b.netAmount - a.netAmount || b.quantity - a.quantity || a.productName.localeCompare(b.productName, 'ko')),
    byDate: Array.from(dates.values()).sort((a, b) => a.saleDate.localeCompare(b.saleDate)),
  }
}

export function normalizeNaverInsightRows(saleDate, category, rows) {
  if (!isYmd(saleDate) || !Array.isArray(rows)) return []
  return rows
    .map((row) => normalizeInsightRow(saleDate, category, row))
    .filter(Boolean)
}

export function summarizeInsightRows(rows, limit = 10) {
  const map = new Map()
  for (const row of Array.isArray(rows) ? rows : []) {
    const category = String(row.category || '').trim()
    const label = String(row.label || '').trim()
    if (!category || !label) continue
    const key = `${category}::${label}`
    const current = map.get(key) || {
      category,
      label,
      interactions: 0,
      inflow: 0,
      orders: 0,
      payAmount: 0,
      refundAmount: 0,
      netAmount: 0,
    }
    current.interactions += toInt(row.interactions)
    current.inflow += toInt(row.inflow)
    current.orders += toInt(row.orders)
    current.payAmount += toInt(row.payAmount)
    current.refundAmount += toInt(row.refundAmount)
    current.netAmount += toInt(row.netAmount)
    map.set(key, current)
  }
  return Array.from(map.values())
    .sort((a, b) => b.payAmount - a.payAmount || b.orders - a.orders || a.label.localeCompare(b.label, 'ko'))
    .slice(0, limit)
}

function normalizeInsightRow(saleDate, category, row) {
  if (!row || typeof row !== 'object') return null
  const record = row
  const label = pickLabel(record)
  if (!label) return null
  const payAmount = toInt(record.payAmount)
  const refundAmount = toInt(record.refundPayAmount ?? record.refundAmount)
  return {
    saleDate,
    category: String(category || '').trim().toUpperCase(),
    label,
    detail: toNonEmptyString(record.channelDetail ?? record.detail),
    interactions: toInt(record.numInteractions ?? record.interactions ?? record.inflowCount),
    inflow: toInt(record.inflowCount ?? record.inflow),
    orders: toInt(record.numPurchases ?? record.orders),
    quantity: toInt(record.productQuantity ?? record.quantity),
    payAmount,
    refundAmount,
    netAmount: toInt(record.netAmount) || payAmount - refundAmount,
    raw: row,
  }
}

function pickLabel(row) {
  const keyword = toNonEmptyString(row.keyword ?? row.refKeyword ?? row.searchKeyword ?? row.keywordName ?? row.query)
  if (keyword) return keyword
  const channelName = toNonEmptyString(row.channelName ?? row.marketingChannelName ?? row.channelGroup)
  const channelDetail = toNonEmptyString(row.channelDetail ?? row.detail)
  if (channelName && channelDetail) return `${channelName} / ${channelDetail}`
  return channelName || channelDetail
}

function createTotals() {
  return {
    orders: 0,
    quantity: 0,
    payAmount: 0,
    refundAmount: 0,
    netAmount: 0,
    averageOrderAmount: 0,
  }
}

function addTotals(target, value) {
  target.orders += value.orders
  target.quantity += value.quantity
  target.payAmount += value.payAmount
  target.refundAmount += value.refundAmount
  target.netAmount += value.netAmount
}

function toYmd(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  if (typeof value === 'string') return value.slice(0, 10)
  return ''
}

function toNonEmptyString(value) {
  if (value === null || value === undefined) return ''
  const text = String(value).trim()
  return text || ''
}

function toInt(value) {
  if (value === null || value === undefined || value === '') return 0
  const parsed = Number(String(value).replace(/,/g, ''))
  return Number.isFinite(parsed) ? Math.round(parsed) : 0
}

function round2(value) {
  return Math.round(value * 100) / 100
}

function isYmd(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}
