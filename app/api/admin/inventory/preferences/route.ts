import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/requireAdmin'
import { uniqueInventoryIds, type InventoryPreferencesPayload } from '@/lib/smartInventoryPrefs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function normalizePreferences(row: {
  favoriteMasterIds: unknown
  masterOrder: unknown
} | null): InventoryPreferencesPayload {
  return {
    favoriteMasterIds: uniqueInventoryIds(row?.favoriteMasterIds),
    masterOrder: uniqueInventoryIds(row?.masterOrder),
  }
}

export async function GET() {
  const { session, unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  const preferences = await prisma.inventoryPreference.findUnique({
    where: { userId: session.user.id },
  })

  return NextResponse.json(normalizePreferences(preferences), {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}

export async function PUT(request: Request) {
  const { session, unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  const body = await request.json().catch(() => ({}))
  const current = await prisma.inventoryPreference.findUnique({
    where: { userId: session.user.id },
  })
  const normalizedCurrent = normalizePreferences(current)

  const favoriteMasterIds =
    Object.prototype.hasOwnProperty.call(body, 'favoriteMasterIds')
      ? uniqueInventoryIds(body.favoriteMasterIds)
      : normalizedCurrent.favoriteMasterIds
  const masterOrder =
    Object.prototype.hasOwnProperty.call(body, 'masterOrder')
      ? uniqueInventoryIds(body.masterOrder)
      : normalizedCurrent.masterOrder

  const preferences = await prisma.inventoryPreference.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      favoriteMasterIds,
      masterOrder,
    },
    update: {
      favoriteMasterIds,
      masterOrder,
    },
  })

  return NextResponse.json(normalizePreferences(preferences), {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
