import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

type ApprovalStatus = 'APPROVED' | 'CANCELED' | 'UNKNOWN'

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

function parseYmdInput(input: string | null) {
  if (!input) return null
  const value = input.trim()
  if (!value) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value.replace(/-/g, '')
  }
  if (/^\d{8}$/.test(value)) {
    return value
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

function normalizeApprovalStatus(row: {
  approvalType: string | null
  totalAmount: number | null
  approvalAmount: number | null
  amount: number | null
  tax: number | null
  serviceCharge: number | null
}): ApprovalStatus {
  const compact = String(row.approvalType || '')
    .trim()
    .toUpperCase()
    .replace(/[\s_-]/g, '')

  if (compact) {
    if (
      compact === 'CANCELED' ||
      compact.includes('CANCEL') ||
      compact.includes('\uCDE8\uC18C') ||
      compact === '2' ||
      compact === 'C'
    ) {
      return 'CANCELED'
    }
    if (
      compact === 'APPROVED' ||
      compact.includes('APPROV') ||
      compact.includes('\uC2B9\uC778') ||
      compact === '1' ||
      compact === 'A'
    ) {
      return 'APPROVED'
    }
  }

  const amount = resolveAmount(row)
  if (amount < 0) return 'CANCELED'
  if (amount > 0) return 'APPROVED'
  return 'UNKNOWN'
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
    const startYmd = parseYmdInput(searchParams.get('startDate'))
    const endYmd = parseYmdInput(searchParams.get('endDate'))

    const where: Prisma.CardUsageWhereInput = {}
    if (cardNum) {
      where.cardNum = { contains: cardNum }
    }
    if (storeName) {
      where.useStoreName = { contains: storeName }
    }
    if (startDate || endDate) {
      const usedAtFilter: { gte?: Date; lte?: Date } = {}
      if (startDate) usedAtFilter.gte = startDate
      if (endDate) usedAtFilter.lte = endDate
      const filters: Prisma.CardUsageWhereInput[] = [{ usedAt: usedAtFilter }]

      // Backward compatibility: include rows where usedAt is null but useDT exists.
      if (startYmd || endYmd) {
        const useDTFilter: { gte?: string; lte?: string } = {}
        if (startYmd) useDTFilter.gte = startYmd
        if (endYmd) useDTFilter.lte = `${endYmd}999999`
        filters.push({ useDT: useDTFilter })
      }

      where.OR = filters
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

    const normalizedItems = items.map((item) => ({
      ...item,
      approvalStatus: normalizeApprovalStatus(item),
    }))

    const totalAmount = amountRows.reduce((sum, row) => sum + resolveAmount(row), 0)

    return NextResponse.json({
      items: normalizedItems,
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
    const reviewedInput = typeof body?.reviewed === 'boolean' ? body.reviewed : undefined

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
    if (reviewedInput !== undefined) {
      data.reviewedAt = reviewedInput ? new Date() : null
      data.reviewedBy = reviewedInput ? (session.user.id || null) : null
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
        reviewedAt: true,
        reviewedBy: true,
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
