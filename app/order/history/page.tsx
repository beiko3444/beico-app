import { prisma } from "@/lib/prisma"
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
        include: { items: { include: { product: true } } },
        orderBy: { createdAt: 'desc' }
    })

    return (
        <OrderHistory orders={orders} userCountry={session.user.country} />
    )
}
