import { prisma } from './prisma'
import { getProductionPrices, selectProductionProduct, PRODUCTION_CATEGORIES } from './productionPricing'

export async function loadProductionProducts() {
  return prisma.product.findMany({
    where: { OR: PRODUCTION_CATEGORIES.map(category => ({ name: { contains: category.replace(/갯지렁이$/, '갯지렁') } })) },
    select: { id: true, name: true, sellPrice: true, onlinePrice: true, priceC: true, regionalPrices: true },
  })
}

export async function resolveProductionProduct(category: string, productId: unknown) {
  if (productId != null && typeof productId !== 'string') return null
  const product = selectProductionProduct(await loadProductionProducts(), category, productId as string | null | undefined)
  return product ? { productId: product.id, ...getProductionPrices(product) } : null
}
