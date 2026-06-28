import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeMaterialSupplyInput, sortMaterialSupplies } from '@/lib/materialSupplies'
import { requireAdminSession } from '@/lib/requireAdmin'

export const dynamic = 'force-dynamic'

type MaterialSupplyReader = {
  materialSupply: {
    findMany: (args: unknown) => Promise<MaterialSupplyRow[]>
    create: (args: unknown) => Promise<MaterialSupplyRow>
    update: (args: unknown) => Promise<MaterialSupplyRow>
    delete: (args: unknown) => Promise<MaterialSupplyRow>
  }
}

type MaterialSupplyRow = {
  id: string
  name: string
  category: string
  supplierName: string
  purchaseUrl: string
  unit: string
  priceKrw: number | null
  widthValue: number | null
  depthValue: number | null
  heightValue: number | null
  dimensionUnit: string
  memo: string
  active: boolean
  sortOrder: number
  lastPurchasedAt: Date | string | null
  createdAt: Date | string
  updatedAt: Date | string
}

const materialSupplyClient = () => (prisma as unknown as MaterialSupplyReader).materialSupply

export async function GET() {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  try {
    const items = await materialSupplyClient().findMany({
      orderBy: [{ active: 'desc' }, { category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json(
      { items: sortMaterialSupplies(items).map(serializeMaterialSupply) },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    )
  } catch (error) {
    console.error('[material-supplies GET] error:', error)
    return NextResponse.json({ error: '부자재 목록을 불러오지 못했습니다.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  try {
    const body = await request.json()
    const data = normalizeMaterialSupplyInput(body || {})
    const item = await materialSupplyClient().create({ data })

    return NextResponse.json({ item: serializeMaterialSupply(item) }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : '부자재를 저장하지 못했습니다.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function PATCH(request: Request) {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  try {
    const body = await request.json()
    const id = String(body?.id || '').trim()
    if (!id) {
      return NextResponse.json({ error: '수정할 부자재 ID가 없습니다.' }, { status: 400 })
    }

    if (body?.markPurchased === true) {
      const item = await materialSupplyClient().update({
        where: { id },
        data: { lastPurchasedAt: new Date() },
      })
      return NextResponse.json({ item: serializeMaterialSupply(item) })
    }

    const data = normalizeMaterialSupplyInput(body || {})
    const item = await materialSupplyClient().update({ where: { id }, data })

    return NextResponse.json({ item: serializeMaterialSupply(item) })
  } catch (error) {
    const message = error instanceof Error ? error.message : '부자재를 수정하지 못했습니다.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  try {
    const { searchParams } = new URL(request.url)
    const id = String(searchParams.get('id') || '').trim()
    if (!id) {
      return NextResponse.json({ error: '삭제할 부자재 ID가 없습니다.' }, { status: 400 })
    }

    await materialSupplyClient().delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[material-supplies DELETE] error:', error)
    return NextResponse.json({ error: '부자재를 삭제하지 못했습니다.' }, { status: 500 })
  }
}

function serializeMaterialSupply(item: MaterialSupplyRow) {
  return {
    ...item,
    lastPurchasedAt: item.lastPurchasedAt ? new Date(item.lastPurchasedAt).toISOString() : null,
    createdAt: new Date(item.createdAt).toISOString(),
    updatedAt: new Date(item.updatedAt).toISOString(),
  }
}
