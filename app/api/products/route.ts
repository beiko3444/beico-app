import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { normalizeIncomingProductImage } from "@/lib/product-image-storage"

const productListSelect = {
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

export async function GET() {
    try {
        const products = await prisma.product.findMany({
            select: productListSelect,
            orderBy: { createdAt: 'desc' }
        })
        return NextResponse.json(products)
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { name, nameJP, nameEN, buyPrice, sellPrice, stock, barcode, productCode, minOrderQuantity, coupangSku } = body
        const normalizedProductCode = productCode ? String(productCode).trim().toUpperCase() : null
        let imageUrl: string | null = null

        if (Object.prototype.hasOwnProperty.call(body, 'imageUrl')) {
            imageUrl = await normalizeIncomingProductImage(body.imageUrl)
        } else if (body.copyImageFromProductId) {
            const sourceProduct = await prisma.product.findUnique({
                where: { id: String(body.copyImageFromProductId) },
                select: { imageUrl: true },
            })
            imageUrl = await normalizeIncomingProductImage(sourceProduct?.imageUrl)
        }

        // Validation
        if (!name || buyPrice === undefined || sellPrice === undefined) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
        }

        const productData: any = {
            name: String(name).trim(),
            nameJP: nameJP ? String(nameJP).trim() : null,
            nameEN: nameEN ? String(nameEN).trim() : null,
            barcode: barcode ? String(barcode).trim() : null,
            productCode: normalizedProductCode,
            coupangSku: coupangSku ? String(coupangSku).trim() : null,
            buyPrice: Number(buyPrice),
            sellPrice: Number(sellPrice),
            onlinePrice: (body.onlinePrice !== null && body.onlinePrice !== undefined && body.onlinePrice !== "") ? Number(body.onlinePrice) : 0,
            jpBuyPrice: (body.jpBuyPrice !== null && body.jpBuyPrice !== undefined && body.jpBuyPrice !== "") ? Number(body.jpBuyPrice) : 0,
            jpSellPrice: (body.jpSellPrice !== null && body.jpSellPrice !== undefined && body.jpSellPrice !== "") ? Number(body.jpSellPrice) : 0,
            krBuyPrice: (body.krBuyPrice !== null && body.krBuyPrice !== undefined && body.krBuyPrice !== "") ? Number(body.krBuyPrice) : 0,
            krSellPrice: (body.krSellPrice !== null && body.krSellPrice !== undefined && body.krSellPrice !== "") ? Number(body.krSellPrice) : 0,
            usBuyPrice: (body.usBuyPrice !== null && body.usBuyPrice !== undefined && body.usBuyPrice !== "") ? Number(body.usBuyPrice) : 0,
            usSellPrice: (body.usSellPrice !== null && body.usSellPrice !== undefined && body.usSellPrice !== "") ? Number(body.usSellPrice) : 0,
            stock: stock !== undefined ? Math.round(Number(stock)) : 0,
            imageUrl,
            priceA: (body.priceA !== null && body.priceA !== undefined && body.priceA !== "") ? Number(body.priceA) : null,
            priceB: (body.priceB !== null && body.priceB !== undefined && body.priceB !== "") ? Number(body.priceB) : null,
            priceC: (body.priceC !== null && body.priceC !== undefined && body.priceC !== "") ? Number(body.priceC) : null,
            priceD: (body.priceD !== null && body.priceD !== undefined && body.priceD !== "") ? Number(body.priceD) : null,
            minOrderQuantity: minOrderQuantity !== undefined ? Math.max(1, Math.round(Number(minOrderQuantity))) : 1,
            regionalPrices: body.regionalPrices !== undefined ? body.regionalPrices : undefined,
        }

        // Get max sortOrder to put new product at the end
        const maxSortOrderProduct = await prisma.product.findFirst({
            orderBy: { sortOrder: 'desc' },
            select: { sortOrder: true }
        })
        const nextSortOrder = (maxSortOrderProduct?.sortOrder ?? -1) + 1

        const product = await prisma.product.create({
            data: {
                ...productData,
                sortOrder: nextSortOrder
            },
            select: productListSelect
        })

        revalidatePath('/admin/products')
        return NextResponse.json(product)
    } catch (error: any) {
        console.error("Failed to create product:", error)
        return NextResponse.json({
            error: "Failed to create product",
            message: error?.message || "Internal server error",
            details: error?.code
        }, { status: 500 })
    }
}
