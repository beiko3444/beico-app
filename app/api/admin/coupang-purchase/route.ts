import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/requireAdmin'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

const parseYmdToDate = (input: string | null, endOfDay = false) => {
  if (!input || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return null
  return new Date(`${input}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+09:00`)
}

export async function GET(request: Request) {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  try {
    const { searchParams } = new URL(request.url)
    const startDate = parseYmdToDate(searchParams.get('startDate'), false)
    const endDate = parseYmdToDate(searchParams.get('endDate'), true)
    const amount = Number(searchParams.get('amount') || '0')

    const where: Prisma.CoupangPurchaseWhereInput = {}
    if (startDate || endDate) {
      where.orderedAt = {}
      if (startDate) where.orderedAt.gte = startDate
      if (endDate) where.orderedAt.lte = endDate
    }
    if (Number.isFinite(amount) && amount > 0) {
      where.totalAmount = amount
    }

    const purchases = await prisma.coupangPurchase.findMany({
      where,
      orderBy: { orderedAt: 'desc' },
      take: 200,
    })

    return NextResponse.json({ items: purchases })
  } catch (error) {
    console.error('[CoupangPurchase GET] error', error)
    const message = error instanceof Error ? error.message : '쿠팡 구매내역 조회 실패'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
