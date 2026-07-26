import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/requireAdmin'
import {
  collectSmartThingsSensors,
  getSmartThingsEnvironmentDashboard,
  SmartThingsIntegrationError,
} from '@/lib/smartThings'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

function errorResponse(error: unknown, fallback: string) {
  const status = error instanceof SmartThingsIntegrationError ? error.status : 500
  console.error('[smartthings]', error)
  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallback },
    { status },
  )
}

export async function GET(request: Request) {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  try {
    const days = Number(new URL(request.url).searchParams.get('days') || 7)
    return NextResponse.json(await getSmartThingsEnvironmentDashboard(days), {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    return errorResponse(error, '온습도 정보를 불러오지 못했습니다.')
  }
}

export async function POST() {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  try {
    return NextResponse.json({ ok: true, ...(await collectSmartThingsSensors()) })
  } catch (error) {
    return errorResponse(error, '온습도 값을 저장하지 못했습니다.')
  }
}
