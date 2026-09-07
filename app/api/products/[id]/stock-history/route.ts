import { NextResponse } from 'next/server'

import { getAdminSession } from '@/lib/admin-session'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 })
    }

    const { id } = await context.params
    const { searchParams } = new URL(request.url)
    const requestedLimit = Number(searchParams.get('limit')) || 100
    const limit = Math.min(200, Math.max(1, Math.round(requestedLimit)))

    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true, name: true, stock: true },
    })
    if (!product) {
      return NextResponse.json({ error: '상품을 찾을 수 없습니다.' }, { status: 404 })
    }

    const history = await prisma.productStockHistory.findMany({
      where: { productId: id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        previousStock: true,
        newStock: true,
        delta: true,
        source: true,
        note: true,
        createdAt: true,
        changedBy: {
          select: { name: true, username: true },
        },
      },
    })

    return NextResponse.json({ product, history })
  } catch (error) {
    console.error('Product stock history error:', error)
    return NextResponse.json({ error: '관리용 재고 이력을 불러오지 못했습니다.' }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 })
    }

    const { id: productId } = await context.params
    const body = await request.json().catch(() => null)
    const historyId = typeof body?.historyId === 'string' ? body.historyId.trim() : ''
    const note = typeof body?.note === 'string' ? body.note.trim() : ''

    if (!historyId) {
      return NextResponse.json({ error: '수정할 재고 이력을 선택해주세요.' }, { status: 400 })
    }
    if (note.length > 200) {
      return NextResponse.json({ error: '수정내역은 200자 이하로 입력해주세요.' }, { status: 400 })
    }

    const result = await prisma.productStockHistory.updateMany({
      where: {
        id: historyId,
        productId,
      },
      data: {
        note: note || null,
      },
    })

    if (result.count === 0) {
      return NextResponse.json({ error: '재고 이력을 찾을 수 없습니다.' }, { status: 404 })
    }

    return NextResponse.json({ success: true, historyId, note: note || null })
  } catch (error) {
    console.error('Product stock history note update error:', error)
    return NextResponse.json({ error: '수정내역을 저장하지 못했습니다.' }, { status: 500 })
  }
}
