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

const listShape = (row: any) => ({
  id: row.id,
  invoiceNo: row.invoiceNo,
  status: row.status,
  createdAt: row.createdAt,
  itemCount: row._count?.items || row.items?.length || 0,
  totalAmount: readNumber(row.totals?.amount),
})

const detailShape = (row: any) => ({
  ...listShape(row),
  form: row.form || {},
  items: Array.isArray(row.items)
    ? row.items.map((item: any) => {
        const raw = item.raw && typeof item.raw === 'object' ? item.raw : {}
        const rawProductName = readString(raw.productName)
        return {
          id: item.id,
          productId: readString(raw.productId) || item.productId || '',
          productName: rawProductName || (item.productName === '미입력 상품' ? '' : item.productName || ''),
          productNameEN: readString(raw.productNameEN) || item.productNameEN || '',
          model: readString(raw.model) || item.model || '',
          hsCode: readString(raw.hsCode) || item.hsCode || '',
          origin: readString(raw.origin) || item.origin || 'KOREA',
          quantity: readNumber(raw.quantity ?? item.quantity),
          unitPrice: readNumber(raw.unitPrice ?? item.unitPrice),
          cartons: readNumber(raw.cartons ?? item.cartons),
          netWeight: readNumber(raw.netWeight ?? item.netWeight),
          grossWeight: readNumber(raw.grossWeight ?? item.grossWeight),
          cbm: readNumber(raw.cbm ?? item.cbm),
          dimension: readString(raw.dimension) || item.dimension || '',
        }
      })
    : [],
})

const itemCreateData = (item: ExportDeclarationPostItem, index: number) => ({
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
})

const normalizeItemsForSave = (rawItems: unknown) => {
  const parsedItems = parseItems(rawItems)
  return parsedItems.length
    ? parsedItems
    : [{ productName: '미입력 상품', quantity: 0, unitPrice: 0, cartons: 0, netWeight: 0, grossWeight: 0, cbm: 0 }]
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')?.trim()

    if (id) {
      const row = await (prisma as any).exportDeclaration.findUnique({
        where: { id },
        include: {
          items: {
            orderBy: { lineNo: 'asc' },
          },
        },
      })

      if (!row) {
        return NextResponse.json({ error: 'Export declaration not found' }, { status: 404 })
      }

      return NextResponse.json(detailShape(row))
    }

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

    return NextResponse.json(rows.map(listShape))
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
    const items = normalizeItemsForSave(body?.items)
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
          create: items.map(itemCreateData),
        },
      },
      include: {
        items: {
          orderBy: { lineNo: 'asc' },
        },
      },
    })

    return NextResponse.json(detailShape(created))
  } catch (error) {
    console.error('Failed to create export declaration:', error)
    return NextResponse.json({ error: 'Failed to create export declaration' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const id = readString(body?.id)
    const form = body?.form && typeof body.form === 'object' ? body.form as Record<string, unknown> : {}
    const items = normalizeItemsForSave(body?.items)

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const invoiceNo = readString(form.invoiceNo) || `EXP-${Date.now()}`
    const totals = buildTotals(items)

    const updated = await (prisma as any).$transaction(async (tx: any) => {
      await tx.exportDeclarationItem.deleteMany({
        where: { exportDeclarationId: id },
      })

      return tx.exportDeclaration.update({
        where: { id },
        data: {
          invoiceNo,
          form,
          totals,
          items: {
            create: items.map(itemCreateData),
          },
        },
        include: {
          items: {
            orderBy: { lineNo: 'asc' },
          },
        },
      })
    })

    return NextResponse.json(detailShape(updated))
  } catch (error) {
    console.error('Failed to update export declaration:', error)
    return NextResponse.json({ error: 'Failed to update export declaration' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = readString(searchParams.get('id'))

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    await (prisma as any).exportDeclaration.delete({
      where: { id },
    })

    return NextResponse.json({ ok: true, id })
  } catch (error) {
    console.error('Failed to delete export declaration:', error)
    return NextResponse.json({ error: 'Failed to delete export declaration' }, { status: 500 })
  }
}
