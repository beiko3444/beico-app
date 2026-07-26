export type InventoryHistoryLink = {
  channel: 'naver' | 'coupang'
  productKey: string
  multiplier: number
}

export type InventoryHistoryPoint = {
  date: string
  label: string
  naver: number
  coupang: number
  total: number
}

export type InventoryHistoryHourPoint = {
  hour: number
  label: string
  naver: number
  coupang: number
  total: number
}

export function parseInventoryProductKey(productKey: unknown): {
  productId: string
  itemId: string
} | null

export function buildProductHistorySeries(options: {
  links: InventoryHistoryLink[]
  dailyRows: Array<Record<string, unknown>>
  eventRows: Array<Record<string, unknown>>
  startDate: string
  endDate: string
  selectedDate: string
}): {
  daily: InventoryHistoryPoint[]
  hourly: InventoryHistoryHourPoint[]
  summary: {
    periodTotal: number
    selectedDayTotal: number
    peakDate: InventoryHistoryPoint | null
    peakHour: InventoryHistoryHourPoint | null
  }
}
