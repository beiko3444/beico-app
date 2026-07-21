import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/requireAdmin'
import { getWormAwbCustomsMonitor } from '@/lib/wormCustomsMonitor'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  const awbNumber = new URL(request.url).searchParams.get('awbNumber')?.trim() || ''
  if (!awbNumber) {
    return NextResponse.json({ error: 'awbNumber is required.' }, { status: 400 })
  }

  const monitor = await getWormAwbCustomsMonitor(awbNumber)
  if (!monitor) return NextResponse.json({ monitor: null })

  return NextResponse.json({
    monitor: {
      awbNumber: monitor.awbNumber,
      status: monitor.status,
      lastStatus: monitor.lastStatus,
      checkCount: monitor.checkCount,
      lastCheckedAt: monitor.lastCheckedAt?.toISOString() || null,
      nextCheckAt: monitor.nextCheckAt.toISOString(),
      completionDetectedAt: monitor.completionDetectedAt?.toISOString() || null,
      notifiedAt: monitor.notifiedAt?.toISOString() || null,
      lastError: monitor.lastError,
    },
  })
}
