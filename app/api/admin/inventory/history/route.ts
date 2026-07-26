import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/requireAdmin'
import {
  fetchSmartInventoryProductHistory,
  SmartInventoryProductHistoryError,
} from '@/lib/smartInventoryProductHistory'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: Request) {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  try {
    const url = new URL(request.url)
    const masterId = Number(url.searchParams.get('masterId'))
    const days = Number(url.searchParams.get('days') || 30)
    const payload = await fetchSmartInventoryProductHistory({
      masterId,
      days,
      selectedDate: url.searchParams.get('date'),
    })
    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    const status = error instanceof SmartInventoryProductHistoryError ? error.status : 502
    console.error('[smart-inventory] failed to fetch product history', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '상품 재고차감 이력을 불러오지 못했습니다.' },
      { status },
    )
  }
}
