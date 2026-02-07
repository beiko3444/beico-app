import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from 'next/link'
import OrdersClient from "./OrdersClient"

export const dynamic = 'force-dynamic'

export default async function OrdersPage() {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
        redirect('/login')
    }

    const [orders, pendingTaxCount, missingTrackingCount] = await Promise.all([
        prisma.order.findMany({
            include: {
                user: {
                    include: {
                        partnerProfile: true
                    }
                },
                items: {
                    include: {
                        product: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        }),
        prisma.order.count({
            where: {
                status: 'APPROVED',
                taxInvoiceIssued: false
            }
        }),
        prisma.order.count({
            where: {
                status: 'APPROVED',
                OR: [
                    { trackingNumber: null },
                    { trackingNumber: '' }
                ]
            }
        })
    ])

    return (
        <OrdersClient
            orders={orders}
            pendingTaxCount={pendingTaxCount}
            missingTrackingCount={missingTrackingCount}
        />
    )
}
