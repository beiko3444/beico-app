
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { loadProductionProducts, resolveProductionProduct } from '@/lib/productionProduct'
import { attachProductionPrices } from '@/lib/productionPricing'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    try {
        const where = category ? { category } : {}
        const [logs, products] = await Promise.all([prisma.productionBatch.findMany({
            where,
            orderBy: { productionDate: 'desc' }, // Order by production date
        }), loadProductionProducts()])
        return NextResponse.json(logs.map(log => attachProductionPrices(log, products)), { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch production logs" }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const {
            category,
            productionDate,
            rawMaterialCost,
            depositDollar,
            electricityCost,
            packagingCost,
            warehouseCost,
            shippingCost,
            customsFee,
            customsDuty,
            vat,
            quantity,
            unitCost,
            memo
        } = body

        const pricing = await resolveProductionProduct(category, body.productId)
        if (!pricing) return NextResponse.json({ error: '가격을 가져올 생산 상품을 선택해 주세요.' }, { status: 400 })

        const log = await prisma.productionBatch.create({
            data: {
                category,
                productionDate: new Date(productionDate),
                rawMaterialCost: Math.round(Number(rawMaterialCost || 0)),
                depositDollar: depositDollar ? Number(depositDollar) : null,
                electricityCost: Math.round(Number(electricityCost || 0)),
                packagingCost: Math.round(Number(packagingCost || 0)),
                warehouseCost: Math.round(Number(warehouseCost || 0)),
                shippingCost: Math.round(Number(shippingCost || 0)),
                customsFee: Math.round(Number(customsFee || 0)),
                customsDuty: Math.round(Number(customsDuty || 0)),
                vat: Math.round(Number(vat || 0)),
                quantity: Math.round(Number(quantity || 0)),
                unitCost: unitCost ? Number(unitCost) : 0,
                ...pricing,
                memo
            }
        })
        return NextResponse.json(log)
    } catch (error: any) {
        console.error("Failed to create production log:", error)
        return NextResponse.json({
            error: "Failed to create production log",
            details: error.message
        }, { status: 500 })
    }
}
