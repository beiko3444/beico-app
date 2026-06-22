import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { processDepositSms } from '@/lib/depositSmsMatcher'
import { createDepositSmsHash } from '@/lib/depositSms'
import { sendDepositMatchAdminPush } from '@/lib/adminPush'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface DepositSmsIngestBody {
  messageHash?: unknown
  sender?: unknown
  body?: unknown
  message?: unknown
  receivedAt?: unknown
  amount?: unknown
  depositorName?: unknown
  bankName?: unknown
  sourceDevice?: unknown
}

export async function POST(request: Request) {
  const secret = process.env.DEPOSIT_SMS_INGEST_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'DEPOSIT_SMS_INGEST_SECRET이 설정되지 않았습니다.' }, { status: 500 })
  }

  if (!isAuthorized(request, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let requestMessageHash: string | null = null

  try {
    const payload = (await request.json()) as DepositSmsIngestBody
    const sender = toNonEmptyString(payload.sender)
    const body = toNonEmptyString(payload.body) || toNonEmptyString(payload.message)
    if (!sender || !body) {
      return NextResponse.json({ error: 'sender와 body는 필수입니다.' }, { status: 400 })
    }

    const receivedAt = toDate(payload.receivedAt) || new Date()
    const messageHash = toNonEmptyString(payload.messageHash) || createDepositSmsHash({ sender, body, receivedAt })
    requestMessageHash = messageHash
    const result = await processDepositSms({
        messageHash,
        sender,
        body,
        receivedAt,
        amount: payload.amount,
        depositorName: toNonEmptyString(payload.depositorName),
        bankName: toNonEmptyString(payload.bankName),
        sourceDevice: toNonEmptyString(payload.sourceDevice),
      }, {
        storeNonDeposit: true,
    })
    if (!('idempotent' in result && result.idempotent)) {
      sendDepositMatchAdminPush({
        matchStatus: result.matchStatus,
        amount: result.amount,
        depositorName: toNonEmptyString(payload.depositorName) || sender,
      }).catch((pushError) => console.error('Deposit SMS push error:', pushError))
    }
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      if (requestMessageHash) {
        const existing = await prisma.depositSms.findUnique({ where: { messageHash: requestMessageHash } })
        if (existing) {
          return NextResponse.json({
            success: true,
            idempotent: true,
            depositSmsId: existing.id,
            matchStatus: existing.matchStatus,
            matchedOrderId: existing.matchedOrderId,
            amount: existing.amount,
          })
        }
      }
    }
    console.error('Deposit SMS ingest error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '입금 문자 처리에 실패했습니다.' },
      { status: 500 }
    )
  }
}

function isAuthorized(request: Request, secret: string) {
  const authorization = request.headers.get('authorization') || ''
  const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  const headerSecret = request.headers.get('x-deposit-sms-secret') || ''
  return bearer === secret || headerSecret === secret
}

function toNonEmptyString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function toDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
