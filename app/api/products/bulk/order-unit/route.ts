import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { updates } = body

        if (!updates || !Array.isArray(updates)) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
        }

        const results = []
        for (const update of updates) {
            const orderUnit = Math.max(1, Math.round(Number(update.orderUnit) || 1))
            const product = await prisma.product.findUnique({ where: { id: update.id } })
            if (!product) continue

            let regionalPrices: Record<string, any> = (product.regionalPrices as Record<string, any>) || {}
            if (!regionalPrices || typeof regionalPrices !== 'object' || Array.isArray(regionalPrices)) regionalPrices = {}

            ;['A', 'B', 'C', 'D'].forEach(grade => {
                if (!regionalPrices[grade] || typeof regionalPrices[grade] !== 'object') regionalPrices[grade] = {}
                if (!regionalPrices[grade].KR || typeof regionalPrices[grade].KR !== 'object') {
                    regionalPrices[grade].KR = {
                        cost: '',
                        wholesale: '',
                        retail: '',
                        moq: String(product.minOrderQuantity || 1),
                        orderUnit: '1',
                    }
                }
                regionalPrices[grade].KR.orderUnit = String(orderUnit)
            })

            const updated = await prisma.product.update({
                where: { id: update.id },
                data: { orderUnit, regionalPrices },
            })
            results.push(updated.id)
        }

        revalidatePath('/admin/products')
        revalidatePath('/order')

        return NextResponse.json({ success: true, count: results.length })
    } catch (error: any) {
        console.error("Bulk order unit update error:", error)
        return NextResponse.json({
            error: "Failed to update order units",
            message: error?.message
        }, { status: 500 })
    }
}
