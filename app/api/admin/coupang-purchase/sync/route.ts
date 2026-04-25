import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/requireAdmin'
import { prisma } from '@/lib/prisma'
import { CoupangScrapeError, scrapeCoupangPurchases } from '@/lib/coupangPurchase'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const isYmd = (s: string | undefined | null): s is string =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)

export async function POST(request: Request) {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  try {
    const body = await request.json().catch(() => ({}))
    const startDate = isYmd(body?.startDate) ? body.startDate : null
    const endDate = isYmd(body?.endDate) ? body.endDate : null

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate / endDate (YYYY-MM-DD) 가 필요합니다.' },
        { status: 400 },
      )
    }

    const loginId = (typeof body?.loginId === 'string' && body.loginId.trim())
      || process.env.COUPANG_USER_LOGIN_ID
      || ''
    const loginPassword = (typeof body?.loginPassword === 'string' && body.loginPassword.trim())
      || process.env.COUPANG_USER_LOGIN_PASSWORD
      || ''
    const headlessOverride =
      typeof body?.headless === 'boolean' ? body.headless : null
    const headless = headlessOverride ?? (process.env.COUPANG_USER_HEADLESS !== 'false')

    if (!loginId || !loginPassword) {
      return NextResponse.json(
        { error: '쿠팡 아이디와 비밀번호를 입력해 주세요.' },
        { status: 400 },
      )
    }

    const scrape = await scrapeCoupangPurchases({
      loginId,
      loginPassword,
      startDate,
      endDate,
      headless,
    })

    let storedCount = 0
    for (const purchase of scrape.purchases) {
      await prisma.coupangPurchase.upsert({
        where: { orderId: purchase.orderId },
        create: {
          orderId: purchase.orderId,
          orderedAt: new Date(purchase.orderedAt),
          totalAmount: purchase.totalAmount,
          paymentMethod: purchase.paymentMethod,
          itemSummary: purchase.itemSummary,
          itemsJson: purchase.items as unknown as Prisma.InputJsonValue,
          raw: purchase.raw as Prisma.InputJsonValue,
        },
        update: {
          orderedAt: new Date(purchase.orderedAt),
          totalAmount: purchase.totalAmount,
          paymentMethod: purchase.paymentMethod,
          itemSummary: purchase.itemSummary,
          itemsJson: purchase.items as unknown as Prisma.InputJsonValue,
          raw: purchase.raw as Prisma.InputJsonValue,
          syncedAt: new Date(),
        },
      })
      storedCount++
    }

    return NextResponse.json({
      success: true,
      fetchedCount: scrape.purchases.length,
      storedCount,
      pagesScraped: scrape.pagesScraped,
      finalUrl: scrape.finalUrl,
    })
  } catch (error) {
    console.error('[CoupangPurchase Sync] error', error)
    if (error instanceof CoupangScrapeError) {
      const status = error.code === 'INVALID_INPUT' ? 400 : error.code === 'CAPTCHA_REQUIRED' ? 409 : 500
      return NextResponse.json(
        { error: error.message, code: error.code, detail: error.detail || null },
        { status },
      )
    }
    const message = error instanceof Error ? error.message : '쿠팡 구매내역 동기화 실패'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
