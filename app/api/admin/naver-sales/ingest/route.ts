import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  normalizeNaverSalesRows,
  normalizeYmdDate,
  ymdToUtcDate,
} from '@/lib/naverSales'
import { normalizeNaverInsightRows } from '@/lib/naverSalesAnalytics.mjs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type IngestBody = {
  sourceDevice?: unknown
  saleDate?: unknown
  startDate?: unknown
  endDate?: unknown
  fetchedAt?: unknown
  rows?: unknown
  insightRows?: unknown
  realtime?: unknown
}

type NaverInsightRow = {
  saleDate: string
  category: string
  label: string
  detail: string
  interactions: number
  inflow: number
  orders: number
  quantity: number
  payAmount: number
  refundAmount: number
  netAmount: number
  raw: unknown
}

export async function POST(request: Request) {
  const secret = process.env.NAVER_SALES_INGEST_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'NAVER_SALES_INGEST_SECRET이 설정되지 않았습니다.' }, { status: 500 })
  }
  if (!isAuthorized(request, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: IngestBody
  try {
    body = (await request.json()) as IngestBody
  } catch {
    return NextResponse.json({ error: 'JSON body가 필요합니다.' }, { status: 400 })
  }

  const defaultSaleDate = normalizeYmdDate(body.saleDate) || normalizeYmdDate(body.endDate)
  if (!defaultSaleDate) {
    return NextResponse.json({ error: 'saleDate 또는 endDate(YYYY-MM-DD)가 필요합니다.' }, { status: 400 })
  }

  const rows = normalizeNaverSalesRows(defaultSaleDate, body.rows)
  const insightRows = normalizeInsightPayload(defaultSaleDate, body.insightRows)
  const realtime = normalizeRealtimePayload(defaultSaleDate, body.realtime)
  const rowsReceived = rows.length + insightRows.length + (realtime ? 1 : 0)

  const sellerCodes = Array.from(new Set(rows.map((row) => row.sellerManagementCode).filter(Boolean)))
  const productMap = await loadProductMap(sellerCodes)
  let upserted = 0

  try {
    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const saleDate = ymdToUtcDate(row.saleDate)
        if (!saleDate) continue
        const matched = row.sellerManagementCode ? productMap.get(row.sellerManagementCode) : undefined
        await tx.naverSalesDaily.upsert({
          where: {
            saleDate_channelProductNo: {
              saleDate,
              channelProductNo: row.channelProductNo,
            },
          },
          create: {
            saleDate,
            channelProductNo: row.channelProductNo,
            sellerManagementCode: row.sellerManagementCode || null,
            productName: row.productName || null,
            dbProductId: matched?.id || null,
            dbProductName: matched?.name || null,
            orders: row.orders,
            quantity: row.quantity,
            payAmount: row.payAmount,
            refundAmount: row.refundAmount,
            netAmount: row.netAmount,
            raw: normalizeJson(row.raw),
            syncedAt: toDate(body.fetchedAt) || new Date(),
          },
          update: {
            sellerManagementCode: row.sellerManagementCode || null,
            productName: row.productName || null,
            dbProductId: matched?.id || null,
            dbProductName: matched?.name || null,
            orders: row.orders,
            quantity: row.quantity,
            payAmount: row.payAmount,
            refundAmount: row.refundAmount,
            netAmount: row.netAmount,
            raw: normalizeJson(row.raw),
            syncedAt: toDate(body.fetchedAt) || new Date(),
          },
        })
        upserted += 1
      }

      for (const row of insightRows) {
        const saleDate = ymdToUtcDate(row.saleDate)
        if (!saleDate) continue
        await tx.naverSalesInsightDaily.upsert({
          where: {
            saleDate_category_label_detail: {
              saleDate,
              category: row.category,
              label: row.label,
              detail: row.detail || '',
            },
          },
          create: {
            saleDate,
            category: row.category,
            label: row.label,
            detail: row.detail || '',
            interactions: row.interactions,
            inflow: row.inflow,
            orders: row.orders,
            quantity: row.quantity,
            payAmount: row.payAmount,
            refundAmount: row.refundAmount,
            netAmount: row.netAmount,
            raw: normalizeJson(row.raw),
            syncedAt: toDate(body.fetchedAt) || new Date(),
          },
          update: {
            interactions: row.interactions,
            inflow: row.inflow,
            orders: row.orders,
            quantity: row.quantity,
            payAmount: row.payAmount,
            refundAmount: row.refundAmount,
            netAmount: row.netAmount,
            raw: normalizeJson(row.raw),
            syncedAt: toDate(body.fetchedAt) || new Date(),
          },
        })
        upserted += 1
      }

      if (realtime) {
        await tx.naverSalesRealtimeSnapshot.create({
          data: {
            snapshotDate: ymdToUtcDate(realtime.snapshotDate) || ymdToUtcDate(defaultSaleDate)!,
            sourceDevice: toNonEmptyString(body.sourceDevice),
            orders: realtime.orders,
            quantity: realtime.quantity,
            payAmount: realtime.payAmount,
            refundAmount: realtime.refundAmount,
            netAmount: realtime.netAmount,
            raw: realtime.raw,
            collectedAt: toDate(body.fetchedAt) || new Date(),
          },
        })
        upserted += 1
      }

      await tx.naverSalesSyncLog.create({
        data: {
          sourceDevice: toNonEmptyString(body.sourceDevice),
          status: upserted > 0 ? 'SUCCESS' : 'EMPTY',
          requestedStartDate: ymdToUtcDate(normalizeYmdDate(body.startDate)) || ymdToUtcDate(defaultSaleDate),
          requestedEndDate: ymdToUtcDate(normalizeYmdDate(body.endDate)) || ymdToUtcDate(defaultSaleDate),
          fetchedAt: toDate(body.fetchedAt),
          rowsReceived,
          rowsUpserted: upserted,
          raw: upserted > 0 ? undefined : { reason: 'no valid rows' },
        },
      })
    })
  } catch (error) {
    await prisma.naverSalesSyncLog.create({
      data: {
        sourceDevice: toNonEmptyString(body.sourceDevice),
        status: 'FAILED',
        requestedStartDate: ymdToUtcDate(normalizeYmdDate(body.startDate)) || ymdToUtcDate(defaultSaleDate),
        requestedEndDate: ymdToUtcDate(normalizeYmdDate(body.endDate)) || ymdToUtcDate(defaultSaleDate),
        fetchedAt: toDate(body.fetchedAt),
        rowsReceived,
        rowsUpserted: upserted,
        errorMessage: error instanceof Error ? error.message : '네이버 판매량 저장 실패',
      },
    })
    console.error('Naver sales ingest error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : '네이버 판매량 저장 실패' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    rowsReceived,
    rowsUpserted: upserted,
  })
}

