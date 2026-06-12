import { NextResponse } from 'next/server'
import { sendFavoriteInventoryPushToAdmins } from '@/lib/inventoryPush'
import { requireAdminSession } from '@/lib/requireAdmin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

function isAuthorizedCron(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization') || ''
  return Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`)
}

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    const { unauthorized } = await requireAdminSession()
    if (unauthorized) return unauthorized
  }

  try {
    const result = await sendFavoriteInventoryPushToAdmins()
    return NextResponse.json({ ok: true, result })
  } catch (error) {
    console.error('[inventory-push] failed to run favorite inventory push', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '즐겨찾기 재고 푸시 발송에 실패했습니다.' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  return GET(request)
}
