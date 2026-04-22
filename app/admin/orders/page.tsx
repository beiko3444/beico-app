import { prisma } from "@/lib/prisma"
import { getProductImageUrl } from "@/lib/product-image-url"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from 'next/link'
import OrdersClient from "./OrdersClient"

export const dynamic = 'force-dynamic'

const orderListSelect = {
    id: true,
    orderNumber: true,
    userId: true,
    total: true,
    createdAt: true,
    status: true,
    trackingNumber: true,
    courier: true,
    taxInvoiceIssued: true,
    depositConfirmedAt: true,
    adminDepositConfirmedAt: true,
    user: {
        select: {
            id: true,
            name: true,
            username: true,
            country: true,
            partnerProfile: {
                select: {
                    businessName: true,
                    representativeName: true,
                    grade: true,
                    businessRegNumber: true,
                    email: true,
                    contact: true,
                    address: true,
                },
            },
        },
    },
    items: {
        select: {
            id: true,
            productId: true,
            quantity: true,
            price: true,
                    product: {
                        select: {
                            id: true,
                            name: true,
                            nameJP: true,
                            nameEN: true,
                            imageUrl: true,
                            productCode: true,
                            barcode: true,
                            updatedAt: true,
                        },
                    },
                },
    },
} as const

export default async function OrdersPage() {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
        redirect('/login')
    }

    const [orders, pendingTaxCount, missingTrackingCount] = await Promise.all([
        prisma.order.findMany({
            select: orderListSelect,
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

    const ordersWithImageUrls = orders.map(order => ({
        ...order,
        items: order.items.map(item => {
            const { imageUrl, updatedAt, ...product } = item.product
            return {
                ...item,
                product: {
                    ...product,
                    imageUrl: imageUrl ? getProductImageUrl(product.id, updatedAt) : null,
                },
            }
        }),
    }))

    return (
        <OrdersClient
            orders={ordersWithImageUrls}
            pendingTaxCount={pendingTaxCount}
            missingTrackingCount={missingTrackingCount}
        />
    )
}
