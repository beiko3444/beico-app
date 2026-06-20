import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseDepositSms } from '@/lib/depositSms'
import { processDepositSms } from '@/lib/depositSmsMatcher'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_BATCH_SIZE = 500

interface MobileMessageBatchBody {
  username?: unknown
  userId?: unknown
  sourceDevice?: unknown
  messages?: unknown
}

interface IncomingMobileMessage {
  deviceMessageId?: unknown
  messageType?: unknown
  direction?: unknown
  sender?: unknown
  senderName?: unknown
  body?: unknown
  receivedAt?: unknown
  threadId?: unknown
  sourceDevice?: unknown
}

type NormalizedMobileMessage = {
  deviceMessageId: string
  messageType: string
  direction: string
  sender: string | null
  senderName: string | null
  body: string
  receivedAt: Date
  threadId: string | null
  sourceDevice: string | null
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
    const payload = (await request.json()) as MobileMessageBatchBody
    const messages = Array.isArray(payload.messages) ? payload.messages as IncomingMobileMessage[] : []
    if (messages.length === 0) {
      return NextResponse.json({ error: 'messages 배열은 필수입니다.' }, { status: 400 })
    }
    if (messages.length > MAX_BATCH_SIZE) {
      return NextResponse.json({ error: `한 번에 최대 ${MAX_BATCH_SIZE}건까지 저장할 수 있습니다.` }, { status: 400 })
    }

    const username = toNonEmptyString(payload.username)
    const userId = toNonEmptyString(payload.userId)
    const user = await prisma.user.findFirst({
      where: userId ? { id: userId } : { username: username || '' },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ error: '문자를 저장할 사용자를 찾을 수 없습니다.' }, { status: 404 })
    }

    const defaultSourceDevice = toNonEmptyString(payload.sourceDevice)
    const rows = messages
      .map((message) => normalizeMessage(message, defaultSourceDevice))
      .filter((message): message is NormalizedMobileMessage => message !== null)

    if (rows.length === 0) {
      return NextResponse.json({ error: '저장 가능한 문자 데이터가 없습니다.' }, { status: 400 })
    }

    const result = await prisma.mobileMessage.createMany({
      data: rows.map((message) => ({
        userId: user.id,
        deviceMessageId: message.deviceMessageId,
        messageType: message.messageType,
        direction: message.direction,
        sender: message.sender,
        senderName: message.senderName,
        body: message.body,
        receivedAt: message.receivedAt,
        threadId: message.threadId,
        sourceDevice: message.sourceDevice,
      })),
      skipDuplicates: true,
    })

    const senderNameUpdates = rows
      .filter((message) => message.senderName)
      .map((message) =>
        prisma.mobileMessage.updateMany({
          where: {
            userId: user.id,
            deviceMessageId: message.deviceMessageId,
          },
          data: {
            senderName: message.senderName,
          },
        })
      )
    if (senderNameUpdates.length > 0) {
      await prisma.$transaction(senderNameUpdates)
    }

    const depositMatches = await processDepositMatches(rows)

    return NextResponse.json({
      success: true,
      accepted: rows.length,
      inserted: result.count,
      duplicates: rows.length - result.count,
      depositMatches,
    })
  } catch (error) {
    console.error('Mobile message batch ingest error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '문자 저장에 실패했습니다.' },
      { status: 500 }
    )
  }
}

async function processDepositMatches(rows: NormalizedMobileMessage[]) {
  let checked = 0
  let autoConfirmed = 0
  let actionRequired = 0
  let errors = 0

  for (const message of rows) {
    const parsed = parseDepositSms({ body: message.body })
    if (!parsed.isDeposit) continue
    checked++

    try {
      const result = await processDepositSms({
        sender: message.sender || message.senderName || 'UNKNOWN',
        body: message.body,
        receivedAt: message.receivedAt,
        sourceDevice: message.sourceDevice,
      }, {
        storeNonDeposit: false,
      })
      if (result.matchStatus === 'AUTO_CONFIRMED') autoConfirmed++
      if (result.matchStatus === 'UNMATCHED' || result.matchStatus === 'AMBIGUOUS') actionRequired++
    } catch (error) {
      errors++
      console.error('Mobile message deposit match error:', error)
    }
  }

  return {
    checked,
    autoConfirmed,
    actionRequired,
    errors,
  }
}

function normalizeMessage(message: IncomingMobileMessage, defaultSourceDevice: string | null): NormalizedMobileMessage | null {
  const deviceMessageId = toNonEmptyString(message.deviceMessageId)
  const body = toNonEmptyString(message.body)
  if (!deviceMessageId || !body) return null

  const messageType = normalizeEnum(message.messageType, ['SMS', 'MMS'], 'SMS')
  const direction = normalizeEnum(message.direction, ['INBOUND'], 'INBOUND')
  const receivedAt = toDate(message.receivedAt) || new Date()

  return {
    deviceMessageId,
    messageType,
    direction,
    sender: toNonEmptyString(message.sender),
    senderName: toNonEmptyString(message.senderName),
    body,
    receivedAt,
    threadId: toNonEmptyString(message.threadId),
    sourceDevice: toNonEmptyString(message.sourceDevice) || defaultSourceDevice,
  }
}

function isAuthorized(request: Request, secret: string) {
  const authorization = request.headers.get('authorization') || ''
  const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  const headerSecret = request.headers.get('x-mobile-message-secret') || ''
  return bearer === secret || headerSecret === secret
}

function normalizeEnum(value: unknown, allowed: string[], fallback: string) {
  const text = toNonEmptyString(value)?.toUpperCase()
  return text && allowed.includes(text) ? text : fallback
}

function toNonEmptyString(value: unknown) {
  if (typeof value !== 'string') return null
  const sanitized = value.replace(/\u0000/g, '').trim()
  return sanitized ? sanitized : null
}

function toDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
