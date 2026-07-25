import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/requireAdmin'
import { fetchSmartInventoryDashboard, syncSmartInventory } from '@/lib/smartInventoryClient'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(request: Request) {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  try {
    const url = new URL(request.url)
    const dashboard = await fetchSmartInventoryDashboard({ refresh: url.searchParams.get('refresh') === '1' })
    return NextResponse.json(dashboard, {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    console.error('[smart-inventory] failed to fetch dashboard', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '재고 정보를 불러오지 못했습니다.' },
      { status: 502 },
    )
  }
}

export async function POST(request: Request) {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  try {
    const body = await request.json().catch(() => ({}))
    if (body?.action !== 'sync') {
      return NextResponse.json({ error: '지원하지 않는 작업입니다.' }, { status: 400 })
    }

    const payload = await syncSmartInventory()
    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    console.error('[smart-inventory] failed to sync inventory', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '재고 동기화에 실패했습니다.' },
      { status: 502 },
    )
  }
}
