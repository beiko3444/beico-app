export const PRODUCT_GRADES = ['A', 'B', 'C', 'D'] as const

export type ProductGrade = (typeof PRODUCT_GRADES)[number]
export type ProductGradeOrderField = 'moq' | 'orderUnit'
export type ProductGradePriceField = 'cost' | 'wholesale' | 'retail'

export function isProductGrade(value: unknown): value is ProductGrade {
  return typeof value === 'string' && PRODUCT_GRADES.includes(value as ProductGrade)
}

export function readProductGradeOrderValue(
  regionalPrices: unknown,
  grade: ProductGrade,
  field: ProductGradeOrderField,
  fallback = 1,
) {
  const root = readRecord(regionalPrices)
  const gradeNode = readRecord(root?.[grade])
  const krNode = readRecord(gradeNode?.KR)
  return readPositiveInt(krNode?.[field], fallback)
}

export function setProductGradeOrderValue(
  regionalPrices: unknown,
  grade: ProductGrade,
  field: ProductGradeOrderField,
  value: number,
) {
  const root = readRecord(regionalPrices) || {}
  const gradeNode = readRecord(root[grade]) || {}
  const krNode = readRecord(gradeNode.KR) || {}
  const normalizedValue = readPositiveInt(value, 1)

  return {
    ...root,
    [grade]: {
      ...gradeNode,
      KR: {
        ...krNode,
        [field]: String(normalizedValue),
      },
    },
  }
}

export function readProductGradePriceValue(
  regionalPrices: unknown,
  grade: ProductGrade,
  field: ProductGradePriceField,
  fallback = 0,
) {
  const root = readRecord(regionalPrices)
  const gradeNode = readRecord(root?.[grade])
  const krNode = readRecord(gradeNode?.KR)
  return readNonNegativeNumber(krNode?.[field], fallback)
}

export function setProductGradePriceValue(
  regionalPrices: unknown,
  grade: ProductGrade,
  field: ProductGradePriceField,
  value: number,
) {
  const root = readRecord(regionalPrices) || {}
  const gradeNode = readRecord(root[grade]) || {}
  const krNode = readRecord(gradeNode.KR) || {}
  const normalizedValue = readNonNegativeNumber(value, 0)

  return {
    ...root,
    [grade]: {
      ...gradeNode,
      KR: {
        ...krNode,
        [field]: String(normalizedValue),
      },
    },
  }
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function readPositiveInt(value: unknown, fallback: number) {
  const parsed = Number(String(value ?? '').replace(/,/g, '').trim())
  if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed)
  const normalizedFallback = Number(fallback)
  return Number.isFinite(normalizedFallback) && normalizedFallback > 0
    ? Math.round(normalizedFallback)
    : 1
}

function readNonNegativeNumber(value: unknown, fallback: number) {
  const normalized = String(value ?? '').replace(/,/g, '').trim()
  const parsed = normalized === '' ? Number.NaN : Number(normalized)
  if (Number.isFinite(parsed) && parsed >= 0) return parsed
  const normalizedFallback = Number(fallback)
  return Number.isFinite(normalizedFallback) && normalizedFallback >= 0
    ? normalizedFallback
    : 0
}
