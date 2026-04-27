/**
 * Auto-match CardUsage rows to CoupangPurchase records by date + amount.
 *
 * Heuristic:
 *   1. Only consider CardUsage rows whose merchant name contains "쿠팡".
 *   2. For each row, look for an unmatched CoupangPurchase with the same
 *      totalAmount and an orderedAt within ±2 days of usedAt.
 *   3. If exactly one candidate is found, link it. Skip ambiguous matches.
 */
import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/requireAdmin'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

const parseYmdToDate = (input: string | null, endOfDay = false) => {
  if (!input || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return null
  return new Date(`${input}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+09:00`)
}

const resolveAmount = (row: {
  totalAmount: number | null
  approvalAmount: number | null
  amount: number | null
  tax: number | null
  serviceCharge: number | null
}) => {
  if (typeof row.totalAmount === 'number') return row.totalAmount
  if (typeof row.approvalAmount === 'number') return row.approvalAmount
  if (typeof row.amount === 'number' || typeof row.tax === 'number' || typeof row.serviceCharge === 'number') {
    return (row.amount || 0) + (row.tax || 0) + (row.serviceCharge || 0)
  }
  return 0
}

export async function POST(request: Request) {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  try {
    const body = await request.json().catch(() => ({}))
    const startDate = parseYmdToDate(typeof body?.startDate === 'string' ? body.startDate : null, false)
    const endDate = parseYmdToDate(typeof body?.endDate === 'string' ? body.endDate : null, true)
    const overrideExisting = body?.overrideExisting === true

    const where: Prisma.CardUsageWhereInput = {
      useStoreName: { contains: '쿠팡' },
    }
    if (!overrideExisting) {
      where.coupangPurchaseId = null
    }
    if (startDate || endDate) {
      where.usedAt = {}
      if (startDate) where.usedAt.gte = startDate
      if (endDate) where.usedAt.lte = endDate
    }

    const cardRows = await prisma.cardUsage.findMany({
      where,
      orderBy: { usedAt: 'desc' },
      take: 1000,
    })

    if (cardRows.length === 0) {
      return NextResponse.json({ matchedCount: 0, ambiguousCount: 0, unmatchedCount: 0, scanned: 0 })
    }

    let matchedCount = 0
    let ambiguousCount = 0
    let unmatchedCount = 0
    const claimedPurchaseIds = new Set<string>()

    for (const row of cardRows) {
      const amount = resolveAmount(row)
      if (!amount || amount <= 0) {
        unmatchedCount++
        continue
      }
      const usedAt = row.usedAt
      if (!usedAt) {
        unmatchedCount++
        continue
      }

      const windowStart = new Date(usedAt.getTime() - 2 * 24 * 3600 * 1000)
      const windowEnd = new Date(usedAt.getTime() + 2 * 24 * 3600 * 1000)

      const candidates = await prisma.coupangPurchase.findMany({
        where: {
          totalAmount: amount,
          orderedAt: { gte: windowStart, lte: windowEnd },
          id: { notIn: Array.from(claimedPurchaseIds) },
          cardUsages: overrideExisting ? undefined : { none: {} },
        },
        orderBy: { orderedAt: 'desc' },
      })

      if (candidates.length === 0) {
        unmatchedCount++
        continue
      }
      if (candidates.length > 1) {
        ambiguousCount++
        continue
      }

      const purchase = candidates[0]
      await prisma.cardUsage.update({
        where: { id: row.id },
        data: { coupangPurchaseId: purchase.id },
      })
      claimedPurchaseIds.add(purchase.id)
      matchedCount++
    }

    return NextResponse.json({
      matchedCount,
      ambiguousCount,
      unmatchedCount,
      scanned: cardRows.length,
    })
  } catch (error) {
    console.error('[CoupangPurchase Match] error', error)
    const message = error instanceof Error ? error.message : '쿠팡 매칭 실패'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
