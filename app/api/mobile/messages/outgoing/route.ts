import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_BATCH_SIZE = 20
const CLAIM_TIMEOUT_MS = 10 * 60 * 1000

function isAuthorized(request: Request, secret: string) {
  const authorization = request.headers.get('authorization') || ''
  const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  const headerSecret = request.headers.get('x-mobile-message-secret') || ''
  return bearer === secret || headerSecret === secret
}

function toNonEmptyString(value: unknown) {
  if (typeof value !== 'string') return null
  const sanitized = value.replace(/\u0000/g, '').trim()
  return sanitized ? sanitized : null
}

export async function GET(request: Request) {
  const secret = process.env.MOBILE_MESSAGE_INGEST_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'MOBILE_MESSAGE_INGEST_SECRET이 설정되지 않았습니다.' }, { status: 500 })
  }

  if (!isAuthorized(request, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const requestedLimit = Number.parseInt(searchParams.get('limit') || '10', 10)
    const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 10, 1), MAX_BATCH_SIZE)
    const sourceDevice = toNonEmptyString(searchParams.get('sourceDevice')) || null
    const claimBefore = new Date(Date.now() - CLAIM_TIMEOUT_MS)

    const messages = await prisma.mobileOutgoingMessage.findMany({
      where: {
        OR: [
          { status: 'PENDING' },
          {
            status: 'CLAIMED',
            claimedAt: { lt: claimBefore },
          },
        ],
      },
      orderBy: [{ createdAt: 'asc' }],
      take: limit,
      select: {
        id: true,
        toName: true,
        toNumber: true,
        body: true,
      },
    })

    if (messages.length > 0) {
      await prisma.mobileOutgoingMessage.updateMany({
        where: {
          id: { in: messages.map((message) => message.id) },
        },
        data: {
          status: 'CLAIMED',
          claimedAt: new Date(),
          sourceDevice,
          attemptCount: { increment: 1 },
        },
      })
    }

    return NextResponse.json({
      success: true,
      messages,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '발송 대기 문자를 불러오지 못했습니다.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
