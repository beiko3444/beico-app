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

        if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
            return NextResponse.json({ error: "Invalid year or month" }, { status: 400 })
        }

        let paidDate: Date | null = null
        if (paidDateRaw) {
            const parsed = new Date(paidDateRaw)
            if (Number.isNaN(parsed.getTime())) {
                return NextResponse.json({ error: "Invalid paidDate" }, { status: 400 })
            }
            paidDate = parsed
        }

        const payment = await prisma.rentPayment.upsert({
            where: { year_month: { year, month } },
            update: { paidDate },
            create: { year, month, paidDate },
        })

        return NextResponse.json({ payment })
    } catch (error) {
        console.error("Failed to save rent payment:", error)
        return NextResponse.json({ error: "Failed to save rent payment" }, { status: 500 })
    }
}
