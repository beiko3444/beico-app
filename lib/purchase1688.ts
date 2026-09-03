import seedData from '@/public/data/1688-initial-orders.json'
import { prisma } from '@/lib/prisma'

export const PURCHASE_1688_SEED_VERSION = 'xlsx-2026-09-03-v1'
export const PURCHASE_1688_STATUSES = ['확인필요', '결제완료', '배송중', '완료', '취소'] as const

export type Purchase1688Status = (typeof PURCHASE_1688_STATUSES)[number]

type SeedOrder = {
  id: string
  orderNo: string
  date: string
  shop: string
  product: string
  productKo?: string
  spec: string
  qty: number
  unitPrice: number
  total: number
  orderPaid: number
  status: string
  trackingNo: string
  note: string
  offerId: string
  skuId: string
  imageUrl: string
  sourceUrl: string
}

export async function ensurePurchase1688Seeded() {
  const setting = await prisma.purchase1688Setting.findUnique({ where: { id: 'default' } })
  if (setting?.seedVersion) return setting

  const orders = (seedData.orders as SeedOrder[]).map((item) => ({
    id: item.id,
    orderNo: item.orderNo,
    orderedOn: item.date,
    shop: item.shop || '',
    productCn: item.product,
    productKo: item.productKo || '',
    spec: item.spec || '',
    quantity: Math.max(1, Math.round(Number(item.qty) || 1)),
    unitPrice: Number(item.unitPrice) || 0,
    itemTotal: Number(item.total) || 0,
    orderPaid: Number(item.orderPaid) || 0,
    status: PURCHASE_1688_STATUSES.includes(item.status as Purchase1688Status) ? item.status : '확인필요',
    trackingNo: item.trackingNo || '',
    note: item.note || '',
    offerId: item.offerId || '',
    skuId: item.skuId || '',
    imageUrl: item.imageUrl || '',
    sourceUrl: item.sourceUrl || '',
  }))

  await prisma.$transaction([
    prisma.purchase1688Item.createMany({ data: orders, skipDuplicates: true }),
    prisma.purchase1688Setting.upsert({
      where: { id: 'default' },
      update: { seedVersion: PURCHASE_1688_SEED_VERSION },
      create: { id: 'default', cnyKrwRate: 204, seedVersion: PURCHASE_1688_SEED_VERSION },
    }),
  ])

  return prisma.purchase1688Setting.findUniqueOrThrow({ where: { id: 'default' } })
}

export function normalizePurchase1688Input(body: Record<string, unknown>) {
  const status = String(body.status || '확인필요')
  return {
    orderNo: String(body.orderNo || '').trim(),
    orderedOn: String(body.orderedOn || '').trim().slice(0, 10),
    shop: String(body.shop || '').trim(),
    productCn: String(body.productCn || '').trim(),
    productKo: String(body.productKo || '').trim(),
    spec: String(body.spec || '').trim(),
    quantity: Math.max(1, Math.round(Number(body.quantity) || 1)),
    unitPrice: Math.max(0, Number(body.unitPrice) || 0),
    itemTotal: Math.max(0, Number(body.itemTotal) || 0),
    orderPaid: Math.max(0, Number(body.orderPaid) || 0),
    status: PURCHASE_1688_STATUSES.includes(status as Purchase1688Status) ? status : '확인필요',
    trackingNo: String(body.trackingNo || '').trim(),
    note: String(body.note || '').trim(),
    offerId: String(body.offerId || '').trim(),
    skuId: String(body.skuId || '').trim(),
    imageUrl: String(body.imageUrl || '').trim(),
    sourceUrl: String(body.sourceUrl || '').trim(),
  }
}
