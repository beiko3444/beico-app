import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { calculateOrderFinalAmount } from '@/lib/orderAmount'
import {
  DEPOSIT_SMS_STATUSES,
  createDepositSmsHash,
  parseDepositSms,
} from '@/lib/depositSms'
import {
  getDepositMatchOrderCreatedAtRange,
  isDepositWithinOrderMatchWindow,
} from '@/lib/depositMatchWindow.mjs'

const EXCLUDED_ORDER_STATUSES = ['CANCELED', 'SHIPPED']

type DbClient = typeof prisma

export interface ProcessDepositSmsInput {
  messageHash?: string | null
  sender: string
  body: string
  receivedAt: Date
  amount?: unknown
  depositorName?: string | null
  bankName?: string | null
  sourceDevice?: string | null
}

export interface ProcessDepositSmsOptions {
  storeNonDeposit?: boolean
}

export async function processDepositSms(
  input: ProcessDepositSmsInput,
  options: ProcessDepositSmsOptions = {},
  db: DbClient = prisma
) {
  const storeNonDeposit = options.storeNonDeposit ?? true
  const messageHash = input.messageHash || createDepositSmsHash({
    sender: input.sender,
    body: input.body,
    receivedAt: input.receivedAt,
  })
  const parsed = parseDepositSms({ body: input.body, amount: input.amount })
  const amount = parsed.amount
  const depositorName = input.depositorName || parsed.depositorName
  const bankName = input.bankName || parsed.bankName

  const existing = await db.depositSms.findUnique({
    where: { messageHash },
    select: { id: true, matchStatus: true, matchedOrderId: true, amount: true },
  })
  if (existing) {
    return {
      success: true,
      idempotent: true,
      depositSmsId: existing.id,
      matchStatus: existing.matchStatus,
      matchedOrderId: existing.matchedOrderId,
      amount: existing.amount,
      orderUpdated: false,
    }
  }

  if (!parsed.isDeposit || !amount) {
    if (!storeNonDeposit) {
      return {
        success: true,
        skipped: true,
        matchStatus: DEPOSIT_SMS_STATUSES.NOT_DEPOSIT,
        amount,
        orderUpdated: false,
      }
    }

    const sms = await createDepositSmsSafely({
      messageHash,
      sender: input.sender,
      body: input.body,
      receivedAt: input.receivedAt,
      amount,
      depositorName,
      bankName,
      sourceDevice: input.sourceDevice,
      matchStatus: DEPOSIT_SMS_STATUSES.NOT_DEPOSIT,
    }, db)
    return {
      success: true,
      depositSmsId: sms.id,
      matchStatus: sms.matchStatus,
      amount,
      orderUpdated: false,
    }
  }

  const orderCreatedAtRange = getDepositMatchOrderCreatedAtRange(input.receivedAt)
  const candidateOrders = await db.order.findMany({
    where: {
      createdAt: orderCreatedAtRange,
      adminDepositConfirmedAt: null,
      status: { notIn: EXCLUDED_ORDER_STATUSES },
    },
    select: {
      id: true,
      createdAt: true,
      status: true,
      depositConfirmedAt: true,
      adminDepositConfirmedAt: true,
      items: { select: { quantity: true, price: true } },
      user: {
        select: {
          name: true,
          username: true,
          partnerProfile: {
            select: {
              businessName: true,
              representativeName: true,
            },
          },
        },
      },
    },
  })

  const amountMatchedOrders = candidateOrders
    .map((order) => ({
      ...order,
      calculatedAmount: calculateOrderFinalAmount(order.items).finalAmount,
    }))
    .filter((order) =>
      order.calculatedAmount === amount &&
      isDepositWithinOrderMatchWindow(order.createdAt, input.receivedAt)
    )

  const nameMatchedOrders = amountMatchedOrders.filter((order) =>
    matchesOrderName(order, depositorName, input.body)
  )
  const effectiveMatches = nameMatchedOrders.length > 0 ? nameMatchedOrders : amountMatchedOrders
  const candidateOrderIds = effectiveMatches.map((order) => order.id)

  if (amountMatchedOrders.length === 0) {
    const sms = await createDepositSmsSafely({
      messageHash,
      sender: input.sender,
      body: input.body,
      receivedAt: input.receivedAt,
      amount,
      depositorName,
      bankName,
      sourceDevice: input.sourceDevice,
      matchStatus: DEPOSIT_SMS_STATUSES.UNMATCHED,
      candidateOrderIds: [],
    }, db)
    return {
      success: true,
      depositSmsId: sms.id,
      matchStatus: sms.matchStatus,
      amount,
      orderUpdated: false,
    }
  }

  if (effectiveMatches.length > 1) {
    const sms = await createDepositSmsSafely({
      messageHash,
      sender: input.sender,
      body: input.body,
      receivedAt: input.receivedAt,
      amount,
      depositorName,
      bankName,
      sourceDevice: input.sourceDevice,
      matchStatus: DEPOSIT_SMS_STATUSES.AMBIGUOUS,
      candidateOrderIds,
    }, db)
    return {
      success: true,
      depositSmsId: sms.id,
      matchStatus: sms.matchStatus,
      amount,
      candidateOrderIds,
      orderUpdated: false,
    }
  }

  const matchedOrder = effectiveMatches[0]
  const confirmedAt = input.receivedAt || new Date()
  const result = await db.$transaction(async (tx) => {
    const freshOrder = await tx.order.findUnique({
      where: { id: matchedOrder.id },
      select: { id: true, adminDepositConfirmedAt: true },
    })
    if (!freshOrder || freshOrder.adminDepositConfirmedAt) {
      const sms = await tx.depositSms.create({
        data: {
          messageHash,
          sender: input.sender,
          body: input.body,
          receivedAt: input.receivedAt,
          amount,
          depositorName,
          bankName,
          sourceDevice: input.sourceDevice,
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
        sender: input.sender,
        body: input.body,
        receivedAt: input.receivedAt,
        amount,
        depositorName,
        bankName,
        sourceDevice: input.sourceDevice,
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

  return {
    success: true,
    depositSmsId: result.sms.id,
    matchStatus: result.sms.matchStatus,
    matchedOrderId: result.sms.matchedOrderId,
    orderUpdated: result.orderUpdated,
    amount,
    candidateOrderIds,
  }
}

async function createDepositSmsSafely(data: Prisma.DepositSmsCreateInput, db: DbClient) {
  try {
    return await db.depositSms.create({ data })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await db.depositSms.findUnique({ where: { messageHash: data.messageHash } })
      if (existing) return existing
    }
    throw error
  }
}

function matchesOrderName(
  order: {
    user?: {
      name?: string | null
      username?: string | null
      partnerProfile?: {
        businessName?: string | null
        representativeName?: string | null
      } | null
    } | null
  },
  depositorName: string | null,
  body: string
) {
  const haystack = normalizeName(`${depositorName || ''} ${body}`)
  if (!haystack) return false

  const candidates = [
    order.user?.name,
    order.user?.username,
    order.user?.partnerProfile?.businessName,
    order.user?.partnerProfile?.representativeName,
  ]
    .map((value) => normalizeName(value || ''))
    .filter((value) => value.length >= 2)

  return candidates.some((candidate) =>
    haystack.includes(candidate) || candidate.includes(haystack)
  )
}

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/주식회사|유한회사|\(주\)|㈜|회사|상사|무역|도매|소매/g, '')
    .replace(/[^0-9a-z가-힣]/g, '')
    .trim()
}
