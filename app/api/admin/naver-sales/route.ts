import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/requireAdmin'
import { defaultDateRange, normalizeYmdDate, toYmd, ymdToUtcDate } from '@/lib/naverSales'
import { buildNaverSalesDashboard, summarizeInsightRows } from '@/lib/naverSalesAnalytics.mjs'

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

  const [rows, insightRows, realtimeSnapshot, latestLog] = await Promise.all([
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
    prisma.naverSalesInsightDaily.findMany({
      where: {
        saleDate: {
          gte: start,
          lte: end,
        },
      },
      orderBy: [
        { payAmount: 'desc' },
        { orders: 'desc' },
        { label: 'asc' },
      ],
      take: 1000,
    }),
    prisma.naverSalesRealtimeSnapshot.findFirst({
      where: {
        snapshotDate: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { collectedAt: 'desc' },
    }),
    prisma.naverSalesSyncLog.findFirst({
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const dashboard = buildNaverSalesDashboard(rows)
  const keywords = summarizeInsightRows(insightRows.filter((row) => row.category === 'KEYWORD' || row.category === 'PRODUCT_KEYWORD'), 15)
  const channels = summarizeInsightRows(insightRows.filter((row) => row.category === 'CHANNEL' || row.category === 'PRODUCT_MARKETING'), 15)

  return NextResponse.json({
    range: { start: startText, end: endText },
    totals: dashboard.totals,
    products: dashboard.products,
    byDate: dashboard.byDate,
    keywords,
    channels,
    realtimeSnapshot: realtimeSnapshot ? {
      snapshotDate: toYmd(realtimeSnapshot.snapshotDate),
      orders: realtimeSnapshot.orders,
      quantity: realtimeSnapshot.quantity,
      payAmount: realtimeSnapshot.payAmount,
      refundAmount: realtimeSnapshot.refundAmount,
      netAmount: realtimeSnapshot.netAmount,
      collectedAt: realtimeSnapshot.collectedAt,
    } : null,
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
