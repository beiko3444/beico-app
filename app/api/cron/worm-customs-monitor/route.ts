import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/requireAdmin'
import { isAuthorizedGithubActionsOidc } from '@/lib/githubActionsOidc'
import { processDueWormCustomsMonitors } from '@/lib/wormCustomsMonitor'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

async function isAuthorizedCron(request: Request) {
  const authorization = request.headers.get('authorization') || ''
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authorization === `Bearer ${cronSecret}`) return true

  const bearerToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  return isAuthorizedGithubActionsOidc(bearerToken)
}

export async function GET(request: Request) {
  if (!(await isAuthorizedCron(request))) {
    const { unauthorized } = await requireAdminSession()
    if (unauthorized) return unauthorized
  }

  try {
    const result = await processDueWormCustomsMonitors(10)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('[worm-customs-monitor] cron failed', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AWB 통관 모니터링에 실패했습니다.' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  return GET(request)
}
