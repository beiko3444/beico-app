import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/requireAdmin'
import { defaultDateRange, normalizeYmdDate, toYmd, ymdToUtcDate } from '@/lib/naverSales'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  const url = new URL(request.url)
  const fallback = defaultDateRange(30)
  const startText = normalizeYmdDate(url.searchParams.get('start')) || fallback.start
  const endText = normalizeYmdDate(url.searchParams.get('end')) || fallback.end
  const start = ymdToUtcDate(startText)
  const end = ymdToUtcDate(endText)
  if (!start || !end || start > end) {
    return NextResponse.json({ error: '조회 기간이 올바르지 않습니다.' }, { status: 400 })
  }

  const [rows, latestLog] = await Promise.all([
    prisma.naverSalesDaily.findMany({
      where: {
        saleDate: {
          gte: start,
          lte: end,
        },
      },
      orderBy: [
        { quantity: 'desc' },
        { netAmount: 'desc' },
        { productName: 'asc' },
      ],
      take: 1000,
    }),
    prisma.naverSalesSyncLog.findFirst({
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const totals = rows.reduce(
    (acc, row) => {
      acc.orders += row.orders
      acc.quantity += row.quantity
      acc.payAmount += row.payAmount
      acc.refundAmount += row.refundAmount
      acc.netAmount += row.netAmount
      return acc
    },
    { orders: 0, quantity: 0, payAmount: 0, refundAmount: 0, netAmount: 0 },
  )

  const byDate = Array.from(
    rows.reduce((map, row) => {
      const key = toYmd(row.saleDate)
      const current = map.get(key) || { saleDate: key, orders: 0, quantity: 0, netAmount: 0 }
      current.orders += row.orders
      current.quantity += row.quantity
      current.netAmount += row.netAmount
      map.set(key, current)
      return map
    }, new Map<string, { saleDate: string; orders: number; quantity: number; netAmount: number }>()),
  )
    .map(([, value]) => value)
    .sort((a, b) => a.saleDate.localeCompare(b.saleDate))

  return NextResponse.json({
    range: { start: startText, end: endText },
    totals,
    byDate,
    rows: rows.map((row) => ({
      id: row.id,
      saleDate: toYmd(row.saleDate),
      channelProductNo: row.channelProductNo,
      sellerManagementCode: row.sellerManagementCode,
      productName: row.productName,
      dbProductId: row.dbProductId,
      dbProductName: row.dbProductName,
      orders: row.orders,
      quantity: row.quantity,
      payAmount: row.payAmount,
      refundAmount: row.refundAmount,
      netAmount: row.netAmount,
      syncedAt: row.syncedAt,
    })),
    latestLog,
  })
}
