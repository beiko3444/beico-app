import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
    console.log("PATCH request received")
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { id } = await context.params
        let body;
        try {
            body = await request.json()
        } catch (e) {
            return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
        }
        const { status, trackingNumber, courier, taxInvoiceIssued, adminDepositConfirmedAt, depositConfirmedAt } = body

        // Validation
        if (status) {
            const validStatuses = ['PENDING', 'CANCELED', 'DEPOSIT_COMPLETED', 'APPROVED', 'SHIPPED']
            if (!validStatuses.includes(status)) {
                return NextResponse.json({ error: "Invalid status" }, { status: 400 })
            }
        }

        const order = await prisma.order.findUnique({
            where: { id },
            include: { user: true }
        })

        if (!order) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 })
        }

        // Authorization logic
        if (session.user.role !== 'ADMIN') {
            if (order.userId !== session.user.id) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 })
            }

            // Partner can only cancel PENDING orders or mark as DEPOSIT_COMPLETED
            if (status === 'CANCELED') {
                if (order.status !== 'PENDING') {
                    return NextResponse.json({ error: "Cannot cancel approved order" }, { status: 400 })
                }
            } else if (status === 'DEPOSIT_COMPLETED') {
                // Allow moving to DEPOSIT_COMPLETED from PENDING/PENDING_DEPOSIT
                if (order.status !== 'PENDING' && order.status !== 'PENDING_DEPOSIT') {
                    return NextResponse.json({ error: "Invalid status transition" }, { status: 403 })
                }
            } else if (status === 'PENDING') {
                // Allow moving back to PENDING from DEPOSIT_COMPLETED (Deposit Cancellation)
                if (order.status !== 'DEPOSIT_COMPLETED') {
                    return NextResponse.json({ error: "Forbidden status change" }, { status: 403 })
                }
            } else if (status) { // Partner trying to set other status
                return NextResponse.json({ error: "Forbidden status change" }, { status: 403 })
            }

            // Partner cannot set tracking number, tax invoice, or admin/user deposit info directly
            if (trackingNumber !== undefined || taxInvoiceIssued !== undefined || adminDepositConfirmedAt !== undefined || depositConfirmedAt !== undefined) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 })
            }
        }

        const updateData: any = {}
        if (status) updateData.status = status
        if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber
        if (courier !== undefined) updateData.courier = courier
        if (taxInvoiceIssued !== undefined) updateData.taxInvoiceIssued = taxInvoiceIssued
        if (adminDepositConfirmedAt !== undefined) updateData.adminDepositConfirmedAt = adminDepositConfirmedAt ? new Date(adminDepositConfirmedAt) : null
        if (depositConfirmedAt !== undefined) updateData.depositConfirmedAt = depositConfirmedAt ? new Date(depositConfirmedAt) : null

        // Transaction to update order and restore stock if canceled
        const result = await prisma.$transaction(async (tx) => {
            // Restore stock if being canceled from non-canceled state
            if (status === 'CANCELED' && order.status !== 'CANCELED') {
                const orderItems = await tx.orderItem.findMany({
                    where: { orderId: id }
                })
                for (const item of orderItems) {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { stock: { increment: item.quantity } }
                    })
                }
            }

            // Deduct stock if un-canceling? (Logic simplistic for now, strictly follow "Restore on Cancel")
            // If changing from CANCELED to PENDING/APPROVED, we should re-deduct? 
            // For now, let's assume one-way flow for safety or just handle cancellation.
            // If user reverts CANCELED -> PENDING, we need to check stock again?
            // Let's stick to the prompt: "Ordered -> Deduct", "Canceled/Deleted -> Restore".

            // Re-deduct if moving FROM CANCELED TO PENDING
            if (order.status === 'CANCELED' && status === 'PENDING') {
                const orderItems = await tx.orderItem.findMany({
                    where: { orderId: id }
                })
                // Verify stock first
                for (const item of orderItems) {
                    const product = await tx.product.findUnique({ where: { id: item.productId } })
                    if (!product || product.stock < item.quantity) {
                        throw new Error(`Insufficient stock to re-activate order for ${product?.name}`)
                    }
                }
                // Deduct
                for (const item of orderItems) {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { stock: { decrement: item.quantity } }
                    })
                }
            }

            if (status === 'DEPOSIT_COMPLETED') {
                updateData.depositConfirmedAt = new Date()
            } else if (status === 'PENDING') {
                updateData.depositConfirmedAt = null
            }

            const updatedOrder = await tx.order.update({
                where: { id },
                data: updateData
            })
            return updatedOrder
        })

        return NextResponse.json(result)

    } catch (error: any) {
        console.error("API Error:", error)
        return NextResponse.json({ error: error.message || "Failed to update order" }, { status: 500 })
    }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
    console.log("DELETE request received")
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { id } = await context.params

        const order = await prisma.order.findUnique({
            where: { id },
            include: { items: true }
        })

        if (!order) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 })
        }

        // Authorization for Delete
        if (session.user.role !== 'ADMIN') {
            if (order.userId !== session.user.id) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 })
            }
            if (order.status !== 'PENDING') {
                return NextResponse.json({ error: "Cannot delete processed order" }, { status: 400 })
            }
        }

        await prisma.$transaction(async (tx) => {
            // Restore stock if order wasn't already canceled (stock held)
            if (order.status !== 'CANCELED') {
                for (const item of order.items) {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { stock: { increment: item.quantity } }
                    })
                }
            }

            await tx.orderItem.deleteMany({
                where: { orderId: id }
            })
            await tx.order.delete({
                where: { id }
            })
        })

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error("Delete error:", error)
        return NextResponse.json({ error: "Failed to delete order" }, { status: 500 })
    }
}
