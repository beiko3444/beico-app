import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/requireAdmin'
import { fetchSmartInventoryDashboard, syncSmartInventory } from '@/lib/smartInventoryClient'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

function normalizeProductName(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/[^\p{L}\p{N}]/gu, '')
}

async function loadProductStocksByName() {
  const products = await prisma.product.findMany({
    select: {
      name: true,
      stock: true,
    },
  })

  const candidates = new Map<string, number[]>()
  for (const product of products) {
    const key = normalizeProductName(product.name)
    if (!key) continue
    candidates.set(key, [...(candidates.get(key) || []), product.stock])
  }

  return new Map(
    [...candidates.entries()]
      .filter(([, stocks]) => stocks.length === 1)
      .map(([name, stocks]) => [name, stocks[0]]),
  )
}

export async function GET(request: Request) {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  try {
    const url = new URL(request.url)
    const [dashboard, productStocksByName] = await Promise.all([
      fetchSmartInventoryDashboard({ refresh: url.searchParams.get('refresh') === '1' }),
      loadProductStocksByName().catch((error) => {
        console.error('[smart-inventory] failed to load product stocks', error)
        return new Map<string, number>()
      }),
    ])
    const payload = {
      ...dashboard,
      rows: dashboard.rows.map((row) => ({
        ...row,
        productStock: productStocksByName.get(normalizeProductName(row.name)) ?? null,
      })),
    }

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    console.error('[smart-inventory] failed to fetch dashboard', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '재고 정보를 불러오지 못했습니다.' },
      { status: 502 },
    )
  }
}

export async function POST(request: Request) {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  try {
    const body = await request.json().catch(() => ({}))
    if (body?.action !== 'sync') {
      return NextResponse.json({ error: '지원하지 않는 작업입니다.' }, { status: 400 })
    }

    const payload = await syncSmartInventory()
    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    console.error('[smart-inventory] failed to sync inventory', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '재고 동기화에 실패했습니다.' },
      { status: 502 },
    )
  }
}
