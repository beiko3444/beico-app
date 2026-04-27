import { prisma } from "@/lib/prisma"
import { getProductImageUrl } from "@/lib/product-image-url"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import OrderHistory from "@/components/OrderHistory"

export const dynamic = 'force-dynamic'

export default async function OrderHistoryPage() {
    const session = await getServerSession(authOptions)

    // session check handled in layout but good to be safe or for typing
    if (!session) return null

    const orders = await prisma.order.findMany({
        where: { userId: session.user.id },
        select: {
            id: true,
            orderNumber: true,
            total: true,
            createdAt: true,
            status: true,
            trackingNumber: true,
            courier: true,
            taxInvoiceIssued: true,
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
        },
        orderBy: { createdAt: 'desc' },
    })

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
        <OrderHistory orders={ordersWithImageUrls} userCountry={session.user.country} />
    )
}
