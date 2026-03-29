import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { fetchCardUsageByPeriod, type BarobillCardApprovalLog } from '@/lib/barobillCard'

export const dynamic = 'force-dynamic'

function toYmd(input: string) {
  const value = String(input || '').trim()
  if (/^\d{8}$/.test(value)) return value
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.replace(/-/g, '')
  throw new Error(`날짜 형식이 올바르지 않습니다: ${input}`)
}

function dedupeLogs(logs: BarobillCardApprovalLog[]) {
  const map = new Map<string, BarobillCardApprovalLog>()
  for (const log of logs) {
    const key = `${log.corpNum}|${log.cardNum}|${log.useKey}`
    if (!map.has(key)) {
      map.set(key, log)
    }
  }
  return Array.from(map.values())
}

function chunk<T>(arr: T[], size: number) {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

function resolveTotalAmount(row: BarobillCardApprovalLog) {
  if (typeof row.totalAmount === 'number') return row.totalAmount
  if (typeof row.approvalAmount === 'number') return row.approvalAmount
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
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const body = await request.json()
    const startDate = toYmd(body?.startDate)
    const endDate = toYmd(body?.endDate)
    const cardNum = String(body?.cardNum || '').trim() || undefined
    const refreshBeforeFetch = Boolean(body?.refreshBeforeFetch)

    const fetched = await fetchCardUsageByPeriod({
      startDate,
      endDate,
      cardNum,
      refreshBeforeFetch,
    })

    const deduped = dedupeLogs(fetched.logs)
    if (deduped.length === 0) {
      return NextResponse.json({
        success: true,
        fetchedCount: 0,
        storedCount: 0,
        targetCards: fetched.targetCards,
        refreshResults: fetched.refreshResults,
        message: '조회된 카드 사용내역이 없습니다.',
      })
    }

    const now = new Date()
    const chunks = chunk(deduped, 200)

    for (const rows of chunks) {
      await prisma.$transaction(
        rows.map((row) => {
          const raw = row.raw as Prisma.InputJsonValue
          const normalizedTotalAmount = resolveTotalAmount(row)
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
              raw,
              syncedAt: now,
            },
          })
        }),
      )
    }

    return NextResponse.json({
      success: true,
      fetchedCount: fetched.logs.length,
      storedCount: deduped.length,
      targetCards: fetched.targetCards,
      refreshResults: fetched.refreshResults,
      message: '카드 사용내역 동기화가 완료되었습니다.',
    })
  } catch (error: unknown) {
    console.error('[CardUsage Sync] error:', error)
    const message = error instanceof Error ? error.message : '카드 사용내역 동기화 실패'
    return NextResponse.json(
      { error: message },
      { status: 500 },
    )
  }
}
