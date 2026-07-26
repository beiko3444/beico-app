import { NextResponse } from 'next/server'
import { collectSmartThingsSensors, SmartThingsIntegrationError } from '@/lib/smartThings'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

function isAuthorizedCron(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authorization = request.headers.get('authorization') || ''
  return Boolean(cronSecret && authorization === `Bearer ${cronSecret}`)
}

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
  }

  try {
    return NextResponse.json({ ok: true, ...(await collectSmartThingsSensors()) })
  } catch (error) {
    const status = error instanceof SmartThingsIntegrationError ? error.status : 500
    console.error('[smartthings] scheduled collection failed', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '예약 온습도 수집에 실패했습니다.' },
      { status },
    )
  }
}

export async function POST(request: Request) {
  return GET(request)
}
