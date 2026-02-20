import { prisma } from "@/lib/prisma"
import OrderInterface from "./order-interface"
import { Filter } from 'lucide-react'

export const dynamic = 'force-dynamic'

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export default async function NewOrderPage() {
    const session = await getServerSession(authOptions)

    // Fetch User Info
    let userGrade = 'C'
    let userName = ''
    const user = session?.user?.id ? await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { partnerProfile: true }
    }) : null

    if (user) {
        userGrade = user?.partnerProfile?.grade || 'C'
        userName = user?.name || ''
    }

    const products = await prisma.product.findMany({
        orderBy: { sortOrder: 'asc' },
    })

    // Map products to apply correct price based on grade
    const productsWithTieredPrice = products.map(p => {
        let finalPrice = p.sellPrice;

        let regional = (p as any).regionalPrices as any;
        const validGrades = ['A', 'B', 'C', 'D'];
        let gradeToUse = userGrade.toUpperCase();
        if (!validGrades.includes(gradeToUse)) gradeToUse = 'C';

        let krBuy = p.buyPrice, krSell = p.krSellPrice || 0;
        let jpBuy = p.jpBuyPrice || 0, jpSell = p.jpSellPrice || 0;
        let usBuy = p.usBuyPrice || 0, usSell = p.usSellPrice || 0;

        const parsePrices = (gradeData: any) => {
            krBuy = Number(String(gradeData.KR?.wholesale || '0').replace(/,/g, ''));
            krSell = Number(String(gradeData.KR?.retail || '0').replace(/,/g, ''));
            jpBuy = Number(String(gradeData.JP?.wholesale || '0').replace(/,/g, ''));
            jpSell = Number(String(gradeData.JP?.retail || '0').replace(/,/g, ''));
            usBuy = Number(String(gradeData.US?.wholesale || '0').replace(/,/g, ''));
            usSell = Number(String(gradeData.US?.retail || '0').replace(/,/g, ''));

            // Set final checkout price based on the user's country
            if (user?.country === 'Korea' && krBuy > 0) finalPrice = krBuy;
            else if (user?.country === 'Japan' && jpBuy > 0) finalPrice = jpBuy;
            else if (usBuy > 0) finalPrice = usBuy;
            else if (krBuy > 0) finalPrice = krBuy; // fallback to KR if US missing
        };

        if (regional && typeof regional === 'object' && regional[gradeToUse]) {
            parsePrices(regional[gradeToUse]);
        } else if (regional && typeof regional === 'object' && regional['C']) {
            parsePrices(regional['C']);
        } else {
            // Old fallback logic
            const gradePriceMap: Record<string, number | null | undefined> = {
                'A': p.priceA,
                'B': p.priceB,
                'C': p.priceC,
                'D': p.priceD
            }

            const selectedPrice = gradePriceMap[gradeToUse]
            if (selectedPrice !== null && selectedPrice !== undefined && selectedPrice > 0) {
                finalPrice = selectedPrice
            } else if (p.priceC && p.priceC > 0) {
                finalPrice = p.priceC
            }
            krBuy = finalPrice;
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
            nameEN: p.nameEN,
            minOrderQuantity: p.minOrderQuantity,
            buyPrice: p.buyPrice,
            onlinePrice: p.onlinePrice || 0,
            jpBuyPrice: jpBuy,
            jpSellPrice: jpSell,
            krBuyPrice: krBuy,
            krSellPrice: krSell,
            usBuyPrice: usBuy,
            usSellPrice: usSell,
            appliedGrade: gradeToUse,
            country: user?.country
        }
    })

    return (
        <div className="space-y-4">
            <div className="mb-2 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="flex items-baseline gap-3 text-left">
                    <h2 className="text-4xl font-black text-[#111827] tracking-tight">
                        商品リスト
                    </h2>
                    <p className="text-sm font-normal text-gray-400 tracking-wide uppercase">Product List</p>
                </div>
            </div>
            <OrderInterface products={productsWithTieredPrice} />
        </div>
    )
}
