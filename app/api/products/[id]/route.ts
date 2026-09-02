import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { normalizeIncomingProductImage } from "@/lib/product-image-storage"
import {
    getProductStockActorId,
    normalizeProductStock,
    PRODUCT_STOCK_SOURCES,
    recordProductStockChange,
} from "@/lib/product-stock-history"

const productResponseSelect = {
    id: true,
    productNumber: true,
    name: true,
    nameJP: true,
    nameEN: true,
    buyPrice: true,
    cnyBuyPrice: true,
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
    groupName: true,
    autoGroupingDisabled: true,
    hsCode: true,
    japanHsCode: true,
    coupangSku: true,
    sortOrder: true,
    minOrderQuantity: true,
    orderUnit: true,
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
        const normalizedGroupName = body.groupName ? String(body.groupName).trim() : null
        const normalizedHsCode = body.hsCode ? String(body.hsCode).trim() : null
        const normalizedJapanHsCode = body.japanHsCode ? String(body.japanHsCode).trim() : null

        const { name, buyPrice, sellPrice } = body

        // Validation - ensure required fields are present and not empty
        if (!name || buyPrice === undefined || sellPrice === undefined) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
        }

        const updateData: any = {
            name: String(name).trim(),
            nameJP: body.nameJP ? String(body.nameJP).trim() : null,
            nameEN: body.nameEN ? String(body.nameEN).trim() : null,
            barcode: body.barcode ? String(body.barcode).trim() : null,
            productCode: normalizedProductCode,
            groupName: normalizedGroupName,
            autoGroupingDisabled: normalizedGroupName
                ? false
                : body.autoGroupingDisabled === true,
            hsCode: normalizedHsCode,
            japanHsCode: normalizedJapanHsCode,
            coupangSku: body.coupangSku ? String(body.coupangSku).trim() : null,
            buyPrice: Number(buyPrice),
            cnyBuyPrice: Object.prototype.hasOwnProperty.call(body, 'cnyBuyPrice')
                ? Math.max(0, Number(body.cnyBuyPrice) || 0)
                : undefined,
            sellPrice: Number(sellPrice),
            onlinePrice: (body.onlinePrice !== null && body.onlinePrice !== undefined && body.onlinePrice !== "") ? Number(body.onlinePrice) : 0,
            jpBuyPrice: (body.jpBuyPrice !== null && body.jpBuyPrice !== undefined && body.jpBuyPrice !== "") ? Number(body.jpBuyPrice) : 0,
            jpSellPrice: (body.jpSellPrice !== null && body.jpSellPrice !== undefined && body.jpSellPrice !== "") ? Number(body.jpSellPrice) : 0,
            krBuyPrice: (body.krBuyPrice !== null && body.krBuyPrice !== undefined && body.krBuyPrice !== "") ? Number(body.krBuyPrice) : 0,
            krSellPrice: (body.krSellPrice !== null && body.krSellPrice !== undefined && body.krSellPrice !== "") ? Number(body.krSellPrice) : 0,
            usBuyPrice: (body.usBuyPrice !== null && body.usBuyPrice !== undefined && body.usBuyPrice !== "") ? Number(body.usBuyPrice) : 0,
            usSellPrice: (body.usSellPrice !== null && body.usSellPrice !== undefined && body.usSellPrice !== "") ? Number(body.usSellPrice) : 0,
            wholesaleAvailable: typeof body.wholesaleAvailable === 'boolean'
                ? body.wholesaleAvailable
                : undefined,
            priceA: (body.priceA !== null && body.priceA !== undefined && body.priceA !== "") ? Number(body.priceA) : null,
            priceB: (body.priceB !== null && body.priceB !== undefined && body.priceB !== "") ? Number(body.priceB) : null,
            priceC: (body.priceC !== null && body.priceC !== undefined && body.priceC !== "") ? Number(body.priceC) : null,
            priceD: (body.priceD !== null && body.priceD !== undefined && body.priceD !== "") ? Number(body.priceD) : null,
            stock: body.stock !== undefined ? normalizeProductStock(body.stock) : 0,
            minOrderQuantity: body.minOrderQuantity !== undefined ? Math.max(1, Math.round(Number(body.minOrderQuantity))) : 1,
            orderUnit: body.orderUnit !== undefined ? Math.max(1, Math.round(Number(body.orderUnit))) : 1,
            sortOrder: body.sortOrder !== undefined ? Math.round(Number(body.sortOrder)) : undefined,
            regionalPrices: body.regionalPrices !== undefined ? body.regionalPrices : undefined,
        }
        if (Object.prototype.hasOwnProperty.call(body, 'imageUrl')) {
            updateData.imageUrl = await normalizeIncomingProductImage(body.imageUrl)
        }

        const changedById = await getProductStockActorId()
        const product = await prisma.$transaction(async (tx) => {
            const existing = await tx.product.findUniqueOrThrow({
                where: { id },
                select: { stock: true },
            })
            const updated = await tx.product.update({
                where: { id },
                data: updateData,
                select: productResponseSelect,
            })
            await recordProductStockChange(tx, {
                productId: id,
                previousStock: existing.stock,
                newStock: updated.stock,
                source: PRODUCT_STOCK_SOURCES.EDIT,
                changedById,
                note: '상품 상세 수정',
            })
            return updated
        })

        revalidatePath('/admin/products')
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
        const patchData = { ...body }

        if (Object.prototype.hasOwnProperty.call(body, 'imageUrl')) {
            patchData.imageUrl = await normalizeIncomingProductImage(body.imageUrl)
        }

        delete patchData.copyImageFromProductId
        const hasStockChange = Object.prototype.hasOwnProperty.call(body, 'stock')
        if (hasStockChange) {
            patchData.stock = normalizeProductStock(body.stock)
        }
        if (Object.prototype.hasOwnProperty.call(body, 'groupName')) {
            patchData.groupName = body.groupName ? String(body.groupName).trim() : null
        }
        if (Object.prototype.hasOwnProperty.call(body, 'autoGroupingDisabled')) {
            patchData.autoGroupingDisabled = body.autoGroupingDisabled === true
        }

        const changedById = hasStockChange ? await getProductStockActorId() : null
        const product = await prisma.$transaction(async (tx) => {
            const existing = hasStockChange
                ? await tx.product.findUniqueOrThrow({ where: { id }, select: { stock: true } })
                : null
            const updated = await tx.product.update({
                where: { id },
                data: patchData,
                select: productResponseSelect,
            })
            if (existing) {
                await recordProductStockChange(tx, {
                    productId: id,
                    previousStock: existing.stock,
                    newStock: updated.stock,
                    source: PRODUCT_STOCK_SOURCES.PATCH,
                    changedById,
                    note: '상품 빠른 수정',
                })
            }
            return updated
        })

        revalidatePath('/admin/products')
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
        revalidatePath('/admin/products')
        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete product" }, { status: 500 })
    }
}
