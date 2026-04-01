import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { upsertWormOrderEmailMatch } from '@/lib/wormOrderMail'

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const uid = typeof body?.uid === 'string' ? body.uid.trim() : ''
    const orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : ''
    const subject = typeof body?.subject === 'string' ? body.subject : ''
    const date = typeof body?.date === 'string' ? body.date : ''

    if (!uid) {
      return NextResponse.json({ error: 'uid is required.' }, { status: 400 })
    }
    if (!orderId || !isUuid(orderId)) {
      return NextResponse.json({ error: '유효한 orderId가 필요합니다.' }, { status: 400 })
    }

    const order = await prisma.wormOrder.findUnique({
      where: { id: orderId },
      select: { id: true, orderNumber: true },
    })
    if (!order) {
      return NextResponse.json({ error: '매칭할 발주를 찾을 수 없습니다.' }, { status: 404 })
    }

    const saved = await upsertWormOrderEmailMatch({
      uid,
      orderId,
      subject,
      date,
    })

    return NextResponse.json({
      ok: true,
      match: {
        uid: saved.uid,
        orderId: saved.orderId,
        orderNumber: saved.order.orderNumber,
        matchedAt: saved.matchedAt.toISOString(),
      },
    })
  } catch (error: unknown) {
    console.error('Failed to match worm email to order:', error)
    const message = error instanceof Error ? error.message : '이메일 매칭 처리 중 오류가 발생했습니다.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
