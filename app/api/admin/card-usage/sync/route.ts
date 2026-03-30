import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { fetchCardUsageByPeriod, type BarobillCardApprovalLog } from '../../../../../lib/barobillCard'
import { classifyCategory } from '../../../../../lib/cardCategory'

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

function toIntFromRaw(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const normalized = String(value).replace(/,/g, '').trim()
  const match = normalized.match(/-?\d+(?:\.\d+)?/)
  if (!match) return null
  const n = Number(match[0])
  if (!Number.isFinite(n)) return null
  return Math.round(n)
}

function resolveTotalAmount(row: BarobillCardApprovalLog) {
  // 1순위: totalAmount가 양수
  if (typeof row.totalAmount === 'number' && row.totalAmount > 0) return row.totalAmount
  // 2순위: approvalAmount가 양수
  if (typeof row.approvalAmount === 'number' && row.approvalAmount > 0) return row.approvalAmount
  // 3순위: amount + tax + serviceCharge 합산
  if (
    typeof row.amount === 'number' ||
    typeof row.tax === 'number' ||
    typeof row.serviceCharge === 'number'
  ) {
    const sum = (row.amount || 0) + (row.tax || 0) + (row.serviceCharge || 0)
    if (sum > 0) return sum
  }
  // 4순위: raw JSON에서 CardApprovalCost 시도
  if (row.raw) {
    const costFromRaw = toIntFromRaw(
      row.raw['CardApprovalCost'] ?? row.raw['ApprovalCost'] ?? row.raw['ApprovalAmount']
    )
    if (typeof costFromRaw === 'number' && costFromRaw > 0) return costFromRaw
  }
  // 마지막: totalAmount or approvalAmount (0이더라도 반환)
  if (typeof row.totalAmount === 'number') return row.totalAmount
  if (typeof row.approvalAmount === 'number') return row.approvalAmount
  return 0
}

/** DB에 저장된 raw JSON에서 금액을 재계산 (0원으로 잘못 저장된 경우 보정) */
function recalcAmountFromRaw(raw: Prisma.JsonValue): number {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 0
  const r = raw as Record<string, unknown>
  const fields = ['TotalAmount', 'ApprovalAmount', 'CardApprovalCost', 'ApprovalCost']
  for (const field of fields) {
    const v = toIntFromRaw(r[field])
    if (typeof v === 'number' && v > 0) return v
  }
  // Amount + Tax + ServiceCharge
  const amount = toIntFromRaw(r['Amount']) || 0
  const tax = toIntFromRaw(r['Tax']) || 0
  const svc = toIntFromRaw(r['ServiceCharge']) || 0
  const sum = amount + tax + svc
  if (sum > 0) return sum
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
        amountResolvedCount: 0,
        amountMissingCount: 0,
        targetCards: fetched.targetCards,
        refreshResults: fetched.refreshResults,
        message: '조회된 카드 사용내역이 없습니다.',
      })
    }

    const amountResolvedCount = deduped.filter((row) => resolveTotalAmount(row) > 0).length
    const amountMissingCount = deduped.length - amountResolvedCount
    const now = new Date()
    const chunks = chunk(deduped, 200)

    for (const rows of chunks) {
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
              category,
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
    }

    // ── 2단계: DB에 0원으로 저장된 기존 데이터 raw에서 재계산 보정 ──
    const zeroAmountRecords = await prisma.cardUsage.findMany({
      where: {
        usedAt: {
          gte: new Date(`${startDate.slice(0, 4)}-${startDate.slice(4, 6)}-${startDate.slice(6, 8)}T00:00:00+09:00`),
          lte: new Date(`${endDate.slice(0, 4)}-${endDate.slice(4, 6)}-${endDate.slice(6, 8)}T23:59:59+09:00`),
        },
        OR: [
          { totalAmount: 0 },
          { totalAmount: null },
        ],
      },
      select: { id: true, raw: true, totalAmount: true },
    })

    let recalcFixedCount = 0
    if (zeroAmountRecords.length > 0) {
      const recalcChunks = chunk(zeroAmountRecords, 100)
      for (const recalcRows of recalcChunks) {
        const ops = recalcRows.flatMap((rec) => {
          const fixedAmount = recalcAmountFromRaw(rec.raw)
          if (fixedAmount <= 0) return []
          recalcFixedCount++
          return [prisma.cardUsage.update({
            where: { id: rec.id },
            data: { totalAmount: fixedAmount },
          })]
        })
        if (ops.length > 0) await prisma.$transaction(ops)
      }
    }

    // ── 3단계: category가 null인 기존 레코드 일괄 분류 ──
    const uncategorizedRecords = await prisma.cardUsage.findMany({
      where: { category: null },
      select: { id: true, useStoreName: true, useStoreBizType: true },
      take: 2000,
    })

    let categorizedCount = 0
    if (uncategorizedRecords.length > 0) {
      const catChunks = chunk(uncategorizedRecords, 100)
      for (const catRows of catChunks) {
        const ops = catRows.map((rec) => {
          const cat = classifyCategory(rec.useStoreName, rec.useStoreBizType)
          categorizedCount++
          return prisma.cardUsage.update({
            where: { id: rec.id },
            data: { category: cat },
          })
        })
        await prisma.$transaction(ops)
      }
    }

    return NextResponse.json({
      success: true,
      fetchedCount: fetched.logs.length,
      storedCount: deduped.length,
      amountResolvedCount,
      amountMissingCount,
      recalcFixedCount,
      categorizedCount,
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
