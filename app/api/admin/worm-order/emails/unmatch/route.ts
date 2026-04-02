import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { deleteWormOrderEmailMatch } from '@/lib/wormOrderMail'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const uid = typeof body?.uid === 'string' ? body.uid.trim() : ''

    if (!uid) {
      return NextResponse.json({ error: 'uid is required.' }, { status: 400 })
    }

    const result = await deleteWormOrderEmailMatch(uid)
    return NextResponse.json({ ok: true, uid: result.uid })
  } catch (error: unknown) {
    console.error('Failed to unmatch worm email:', error)
    const message = error instanceof Error ? error.message : '매칭 해제 중 오류가 발생했습니다.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
