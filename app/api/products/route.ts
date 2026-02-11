import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
    try {
        const products = await prisma.product.findMany({
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
        const { name, nameJP, nameEN, buyPrice, sellPrice, stock, barcode, productCode, minOrderQuantity } = body

        // Validation
        if (!name || buyPrice === undefined || sellPrice === undefined) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
        }

        const productData: any = {
            name: String(name).trim(),
            nameJP: nameJP ? String(nameJP).trim() : null,
            nameEN: nameEN ? String(nameEN).trim() : null,
            barcode: barcode ? String(barcode).trim() : null,
            productCode: productCode ? String(productCode).trim() : null,
            buyPrice: Math.round(Number(buyPrice)),
            sellPrice: Math.round(Number(sellPrice)),
            onlinePrice: (body.onlinePrice !== null && body.onlinePrice !== undefined && body.onlinePrice !== "") ? Math.round(Number(body.onlinePrice)) : 0,
            jpBuyPrice: (body.jpBuyPrice !== null && body.jpBuyPrice !== undefined && body.jpBuyPrice !== "") ? Math.round(Number(body.jpBuyPrice)) : 0,
            jpSellPrice: (body.jpSellPrice !== null && body.jpSellPrice !== undefined && body.jpSellPrice !== "") ? Math.round(Number(body.jpSellPrice)) : 0,
            krBuyPrice: (body.krBuyPrice !== null && body.krBuyPrice !== undefined && body.krBuyPrice !== "") ? Math.round(Number(body.krBuyPrice)) : 0,
            krSellPrice: (body.krSellPrice !== null && body.krSellPrice !== undefined && body.krSellPrice !== "") ? Math.round(Number(body.krSellPrice)) : 0,
            usBuyPrice: (body.usBuyPrice !== null && body.usBuyPrice !== undefined && body.usBuyPrice !== "") ? Math.round(Number(body.usBuyPrice)) : 0,
            usSellPrice: (body.usSellPrice !== null && body.usSellPrice !== undefined && body.usSellPrice !== "") ? Math.round(Number(body.usSellPrice)) : 0,
            stock: stock !== undefined ? Math.round(Number(stock)) : 0,
            imageUrl: body.imageUrl || null,
            priceA: (body.priceA !== null && body.priceA !== undefined && body.priceA !== "") ? Math.round(Number(body.priceA)) : null,
            priceB: (body.priceB !== null && body.priceB !== undefined && body.priceB !== "") ? Math.round(Number(body.priceB)) : null,
            priceC: (body.priceC !== null && body.priceC !== undefined && body.priceC !== "") ? Math.round(Number(body.priceC)) : null,
            priceD: (body.priceD !== null && body.priceD !== undefined && body.priceD !== "") ? Math.round(Number(body.priceD)) : null,
            minOrderQuantity: minOrderQuantity !== undefined ? Math.max(1, Math.round(Number(minOrderQuantity))) : 1,
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
            }
        })

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
