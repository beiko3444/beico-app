import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
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
