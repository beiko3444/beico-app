import { NextResponse } from 'next/server'
import { getWormEmailDetail } from '@/lib/wormOrderMail'
import { requireAdminSession } from '@/lib/requireAdmin'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  const { searchParams } = new URL(req.url)
  const uid = (searchParams.get('uid') || '').trim()

  if (!uid) {
    return NextResponse.json({ error: '요청 파라미터가 누락되었습니다. (uid)' }, { status: 400 })
  }

  try {
    const detail = await getWormEmailDetail(uid)
    return NextResponse.json(detail, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
      },
    })
  } catch (error: unknown) {
    console.error('Email Detail Error:', error)
    const message = error instanceof Error ? error.message : '메일 상세 조회 실패'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
