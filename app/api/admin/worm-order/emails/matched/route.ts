import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/requireAdmin'
import { loadMatchedWormOrderEmails } from '@/lib/wormOrderMail'

export const dynamic = 'force-dynamic'

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value)
}

export async function GET(request: Request) {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  try {
    const { searchParams } = new URL(request.url)
    const orderId = (searchParams.get('orderId') || '').trim()
    if (!orderId || !isUuid(orderId)) {
      return NextResponse.json({ error: '유효한 orderId가 필요합니다.' }, { status: 400 })
    }

    const payload = await loadMatchedWormOrderEmails(orderId)
    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'private, max-age=20, stale-while-revalidate=120',
      },
    })
  } catch (error: unknown) {
    console.error('Failed to load matched worm emails:', error)
    const message = error instanceof Error ? error.message : '매칭된 메일 조회 중 오류가 발생했습니다.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
