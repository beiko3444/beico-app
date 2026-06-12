export const INVENTORY_FAVORITES_KEY = 'beiko:smart-inventory:favorites:v1'
export const INVENTORY_ORDER_KEY = 'beiko:smart-inventory:master-order:v1'
export const INVENTORY_FAVORITES_EVENT = 'beiko:smart-inventory:favorites-changed'
export const INVENTORY_ORDER_EVENT = 'beiko:smart-inventory:order-changed'

function uniqueNumbers(values: unknown[]): number[] {
  const seen = new Set<number>()
  const result: number[] = []
  for (const value of values) {
    const parsed = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(parsed)) continue
    const id = Math.trunc(parsed)
    if (seen.has(id)) continue
    seen.add(id)
    result.push(id)
  }
  return result
}

export function readStoredNumberArray(key: string): number[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? uniqueNumbers(parsed) : []
  } catch {
    return []
  }
}

export function writeStoredNumberArray(key: string, values: number[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, JSON.stringify(uniqueNumbers(values)))
}
