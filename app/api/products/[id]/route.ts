import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params
        const body = await request.json()
        console.log(`[UPDATE PRODUCT] ID: ${id}, Body:`, body)

        const { name, buyPrice, sellPrice, stock } = body

        // Validation - ensure required fields are present and not empty
        if (!name || buyPrice === undefined || sellPrice === undefined || stock === undefined) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
        }

        const updateData: any = {
            name: String(name).trim(),
            nameJP: body.nameJP ? String(body.nameJP).trim() : null,
            nameEN: body.nameEN ? String(body.nameEN).trim() : null,
            barcode: body.barcode ? String(body.barcode).trim() : null,
            productCode: body.productCode ? String(body.productCode).trim() : null,
            buyPrice: Math.round(Number(buyPrice)),
            sellPrice: Math.round(Number(sellPrice)),
            onlinePrice: (body.onlinePrice !== null && body.onlinePrice !== undefined && body.onlinePrice !== "") ? Math.round(Number(body.onlinePrice)) : 0,
            jpBuyPrice: (body.jpBuyPrice !== null && body.jpBuyPrice !== undefined && body.jpBuyPrice !== "") ? Math.round(Number(body.jpBuyPrice)) : 0,
            jpSellPrice: (body.jpSellPrice !== null && body.jpSellPrice !== undefined && body.jpSellPrice !== "") ? Math.round(Number(body.jpSellPrice)) : 0,
            krBuyPrice: (body.krBuyPrice !== null && body.krBuyPrice !== undefined && body.krBuyPrice !== "") ? Math.round(Number(body.krBuyPrice)) : 0,
            krSellPrice: (body.krSellPrice !== null && body.krSellPrice !== undefined && body.krSellPrice !== "") ? Math.round(Number(body.krSellPrice)) : 0,
            usBuyPrice: (body.usBuyPrice !== null && body.usBuyPrice !== undefined && body.usBuyPrice !== "") ? Math.round(Number(body.usBuyPrice)) : 0,
            usSellPrice: (body.usSellPrice !== null && body.usSellPrice !== undefined && body.usSellPrice !== "") ? Math.round(Number(body.usSellPrice)) : 0,
            stock: Math.round(Number(stock)),
            imageUrl: body.imageUrl || null,
            priceA: (body.priceA !== null && body.priceA !== undefined && body.priceA !== "") ? Math.round(Number(body.priceA)) : null,
            priceB: (body.priceB !== null && body.priceB !== undefined && body.priceB !== "") ? Math.round(Number(body.priceB)) : null,
            priceC: (body.priceC !== null && body.priceC !== undefined && body.priceC !== "") ? Math.round(Number(body.priceC)) : null,
            priceD: (body.priceD !== null && body.priceD !== undefined && body.priceD !== "") ? Math.round(Number(body.priceD)) : null,
            minOrderQuantity: body.minOrderQuantity !== undefined ? Math.max(1, Math.round(Number(body.minOrderQuantity))) : 1,
            sortOrder: body.sortOrder !== undefined ? Math.round(Number(body.sortOrder)) : undefined,
        }

        console.log(`[UPDATE PRODUCT] Data for Prisma:`, updateData)

        const product = await prisma.product.update({
            where: { id },
            data: updateData
        })

        return NextResponse.json(product)
    } catch (error: any) {
        console.error("Full Prisma Error:", error)
        return NextResponse.json({
            error: "Failed to update product",
            message: error?.message || "Internal server error",
            details: error?.code
        }, { status: 500 })
    }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params
        await prisma.product.delete({
            where: { id }
        })
        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete product" }, { status: 500 })
    }
}
