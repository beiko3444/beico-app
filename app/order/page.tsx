import { prisma } from "@/lib/prisma"
import OrderInterface from "./order-interface"

export const dynamic = 'force-dynamic'

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export default async function NewOrderPage() {
    const session = await getServerSession(authOptions)

    // Fetch User Grade & Name
    let userGrade = 'C'
    let userName = ''
    if (session?.user?.id) {
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { partnerProfile: true }
        })
        userGrade = user?.partnerProfile?.grade || 'C'
        userName = user?.name || ''
    }

    const products = await prisma.product.findMany({
        orderBy: { sortOrder: 'asc' },
    })

    // Map products to apply correct price based on grade
    const productsWithTieredPrice = products.map(p => {
        let finalPrice = p.sellPrice

        // We use priceC as a secondary fallback if the specific grade price is null
        // before falling back to the consumer sellPrice
        const gradePriceMap: Record<string, number | null | undefined> = {
            'A': p.priceA,
            'B': p.priceB,
            'C': p.priceC,
            'D': p.priceD
        }

        const selectedPrice = gradePriceMap[userGrade.toUpperCase()]
        if (selectedPrice !== null && selectedPrice !== undefined && selectedPrice > 0) {
            finalPrice = selectedPrice
        } else if (p.priceC && p.priceC > 0) {
            // Default to C grade price if the user's specific grade price isn't set
            finalPrice = p.priceC
        } else {
            finalPrice = p.sellPrice
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
            minOrderQuantity: p.minOrderQuantity,
            originalSellPrice: p.sellPrice, // Keep for reference if needed
            appliedGrade: userGrade
        }
    })

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                    <span className="w-2 h-8 bg-[var(--color-brand-blue)] rounded-full"></span>
                    주문하기
                </h2>
                <p className="text-sm text-gray-500 mt-1 font-medium">실시간 재고 상태에 따라 발주가 가능합니다.</p>
            </div>
            <OrderInterface products={productsWithTieredPrice} />
        </div>
    )
}
