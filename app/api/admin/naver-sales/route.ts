import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/requireAdmin'
import { defaultDateRange, normalizeYmdDate } from '@/lib/naverSales'
import { fetchNaverSalesRemoteDashboard } from '@/lib/naverSalesRemote'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  const url = new URL(request.url)
  const fallback = defaultDateRange(30)
  const startText = normalizeYmdDate(url.searchParams.get('start')) || fallback.start
  const endText = normalizeYmdDate(url.searchParams.get('end')) || fallback.end
  const forceLiveRefresh = url.searchParams.get('refresh') === '1'

  const dashboard = await fetchNaverSalesRemoteDashboard(startText, endText, {
    refresh: forceLiveRefresh,
    timeoutMs: forceLiveRefresh ? 45000 : 12000,
  })
  return NextResponse.json(dashboard)
}
