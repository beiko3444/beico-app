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
            const updated = await prisma.product.update({
                where: { id: update.id },
                data: { orderUnit },
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
