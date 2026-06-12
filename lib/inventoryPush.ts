import type { Prisma } from '@prisma/client'
import { getFirebaseMessaging } from '@/lib/firebaseAdmin'
import { prisma } from '@/lib/prisma'
import { fetchSmartInventoryDashboard, type SmartInventoryMasterRow } from '@/lib/smartInventoryClient'
import { uniqueInventoryIds } from '@/lib/smartInventoryPrefs'

type PushResult = {
  attempted: number
  sent: number
  failed: number
  disabled: number
  favoriteCount: number
  message: string
}

function formatStock(value: number | null | undefined) {
  if (value === null || value === undefined) return '-'
  return value.toLocaleString('ko-KR')
}

function compactName(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length > 18 ? `${normalized.slice(0, 18)}...` : normalized
}

function buildFavoriteInventoryBody(rows: SmartInventoryMasterRow[]) {
  if (!rows.length) return '즐겨찾기한 재고가 없습니다.'
  return rows
    .slice(0, 8)
    .map((row) => `${compactName(row.name)} N ${formatStock(row.naverStock)} / C ${formatStock(row.coupangStock)} / 총 ${formatStock(row.totalStock)}`)
    .join('\n')
}

function isUnregisteredFcmError(code: string | undefined) {
  return code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token'
}

export async function sendFavoriteInventoryPushToAdmins(): Promise<PushResult> {
  const [preferences, dashboard, tokens] = await Promise.all([
    prisma.inventoryPreference.findMany({
      where: {
        user: { role: 'ADMIN' },
      },
      include: {
        user: true,
      },
    }),
    fetchSmartInventoryDashboard({ refresh: true }),
    prisma.pushToken.findMany({
      where: {
        enabled: true,
        user: { role: 'ADMIN' },
      },
      select: {
        id: true,
        token: true,
      },
    }),
  ])

  const favoriteIds = uniqueInventoryIds(preferences.flatMap((preference) => preference.favoriteMasterIds as Prisma.JsonArray))
  const rowById = new Map(dashboard.rows.map((row) => [row.id, row]))
  const favoriteRows = favoriteIds.map((id) => rowById.get(id)).filter((row): row is SmartInventoryMasterRow => Boolean(row))
  const body = buildFavoriteInventoryBody(favoriteRows)
  const title = `즐겨찾기 재고 ${favoriteRows.length}개`

  if (!tokens.length) {
    return {
      attempted: 0,
      sent: 0,
      failed: 0,
      disabled: 0,
      favoriteCount: favoriteRows.length,
      message: '등록된 푸시 토큰이 없습니다.',
    }
  }

  const messaging = getFirebaseMessaging()
  let sent = 0
  let failed = 0
  const disableTokenIds: string[] = []

  for (const token of tokens) {
    try {
      await messaging.send({
        token: token.token,
        notification: {
          title,
          body,
        },
        data: {
          type: 'favorite_inventory',
          url: '/admin/inventory',
          favoriteCount: String(favoriteRows.length),
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'inventory',
            sound: 'default',
          },
        },
      })
      sent += 1
    } catch (error) {
      failed += 1
      const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code) : undefined
      if (isUnregisteredFcmError(code)) disableTokenIds.push(token.id)
      console.error('[inventory-push] failed to send push', error)
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
    favoriteCount: favoriteRows.length,
    message: body,
  }
}
