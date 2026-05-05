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

        const usages = await prisma.electricityUsage.findMany({
            where: { year },
            select: {
                month: true,
                rawBillData: true
            },
            orderBy: { month: 'asc' }
        })

        const monthlyLandlordTotals = Object.fromEntries(
            Array.from({ length: 12 }, (_, idx) => [idx + 1, null])
        ) as Record<number, number | null>

        for (const usage of usages) {
            try {
                const parsed = JSON.parse(usage.rawBillData || '{}')
                monthlyLandlordTotals[usage.month] = typeof parsed.landlordTotal === 'number'
                    ? parsed.landlordTotal
                    : null
            } catch {
                monthlyLandlordTotals[usage.month] = null
            }
        }

        return NextResponse.json({ year, monthlyLandlordTotals })
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch electricity monthly summary" }, { status: 500 })
    }
}
