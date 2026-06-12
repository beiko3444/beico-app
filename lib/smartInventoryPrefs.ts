export const INVENTORY_FAVORITES_EVENT = 'beiko:smart-inventory:favorites-changed'
export const INVENTORY_ORDER_EVENT = 'beiko:smart-inventory:order-changed'

export type InventoryPreferencesPayload = {
  favoriteMasterIds: number[]
  masterOrder: number[]
}

export function uniqueInventoryIds(values: unknown): number[] {
  if (!Array.isArray(values)) return []
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
