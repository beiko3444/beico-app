import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { calculateOrderFinalAmount } from '@/lib/orderAmount'
import {
  DEPOSIT_SMS_STATUSES,
  createDepositSmsHash,
  parseDepositSms,
} from '@/lib/depositSms'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const EXCLUDED_ORDER_STATUSES = ['CANCELED', 'SHIPPED']

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
    const parsed = parseDepositSms({ body, amount: payload.amount })
    const amount = parsed.amount
    const depositorName = toNonEmptyString(payload.depositorName) || parsed.depositorName
    const bankName = toNonEmptyString(payload.bankName) || parsed.bankName
    const sourceDevice = toNonEmptyString(payload.sourceDevice)

    const existing = await prisma.depositSms.findUnique({
      where: { messageHash },
      select: { id: true, matchStatus: true, matchedOrderId: true, amount: true },
    })
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

    if (!parsed.isDeposit || !amount) {
      const sms = await prisma.depositSms.create({
        data: {
          messageHash,
          sender,
          body,
          receivedAt,
          amount,
          depositorName,
          bankName,
          sourceDevice,
          matchStatus: DEPOSIT_SMS_STATUSES.NOT_DEPOSIT,
        },
      })
      return NextResponse.json({
        success: true,
        depositSmsId: sms.id,
        matchStatus: sms.matchStatus,
        amount,
      })
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const candidateOrders = await prisma.order.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
        adminDepositConfirmedAt: null,
        status: { notIn: EXCLUDED_ORDER_STATUSES },
      },
      select: {
        id: true,
        status: true,
        depositConfirmedAt: true,
        adminDepositConfirmedAt: true,
        items: { select: { quantity: true, price: true } },
      },
    })

    const amountMatchedOrders = candidateOrders
      .map((order) => ({
        ...order,
        calculatedAmount: calculateOrderFinalAmount(order.items).finalAmount,
      }))
      .filter((order) => order.calculatedAmount === amount)

    const candidateOrderIds = amountMatchedOrders.map((order) => order.id)

    if (amountMatchedOrders.length === 0) {
      const sms = await createDepositSmsSafely({
        messageHash,
        sender,
        body,
        receivedAt,
        amount,
        depositorName,
        bankName,
        sourceDevice,
        matchStatus: DEPOSIT_SMS_STATUSES.UNMATCHED,
        candidateOrderIds,
      })
      return NextResponse.json({
        success: true,
        depositSmsId: sms.id,
        matchStatus: sms.matchStatus,
        amount,
      })
    }

    if (amountMatchedOrders.length > 1) {
      const sms = await createDepositSmsSafely({
        messageHash,
        sender,
        body,
        receivedAt,
        amount,
        depositorName,
        bankName,
        sourceDevice,
        matchStatus: DEPOSIT_SMS_STATUSES.AMBIGUOUS,
        candidateOrderIds,
      })
      return NextResponse.json({
        success: true,
        depositSmsId: sms.id,
        matchStatus: sms.matchStatus,
        amount,
        candidateOrderIds,
      })
    }

    const matchedOrder = amountMatchedOrders[0]
    const confirmedAt = receivedAt || new Date()
    const result = await prisma.$transaction(async (tx) => {
      const freshOrder = await tx.order.findUnique({
        where: { id: matchedOrder.id },
        select: { id: true, adminDepositConfirmedAt: true },
      })
      if (!freshOrder || freshOrder.adminDepositConfirmedAt) {
        const sms = await tx.depositSms.create({
          data: {
            messageHash,
            sender,
            body,
            receivedAt,
            amount,
            depositorName,
            bankName,
            sourceDevice,
            matchStatus: DEPOSIT_SMS_STATUSES.DUPLICATE_OR_ALREADY_CONFIRMED,
            matchedOrderId: matchedOrder.id,
            candidateOrderIds,
          },
        })
        return { sms, orderUpdated: false }
      }

      const sms = await tx.depositSms.create({
        data: {
          messageHash,
          sender,
          body,
          receivedAt,
          amount,
          depositorName,
          bankName,
          sourceDevice,
          matchStatus: DEPOSIT_SMS_STATUSES.AUTO_CONFIRMED,
          matchedOrderId: matchedOrder.id,
          matchedAt: new Date(),
          candidateOrderIds,
        },
      })

      await tx.order.update({
        where: { id: matchedOrder.id },
        data: {
          status: 'DEPOSIT_COMPLETED',
          depositConfirmedAt: confirmedAt,
          adminDepositConfirmedAt: confirmedAt,
        },
      })

      return { sms, orderUpdated: true }
    })

    return NextResponse.json({
      success: true,
      depositSmsId: result.sms.id,
      matchStatus: result.sms.matchStatus,
      matchedOrderId: result.sms.matchedOrderId,
      orderUpdated: result.orderUpdated,
      amount,
    })
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

async function createDepositSmsSafely(data: Prisma.DepositSmsCreateInput) {
  try {
    return await prisma.depositSms.create({ data })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await prisma.depositSms.findUnique({ where: { messageHash: data.messageHash } })
      if (existing) return existing
    }
    throw error
  }
}
