import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/requireAdmin'
import { getProductImageUrl } from '@/lib/product-image-url'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const QUICK_BAIT_CATEGORIES = ['청갯지렁이', '홍갯지렁이', '혼무시', '멍게', '번데기']

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

  const [items, monthItems, products] = await Promise.all([
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
        productId: true,
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
    prisma.product.findMany({
      where: {
        OR: QUICK_BAIT_CATEGORIES.flatMap((category) => [
          { name: { contains: category, mode: 'insensitive' as const } },
          { nameJP: { contains: category, mode: 'insensitive' as const } },
          { nameEN: { contains: category, mode: 'insensitive' as const } },
        ]),
      },
      select: {
        id: true,
        name: true,
        nameJP: true,
        productCode: true,
        imageUrl: true,
        stock: true,
        updatedAt: true,
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

  const quickProducts = products.map((product) => ({
    id: productIdToInt(product.id),
    sourceId: product.id,
    name: product.name,
    nameJP: product.nameJP,
    productCode: product.productCode,
    imageUrl: product.imageUrl ? getProductImageUrl(product.id, product.updatedAt) : null,
    stock: product.stock,
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
  const masterId = Number(body?.masterId)
  const productId = typeof body?.productId === 'string' && body.productId.trim() ? body.productId.trim() : null
  const productName = typeof body?.productName === 'string' ? body.productName.trim() : ''
  const productImageUrl = typeof body?.productImageUrl === 'string' && body.productImageUrl.trim() ? body.productImageUrl.trim() : null
  const quantity = Number(body?.quantity)

  if (!Number.isFinite(masterId) || masterId <= 0) {
    return NextResponse.json({ error: '상품 ID가 올바르지 않습니다.' }, { status: 400 })
  }
  if (!productName) {
    return NextResponse.json({ error: '상품명이 필요합니다.' }, { status: 400 })
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: '입고 수량은 1 이상이어야 합니다.' }, { status: 400 })
  }

  const item = await prisma.$transaction(async (tx) => {
    let resolvedProductId = productId
    let resolvedProductName = productName
    let resolvedProductImageUrl = productImageUrl

    if (productId) {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true, imageUrl: true, updatedAt: true },
      })

      if (!product) {
        throw new Error('상품을 찾지 못했습니다.')
      }

      resolvedProductId = product.id
      resolvedProductName = product.name
      resolvedProductImageUrl = product.imageUrl ? getProductImageUrl(product.id, product.updatedAt) : null

      await tx.product.update({
        where: { id: product.id },
        data: { stock: { increment: Math.trunc(quantity) } },
      })
    }

    return tx.inventoryInbound.create({
      data: {
        inboundDate,
        masterId: Math.trunc(masterId),
        productId: resolvedProductId,
        productName: resolvedProductName,
        productImageUrl: resolvedProductImageUrl,
        quantity: Math.trunc(quantity),
        createdById: session.user.id,
      },
      select: {
        id: true,
        inboundDate: true,
        masterId: true,
        productId: true,
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

function productIdToInt(id: string) {
  let hash = 0
  for (let index = 0; index < id.length; index++) {
    hash = ((hash << 5) - hash + id.charCodeAt(index)) | 0
  }
  return Math.abs(hash) || 1
}
