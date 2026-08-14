import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { isProductGrade, setProductGradeOrderValue } from "@/lib/productGradePricing"
import { requireAdminSession } from "@/lib/requireAdmin"

export async function POST(request: Request) {
    const { unauthorized } = await requireAdminSession()
    if (unauthorized) return unauthorized

    try {
        const body = await request.json()
        const { updates } = body
        const grade = body.grade ?? 'C'

        if (!updates || !Array.isArray(updates)) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
        }
        if (!isProductGrade(grade)) {
            return NextResponse.json({ error: "Invalid product grade" }, { status: 400 })
        }

        const results = []
        for (const update of updates) {
            const orderUnit = Math.max(1, Math.round(Number(update.orderUnit) || 1))
            const product = await prisma.product.findUnique({
                where: { id: update.id },
                select: { id: true, regionalPrices: true },
            })
            if (!product) continue

            const regionalPrices = setProductGradeOrderValue(product.regionalPrices, grade, 'orderUnit', orderUnit)

            const updated = await prisma.product.update({
                where: { id: update.id },
                data: {
                    ...(grade === 'C' ? { orderUnit } : {}),
                    regionalPrices: regionalPrices as Prisma.InputJsonValue,
                },
            })
            results.push(updated.id)
        }

        revalidatePath('/admin/products')
        revalidatePath('/order')

        return NextResponse.json({ success: true, count: results.length })
    } catch (error: unknown) {
        console.error("Bulk order unit update error:", error)
        return NextResponse.json({
            error: "Failed to update order units",
            message: error instanceof Error ? error.message : undefined,
        }, { status: 500 })
    }
}
