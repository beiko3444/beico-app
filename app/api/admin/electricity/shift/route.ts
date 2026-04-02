import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/requireAdmin'

export async function GET() {
    const { unauthorized } = await requireAdminSession()
    if (unauthorized) return unauthorized

    try {
        const records = await prisma.electricityUsage.findMany()

        // Temporarily shift year to year + 1000 (avoid unique constraints collisions)
        for (const r of records) {
            await prisma.electricityUsage.update({
                where: { id: r.id },
                data: { year: r.year + 1000 }
            })
        }

        const updated = []
        for (const r of records) {
            let newYear = r.year
            let newMonth = r.month - 1
            if (newMonth === 0) {
                newYear -= 1
                newMonth = 12
            }

            const updatedRecord = await prisma.electricityUsage.update({
                where: { id: r.id },
                data: { year: newYear, month: newMonth }
            })
            updated.push(updatedRecord)
        }

        return NextResponse.json({ success: true, count: updated.length, updated })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message || String(e) }, { status: 500 })
    }
}
