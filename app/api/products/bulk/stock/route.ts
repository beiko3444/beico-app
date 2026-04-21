import { NextResponse } from "next/server"
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
            const updated = await prisma.product.update({
                where: { id: update.id },
                data: { stock: update.stock },
            })
            results.push(updated.id)
        }

        return NextResponse.json({ success: true, count: results.length })
    } catch (error: any) {
        console.error("Bulk stock update error:", error)
        return NextResponse.json({
            error: "Failed to update stock",
            message: error?.message
        }, { status: 500 })
    }
}
