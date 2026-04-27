import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { sendEmail } from "@/lib/email"

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
            select: {
                id: true,
                userId: true,
                orderNumber: true,
                status: true,
                user: {
                    select: {
                        name: true,
                    },
                },
                items: {
                    select: {
                        productId: true,
                        quantity: true,
                        price: true,
                        product: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
            }
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
                // Allow moving to DEPOSIT_COMPLETED from PENDING/PENDING_DEPOSIT, or if already DEPOSIT_COMPLETED (idempotency)
                if (order.status !== 'PENDING' && order.status !== 'PENDING_DEPOSIT' && order.status !== 'DEPOSIT_COMPLETED') {
                    console.log(`Forbidden transition attempt from ${order.status} to DEPOSIT_COMPLETED`)
                    return NextResponse.json({ error: `Invalid status transition from ${order.status}` }, { status: 403 })
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
        const result = await prisma.$transaction(async (tx: any) => {
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

            // Synchronize deposit confirmations for Admin actions
            if (session.user.role === 'ADMIN') {
                if (status === 'DEPOSIT_COMPLETED') {
                    if (!updateData.depositConfirmedAt) updateData.depositConfirmedAt = new Date()
                    if (!updateData.adminDepositConfirmedAt) updateData.adminDepositConfirmedAt = new Date()
                } else if (adminDepositConfirmedAt) {
                    // If specifically setting admin confirmation, ensure user confirmation and status are also set
                    updateData.status = 'DEPOSIT_COMPLETED'
                    if (!updateData.depositConfirmedAt) updateData.depositConfirmedAt = new Date()
                    updateData.adminDepositConfirmedAt = new Date(adminDepositConfirmedAt)
                }
            } else {
                // Partner (Customer) action
                if (status === 'DEPOSIT_COMPLETED') {
                    updateData.depositConfirmedAt = new Date()
                } else if (status === 'PENDING') {
                    // Reverting to PENDING clears user confirmation (but not necessarily admin's if already done, 
                    // though usually admin wouldn't have confirmed if it's PENDING)
                    updateData.depositConfirmedAt = null
                }
            }

            const updatedOrder = await tx.order.update({
                where: { id },
                data: updateData
            })
            return updatedOrder
        })

        if (session.user.role !== 'ADMIN' && status === 'DEPOSIT_COMPLETED' && order.status !== 'DEPOSIT_COMPLETED') {
            try {
                // Calculate Totals using the same logic as AdminOrderCard
                const productSupplyTotal = order.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
                const totalQuantity = order.items.reduce((sum: number, item: any) => sum + item.quantity, 0);
                const shippingFee = totalQuantity > 0 ? Math.ceil(totalQuantity / 100) * 3000 : 0;
                const grandSupply = productSupplyTotal + shippingFee;
                const grandVat = Math.round(grandSupply * 0.1);
                const totalAmount = grandSupply + grandVat;

                const itemsListHtml = order.items.map((item: any) => `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 10px 0;">${item.product.name}</td>
                        <td style="padding: 10px 0; text-align: center;">${item.quantity}</td>
                        <td style="padding: 10px 0; text-align: right;">${(item.price * item.quantity).toLocaleString()}원</td>
                    </tr>
                `).join('');

                await sendEmail({
                    to: 'contact@beiko.co.kr',
                    subject: `[입금완료 알림] ${order.user?.name || '고객'}님의 입금 확인 요청`,
                    text: `고객(${order.user?.name || '알 수 없음'})님이 입금 확인을 요청했습니다.\n\n주문번호: ${order.orderNumber || order.id}\n총 금액: ${totalAmount.toLocaleString()}원\n\n관리자 페이지: ${process.env.NEXTAUTH_URL}/admin/orders`,
                    html: `
                        <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 12px;">
                            <h2 style="color: #e43f29; border-bottom: 2px solid #e43f29; padding-bottom: 10px;">💰 입금 완료 알림</h2>
                            <p style="font-size: 16px;"><strong>${order.user?.name || '고객'}</strong>님이 입금 확인을 요청했습니다.</p>
                            
                            <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                <p style="margin: 5px 0;"><strong>주문번호:</strong> ${order.orderNumber || order.id}</p>
                                <p style="margin: 5px 0;"><strong>상태:</strong> <span style="color: #e43f29; font-weight: bold;">입금완료 (관리자 확인 필요)</span></p>
                            </div>

                            <h3 style="font-size: 15px; border-bottom: 1px solid #333; padding-bottom: 5px;">📦 주문 내역</h3>
                            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                                <thead>
                                    <tr style="border-bottom: 2px solid #eee; color: #666;">
                                        <th style="text-align: left; padding: 10px 0;">상품명</th>
                                        <th style="text-align: center; padding: 10px 0;">수량</th>
                                        <th style="text-align: right; padding: 10px 0;">금액</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itemsListHtml}
                                    ${shippingFee > 0 ? `
                                    <tr style="border-bottom: 1px solid #eee;">
                                        <td style="padding: 10px 0;">배송비</td>
                                        <td style="padding: 10px 0; text-align: center;">1</td>
                                        <td style="padding: 10px 0; text-align: right;">${shippingFee.toLocaleString()}원</td>
                                    </tr>
                                    ` : ''}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colspan="2" style="padding: 15px 0; font-weight: bold; font-size: 16px;">총 결제금액 (VAT포함)</td>
                                        <td style="padding: 15px 0; text-align: right; font-weight: bold; font-size: 18px; color: #e43f29;">${totalAmount.toLocaleString()}원</td>
                                    </tr>
                                </tfoot>
                            </table>

                            <p style="margin-top: 30px; text-align: center;">
                                <a href="${process.env.NEXTAUTH_URL}/admin/orders" 
                                   style="display: inline-block; padding: 12px 24px; background: #424853; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
                                   관리자 페이지에서 확인하기
                                </a>
                            </p>
                            <p style="font-size: 12px; color: #999; text-align: center; margin-top: 20px;">본 메일은 베이코 시스템에서 자동 발송되었습니다.</p>
                        </div>
                    `
                });
            } catch (err) {
                console.error("Failed to send deposit confirmation email:", err);
            }
        }

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

        await prisma.$transaction(async (tx: any) => {
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
