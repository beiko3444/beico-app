export type PartnerOrderCountry = 'KR' | 'JP' | 'US'

export type PartnerOrderPricingProduct = {
  sellPrice?: number | null
  priceA?: number | null
  priceB?: number | null
  priceC?: number | null
  priceD?: number | null
  minOrderQuantity?: number | null
  orderUnit?: number | null
  regionalPrices?: unknown
}

export type PartnerOrderTerms = {
  unitPrice: number
  minimumQuantity: number
  orderUnit: number
}

export function getPartnerOrderCountry(country?: string | null): PartnerOrderCountry {
  if (country === 'Korea') return 'KR'
  if (country === 'Japan') return 'JP'
  return 'US'
}

export function getPartnerOrderGrade(grade?: string | null) {
  const normalized = String(grade || 'C').toUpperCase()
  return ['A', 'B', 'C', 'D'].includes(normalized) ? normalized : 'C'
}

export function resolvePartnerOrderTerms(
  product: PartnerOrderPricingProduct,
  partner: { country?: string | null; grade?: string | null },
): PartnerOrderTerms {
  const country = getPartnerOrderCountry(partner.country)
  const grade = getPartnerOrderGrade(partner.grade)
  const fallbackMinimum = readPositiveInt(product.minOrderQuantity, 1)
  const fallbackOrderUnit = readPositiveInt(product.orderUnit, 1)
  const fallbackPrice = resolveLegacyPrice(product, grade)
  const regionalRoot = readRecord(product.regionalPrices)
  const gradeData = readRecord(regionalRoot?.[grade]) || readRecord(regionalRoot?.C)

  if (!gradeData) {
    return {
      unitPrice: fallbackPrice,
      minimumQuantity: fallbackMinimum,
      orderUnit: fallbackOrderUnit,
    }
  }

  const countryData = readRecord(gradeData[country]) || readRecord(gradeData.KR)
  const krData = readRecord(gradeData.KR)
  let unitPrice = readNonNegativeNumber(countryData?.wholesale, 0)

  if (country === 'US' && unitPrice <= 0) {
    unitPrice = readNonNegativeNumber(krData?.wholesale, 0)
  }
  if (unitPrice <= 0) unitPrice = fallbackPrice

  return {
    unitPrice,
    minimumQuantity: readPositiveInt(countryData?.moq, fallbackMinimum),
    orderUnit: readPositiveInt(countryData?.orderUnit, fallbackOrderUnit),
  }
}

// Unit price a partner is charged at checkout. The order page shows this price and
// the order API recomputes it, so a client-sent price is never trusted.
export function resolvePartnerCheckoutUnitPrice(
  product: PartnerOrderPricingProduct,
  partner: { country?: string | null; grade?: string | null },
) {
  const grade = getPartnerOrderGrade(partner.grade)
  const regionalRoot = readRecord(product.regionalPrices)
  const gradeData = readRecord(regionalRoot?.[grade]) || readRecord(regionalRoot?.C)
  if (!gradeData) return resolveLegacyPrice(product, grade)

  const wholesale = (code: PartnerOrderCountry) => readNonNegativeNumber(readRecord(gradeData[code])?.wholesale, 0)
  const kr = wholesale('KR')
  const jp = wholesale('JP')
  const us = wholesale('US')
  if (partner.country === 'Korea' && kr > 0) return kr
  if (partner.country === 'Japan' && jp > 0) return jp
  if (us > 0) return us
  if (kr > 0) return kr
  return readNonNegativeNumber(product.sellPrice, 0)
}

// Shipping is 3,000 per started 100 units and VAT is 10%, both waived for USD partners.
export function calculatePartnerOrderTotals(subtotal: number, totalQuantity: number, country?: string | null) {
  const isUSD = country !== 'Korea' && country !== 'Japan'
  const shippingFee = totalQuantity > 0 && !isUSD ? Math.ceil(totalQuantity / 100) * 3000 : 0
  const supplyTotal = subtotal + shippingFee
  const vat = isUSD ? 0 : Math.round(supplyTotal * 0.1)
  return { isUSD, shippingFee, supplyTotal, vat, total: supplyTotal + vat }
}

function resolveLegacyPrice(product: PartnerOrderPricingProduct, grade: string) {
  const gradePrice = {
    A: product.priceA,
    B: product.priceB,
    C: product.priceC,
    D: product.priceD,
  }[grade]

  const selectedPrice = readNonNegativeNumber(gradePrice, 0)
  if (selectedPrice > 0) return selectedPrice

  const cPrice = readNonNegativeNumber(product.priceC, 0)
  if (cPrice > 0) return cPrice

  return readNonNegativeNumber(product.sellPrice, 0)
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function readNonNegativeNumber(value: unknown, fallback: number) {
  const parsed = typeof value === 'number'
    ? value
    : Number(String(value ?? '').replace(/,/g, '').trim())
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function readPositiveInt(value: unknown, fallback: number) {
  const parsed = Number(String(value ?? '').replace(/,/g, '').trim())
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback
}
