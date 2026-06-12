import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import type { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { classifyCategory } from '@/lib/cardCategory'
import { scrapeLotteCardUsage } from '@/lib/lotteCardCrawler'
import type { BarobillCardApprovalLog } from '@/lib/barobillCard'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

function toYmd(input: string) {
  const value = String(input || '').trim()
  if (/^\d{8}$/.test(value)) return value
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.replace(/-/g, '')
  throw new Error(`Invalid date format: ${input}`)
}

function dedupeLogs(logs: BarobillCardApprovalLog[]) {
  const map = new Map<string, BarobillCardApprovalLog>()
  for (const log of logs) {
    const key = `${log.corpNum}|${log.cardNum}|${log.useKey}`
    if (!map.has(key)) map.set(key, log)
  }
  return Array.from(map.values())
}

function chunk<T>(arr: T[], size: number) {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
  return chunks
}

function resolveTotalAmount(row: BarobillCardApprovalLog) {
  if (typeof row.totalAmount === 'number' && row.totalAmount !== 0) return row.totalAmount
  if (typeof row.approvalAmount === 'number' && row.approvalAmount !== 0) return row.approvalAmount
  if (
    typeof row.amount === 'number' ||
    typeof row.tax === 'number' ||
    typeof row.serviceCharge === 'number'
  ) {
    return (row.amount || 0) + (row.tax || 0) + (row.serviceCharge || 0)
  }
  return 0
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Permission denied.' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const startDate = toYmd(body?.startDate)
    const endDate = toYmd(body?.endDate)
    const cardNum = String(body?.cardNum || '').trim() || undefined
    const debugUrl = String(body?.debugUrl || '').trim() || undefined

    const fetched = await scrapeLotteCardUsage({
      startDate,
      endDate,
      cardNum,
      debugUrl,
    })

    const deduped = dedupeLogs(fetched.logs)
    const now = new Date()
    let storedCount = 0

    for (const rows of chunk(deduped, 200)) {
      await prisma.$transaction(
        rows.map((row) => {
          const raw = row.raw as Prisma.InputJsonValue
          const normalizedTotalAmount = resolveTotalAmount(row)
          const category = classifyCategory(row.useStoreName, row.useStoreBizType)

          return prisma.cardUsage.upsert({
            where: {
              corpNum_cardNum_useKey: {
                corpNum: row.corpNum,
                cardNum: row.cardNum,
                useKey: row.useKey,
              },
            },
            update: {
              useDT: row.useDT,
              usedAt: row.usedAt,
              approvalType: row.approvalType,
              approvalNum: row.approvalNum,
              approvalAmount: row.approvalAmount,
              foreignApprovalAmount: row.foreignApprovalAmount,
              amount: row.amount,
              tax: row.tax,
              serviceCharge: row.serviceCharge,
              totalAmount: normalizedTotalAmount,
              useStoreNum: row.useStoreNum,
              useStoreCorpNum: row.useStoreCorpNum,
              useStoreTaxType: row.useStoreTaxType,
              useStoreName: row.useStoreName,
              useStoreCeo: row.useStoreCeo,
              useStoreAddr: row.useStoreAddr,
              useStoreBizType: row.useStoreBizType,
              useStoreTel: row.useStoreTel,
              paymentPlan: row.paymentPlan,
              installmentMonths: row.installmentMonths,
              currencyCode: row.currencyCode,
              memo: row.memo,
              raw,
              syncedAt: now,
            },
            create: {
              corpNum: row.corpNum,
              cardNum: row.cardNum,
              useKey: row.useKey,
              useDT: row.useDT,
              usedAt: row.usedAt,
              approvalType: row.approvalType,
              approvalNum: row.approvalNum,
              approvalAmount: row.approvalAmount,
              foreignApprovalAmount: row.foreignApprovalAmount,
              amount: row.amount,
              tax: row.tax,
              serviceCharge: row.serviceCharge,
              totalAmount: normalizedTotalAmount,
              useStoreNum: row.useStoreNum,
              useStoreCorpNum: row.useStoreCorpNum,
              useStoreTaxType: row.useStoreTaxType,
              useStoreName: row.useStoreName,
              useStoreCeo: row.useStoreCeo,
              useStoreAddr: row.useStoreAddr,
              useStoreBizType: row.useStoreBizType,
              useStoreTel: row.useStoreTel,
              paymentPlan: row.paymentPlan,
              installmentMonths: row.installmentMonths,
              currencyCode: row.currencyCode,
              memo: row.memo,
              category,
              raw,
              syncedAt: now,
            },
          })
        }),
      )
      storedCount += rows.length
    }

    const amountResolvedCount = deduped.filter((row) => resolveTotalAmount(row) !== 0).length

    return NextResponse.json({
      success: true,
      source: fetched.source,
      fetchedCount: fetched.logs.length,
      storedCount,
      amountResolvedCount,
      amountMissingCount: deduped.length - amountResolvedCount,
      targetCards: fetched.targetCards,
      refreshResults: [],
      loadedRowCount: fetched.loadedRowCount,
      loadMoreClicks: fetched.loadMoreClicks,
      finalUrl: fetched.finalUrl,
      pageTitle: fetched.pageTitle,
      syncedAt: new Date().toISOString(),
      message: 'LotteCard direct sync completed.',
    })
  } catch (error: unknown) {
    console.error('[LotteCard Sync] error:', error)
    const message = error instanceof Error ? error.message : 'LotteCard direct sync failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
