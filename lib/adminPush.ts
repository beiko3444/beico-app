import { getFirebaseMessaging } from '@/lib/firebaseAdmin'
import { prisma } from '@/lib/prisma'
import {
  buildDepositMatchPushPayload,
  buildMobileMessagePushPayload,
  buildNewOrderPushPayload,
} from '@/lib/adminPushPayload.mjs'

type AdminPushPayload = {
  title: string
  body: string
  url: string
  data: Record<string, string>
}

type NewOrderPushInput = {
  orderNumber: string | null
  customerName: string | null
  total: number
  itemsCount: number
}

type MobileMessagePushInput = {
  count: number
  sender: string | null
  body: string
}

type DepositMatchPushInput = {
  matchStatus: string
  amount: number | null | undefined
  depositorName: string | null | undefined
}

function isUnregisteredFcmError(code: string | undefined) {
  return code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token'
}

export async function sendAdminAlertPush(payload: AdminPushPayload) {
  const tokens = await prisma.pushToken.findMany({
    where: {
      enabled: true,
      platform: { startsWith: 'alerts:' },
      user: { role: 'ADMIN' },
    },
    select: {
      id: true,
      token: true,
    },
  })

  if (!tokens.length) {
    return { attempted: 0, sent: 0, failed: 0, disabled: 0 }
  }

  const messaging = getFirebaseMessaging()
  let sent = 0
  let failed = 0
  const disableTokenIds: string[] = []

  for (const row of tokens) {
    try {
      await messaging.send({
        token: row.token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data,
        android: {
          priority: 'high',
          notification: {
            channelId: 'beiko_alerts',
            sound: 'default',
          },
        },
      })
      sent += 1
    } catch (error) {
      failed += 1
      const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code) : undefined
      if (isUnregisteredFcmError(code)) disableTokenIds.push(row.id)
      console.error('[admin-push] failed to send alert push', error)
    }
  }

  if (disableTokenIds.length) {
    await prisma.pushToken.updateMany({
      where: { id: { in: disableTokenIds } },
      data: { enabled: false },
    })
  }

  return {
    attempted: tokens.length,
    sent,
    failed,
    disabled: disableTokenIds.length,
  }
}

export async function sendNewOrderAdminPush(input: NewOrderPushInput) {
  return sendAdminAlertPush(buildNewOrderPushPayload(input))
}

export async function sendMobileMessageAdminPush(input: MobileMessagePushInput) {
  return sendAdminAlertPush(buildMobileMessagePushPayload(input))
}

export async function sendDepositMatchAdminPush(input: DepositMatchPushInput) {
  return sendAdminAlertPush(buildDepositMatchPushPayload(input))
}
