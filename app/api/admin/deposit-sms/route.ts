import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/requireAdmin'

export const dynamic = 'force-dynamic'

const ACTION_REQUIRED_STATUSES = ['UNMATCHED', 'AMBIGUOUS']

export async function GET() {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  const [statusGroups, messages] = await Promise.all([
    prisma.depositSms.groupBy({
      by: ['matchStatus'],
      where: { matchStatus: { in: ACTION_REQUIRED_STATUSES } },
      _count: { _all: true },
    }),
    prisma.depositSms.findMany({
      where: { matchStatus: { in: ACTION_REQUIRED_STATUSES } },
      orderBy: { receivedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        messageHash: true,
        sender: true,
        body: true,
        receivedAt: true,
        amount: true,
        depositorName: true,
        bankName: true,
        sourceDevice: true,
        matchStatus: true,
        matchedOrderId: true,
        candidateOrderIds: true,
      },
    }),
  ])

  const counts = statusGroups.reduce<Record<string, number>>((acc, group) => {
    acc[group.matchStatus] = group._count._all
    return acc
  }, {})

  return NextResponse.json({
    counts: {
      unmatched: counts.UNMATCHED || 0,
      ambiguous: counts.AMBIGUOUS || 0,
    },
    messages,
  })
}
