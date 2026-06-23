import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type AlertItem = {
  id: string
  type: 'new_order' | 'mobile_message' | 'deposit_sms'
  title: string
  body: string
  url: string
  createdAt: string
}

const MAX_ALERTS = 50

export async function GET(request: Request) {
  const secret = process.env.MOBILE_MESSAGE_INGEST_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'MOBILE_MESSAGE_INGEST_SECRET이 설정되지 않았습니다.' }, { status: 500 })
  }
  if (!isAuthorized(request, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const since = parseSince(url.searchParams.get('since'))
  const where = since ? { createdAt: { gt: since } } : { createdAt: { gt: new Date(Date.now() - 10 * 60 * 1000) } }

  const [orders, messages, deposits] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        orderNumber: true,
        total: true,
        createdAt: true,
        user: {
          select: {
            name: true,
            username: true,
            partnerProfile: { select: { businessName: true } },
          },
        },
        _count: { select: { items: true } },
      },
    }),
    prisma.mobileMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        sender: true,
        senderName: true,
        body: true,
        createdAt: true,
      },
    }),
    prisma.depositSms.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        amount: true,
        depositorName: true,
        sender: true,
        matchStatus: true,
        createdAt: true,
      },
    }),
  ])

  const alerts: AlertItem[] = [
    ...orders.map((order) => {
      const customerName = order.user?.partnerProfile?.businessName || order.user?.name || order.user?.username || '고객'
      return {
        id: `order:${order.id}`,
        type: 'new_order' as const,
        title: '신규 주문 접수',
        body: `${customerName} · ${order.orderNumber || '-'} · ${formatMoney(order.total)} · ${order._count.items}개 상품`,
        url: '/admin/orders',
        createdAt: order.createdAt.toISOString(),
      }
    }),
    ...messages.map((message) => ({
      id: `message:${message.id}`,
      type: 'mobile_message' as const,
      title: '새 문자 수신',
      body: `${message.senderName || message.sender || '알 수 없음'} · ${compact(message.body)}`,
      url: '/admin/mobile-messages',
      createdAt: message.createdAt.toISOString(),
    })),
    ...deposits.map((deposit) => ({
      id: `deposit:${deposit.id}`,
      type: 'deposit_sms' as const,
      title: deposit.matchStatus === 'AUTO_CONFIRMED' ? '입금 자동확인 완료' : '입금문자 확인 필요',
      body: `${deposit.depositorName || deposit.sender || '입금자 미확인'} · ${formatMoney(deposit.amount)} · ${depositStatusLabel(deposit.matchStatus)}`,
      url: '/admin/orders',
      createdAt: deposit.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_ALERTS)

  return NextResponse.json({
    alerts,
    serverTime: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}

function isAuthorized(request: Request, secret: string) {
  const authorization = request.headers.get('authorization') || ''
  const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  const headerSecret = request.headers.get('x-mobile-message-secret') || ''
  return bearer === secret || headerSecret === secret
}

function parseSince(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function compact(value: string) {
  const text = value.replace(/\s+/g, ' ').trim()
  return text.length > 90 ? `${text.slice(0, 87)}...` : text
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return '-'
  return `${Math.round(value).toLocaleString('ko-KR')}원`
}

function depositStatusLabel(status: string) {
  if (status === 'AUTO_CONFIRMED') return '자동 입금확인'
  if (status === 'AMBIGUOUS') return '후보 여러 건'
  if (status === 'UNMATCHED') return '매칭 없음'
  if (status === 'DUPLICATE_OR_ALREADY_CONFIRMED') return '이미 처리됨'
  if (status === 'NOT_DEPOSIT') return '입금 아님'
  return status || '확인 필요'
}
