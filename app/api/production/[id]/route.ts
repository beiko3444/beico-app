
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params
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

        const log = await prisma.productionBatch.update({
            where: { id },
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
                unitCost: unitCost ? Number(unitCost) : null,
                salesPrice: Math.round(Number(salesPrice || 0)),
                wholesalePrice: Math.round(Number(wholesalePrice || 0)),
                memo
            }
        })
        return NextResponse.json(log)
    } catch (error) {
        return NextResponse.json({ error: "Failed to update production log" }, { status: 500 })
    }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params
        await prisma.productionBatch.delete({
            where: { id }
        })
        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete production log" }, { status: 500 })
    }
}
