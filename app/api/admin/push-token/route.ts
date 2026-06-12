import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/requireAdmin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  const { session, unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  const body = await request.json().catch(() => ({}))
  const token = typeof body?.token === 'string' ? body.token.trim() : ''
  const platform = typeof body?.platform === 'string' ? body.platform.trim().slice(0, 30) : 'unknown'

  if (!token) {
    return NextResponse.json({ error: '푸시 토큰이 없습니다.' }, { status: 400 })
  }

  const saved = await prisma.pushToken.upsert({
    where: { token },
    create: {
      userId: session.user.id,
      token,
      platform,
      enabled: true,
      lastSeenAt: new Date(),
    },
    update: {
      userId: session.user.id,
      platform,
      enabled: true,
      lastSeenAt: new Date(),
    },
    select: {
      id: true,
      platform: true,
      enabled: true,
      lastSeenAt: true,
    },
  })

  return NextResponse.json({ ok: true, token: saved })
}
