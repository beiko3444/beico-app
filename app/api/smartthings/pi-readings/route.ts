import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { collectSmartThingsSensors, SmartThingsIntegrationError } from '@/lib/smartThings'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

function safeMatch(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

function authorized(request: Request) {
  const expected = process.env.SMARTTHINGS_COLLECTOR_SECRET?.trim() || ''
  const authorization = request.headers.get('authorization') || ''
  const provided = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  return Boolean(expected && provided && safeMatch(expected, provided))
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
  }

  try {
    return NextResponse.json({ ok: true, ...(await collectSmartThingsSensors()) }, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    const status = error instanceof SmartThingsIntegrationError ? error.status : 500
    console.error('[smartthings] Raspberry Pi collection bridge failed', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'SmartThings 온습도 조회에 실패했습니다.' },
      { status },
    )
  }
}
