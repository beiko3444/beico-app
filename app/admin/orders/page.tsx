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
    depositSmsMessages: {
        orderBy: {
            receivedAt: 'desc',
        },
        take: 5,
        select: {
            id: true,
            messageHash: true,
            sender: true,
            body: true,
            receivedAt: true,
            amount: true,
            depositorName: true,
            bankName: true,
            sourceDevice: true,
            matchStatus: true,
            matchedAt: true,
        },
    },
} as const

export default async function OrdersPage() {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
        redirect('/login')
    }
    const orders = await prisma.order.findMany({
        select: orderListSelect,
        orderBy: {
            createdAt: 'desc'
        }
    })
    const [depositSmsGroups, depositSmsActionItems] = await Promise.all([
        prisma.depositSms.groupBy({
            by: ['matchStatus'],
            where: {
                matchStatus: {
                    in: ['UNMATCHED', 'AMBIGUOUS'],
                },
            },
            _count: {
                _all: true,
            },
        }),
        prisma.depositSms.findMany({
            where: {
                matchStatus: {
                    in: ['UNMATCHED', 'AMBIGUOUS'],
                },
            },
            orderBy: {
                receivedAt: 'desc',
            },
            take: 10,
            select: {
                id: true,
                sender: true,
                body: true,
                receivedAt: true,
                amount: true,
                depositorName: true,
                bankName: true,
                matchStatus: true,
            },
        }),
    ])
    const depositSmsSummary = depositSmsGroups.reduce(
        (acc, group) => {
            if (group.matchStatus === 'UNMATCHED') acc.unmatched = group._count._all
            if (group.matchStatus === 'AMBIGUOUS') acc.ambiguous = group._count._all
            return acc
        },
        { unmatched: 0, ambiguous: 0 }
    )

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
            depositSmsSummary={depositSmsSummary}
            depositSmsActionItems={depositSmsActionItems}
        />
    )
}
