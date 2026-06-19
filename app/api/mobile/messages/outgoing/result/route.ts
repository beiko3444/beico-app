import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type OutgoingResult = {
  id?: unknown
  status?: unknown
  error?: unknown
}

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

export async function POST(request: Request) {
  const secret = process.env.MOBILE_MESSAGE_INGEST_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'MOBILE_MESSAGE_INGEST_SECRET이 설정되지 않았습니다.' }, { status: 500 })
  }

  if (!isAuthorized(request, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const payload = await request.json()
    const sourceDevice = toNonEmptyString(payload?.sourceDevice)
    const results = Array.isArray(payload?.results) ? payload.results as OutgoingResult[] : []

    if (results.length === 0) {
      return NextResponse.json({ error: 'results 배열은 필수입니다.' }, { status: 400 })
    }

    const updates = results
      .map((result) => {
        const id = toNonEmptyString(result.id)
        if (!id) return null
        const normalizedStatus = toNonEmptyString(result.status)?.toUpperCase() === 'SENT' ? 'SENT' : 'FAILED'
        const error = toNonEmptyString(result.error)
        return prisma.mobileOutgoingMessage.updateMany({
          where: { id },
          data: {
            status: normalizedStatus,
            sourceDevice: sourceDevice || undefined,
            sentAt: normalizedStatus === 'SENT' ? new Date() : undefined,
            failedAt: normalizedStatus === 'FAILED' ? new Date() : undefined,
            lastError: normalizedStatus === 'FAILED' ? error || '전송 실패' : null,
          },
        })
      })
      .filter((update): update is NonNullable<typeof update> => update !== null)

    if (updates.length > 0) {
      await prisma.$transaction(updates)
    }

    return NextResponse.json({
      success: true,
      accepted: updates.length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '발송 결과 저장에 실패했습니다.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
