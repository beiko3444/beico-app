import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import ExportDeclarationClient, { type ExportDeclarationListItem, type ExportProductOption } from './ExportDeclarationClient'

export const dynamic = 'force-dynamic'

const readNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.-]/g, ''))
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

type RegionalPriceNode = {
  wholesale?: unknown
  cost?: unknown
}

type RegionalPriceCountry = {
  US?: RegionalPriceNode
}

type RegionalPriceRoot = {
  C?: RegionalPriceCountry
}

const resolveUsdUnitPrice = (product: { usBuyPrice?: number | null; usSellPrice?: number | null; regionalPrices?: unknown }) => {
  const direct = readNumber(product.usBuyPrice)
  if (direct > 0) return direct

  const regional = product.regionalPrices as RegionalPriceRoot | null | undefined
  const fromRegional = readNumber(regional?.C?.US?.wholesale ?? regional?.C?.US?.cost)
  if (fromRegional > 0) return fromRegional

  return readNumber(product.usSellPrice)
}

const getCachedExportProducts = unstable_cache(
  async () => {
    return prisma.product.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        nameEN: true,
        nameJP: true,
        productCode: true,
        usBuyPrice: true,
        usSellPrice: true,
        regionalPrices: true,
        stock: true,
      },
    })
  },
  ['admin-export-declaration-products-v1'],
  { revalidate: 60 },
)

const readTotalAmount = (value: unknown): number => {
  if (!value || typeof value !== 'object') return 0
  return readNumber((value as Record<string, unknown>).amount)
}

export default async function ExportDeclarationPage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  let products: Awaited<ReturnType<typeof getCachedExportProducts>> = []
  let savedDeclarations: ExportDeclarationListItem[] = []
  try {
    products = await getCachedExportProducts()
  } catch (error) {
    console.error('Failed to load export declaration products:', error)
  }

  try {
    const rows = await (prisma as any).exportDeclaration.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        invoiceNo: true,
        status: true,
        totals: true,
        createdAt: true,
        _count: {
          select: { items: true },
        },
      },
    })

    savedDeclarations = rows.map((row: any) => ({
      id: row.id,
      invoiceNo: row.invoiceNo,
      status: row.status,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
      itemCount: row._count?.items || 0,
      totalAmount: readTotalAmount(row.totals),
    }))
  } catch (error) {
    console.error('Failed to load export declaration list:', error)
  }

  const productOptions: ExportProductOption[] = products.map((product) => ({
    id: product.id,
    name: product.name,
    nameEN: product.nameEN || null,
    nameJP: product.nameJP || null,
    productCode: product.productCode ? String(product.productCode).toUpperCase() : null,
    unitPriceUsd: resolveUsdUnitPrice(product),
    stock: product.stock,
  }))

  return <ExportDeclarationClient products={productOptions} savedDeclarations={savedDeclarations} />
}
