import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

function parseDateInput(input: string | null, endOfDay = false) {
  if (!input) return null
  const value = input.trim()
  if (!value) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+09:00`)
  }
  if (/^\d{8}$/.test(value)) {
    const y = value.slice(0, 4)
    const m = value.slice(4, 6)
    const d = value.slice(6, 8)
    return new Date(`${y}-${m}-${d}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+09:00`)
  }
  return null
}

function resolveAmount(row: {
  totalAmount: number | null
  approvalAmount: number | null
  amount: number | null
  tax: number | null
  serviceCharge: number | null
}) {
  if (typeof row.totalAmount === 'number') return row.totalAmount
  if (typeof row.approvalAmount === 'number') return row.approvalAmount
  if (
    typeof row.amount === 'number' ||
    typeof row.tax === 'number' ||
    typeof row.serviceCharge === 'number'
  ) {
    return (row.amount || 0) + (row.tax || 0) + (row.serviceCharge || 0)
  }
  return 0
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const pageSize = Math.min(10000, Math.max(1, parseInt(searchParams.get('pageSize') || '50', 10)))
    const cardNum = (searchParams.get('cardNum') || '').trim()
    const storeName = (searchParams.get('storeName') || '').trim()
    const startDate = parseDateInput(searchParams.get('startDate'), false)
    const endDate = parseDateInput(searchParams.get('endDate'), true)

    const where: Prisma.CardUsageWhereInput = {}
    if (cardNum) {
      where.cardNum = { contains: cardNum }
    }
    if (storeName) {
      where.useStoreName = { contains: storeName }
    }
    if (startDate || endDate) {
      where.usedAt = {}
      if (startDate) where.usedAt.gte = startDate
      if (endDate) where.usedAt.lte = endDate
    }

    const [items, totalCount, maxSyncedAt, amountRows] = await Promise.all([
      prisma.cardUsage.findMany({
        where,
        orderBy: [{ usedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.cardUsage.count({ where }),
      prisma.cardUsage.aggregate({
        _max: { syncedAt: true },
      }),
      prisma.cardUsage.findMany({
        where,
        select: {
          totalAmount: true,
          approvalAmount: true,
          amount: true,
          tax: true,
          serviceCharge: true,
        },
      }),
    ])

    const totalAmount = amountRows.reduce((sum, row) => sum + resolveAmount(row), 0)

    return NextResponse.json({
      items,
      page,
      pageSize,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
      summary: {
        totalAmount,
        lastSyncedAt: maxSyncedAt._max.syncedAt,
      },
    })
  } catch (error: unknown) {
    console.error('[CardUsage GET] error:', error)
    const message = error instanceof Error ? error.message : '카드 사용내역 조회 실패'
    return NextResponse.json(
      { error: message },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const body = await request.json()
    const id = String(body?.id || '').trim()
    const memoInput = typeof body?.memo === 'string' ? body.memo : undefined
    const categoryInput = typeof body?.category === 'string' ? body.category : undefined

    if (!id) {
      return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 })
    }

    const data: Record<string, unknown> = {}
    if (memoInput !== undefined) {
      data.userMemo = memoInput.trim() ? memoInput.trim() : null
    }
    if (categoryInput !== undefined) {
      data.category = categoryInput.trim() ? categoryInput.trim() : null
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: '변경할 내용이 없습니다.' }, { status: 400 })
    }

    const updated = await prisma.cardUsage.update({
      where: { id },
      data,
      select: {
        id: true,
        userMemo: true,
        category: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      item: updated,
    })
  } catch (error: unknown) {
    console.error('[CardUsage PATCH] error:', error)
    const message = error instanceof Error ? error.message : '메모 저장 실패'
    return NextResponse.json(
      { error: message },
      { status: 500 },
    )
  }
}
