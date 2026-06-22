import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RegisterBody = {
  token?: unknown
  platform?: unknown
  deviceName?: unknown
}

export async function POST(request: Request) {
  const secret = process.env.BEIKO_ALERT_APP_REGISTER_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'BEIKO_ALERT_APP_REGISTER_SECRET이 설정되지 않았습니다.' }, { status: 500 })
  }
  if (!isAuthorized(request, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({} as RegisterBody))
  const token = toText(body.token)
  if (!token) {
    return NextResponse.json({ error: '푸시 토큰이 없습니다.' }, { status: 400 })
  }

  const adminUsername = toText(process.env.BEIKO_ALERT_APP_ADMIN_USERNAME)
  const admin = await prisma.user.findFirst({
    where: adminUsername ? { username: adminUsername, role: 'ADMIN' } : { role: 'ADMIN' },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })
  if (!admin) {
    return NextResponse.json({ error: '알림 토큰을 연결할 관리자 계정이 없습니다.' }, { status: 404 })
  }

  const platformSuffix = toText(body.platform) || 'android'
  const deviceName = toText(body.deviceName)
  const saved = await prisma.pushToken.upsert({
    where: { token },
    create: {
      userId: admin.id,
      token,
      platform: `alerts:${platformSuffix}`.slice(0, 30),
      enabled: true,
      lastSeenAt: new Date(),
    },
    update: {
      userId: admin.id,
      platform: `alerts:${platformSuffix}`.slice(0, 30),
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

  return NextResponse.json({
    ok: true,
    token: saved,
    deviceName,
  })
}

function isAuthorized(request: Request, secret: string) {
  const authorization = request.headers.get('authorization') || ''
  const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  const headerSecret = request.headers.get('x-alert-app-secret') || ''
  return bearer === secret || headerSecret === secret
}

function toText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}
