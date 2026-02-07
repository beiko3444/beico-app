import { prisma } from "@/lib/prisma"
import OrderInterface from "./order-interface"

export const dynamic = 'force-dynamic'

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export default async function NewOrderPage() {
    const session = await getServerSession(authOptions)

    // Fetch User Grade
    let userGrade = 'C'
    if (session?.user?.id) {
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { partnerProfile: true }
        })
        userGrade = user?.partnerProfile?.grade || 'C'
    }

    const products = await prisma.product.findMany({
        orderBy: { sortOrder: 'asc' },
    })

    // Map products to apply correct price based on grade
    const productsWithTieredPrice = products.map(p => {
        let finalPrice = p.sellPrice

        switch (userGrade) {
            case 'A': finalPrice = p.priceA ?? p.sellPrice; break;
            case 'B': finalPrice = p.priceB ?? p.sellPrice; break;
            case 'C': finalPrice = p.priceC ?? p.sellPrice; break;
            case 'D': finalPrice = p.priceD ?? p.sellPrice; break;
            default: finalPrice = p.sellPrice;
        }

        return {
            id: p.id,
            name: p.name,
            sellPrice: finalPrice,
            stock: p.stock,
            imageUrl: p.imageUrl,
            productCode: p.productCode,
            barcode: p.barcode,
            nameJP: p.nameJP,
            minOrderQuantity: p.minOrderQuantity
        }
    })

    return (
        <>
            <h2 className="text-xl font-bold text-gray-800 mb-6">주문하기</h2>
            <OrderInterface products={productsWithTieredPrice} />
        </>
    )
}
