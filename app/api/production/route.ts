
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    try {
        const where = category ? { category } : {}
        const logs = await prisma.productionBatch.findMany({
            where,
            orderBy: { productionDate: 'desc' }, // Order by production date
        })
        return NextResponse.json(logs)
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
            salesPrice,
            wholesalePrice,
            memo
        } = body

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
                salesPrice: Math.round(Number(salesPrice || 0)),
                wholesalePrice: Math.round(Number(wholesalePrice || 0)),
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
