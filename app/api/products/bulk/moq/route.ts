import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { updates } = body

        if (!updates || !Array.isArray(updates)) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
        }

        const results = [];
        for (const update of updates) {
            const product = await prisma.product.findUnique({ where: { id: update.id } });
            if (!product) continue;

            let regionalPrices: Record<string, any> = (product.regionalPrices as Record<string, any>) || {};
            if (typeof regionalPrices !== 'object') regionalPrices = {};

            ['A', 'B', 'C', 'D'].forEach(grade => {
                if (!regionalPrices[grade]) regionalPrices[grade] = {};
                if (!regionalPrices[grade].KR) regionalPrices[grade].KR = { cost: '', wholesale: '', retail: '', moq: '1' };
                regionalPrices[grade].KR.moq = String(update.moq);
            });

            const updated = await prisma.product.update({
                where: { id: update.id },
                data: {
                    minOrderQuantity: update.moq,
                    regionalPrices: regionalPrices
                }
            });
            results.push(updated.id);
        }

        return NextResponse.json({ success: true, count: results.length })
    } catch (error: any) {
        console.error("Bulk MOQ update error:", error)
        return NextResponse.json({
            error: "Failed to update MOQs",
            message: error?.message
        }, { status: 500 })
    }
}
