import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getProductImageUrl } from '@/lib/product-image-url'
import { formatKoreanYmd, koreanMonthRange, parseKoreanYmd } from '@/lib/inventoryInboundDates.mjs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DEFAULT_WAREHOUSE_ITEMS = [
  {
    name: 'BEIKO 퀵베이트V3 청갯지렁이',
    productCode: 'quickbait-green',
    keyword: '청갯지렁이',
    sortOrder: 10,
  },
  {
    name: 'BEIKO 퀵베이트V3 홍갯지렁이',
    productCode: 'quickbait-red',
    keyword: '홍갯지렁이',
    sortOrder: 20,
  },
  {
    name: 'BEIKO 퀵베이트V3 혼무시',
    productCode: 'quickbait-blue',
    keyword: '혼무시',
    sortOrder: 30,
  },
  {
    name: 'BEIKO 퀵베이트V3 멍게',
    productCode: 'quickbait-orange',
    keyword: '멍게',
    sortOrder: 40,
  },
  {
    name: 'BEIKO 퀵베이트V3 번데기',
    productCode: 'quickbait-yellow',
    keyword: '번데기',
    sortOrder: 50,
  },
]

export async function GET(request: Request) {
  const url = new URL(request.url)
  const requestedDate = url.searchParams.get('date')
  const inboundDate = parseKoreanYmd(requestedDate) || todayStart()
  const dateText = formatKoreanYmd(inboundDate)
  const nextDate = new Date(inboundDate.getTime() + 86_400_000)
  const monthRange = koreanMonthRange(dateText)
  if (!monthRange) {
    return NextResponse.json({ error: '입고 조회 날짜가 올바르지 않습니다.' }, { status: 400 })
  }

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
          gte: monthRange.start,
          lt: monthRange.end,
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
      const date = formatKoreanYmd(item.inboundDate)
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
    date: dateText,
    items,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    calendar,
    quickProducts,
  }, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const inboundDate = parseKoreanYmd(body?.inboundDate) || todayStart()
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
        createdById: null,
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

function todayStart() {
  return parseKoreanYmd(formatKoreanYmd(new Date())) || new Date()
}

async function ensureWarehouseInventoryItems() {
  await Promise.all(
    DEFAULT_WAREHOUSE_ITEMS.map(async (item) => {
      const product = await prisma.product.findFirst({
        where: {
          imageUrl: { not: null },
          OR: [
            { name: { contains: item.keyword, mode: 'insensitive' } },
            { nameJP: { contains: item.keyword, mode: 'insensitive' } },
            { nameEN: { contains: item.keyword, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          imageUrl: true,
          updatedAt: true,
        },
        orderBy: { sortOrder: 'asc' },
      })
      const imageUrl = product?.imageUrl ? getProductImageUrl(product.id, product.updatedAt) : null

      const warehouseItem = await prisma.warehouseInventoryItem.upsert({
        where: { productCode: item.productCode },
        create: {
          name: item.name,
          productCode: item.productCode,
          imageUrl,
          sortOrder: item.sortOrder,
          stock: 0,
          active: true,
        },
        update: {
          name: item.name,
          ...(imageUrl ? { imageUrl } : {}),
          sortOrder: item.sortOrder,
          active: true,
        },
      })

      if (imageUrl) {
        await prisma.inventoryInbound.updateMany({
          where: { warehouseItemId: warehouseItem.id },
          data: { productImageUrl: imageUrl },
        })
      }
    }),
  )
}
