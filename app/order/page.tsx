import { prisma } from "@/lib/prisma"
import OrderInterface from "./order-interface"
import { getProductImageUrl } from "@/lib/product-image-url"

export const dynamic = 'force-dynamic'

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const safeNumber = (value: unknown, fallback = 0) => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
    if (typeof value === 'bigint') return Number(value)
    const normalized = String(value ?? '').replace(/,/g, '').trim()
    if (!normalized) return fallback
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : fallback
}

const safeNonNegativeNumber = (value: unknown, fallback = 0) => {
    const parsed = safeNumber(value, fallback)
    return parsed >= 0 ? parsed : fallback
}

const safePositiveInt = (value: unknown, fallback = 1) => {
    const parsed = safeNumber(value, fallback)
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback
}

const safeText = (value: unknown, fallback = '') => {
    return typeof value === 'string' && value.trim() ? value : fallback
}

export default async function NewOrderPage() {
    const session = await getServerSession(authOptions)

    // Fetch User Info
    let userGrade = 'C'
    let userName = ''
    const user = session?.user?.id ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
            name: true,
            country: true,
            partnerProfile: {
                select: {
                    grade: true,
                },
            },
        },
    }) : null

    if (user) {
        userGrade = user?.partnerProfile?.grade || 'C'
        userName = user?.name || ''
    }

    const products = await prisma.product.findMany({
        where: { wholesaleAvailable: true },
        orderBy: { sortOrder: 'asc' },
        select: {
            id: true,
            name: true,
            nameJP: true,
            nameEN: true,
            buyPrice: true,
            sellPrice: true,
            onlinePrice: true,
            priceA: true,
            priceB: true,
            priceC: true,
            priceD: true,
            imageUrl: true,
            productCode: true,
            barcode: true,
            minOrderQuantity: true,
            orderUnit: true,
            jpBuyPrice: true,
            jpSellPrice: true,
            krBuyPrice: true,
            krSellPrice: true,
            usBuyPrice: true,
            usSellPrice: true,
            regionalPrices: true,
            updatedAt: true,
        },
    })

    // Map products to apply correct price based on grade
    const productsWithTieredPrice = products.map(p => {
        let finalPrice = safeNonNegativeNumber(p.sellPrice);

        let regional = (p as any).regionalPrices as any;
        const validGrades = ['A', 'B', 'C', 'D'];
        let gradeToUse = userGrade.toUpperCase();
        if (!validGrades.includes(gradeToUse)) gradeToUse = 'C';

        let krBuy = safeNonNegativeNumber(p.buyPrice), krSell = safeNonNegativeNumber(p.krSellPrice);
        let jpBuy = safeNonNegativeNumber(p.jpBuyPrice), jpSell = safeNonNegativeNumber(p.jpSellPrice);
        let usBuy = safeNonNegativeNumber(p.usBuyPrice), usSell = safeNonNegativeNumber(p.usSellPrice);
        let currentMoq = safePositiveInt(p.minOrderQuantity, 1);
        let currentOrderUnit = safePositiveInt(p.orderUnit, 1);

        const parsePrices = (gradeData: any) => {
            krBuy = safeNonNegativeNumber(gradeData?.KR?.wholesale);
            krSell = safeNonNegativeNumber(gradeData?.KR?.retail);
            jpBuy = safeNonNegativeNumber(gradeData?.JP?.wholesale);
            jpSell = safeNonNegativeNumber(gradeData?.JP?.retail);
            usBuy = safeNonNegativeNumber(gradeData?.US?.wholesale);
            usSell = safeNonNegativeNumber(gradeData?.US?.retail);

            // Set regional MOQ
            if (user?.country === 'Korea') {
                currentMoq = safePositiveInt(gradeData?.KR?.moq, safePositiveInt(p.minOrderQuantity, 1));
                currentOrderUnit = safePositiveInt(gradeData?.KR?.orderUnit, safePositiveInt(p.orderUnit, 1));
            } else if (user?.country === 'Japan') {
                currentMoq = safePositiveInt(gradeData?.JP?.moq, safePositiveInt(p.minOrderQuantity, 1));
                currentOrderUnit = safePositiveInt(gradeData?.JP?.orderUnit, safePositiveInt(p.orderUnit, 1));
            } else {
                currentMoq = safePositiveInt(gradeData?.US?.moq, safePositiveInt(p.minOrderQuantity, 1));
                currentOrderUnit = safePositiveInt(gradeData?.US?.orderUnit, safePositiveInt(p.orderUnit, 1));
            }

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

            const selectedPrice = safeNonNegativeNumber(gradePriceMap[gradeToUse])
            if (selectedPrice > 0) {
                finalPrice = selectedPrice
            } else if (safeNonNegativeNumber(p.priceC) > 0) {
                finalPrice = safeNonNegativeNumber(p.priceC)
            }
            krBuy = finalPrice;
        }

        return {
            id: p.id,
            name: safeText(p.name, '상품 정보 없음'),
            imageUrl: p.imageUrl ? getProductImageUrl(p.id, p.updatedAt) : null,
            sellPrice: safeNonNegativeNumber(finalPrice),
            productCode: safeText(p.productCode) || null,
            barcode: safeText(p.barcode) || null,
            nameJP: safeText(p.nameJP) || null,
            nameEN: safeText(p.nameEN) || null,
            minOrderQuantity: currentMoq,
            orderUnit: currentOrderUnit,
            buyPrice: safeNonNegativeNumber(p.buyPrice),
            onlinePrice: safeNonNegativeNumber(p.onlinePrice),
            jpBuyPrice: jpBuy,
            jpSellPrice: jpSell,
            krBuyPrice: krBuy,
            krSellPrice: krSell,
            usBuyPrice: usBuy,
            usSellPrice: usSell,
            appliedGrade: gradeToUse,
            country: user?.country || null
        }
    })

    return (
        <div className="ux-page-stack">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                <div className="text-left">
                    <h1 className="ux-page-title">
                        商品リスト
                    </h1>
                    <p className="ux-helper mt-1">商品を選択して数量を入力してください。</p>
                </div>
            </div>
            <OrderInterface products={productsWithTieredPrice} />
        </div>
    )
}
