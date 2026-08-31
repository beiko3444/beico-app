import type { Prisma } from '@prisma/client'

import { getAdminSession } from '@/lib/admin-session'

export const PRODUCT_STOCK_SOURCES = {
  CREATE: 'PRODUCT_CREATE',
  EDIT: 'PRODUCT_EDIT',
  PATCH: 'PRODUCT_PATCH',
  BULK: 'PRODUCT_BULK_EDIT',
} as const

type StockHistoryClient = Pick<Prisma.TransactionClient, 'productStockHistory'>

export function normalizeProductStock(value: unknown) {
  return Math.max(0, Math.round(Number(value) || 0))
}

export async function getProductStockActorId() {
  const session = await getAdminSession()
  return session?.user.id || null
}

export async function recordProductStockChange(
  tx: StockHistoryClient,
  {
    productId,
    previousStock,
    newStock,
    source,
    changedById,
    note,
  }: {
    productId: string
    previousStock: number
    newStock: number
    source: string
    changedById?: string | null
    note?: string | null
  },
) {
  if (previousStock === newStock) return null

  return tx.productStockHistory.create({
    data: {
      productId,
      previousStock,
      newStock,
      delta: newStock - previousStock,
      source,
      changedById: changedById || null,
      note: note || null,
    },
  })
}