function normalizeInsightPayload(defaultSaleDate: string, value: unknown): NaverInsightRow[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const record = entry as Record<string, unknown>
    const category = toStringValue(record.category)
    const saleDate = normalizeYmdDate(record.saleDate) || defaultSaleDate
    const rows = Array.isArray(record.rows) ? record.rows : [record]
    return normalizeNaverInsightRows(saleDate, category, rows) as NaverInsightRow[]
  })
}

function normalizeRealtimePayload(defaultSaleDate: string, value: unknown) {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const snapshotDate = normalizeYmdDate(record.snapshotDate) || normalizeYmdDate(record.saleDate) || defaultSaleDate
  const payAmount = toInt(record.payAmount ?? record.totalPayAmount ?? record.salesAmount)
  const refundAmount = toInt(record.refundAmount ?? record.refundPayAmount)
  return {
    snapshotDate,
    orders: toInt(record.orders ?? record.numPurchases ?? record.orderCount),
    quantity: toInt(record.quantity ?? record.productQuantity),
    payAmount,
    refundAmount,
    netAmount: toInt(record.netAmount) || payAmount - refundAmount,
    raw: normalizeJson(record.raw ?? record),
  }
}

async function loadProductMap(sellerCodes: string[]) {
  const map = new Map<string, { id: string; name: string }>()
  if (sellerCodes.length === 0) return map

  const products = await prisma.product.findMany({
    where: {
      OR: [
        { productCode: { in: sellerCodes } },
        { barcode: { in: sellerCodes } },
      ],
    },
    select: {
      id: true,
      name: true,
      nameEN: true,
      productCode: true,
      barcode: true,
    },
  })

  for (const product of products) {
    const value = { id: product.id, name: product.name || product.nameEN || product.id }
    if (product.productCode) map.set(product.productCode.trim().toUpperCase(), value)
    if (product.barcode) map.set(product.barcode.trim().toUpperCase(), value)
  }
  return map
}

function isAuthorized(request: Request, secret: string) {
  const authorization = request.headers.get('authorization') || ''
  const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  const headerSecret = request.headers.get('x-naver-sales-secret') || ''
  return bearer === secret || headerSecret === secret
}

function toNonEmptyString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function toStringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function toInt(value: unknown) {
  if (value === null || value === undefined || value === '') return 0
  const parsed = Number(String(value).replace(/,/g, ''))
  return Number.isFinite(parsed) ? Math.round(parsed) : 0
}

function normalizeJson(value: unknown): Prisma.InputJsonValue {
  try {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue
  } catch {
    return {}
  }
}

function toDate(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
