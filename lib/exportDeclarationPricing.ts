export type ExportCountryCode = 'KR' | 'JP' | 'US'
export type ExportCurrencyCode = 'KRW' | 'JPY' | 'USD'

export type ExportProductPrice = {
  amount: number
  currency: ExportCurrencyCode
}

export type ExportProductPriceMap = Partial<Record<ExportCountryCode, ExportProductPrice>>

export type ExportExchangeRates = {
  KRW: number
  JPY: number
}

const countryCurrency: Record<ExportCountryCode, ExportCurrencyCode> = {
  KR: 'KRW',
  JP: 'JPY',
  US: 'USD',
}

const readNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.-]/g, ''))
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

const readRegionalRetail = (regionalPrices: unknown, country: ExportCountryCode) => {
  if (!regionalPrices || typeof regionalPrices !== 'object' || Array.isArray(regionalPrices)) return 0
  const root = regionalPrices as Record<string, unknown>
  const grade = root.C
  if (!grade || typeof grade !== 'object' || Array.isArray(grade)) return 0
  const countryNode = (grade as Record<string, unknown>)[country]
  if (!countryNode || typeof countryNode !== 'object' || Array.isArray(countryNode)) return 0
  return readNumber((countryNode as Record<string, unknown>).retail)
}

const roundUsd = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.round(value * 100) / 100
}

export function normalizeExportCountry(value: unknown): ExportCountryCode {
  return value === 'KR' || value === 'JP' || value === 'US' ? value : 'US'
}

export function buildExportProductPrices(product: {
  krSellPrice?: unknown
  jpSellPrice?: unknown
  usSellPrice?: unknown
  onlinePrice?: unknown
  regionalPrices?: unknown
}): ExportProductPriceMap {
  const kr = readRegionalRetail(product.regionalPrices, 'KR') || readNumber(product.krSellPrice) || readNumber(product.onlinePrice)
  const jp = readRegionalRetail(product.regionalPrices, 'JP') || readNumber(product.jpSellPrice)
  const us = readRegionalRetail(product.regionalPrices, 'US') || readNumber(product.usSellPrice)

  return {
    KR: { amount: kr, currency: 'KRW' },
    JP: { amount: jp, currency: 'JPY' },
    US: { amount: us, currency: 'USD' },
  }
}

export function resolveExportUnitPriceUsd({
  prices,
  exportCountry,
  exchangeRates,
  fallbackUsd = 0,
}: {
  prices?: ExportProductPriceMap | null
  exportCountry: ExportCountryCode
  exchangeRates?: ExportExchangeRates | null
  fallbackUsd?: number
}) {
  const country = normalizeExportCountry(exportCountry)
  const price = prices?.[country]
  const fallback = roundUsd(fallbackUsd)

  if (!price || price.amount <= 0) return fallback
  if (price.currency === 'USD') return roundUsd(price.amount)

  const rateKey = price.currency === 'JPY' ? 'JPY' : 'KRW'
  const rate = exchangeRates?.[rateKey]
  if (!rate || !Number.isFinite(rate) || rate <= 0) return fallback

  return roundUsd(price.amount / rate)
}

export function getExportCountryCurrency(country: ExportCountryCode): ExportCurrencyCode {
  return countryCurrency[normalizeExportCountry(country)]
}
