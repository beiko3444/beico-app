import {
  fetchSmartInventoryDashboard,
  monitorRequest,
  resolveMonitorCandidates,
  type SmartInventoryMasterRow,
} from '@/lib/smartInventoryClient'
import { buildProductHistorySeries } from '@/lib/smartInventoryHistory.mjs'

type RawRecord = Record<string, unknown>
type InventoryHistoryLink = {
  channel: 'naver' | 'coupang'
  productKey: string
  multiplier: number
}

export type SmartInventoryProductHistoryPayload = ReturnType<typeof buildProductHistorySeries> & {
  product: {
    id: number
    name: string
    imageUrl: string | null
    totalStock: number | null
    naverStock: number | null
    coupangStock: number | null
  }
  range: {
    days: number
    startDate: string
    endDate: string
    selectedDate: string
  }
  linked: Array<{
    channel: 'naver' | 'coupang'
    name: string
    multiplier: number
  }>
}

export class SmartInventoryProductHistoryError extends Error {
  status: number

  constructor(message: string, status = 502) {
    super(message)
    this.name = 'SmartInventoryProductHistoryError'
    this.status = status
  }
}

function kstToday() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function shiftDate(date: string, amount: number) {
  const [year, month, day] = date.split('-').map(Number)
  const value = new Date(Date.UTC(year, month - 1, day + amount))
  return value.toISOString().slice(0, 10)
}

function validDate(value: string | null | undefined) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null
  const date = String(value)
  return shiftDate(date, 0) === date ? date : null
}

function historyLinks(master: SmartInventoryMasterRow): InventoryHistoryLink[] {
  return master.linked.map((link) => ({
    channel: link.channel,
    productKey: link.productKey,
    multiplier: Math.max(1, link.multiplier),
  }))
}

export async function fetchSmartInventoryProductHistory(options: {
  masterId: number
  days?: number
  selectedDate?: string | null
}): Promise<SmartInventoryProductHistoryPayload> {
  const masterId = Math.trunc(Number(options.masterId))
  if (!Number.isFinite(masterId) || masterId <= 0) {
    throw new SmartInventoryProductHistoryError('상품 번호가 올바르지 않습니다.', 400)
  }

  const days = Math.max(7, Math.min(365, Math.trunc(Number(options.days) || 30)))
  const endDate = kstToday()
  const startDate = shiftDate(endDate, -(days - 1))
  const requestedDate = validDate(options.selectedDate)
  const selectedDate =
    requestedDate && requestedDate >= startDate && requestedDate <= endDate
      ? requestedDate
      : endDate

  const dashboard = await fetchSmartInventoryDashboard()
  const master = dashboard.rows.find((row) => row.id === masterId)
  if (!master) {
    throw new SmartInventoryProductHistoryError('선택한 상품을 찾지 못했습니다.', 404)
  }

  const links = historyLinks(master)
  let dailyRows: RawRecord[] = []
  let eventRows: RawRecord[] = []

  if (links.length) {
    const candidates = await resolveMonitorCandidates(15_000)
    if (!candidates.length) {
      throw new SmartInventoryProductHistoryError(
        '라즈베리 재고 서버 주소를 찾지 못했습니다. 잠시 후 다시 시도해 주세요.',
      )
    }
    let lastError: unknown = null

    for (const base of candidates) {
      try {
        const [seriesPayload, dayPayload] = await Promise.all([
          monitorRequest<RawRecord>(
            base,
            `/sales/series?start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`,
            {},
            15_000,
          ),
          monitorRequest<RawRecord>(
            base,
            `/sales?date=${encodeURIComponent(selectedDate)}`,
            {},
            15_000,
          ),
        ])
        if (!Array.isArray(seriesPayload.rows) || !Array.isArray(dayPayload.sales)) {
          throw new Error('라즈베리 재고 서버의 응답 형식이 올바르지 않습니다.')
        }
        dailyRows = seriesPayload.rows.filter(
          (row): row is RawRecord => Boolean(row && typeof row === 'object'),
        )
        eventRows = dayPayload.sales.filter(
          (row): row is RawRecord => Boolean(row && typeof row === 'object'),
        )
        lastError = null
        break
      } catch (error) {
        lastError = error
      }
    }

    if (lastError) {
      throw new SmartInventoryProductHistoryError(
        `재고차감 이력을 불러오지 못했습니다. ${lastError instanceof Error ? lastError.message : String(lastError)}`,
      )
    }
  }

  const series = buildProductHistorySeries({
    links,
    dailyRows,
    eventRows,
    startDate,
    endDate,
    selectedDate,
  })

  return {
    product: {
      id: master.id,
      name: master.name,
      imageUrl: master.imageUrl,
      totalStock: master.totalStock,
      naverStock: master.naverStock,
      coupangStock: master.coupangStock,
    },
    range: { days, startDate, endDate, selectedDate },
    linked: master.linked.map((link) => ({
      channel: link.channel,
      name: link.name,
      multiplier: link.multiplier,
    })),
    ...series,
  }
}
