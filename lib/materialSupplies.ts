export type MaterialSupplyInput = {
  name?: unknown
  category?: unknown
  supplierName?: unknown
  purchaseUrl?: unknown
  unit?: unknown
  priceKrw?: unknown
  widthValue?: unknown
  depthValue?: unknown
  heightValue?: unknown
  dimensionUnit?: unknown
  memo?: unknown
  sortOrder?: unknown
  active?: unknown
}

export type NormalizedMaterialSupplyInput = {
  name: string
  category: string
  supplierName: string
  purchaseUrl: string
  unit: string
  priceKrw: number | null
  widthValue: number | null
  depthValue: number | null
  heightValue: number | null
  dimensionUnit: 'mm' | 'cm'
  memo: string
  sortOrder: number
  active: boolean
}

export type SortableMaterialSupply = {
  id: string
  name: string
  category?: string | null
  active: boolean
  sortOrder?: number | null
  updatedAt: Date | string
}

export function parseMaterialSupplyUnitQuantity(value: unknown) {
  if (typeof value !== 'string') return null
  const numbers = value
    .match(/[0-9]+(?:\.[0-9]+)?/g)
    ?.map((part) => Number(part))
    .filter((number) => Number.isFinite(number) && number > 0)

  if (!numbers?.length) return null
  return Math.max(...numbers)
}

export function getMaterialSupplyUnitPrice(priceKrw: number | null | undefined, unit: unknown) {
  if (!priceKrw || priceKrw <= 0) return null
  const quantity = parseMaterialSupplyUnitQuantity(unit)
  if (!quantity) return null
  return priceKrw / quantity
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ''))
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.round(parsed)
}

function floatOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ''))
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.round(parsed * 100) / 100
}

function normalizeDimensionUnit(value: unknown): 'mm' | 'cm' {
  return text(value).toLowerCase() === 'cm' ? 'cm' : 'mm'
}

function numberOrZero(value: unknown) {
  const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''))
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.round(parsed))
}

function normalizePurchaseUrl(value: unknown) {
  const purchaseUrl = text(value)
  try {
    const url = new URL(purchaseUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('invalid protocol')
    }
    return url.toString()
  } catch {
    throw new Error('구매 링크는 http 또는 https 주소여야 합니다.')
  }
}

export function normalizeMaterialSupplyInput(input: MaterialSupplyInput): NormalizedMaterialSupplyInput {
  const name = text(input.name)
  if (!name) throw new Error('부자재명을 입력해주세요.')

  return {
    name,
    category: text(input.category),
    supplierName: text(input.supplierName),
    purchaseUrl: normalizePurchaseUrl(input.purchaseUrl),
    unit: text(input.unit),
    priceKrw: numberOrNull(input.priceKrw),
    widthValue: floatOrNull(input.widthValue),
    depthValue: floatOrNull(input.depthValue),
    heightValue: floatOrNull(input.heightValue),
    dimensionUnit: normalizeDimensionUnit(input.dimensionUnit),
    memo: text(input.memo),
    sortOrder: numberOrZero(input.sortOrder),
    active: typeof input.active === 'boolean' ? input.active : true,
  }
}

export function sortMaterialSupplies<T extends SortableMaterialSupply>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1
    const categoryCompare = String(a.category || '').localeCompare(String(b.category || ''), 'ko')
    if (categoryCompare !== 0) return categoryCompare
    const sortCompare = (a.sortOrder || 0) - (b.sortOrder || 0)
    if (sortCompare !== 0) return sortCompare
    return a.name.localeCompare(b.name, 'ko')
  })
}
