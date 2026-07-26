const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function numberValue(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function dateToUtc(date) {
  if (!DATE_PATTERN.test(String(date || ''))) return null
  const [year, month, day] = String(date).split('-').map(Number)
  const value = new Date(Date.UTC(year, month - 1, day))
  if (
    value.getUTCFullYear() !== year ||
    value.getUTCMonth() !== month - 1 ||
    value.getUTCDate() !== day
  ) {
    return null
  }
  return value
}

function utcToDate(value) {
  return value.toISOString().slice(0, 10)
}

function datesBetween(startDate, endDate) {
  const start = dateToUtc(startDate)
  const end = dateToUtc(endDate)
  if (!start || !end || start > end) return []

  const result = []
  for (let cursor = start.getTime(); cursor <= end.getTime(); cursor += 86_400_000) {
    result.push(utcToDate(new Date(cursor)))
  }
  return result
}

function pointLabel(date) {
  return `${date.slice(5, 7)}.${date.slice(8, 10)}`
}

function rawRowKey(row) {
  const channel = String(row?.channel || '').trim().toLowerCase()
  const productId = String(row?.product_id ?? row?.productId ?? '').trim()
  const itemValue = row?.item_id ?? row?.itemId
  const itemId = itemValue === null || itemValue === undefined ? '' : String(itemValue).trim()
  if ((channel !== 'naver' && channel !== 'coupang') || !productId) return null
  return `${channel}:${productId}|${itemId}`
}

export function parseInventoryProductKey(productKey) {
  const value = String(productKey || '').trim()
  if (!value || value.startsWith('url:') || value.startsWith('name:')) return null

  const identityMatch = value.match(/^id:([^|]+)\|item:(.*)$/)
  if (identityMatch) {
    return {
      productId: identityMatch[1].trim(),
      itemId: identityMatch[2].trim(),
    }
  }

  const separator = value.indexOf('|')
  if (separator < 0) return null
  const productId = value.slice(0, separator).trim()
  if (!productId) return null
  return {
    productId,
    itemId: value.slice(separator + 1).trim(),
  }
}

function linkMap(links) {
  const result = new Map()
  for (const link of links || []) {
    const channel = String(link?.channel || '').trim().toLowerCase()
    if (channel !== 'naver' && channel !== 'coupang') continue
    const parsed = parseInventoryProductKey(link?.productKey)
    if (!parsed) continue
    result.set(`${channel}:${parsed.productId}|${parsed.itemId}`, {
      channel,
      multiplier: Math.max(1, Math.trunc(numberValue(link?.multiplier) || 1)),
    })
  }
  return result
}

export function buildProductHistorySeries({
  links,
  dailyRows,
  eventRows,
  startDate,
  endDate,
  selectedDate,
}) {
  const linked = linkMap(links)
  const daily = datesBetween(startDate, endDate).map((date) => ({
    date,
    label: pointLabel(date),
    naver: 0,
    coupang: 0,
    total: 0,
  }))
  const dailyByDate = new Map(daily.map((point) => [point.date, point]))

  for (const row of dailyRows || []) {
    const match = linked.get(rawRowKey(row))
    const date = String(row?.date || '').slice(0, 10)
    const point = dailyByDate.get(date)
    if (!match || !point) continue
    const quantity = Math.max(0, Math.trunc(numberValue(row?.qty_sold ?? row?.qtySold))) * match.multiplier
    point[match.channel] += quantity
    point.total += quantity
  }

  const hourly = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, '0')}시`,
    naver: 0,
    coupang: 0,
    total: 0,
  }))

  for (const row of eventRows || []) {
    const match = linked.get(rawRowKey(row))
    if (!match) continue
    const recordedAt = String(row?.recorded_at ?? row?.recordedAt ?? '')
    if (recordedAt.slice(0, 10) !== selectedDate) continue
    const hourMatch = recordedAt.match(/[T ](\d{2}):/)
    const hour = hourMatch ? Number(hourMatch[1]) : -1
    if (hour < 0 || hour > 23) continue
    const quantity = Math.max(0, Math.trunc(numberValue(row?.qty_sold ?? row?.qtySold))) * match.multiplier
    hourly[hour][match.channel] += quantity
    hourly[hour].total += quantity
  }

  const periodTotal = daily.reduce((sum, point) => sum + point.total, 0)
  const selectedDayTotal = hourly.reduce((sum, point) => sum + point.total, 0)
  const peakDate = daily.reduce((peak, point) => point.total > peak.total ? point : peak, daily[0] || null)
  const peakHour = hourly.reduce((peak, point) => point.total > peak.total ? point : peak, hourly[0] || null)

  return {
    daily,
    hourly,
    summary: {
      periodTotal,
      selectedDayTotal,
      peakDate: peakDate?.total ? peakDate : null,
      peakHour: peakHour?.total ? peakHour : null,
    },
  }
}
