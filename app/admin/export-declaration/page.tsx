import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildExportProductPrices, resolveExportUnitPriceUsd } from '@/lib/exportDeclarationPricing'
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
        onlinePrice: true,
        krSellPrice: true,
        jpSellPrice: true,
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

type ExportDeclarationRow = {
  id: string
  invoiceNo: string
  status: string
  totals: unknown
  createdAt: Date | string
  _count?: {
    items?: number
  }
}

type ExportDeclarationReader = {
  exportDeclaration: {
    findMany: (args: unknown) => Promise<ExportDeclarationRow[]>
  }
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
    const rows = await (prisma as unknown as ExportDeclarationReader).exportDeclaration.findMany({
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

    savedDeclarations = rows.map((row) => ({
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

  const productOptions: ExportProductOption[] = products.map((product) => {
    const prices = buildExportProductPrices(product)
    return {
      id: product.id,
      name: product.name,
      nameEN: product.nameEN || null,
      nameJP: product.nameJP || null,
      productCode: product.productCode ? String(product.productCode).toUpperCase() : null,
      prices,
      unitPriceUsd: resolveExportUnitPriceUsd({
        prices,
        exportCountry: 'US',
        exchangeRates: null,
        fallbackUsd: readNumber(product.usSellPrice),
      }),
      stock: product.stock,
    }
  })

  return <ExportDeclarationClient products={productOptions} savedDeclarations={savedDeclarations} />
}
