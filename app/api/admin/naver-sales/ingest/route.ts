import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  normalizeNaverSalesRows,
  normalizeYmdDate,
  ymdToUtcDate,
} from '@/lib/naverSales'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type IngestBody = {
  sourceDevice?: unknown
  saleDate?: unknown
  startDate?: unknown
  endDate?: unknown
  fetchedAt?: unknown
  rows?: unknown
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
  if (rows.length === 0) {
    await prisma.naverSalesSyncLog.create({
      data: {
        sourceDevice: toNonEmptyString(body.sourceDevice),
        status: 'EMPTY',
        requestedStartDate: ymdToUtcDate(normalizeYmdDate(body.startDate)) || ymdToUtcDate(defaultSaleDate),
        requestedEndDate: ymdToUtcDate(normalizeYmdDate(body.endDate)) || ymdToUtcDate(defaultSaleDate),
        fetchedAt: toDate(body.fetchedAt),
        rowsReceived: Array.isArray(body.rows) ? body.rows.length : 0,
        rowsUpserted: 0,
        raw: { reason: 'no valid rows' },
      },
    })
    return NextResponse.json({ success: true, rowsReceived: Array.isArray(body.rows) ? body.rows.length : 0, rowsUpserted: 0 })
  }

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
            raw: row.raw,
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
            raw: row.raw,
            syncedAt: toDate(body.fetchedAt) || new Date(),
          },
        })
        upserted += 1
      }

      await tx.naverSalesSyncLog.create({
        data: {
          sourceDevice: toNonEmptyString(body.sourceDevice),
          status: 'SUCCESS',
          requestedStartDate: ymdToUtcDate(normalizeYmdDate(body.startDate)) || ymdToUtcDate(rows[0].saleDate),
          requestedEndDate: ymdToUtcDate(normalizeYmdDate(body.endDate)) || ymdToUtcDate(rows[rows.length - 1].saleDate),
          fetchedAt: toDate(body.fetchedAt),
          rowsReceived: rows.length,
          rowsUpserted: upserted,
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
        rowsReceived: rows.length,
        rowsUpserted: upserted,
        errorMessage: error instanceof Error ? error.message : '네이버 판매량 저장 실패',
      },
    })
    console.error('Naver sales ingest error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : '네이버 판매량 저장 실패' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    rowsReceived: rows.length,
    rowsUpserted: upserted,
  })
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

function toDate(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
