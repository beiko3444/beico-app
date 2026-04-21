import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const productResponseSelect = {
    id: true,
    name: true,
    nameJP: true,
    nameEN: true,
    buyPrice: true,
    sellPrice: true,
    onlinePrice: true,
    priceA: true,
    priceB: true,
    priceC: true,
    priceD: true,
    stock: true,
    safetyStock: true,
    barcode: true,
    productCode: true,
    coupangSku: true,
    sortOrder: true,
    minOrderQuantity: true,
    jpBuyPrice: true,
    jpSellPrice: true,
    krBuyPrice: true,
    krSellPrice: true,
    usBuyPrice: true,
    usSellPrice: true,
    regionalPrices: true,
    wholesaleAvailable: true,
    createdAt: true,
    updatedAt: true,
} as const

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params
        const body = await request.json()
        const normalizedProductCode = body.productCode ? String(body.productCode).trim().toUpperCase() : null

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
            productCode: normalizedProductCode,
            coupangSku: body.coupangSku ? String(body.coupangSku).trim() : null,
            buyPrice: Number(buyPrice),
            sellPrice: Number(sellPrice),
            onlinePrice: (body.onlinePrice !== null && body.onlinePrice !== undefined && body.onlinePrice !== "") ? Number(body.onlinePrice) : 0,
            jpBuyPrice: (body.jpBuyPrice !== null && body.jpBuyPrice !== undefined && body.jpBuyPrice !== "") ? Number(body.jpBuyPrice) : 0,
            jpSellPrice: (body.jpSellPrice !== null && body.jpSellPrice !== undefined && body.jpSellPrice !== "") ? Number(body.jpSellPrice) : 0,
            krBuyPrice: (body.krBuyPrice !== null && body.krBuyPrice !== undefined && body.krBuyPrice !== "") ? Number(body.krBuyPrice) : 0,
            krSellPrice: (body.krSellPrice !== null && body.krSellPrice !== undefined && body.krSellPrice !== "") ? Number(body.krSellPrice) : 0,
            usBuyPrice: (body.usBuyPrice !== null && body.usBuyPrice !== undefined && body.usBuyPrice !== "") ? Number(body.usBuyPrice) : 0,
            usSellPrice: (body.usSellPrice !== null && body.usSellPrice !== undefined && body.usSellPrice !== "") ? Number(body.usSellPrice) : 0,
            stock: Math.round(Number(stock)),
            priceA: (body.priceA !== null && body.priceA !== undefined && body.priceA !== "") ? Number(body.priceA) : null,
            priceB: (body.priceB !== null && body.priceB !== undefined && body.priceB !== "") ? Number(body.priceB) : null,
            priceC: (body.priceC !== null && body.priceC !== undefined && body.priceC !== "") ? Number(body.priceC) : null,
            priceD: (body.priceD !== null && body.priceD !== undefined && body.priceD !== "") ? Number(body.priceD) : null,
            minOrderQuantity: body.minOrderQuantity !== undefined ? Math.max(1, Math.round(Number(body.minOrderQuantity))) : 1,
            sortOrder: body.sortOrder !== undefined ? Math.round(Number(body.sortOrder)) : undefined,
            regionalPrices: body.regionalPrices !== undefined ? body.regionalPrices : undefined,
        }
        if (Object.prototype.hasOwnProperty.call(body, 'imageUrl')) {
            updateData.imageUrl = body.imageUrl || null
        }

        const product = await prisma.product.update({
            where: { id },
            data: updateData,
            select: productResponseSelect
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

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params
        const body = await request.json()
        const product = await prisma.product.update({
            where: { id },
            data: body,
            select: productResponseSelect,
        })
        return NextResponse.json(product)
    } catch (error: any) {
        return NextResponse.json({ error: "Failed to patch product", message: error?.message }, { status: 500 })
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
