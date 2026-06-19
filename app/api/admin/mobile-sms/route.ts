import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MOBILE_SMS_LIMIT = 200

function normalizeDigits(value: string) {
  return value.replace(/\D/g, '')
}

function normalizeText(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.replace(/\u0000/g, '').trim()
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const messages = await prisma.mobileOutgoingMessage.findMany({
      orderBy: [{ createdAt: 'desc' }],
      take: MOBILE_SMS_LIMIT,
      select: {
        id: true,
        toName: true,
        toNumber: true,
        body: true,
        status: true,
        attemptCount: true,
        sourceDevice: true,
        claimedAt: true,
        sentAt: true,
        failedAt: true,
        lastError: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ messages })
  } catch (error) {
    const message = error instanceof Error ? error.message : '휴대폰 문자 발송내역을 불러오지 못했습니다.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const toName = normalizeText(body?.toName)
    const toNumber = normalizeDigits(typeof body?.toNumber === 'string' ? body.toNumber : '')
    const contents = normalizeText(body?.contents)

    if (!toNumber) {
      return NextResponse.json({ error: '수신번호를 입력해주세요.' }, { status: 400 })
    }
    if (!contents) {
      return NextResponse.json({ error: '문자 내용을 입력해주세요.' }, { status: 400 })
    }

    const message = await prisma.mobileOutgoingMessage.create({
      data: {
        requestedById: session.user.id || null,
        toName: toName || null,
        toNumber,
        body: contents,
        status: 'PENDING',
      },
    })

    return NextResponse.json({
      success: true,
      message,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '휴대폰 문자 발송 등록에 실패했습니다.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
