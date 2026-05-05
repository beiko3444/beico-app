import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { unstable_cache } from "next/cache"
import Link from "next/link"
import ProformaClient, { type IssuedInvoice, type PartnerOption, type ProductOption } from "./ProformaClient"

export const dynamic = 'force-dynamic'

const getCachedProformaPageData = unstable_cache(
    async () => {
        const [partners, products, issued] = await Promise.all([
            prisma.user.findMany({
                where: { role: 'PARTNER', status: { not: 'DELETED' } },
                select: {
                    id: true,
                    name: true,
                    partnerProfile: {
                        select: {
                            businessName: true,
                            representativeName: true,
                            email: true,
                            contact: true,
                            address: true,
                        },
                    },
                },
                orderBy: { name: 'asc' }
            }),
            prisma.product.findMany({
                orderBy: { sortOrder: 'asc' },
                select: {
                    id: true,
                    name: true,
                    nameEN: true,
                    nameJP: true,
                    productCode: true,
                    usBuyPrice: true,
                    usSellPrice: true,
                    regionalPrices: true,
                    stock: true
                }
            }),
            prisma.proformaInvoice.findMany({
                include: {
                    items: {
                        orderBy: { createdAt: 'asc' }
                    }
                },
                orderBy: { issueDate: 'desc' },
                take: 100
            })
        ])

        return { partners, products, issued }
    },
    ['admin-proforma-page-v2'],
    { revalidate: 60 }
)

const readNumber = (value: unknown): number => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0
    }
    if (typeof value === 'string') {
        const cleaned = value.replace(/[^0-9.-]/g, '')
        const parsed = Number(cleaned)
        return Number.isFinite(parsed) ? parsed : 0
    }
    return 0
}

const toIsoStringSafe = (value: unknown): string => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString()
    }
    if (typeof value === 'string') {
        const parsed = new Date(value)
        if (!Number.isNaN(parsed.getTime())) {
            return parsed.toISOString()
        }
    }
    return new Date().toISOString()
}

type RegionalPriceNode = {
    wholesale?: unknown
    cost?: unknown
}

type RegionalPriceCountry = {
    US?: RegionalPriceNode
}

type RegionalPriceRoot = {
    C?: RegionalPriceCountry
}

const resolveUsdUnitPrice = (product: { usBuyPrice?: number | null; usSellPrice?: number | null; regionalPrices?: unknown }) => {
    const direct = readNumber(product.usBuyPrice)
    if (direct > 0) return direct

    const regional = product.regionalPrices as RegionalPriceRoot | null | undefined
    const fromRegional = readNumber(regional?.C?.US?.wholesale ?? regional?.C?.US?.cost)
    if (fromRegional > 0) return fromRegional

    return readNumber(product.usSellPrice)
}

export default async function ProformaPage() {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
        redirect('/login')
    }

    let partners: Awaited<ReturnType<typeof getCachedProformaPageData>>['partners'] = []
    let products: Awaited<ReturnType<typeof getCachedProformaPageData>>['products'] = []
    let issued: Awaited<ReturnType<typeof getCachedProformaPageData>>['issued'] = []
    try {
        const data = await getCachedProformaPageData()
        partners = data.partners
        products = data.products
        issued = data.issued
    } catch (error) {
        console.error('Failed to load PI page data:', error)
    }

    const partnerOptions: PartnerOption[] = partners.map((partner) => ({
        id: partner.id,
        name: partner.name,
        businessName: partner.partnerProfile?.businessName || null,
        representativeName: partner.partnerProfile?.representativeName || null,
        email: partner.partnerProfile?.email || null,
        contact: partner.partnerProfile?.contact || null,
        address: partner.partnerProfile?.address || null
    }))

    const productOptions: ProductOption[] = products.map((product) => ({
        id: product.id,
        name: product.name,
        nameEN: product.nameEN || null,
        nameJP: product.nameJP || null,
        productCode: product.productCode ? String(product.productCode).toUpperCase() : null,
        imageUrl: null,
        usBuyPrice: resolveUsdUnitPrice(product),
        stock: product.stock
    }))

    const issuedInvoices: IssuedInvoice[] = issued.map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber || '-',
        issueDate: toIsoStringSafe(invoice.issueDate),
        partnerName: invoice.partnerName || '-',
        totalUsd: readNumber(invoice.totalUsd),
        productionTime:
            typeof invoice.productionTime === 'string' && invoice.productionTime.trim().length > 0
                ? invoice.productionTime
                : '3-5 days after receiving the deposit',
        items: invoice.items.map((item) => ({
            id: item.id,
            productId: item.productId,
            productName: item.productName || '-',
            productNameEN: item.productNameEN,
            productCode: item.productCode ? String(item.productCode).toUpperCase() : null,
            quantity: Math.max(1, Number(item.quantity || 0)),
            unitPriceUsd: readNumber(item.unitPriceUsd),
            amountUsd: readNumber(item.amountUsd)
        }))
    }))

    return (
        <div className="space-y-6">
            <div className="sticky top-0 z-40 bg-white/80 dark:bg-[#1e1e1e]/80 backdrop-blur-xl pt-2 pb-2 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 border-b border-gray-100 dark:border-[#2a2a2a] shadow-sm dark:shadow-none transition-all duration-300">
                <div className="flex items-center gap-3">
                    <Link href="/admin" className="p-1.5 hover:bg-gray-100 dark:hover:bg-[#252525] rounded-full text-gray-400 dark:text-gray-400 hover:text-[#e53b19] transition-all" title="Dashboard">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    </Link>
                    <h1 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">PI발급 작성</h1>
                </div>
            </div>

            <div className="w-[min(1720px,calc(100vw-2rem))] mx-auto">
                <ProformaClient
                    partners={partnerOptions}
                    products={productOptions}
                    initialIssuedInvoices={issuedInvoices}
                />
            </div>
        </div>
    )
}
