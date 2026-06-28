import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type ExportDeclarationPostItem = {
  id?: string
  productId?: string
  productName?: string
  productNameEN?: string
  model?: string
  hsCode?: string
  origin?: string
  quantity?: number
  unitPrice?: number
  cartons?: number
  netWeight?: number
  grossWeight?: number
  cbm?: number
  dimension?: string
}

const readNumber = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.-]/g, ''))
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

const readString = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

const parseItems = (value: unknown): ExportDeclarationPostItem[] => {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      const record = item && typeof item === 'object' ? item as Record<string, unknown> : {}
      const quantity = Math.max(0, Math.floor(readNumber(record.quantity)))
      const unitPrice = readNumber(record.unitPrice)
      const cartons = Math.max(0, Math.floor(readNumber(record.cartons)))

      return {
        id: readString(record.id),
        productId: readString(record.productId),
        productName: readString(record.productName),
        productNameEN: readString(record.productNameEN),
        model: readString(record.model),
        hsCode: readString(record.hsCode),
        origin: readString(record.origin),
        quantity,
        unitPrice,
        cartons,
        netWeight: readNumber(record.netWeight),
        grossWeight: readNumber(record.grossWeight),
        cbm: readNumber(record.cbm),
        dimension: readString(record.dimension),
      }
    })
}

const buildTotals = (items: ExportDeclarationPostItem[]) => ({
  quantity: items.reduce((sum, item) => sum + (item.quantity || 0), 0),
  amount: items.reduce((sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0),
  cartons: items.reduce((sum, item) => sum + (item.cartons || 0), 0),
  netWeight: items.reduce((sum, item) => sum + (item.netWeight || 0), 0),
  grossWeight: items.reduce((sum, item) => sum + (item.grossWeight || 0), 0),
  cbm: items.reduce((sum, item) => sum + (item.cbm || 0), 0),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const rows = await (prisma as any).exportDeclaration.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        invoiceNo: true,
        status: true,
        totals: true,
        createdAt: true,
        _count: {
          select: { items: true },
        },
      },
    })

    return NextResponse.json(rows.map((row: any) => ({
      id: row.id,
      invoiceNo: row.invoiceNo,
      status: row.status,
      createdAt: row.createdAt,
      itemCount: row._count?.items || 0,
      totalAmount: readNumber(row.totals?.amount),
    })))
  } catch (error) {
    console.error('Failed to fetch export declarations:', error)
    return NextResponse.json({ error: 'Failed to fetch export declarations' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const form = body?.form && typeof body.form === 'object' ? body.form as Record<string, unknown> : {}
    const parsedItems = parseItems(body?.items)
    const items = parsedItems.length
      ? parsedItems
      : [{ productName: '미입력 상품', quantity: 0, unitPrice: 0, cartons: 0, netWeight: 0, grossWeight: 0, cbm: 0 }]
    const invoiceNo = readString(form.invoiceNo) || `EXP-${Date.now()}`

    const totals = buildTotals(items)
    const created = await (prisma as any).exportDeclaration.create({
      data: {
        invoiceNo,
        status: 'DRAFT',
        form,
        totals,
        createdById: session.user.id || null,
        items: {
          create: items.map((item, index) => ({
            productId: item.productId || null,
            lineNo: index + 1,
            productName: item.productName || item.productNameEN || item.model || '미입력 상품',
            productNameEN: item.productNameEN || null,
            model: item.model || null,
            hsCode: item.hsCode || null,
            origin: item.origin || null,
            quantity: item.quantity || 0,
            unitPrice: item.unitPrice || 0,
            amount: (item.quantity || 0) * (item.unitPrice || 0),
            cartons: item.cartons || 0,
            netWeight: item.netWeight || 0,
            grossWeight: item.grossWeight || 0,
            cbm: item.cbm || 0,
            dimension: item.dimension || null,
            raw: item,
          })),
        },
      },
      select: {
        id: true,
        invoiceNo: true,
        status: true,
        totals: true,
        createdAt: true,
        _count: {
          select: { items: true },
        },
      },
    })

    return NextResponse.json({
      id: created.id,
      invoiceNo: created.invoiceNo,
      status: created.status,
      createdAt: created.createdAt,
      itemCount: created._count?.items || 0,
      totalAmount: readNumber(created.totals?.amount),
    })
  } catch (error) {
    console.error('Failed to create export declaration:', error)
    return NextResponse.json({ error: 'Failed to create export declaration' }, { status: 500 })
  }
}
