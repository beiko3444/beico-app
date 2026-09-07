import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensurePurchase1688Seeded, normalizePurchase1688Input } from '@/lib/purchase1688'
import { requireAdminSession } from '@/lib/requireAdmin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  try {
    const setting = await ensurePurchase1688Seeded()
    const items = await prisma.purchase1688Item.findMany({
      orderBy: [{ orderedOn: 'desc' }, { orderNo: 'desc' }, { createdAt: 'asc' }],
    })
    return NextResponse.json({ items, cnyKrwRate: setting.cnyKrwRate }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[1688 GET]', error)
    return NextResponse.json({ error: '1688 구매내역을 불러오지 못했습니다.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  try {
    await ensurePurchase1688Seeded()
    const body = (await request.json()) as Record<string, unknown>
    const data = normalizePurchase1688Input(body)
    if (!data.orderNo || !data.productCn) {
      return NextResponse.json({ error: '주문번호와 중문 상품명은 필수입니다.' }, { status: 400 })
    }
    const item = await prisma.purchase1688Item.create({ data: { id: crypto.randomUUID(), ...data } })
    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    console.error('[1688 POST]', error)
    return NextResponse.json({ error: '구매내역을 추가하지 못했습니다.' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  try {
    const body = (await request.json()) as Record<string, unknown>
    if (body.kind === 'rate') {
      const cnyKrwRate = Math.max(1, Number(body.cnyKrwRate) || 204)
      const setting = await prisma.purchase1688Setting.upsert({
        where: { id: 'default' },
        update: { cnyKrwRate },
        create: { id: 'default', cnyKrwRate },
      })
      return NextResponse.json({ cnyKrwRate: setting.cnyKrwRate })
    }

    const id = String(body.id || '')
    if (!id) return NextResponse.json({ error: '수정할 항목이 없습니다.' }, { status: 400 })
    const item = await prisma.purchase1688Item.update({ where: { id }, data: normalizePurchase1688Input(body) })
    return NextResponse.json({ item })
  } catch (error) {
    console.error('[1688 PATCH]', error)
    return NextResponse.json({ error: '구매내역을 수정하지 못했습니다.' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  try {
    const id = new URL(request.url).searchParams.get('id') || ''
    if (!id) return NextResponse.json({ error: '삭제할 항목이 없습니다.' }, { status: 400 })
    await prisma.purchase1688Item.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[1688 DELETE]', error)
    return NextResponse.json({ error: '구매내역을 삭제하지 못했습니다.' }, { status: 500 })
  }
}
