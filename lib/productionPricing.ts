import { readProductGradePriceValue } from './productGradePricing'

export interface ProductionPriceProduct {
  id: string
  name: string
  nameJP?: string | null
  sellPrice: number
  onlinePrice?: number | null
  priceC?: number | null
  regionalPrices?: unknown
}

export const PRODUCTION_CATEGORIES = ['청갯지렁이', '홍갯지렁이', '혼무시', '멍게', '번데기'] as const

function normalizeProductName(value: string) {
  return value.normalize('NFKC').replace(/청갯지렁(?:이)?/g, '청갯지렁이').replace(/홍갯지렁(?:이)?/g, '홍갯지렁이')
}

export function getProductionProducts<T extends ProductionPriceProduct>(products: T[], category: string): T[] {
  // 상품의 종류를 단어로 비교합니다. '홍갯지렁이'를 '청갯지렁이'로 연결하지 않습니다.
  if (!PRODUCTION_CATEGORIES.some(value => value === category)) return []
  return products.filter(product => {
    const words = normalizeProductName(product.name).split(/[\s\d\p{P}]+/u)
    return words.includes(category)
  })
}

export function selectProductionProduct<T extends ProductionPriceProduct>(products: T[], category: string, productId?: string | null): T | undefined {
  const candidates = getProductionProducts(products, category)
  if (productId) return candidates.find(product => product.id === productId)
  // 기본 단품만 자동 연결합니다. 이름에 종류가 나열된 세트 상품은 자동 선택하지 않습니다.
  const exact = candidates.filter(product => {
    const name = normalizeProductName(product.name).replace(/\s+/g, '').toLowerCase()
    return name === category || name.replace(/^(?:beiko|베이코)?(?:퀵베이트|쿽베이트)(?:v\d+)?/, '') === category
  })
  if (exact.length === 1) return exact[0]
  return undefined
}

export function attachProductionPrices<T extends { category: string; productId?: string | null }>(batch: T, products: ProductionPriceProduct[]) {
  const product = selectProductionProduct(products, batch.category, batch.productId)
  return {
    ...batch,
    productId: product?.id ?? batch.productId ?? null,
    priceProductName: product?.name ?? null,
    salesPrice: product ? getProductionPrices(product).salesPrice : null,
    wholesalePrice: product ? getProductionPrices(product).wholesalePrice : null,
  }
}

export function getProductionPrices(product: ProductionPriceProduct) {
  return {
    // 기존 생산 기록의 필드명은 화면의 도매/소매 순서와 반대로 되어 있습니다.
    salesPrice: Math.round(readProductGradePriceValue(product.regionalPrices, 'C', 'wholesale', product.priceC ?? product.sellPrice)),
    wholesalePrice: Math.round(readProductGradePriceValue(product.regionalPrices, 'C', 'retail', product.onlinePrice ?? 0)),
  }
}

export function productionMargin(price: number | null, unitCost: number | null) {
  return price !== null && price > 0 ? ((price - (unitCost ?? 0)) / price) * 100 : null
}
