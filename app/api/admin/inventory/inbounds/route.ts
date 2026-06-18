import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/requireAdmin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DEFAULT_WAREHOUSE_ITEMS = [
  {
    name: 'BEIKO 퀵베이트V3 청갯지렁이',
    productCode: 'quickbait-green',
    imageUrl: '/inventory-assets/quickbait-green.png',
    sortOrder: 10,
  },
  {
    name: 'BEIKO 퀵베이트V3 홍갯지렁이',
    productCode: 'quickbait-red',
    imageUrl: '/inventory-assets/quickbait-red.png',
    sortOrder: 20,
  },
  {
    name: 'BEIKO 퀵베이트V3 혼무시',
    productCode: 'quickbait-blue',
    imageUrl: '/inventory-assets/quickbait-blue.png',
    sortOrder: 30,
  },
  {
    name: 'BEIKO 퀵베이트V3 멍게',
    productCode: 'quickbait-orange',
    imageUrl: '/inventory-assets/quickbait-orange.png',
    sortOrder: 40,
  },
  {
    name: 'BEIKO 퀵베이트V3 번데기',
    productCode: 'quickbait-yellow',
    imageUrl: '/inventory-assets/quickbait-yellow.png',
    sortOrder: 50,
  },
]

export async function GET(request: Request) {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  const url = new URL(request.url)
  const inboundDate = parseInboundDate(url.searchParams.get('date')) || todayStart()
  const nextDate = new Date(inboundDate)
  nextDate.setDate(nextDate.getDate() + 1)
  const monthStart = new Date(inboundDate)
  monthStart.setDate(1)
  const monthEnd = new Date(monthStart)
  monthEnd.setMonth(monthEnd.getMonth() + 1)

  await ensureWarehouseInventoryItems()

  const [items, monthItems, warehouseItems] = await Promise.all([
    prisma.inventoryInbound.findMany({
      where: {
        inboundDate: {
          gte: inboundDate,
          lt: nextDate,
        },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        inboundDate: true,
        masterId: true,
        warehouseItemId: true,
        productName: true,
        productImageUrl: true,
        quantity: true,
        createdAt: true,
        createdBy: { select: { name: true, username: true } },
      },
    }),
    prisma.inventoryInbound.findMany({
      where: {
        inboundDate: {
          gte: monthStart,
          lt: monthEnd,
        },
      },
      select: {
        inboundDate: true,
        quantity: true,
      },
    }),
    prisma.warehouseInventoryItem.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        nameJP: true,
        productCode: true,
        imageUrl: true,
        stock: true,
      },
      orderBy: { sortOrder: 'asc' },
    }),
  ])

  const calendar = Array.from(
    monthItems.reduce((map, item) => {
      const date = formatYmd(item.inboundDate)
      const current = map.get(date) || { date, totalQuantity: 0, count: 0 }
      current.totalQuantity += item.quantity
      current.count += 1
      map.set(date, current)
      return map
    }, new Map<string, { date: string; totalQuantity: number; count: number }>()).values(),
  ).sort((a, b) => a.date.localeCompare(b.date))

  const quickProducts = warehouseItems.map((item, index) => ({
    id: index + 1,
    sourceId: item.id,
    name: item.name,
    nameJP: item.nameJP,
    productCode: item.productCode,
    imageUrl: item.imageUrl,
    stock: item.stock,
  }))

  return NextResponse.json({
    date: formatYmd(inboundDate),
    items,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    calendar,
    quickProducts,
  }, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}

export async function POST(request: Request) {
  const { session, unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  const body = await request.json().catch(() => ({}))
  const inboundDate = parseInboundDate(body?.inboundDate) || todayStart()
  const warehouseItemId = typeof body?.warehouseItemId === 'string' && body.warehouseItemId.trim() ? body.warehouseItemId.trim() : null
  const productName = typeof body?.productName === 'string' ? body.productName.trim() : ''
  const productImageUrl = typeof body?.productImageUrl === 'string' && body.productImageUrl.trim() ? body.productImageUrl.trim() : null
  const quantity = Number(body?.quantity)

  if (!warehouseItemId) {
    return NextResponse.json({ error: '상품 ID가 올바르지 않습니다.' }, { status: 400 })
  }
  if (!productName) {
    return NextResponse.json({ error: '상품명이 필요합니다.' }, { status: 400 })
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: '입고 수량은 1 이상이어야 합니다.' }, { status: 400 })
  }

  const item = await prisma.$transaction(async (tx) => {
    const warehouseItem = await tx.warehouseInventoryItem.findUnique({
      where: { id: warehouseItemId },
      select: { id: true, name: true, imageUrl: true },
    })

    if (!warehouseItem) {
      throw new Error('창고재고 상품을 찾지 못했습니다.')
    }

    await tx.warehouseInventoryItem.update({
      where: { id: warehouseItem.id },
      data: { stock: { increment: Math.trunc(quantity) } },
    })

    return tx.inventoryInbound.create({
      data: {
        inboundDate,
        warehouseItemId: warehouseItem.id,
        productName: warehouseItem.name || productName,
        productImageUrl: warehouseItem.imageUrl || productImageUrl,
        quantity: Math.trunc(quantity),
        createdById: session.user.id,
      },
      select: {
        id: true,
        inboundDate: true,
        masterId: true,
        warehouseItemId: true,
        productName: true,
        productImageUrl: true,
        quantity: true,
        createdAt: true,
        createdBy: { select: { name: true, username: true } },
      },
    })
  })

  return NextResponse.json({ success: true, item }, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}

function parseInboundDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00+09:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function todayStart() {
  return parseInboundDate(formatYmd(new Date())) || new Date()
}

function formatYmd(date: Date) {
  const koreaDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const year = koreaDate.getFullYear()
  const month = String(koreaDate.getMonth() + 1).padStart(2, '0')
  const day = String(koreaDate.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function ensureWarehouseInventoryItems() {
  await Promise.all(
    DEFAULT_WAREHOUSE_ITEMS.map((item) =>
      prisma.warehouseInventoryItem.upsert({
        where: { productCode: item.productCode },
        create: {
          ...item,
          stock: 0,
          active: true,
        },
        update: {
          name: item.name,
          imageUrl: item.imageUrl,
          sortOrder: item.sortOrder,
          active: true,
        },
      }),
    ),
  )
}
