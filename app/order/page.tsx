import { prisma } from "@/lib/prisma"
import OrderInterface from "./order-interface"
import { Filter } from 'lucide-react'

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
            buyPrice: p.buyPrice,
            onlinePrice: p.onlinePrice || 0,
            appliedGrade: userGrade
        }
    })

    return (
        <div className="space-y-6">
            <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="flex items-baseline gap-3">
                    <h2 className="text-4xl font-black text-[#111827] tracking-tight">
                        Order List
                    </h2>
                    <p className="text-xl font-bold text-gray-400 tracking-wide">注文リスト</p>
                </div>

                <div className="flex items-center gap-2 text-[#e34219] font-bold bg-white px-5 py-2.5 rounded-xl shadow-sm border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
                    <Filter size={20} strokeWidth={2.5} />
                    <span className="text-sm">Filter</span>
                </div>
            </div>
            <OrderInterface products={productsWithTieredPrice} />
        </div>
    )
}
