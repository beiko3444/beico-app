import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import {
    getProductStockActorId,
    normalizeProductStock,
    PRODUCT_STOCK_SOURCES,
    recordProductStockChange,
} from "@/lib/product-stock-history"

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { updates } = body

        if (!updates || !Array.isArray(updates)) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
        }

        const changedById = await getProductStockActorId()
        const results = await prisma.$transaction(async (tx) => {
            const changedIds: string[] = []
            for (const update of updates) {
                const stock = normalizeProductStock(update.stock)
                const existing = await tx.product.findUniqueOrThrow({
                    where: { id: update.id },
                    select: { stock: true },
                })
                if (existing.stock === stock) continue

                await tx.product.update({
                    where: { id: update.id },
                    data: { stock },
                })
                await recordProductStockChange(tx, {
                    productId: update.id,
                    previousStock: existing.stock,
                    newStock: stock,
                    source: PRODUCT_STOCK_SOURCES.BULK,
                    changedById,
                    note: '상품관리 일괄 수정',
                })
                changedIds.push(update.id)
            }
            return changedIds
        })

        revalidatePath('/admin/products')
        return NextResponse.json({ success: true, count: results.length })
    } catch (error: any) {
        console.error("Bulk stock update error:", error)
        return NextResponse.json({
            error: "Failed to update stock",
            message: error?.message
        }, { status: 500 })
    }
}
