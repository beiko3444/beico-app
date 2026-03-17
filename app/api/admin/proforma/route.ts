import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { Prisma } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type PostItem = {
    productId: string
    quantity: number
}

const readNumber = (value: unknown): number => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0
    }
    if (typeof value === 'string') {
        const cleaned = value.replace(/[^0-9.-]/g, '')
        const parsed = Number(cleaned)
        return Number.isFinite(parsed) ? parsed : 0
    }
    return 0
}

const resolveUsdUnitPrice = (product: { usBuyPrice?: number | null; usSellPrice?: number | null; regionalPrices?: unknown }) => {
    const direct = readNumber(product.usBuyPrice)
    if (direct > 0) return direct

    const regional = product.regionalPrices as Record<string, any> | null | undefined
    const fromRegional = readNumber(regional?.C?.US?.wholesale ?? regional?.C?.US?.cost)
    if (fromRegional > 0) return fromRegional

    return readNumber(product.usSellPrice)
}

const buildInvoicePrefix = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `PI-${year}${month}${day}`
}

const getNextInvoiceNumber = async (tx: Prisma.TransactionClient, date: Date) => {
    const prefix = buildInvoicePrefix(date)
    const latest = await tx.proformaInvoice.findFirst({
        where: {
            invoiceNumber: {
                startsWith: prefix
            }
        },
        orderBy: {
            invoiceNumber: 'desc'
        },
        select: {
            invoiceNumber: true
        }
    })

    let sequence = 1
    if (latest?.invoiceNumber) {
        const suffix = latest.invoiceNumber.slice(-3)
        const parsed = Number(suffix)
        if (Number.isFinite(parsed)) {
            sequence = parsed + 1
        }
    }

    return `${prefix}-${String(sequence).padStart(3, '0')}`
}

const parseItems = (raw: unknown): PostItem[] => {
    if (!Array.isArray(raw)) return []
    return raw
        .map((item) => {
            if (!item || typeof item !== 'object') {
                return { productId: '', quantity: 1 }
            }

            const record = item as Record<string, unknown>
            return {
                productId: typeof record.productId === 'string' ? record.productId : '',
                quantity: Math.max(1, Math.floor(Number(record.quantity || 0)))
            }
        })
        .filter((item) => item.productId.length > 0)
}

export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const invoices = await prisma.proformaInvoice.findMany({
            include: {
                items: {
                    orderBy: { createdAt: 'asc' }
                }
            },
            orderBy: { issueDate: 'desc' }
        })
        return NextResponse.json(invoices)
    } catch (error) {
        console.error('Failed to fetch PI list:', error)
        return NextResponse.json({ error: 'Failed to fetch PI list' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await request.json()
        const partnerId = typeof body?.partnerId === 'string' ? body.partnerId : ''
        const items = parseItems(body?.items)

        if (!partnerId) {
            return NextResponse.json({ error: 'partnerId is required' }, { status: 400 })
        }
        if (items.length === 0) {
            return NextResponse.json({ error: 'items is required' }, { status: 400 })
        }

        const partner = await prisma.user.findUnique({
            where: { id: partnerId },
            include: { partnerProfile: true }
        })
        if (!partner) {
            return NextResponse.json({ error: 'Partner not found' }, { status: 404 })
        }

        const products = await prisma.product.findMany({
            where: {
                id: {
                    in: items.map((item) => item.productId)
                }
            },
            select: {
                id: true,
                name: true,
                nameEN: true,
                nameJP: true,
                productCode: true,
                usBuyPrice: true,
                usSellPrice: true,
                regionalPrices: true
            }
        })
        if (products.length !== items.length) {
            return NextResponse.json({ error: 'Some products were not found' }, { status: 400 })
        }

        const productMap = new Map(products.map((product) => [product.id, product]))
        const lineItems = items.map((item) => {
            const product = productMap.get(item.productId)
            if (!product) {
                throw new Error(`Product not found: ${item.productId}`)
            }

            const unitPriceUsd = resolveUsdUnitPrice(product)
            return {
                productId: product.id,
                productName: product.nameJP || product.name,
                productNameEN: product.nameEN,
                productCode: product.productCode ? String(product.productCode).toUpperCase() : null,
                quantity: item.quantity,
                unitPriceUsd,
                amountUsd: unitPriceUsd * item.quantity
            }
        })

        const totalUsd = lineItems.reduce((sum, line) => sum + line.amountUsd, 0)
        const issuedAt = new Date()

        const created = await prisma.$transaction(async (tx) => {
            const invoiceNumber = await getNextInvoiceNumber(tx, issuedAt)
            return tx.proformaInvoice.create({
                data: {
                    invoiceNumber,
                    partnerId: partner.id,
                    partnerName: partner.partnerProfile?.businessName || partner.name,
                    issueDate: issuedAt,
                    totalUsd,
                    items: {
                        create: lineItems
                    }
                },
                include: {
                    items: {
                        orderBy: { createdAt: 'asc' }
                    }
                }
            })
        })

        return NextResponse.json(created)
    } catch (error) {
        console.error('Failed to issue PI:', error)
        return NextResponse.json({ error: 'Failed to issue PI' }, { status: 500 })
    }
}
