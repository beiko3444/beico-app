import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/requireAdmin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  const url = new URL(request.url)
  const inboundDate = parseInboundDate(url.searchParams.get('date')) || todayStart()
  const nextDate = new Date(inboundDate)
  nextDate.setDate(nextDate.getDate() + 1)

  const items = await prisma.inventoryInbound.findMany({
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
      productName: true,
      productImageUrl: true,
      quantity: true,
      createdAt: true,
      createdBy: { select: { name: true, username: true } },
    },
  })

  return NextResponse.json({
    date: formatYmd(inboundDate),
    items,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
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

  const item = await prisma.inventoryInbound.create({
    data: {
      inboundDate,
      masterId: Math.trunc(masterId),
      productName,
      productImageUrl,
      quantity: Math.trunc(quantity),
      createdById: session.user.id,
    },
    select: {
      id: true,
      inboundDate: true,
      masterId: true,
      productName: true,
      productImageUrl: true,
      quantity: true,
      createdAt: true,
      createdBy: { select: { name: true, username: true } },
    },
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
