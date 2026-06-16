import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminSession } from "@/lib/requireAdmin"

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    const { unauthorized } = await requireAdminSession()
    if (unauthorized) return unauthorized

    try {
        const { searchParams } = new URL(request.url)
        const year = parseInt(searchParams.get('year') || '')

        if (!year) {
            return NextResponse.json({ error: "Missing year" }, { status: 400 })
        }

        const payments = await prisma.rentPayment.findMany({
            where: { year },
            orderBy: { month: 'asc' },
        })

        return NextResponse.json({ payments })
    } catch (error) {
        console.error("Failed to fetch rent payments:", error)
        return NextResponse.json({ error: "Failed to fetch rent payments" }, { status: 500 })
    }
}

export async function POST(request: Request) {
    const { unauthorized } = await requireAdminSession()
    if (unauthorized) return unauthorized

    try {
        const body = await request.json()
        const year = Number(body?.year)
        const month = Number(body?.month)
        const paidDateRaw = body?.paidDate
        const hasPaidDate = Object.prototype.hasOwnProperty.call(body || {}, 'paidDate')
        const hasRentTaxInvoiceIssued = Object.prototype.hasOwnProperty.call(body || {}, 'rentTaxInvoiceIssued')
        const hasElectricityPaid = Object.prototype.hasOwnProperty.call(body || {}, 'electricityPaid')
        const hasElectricityPaidAt = Object.prototype.hasOwnProperty.call(body || {}, 'electricityPaidAt')

        if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
            return NextResponse.json({ error: "Invalid year or month" }, { status: 400 })
        }

        const paidDate = hasPaidDate ? parseOptionalDate(paidDateRaw, 'paidDate') : undefined
        const electricityPaidAt = hasElectricityPaidAt ? parseOptionalDate(body?.electricityPaidAt, 'electricityPaidAt') : undefined
        if (paidDate instanceof NextResponse) return paidDate
        if (electricityPaidAt instanceof NextResponse) return electricityPaidAt

        const update: Record<string, unknown> = {}
        if (hasPaidDate) update.paidDate = paidDate
        if (hasRentTaxInvoiceIssued) update.rentTaxInvoiceIssued = Boolean(body?.rentTaxInvoiceIssued)
        if (hasElectricityPaid) update.electricityPaid = Boolean(body?.electricityPaid)
        if (hasElectricityPaidAt) update.electricityPaidAt = electricityPaidAt

        const payment = await prisma.rentPayment.upsert({
            where: { year_month: { year, month } },
            update,
            create: {
                year,
                month,
                paidDate: hasPaidDate ? paidDate : null,
                rentTaxInvoiceIssued: hasRentTaxInvoiceIssued ? Boolean(body?.rentTaxInvoiceIssued) : false,
                electricityPaid: hasElectricityPaid ? Boolean(body?.electricityPaid) : false,
                electricityPaidAt: hasElectricityPaidAt ? electricityPaidAt : null,
            },
        })

        return NextResponse.json({ payment })
    } catch (error) {
        console.error("Failed to save rent payment:", error)
        return NextResponse.json({ error: "Failed to save rent payment" }, { status: 500 })
    }
}

function parseOptionalDate(value: unknown, fieldName: string): Date | null | NextResponse {
    if (!value) return null
    const parsed = new Date(String(value))
    if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: `Invalid ${fieldName}` }, { status: 400 })
    }
    return parsed
}
