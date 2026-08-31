import { prisma } from "@/lib/prisma"
import { getProductImageUrl } from "@/lib/product-image-url"
import { Prisma } from "@prisma/client"
import ProductForm from "./product-form"
import Link from 'next/link'
import ProductTable from "./ProductTable"

// Force dynamic to ensure we get fresh data
export const dynamic = 'force-dynamic'

const PRODUCT_PAGE_SIZE_OPTIONS = [30, 50, 100] as const
const DEFAULT_PRODUCT_PAGE_SIZE = 50

type PageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const firstParam = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value
const parsePositiveInt = (value: string | undefined, fallback: number) => {
    const parsed = Number.parseInt(value || '', 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}
const parsePageSize = (value: string | undefined) => {
    const parsed = parsePositiveInt(value, DEFAULT_PRODUCT_PAGE_SIZE)
    return PRODUCT_PAGE_SIZE_OPTIONS.includes(parsed as typeof PRODUCT_PAGE_SIZE_OPTIONS[number])
        ? parsed
        : DEFAULT_PRODUCT_PAGE_SIZE
}

const productSelect = Prisma.validator<Prisma.ProductSelect>()({
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
    stock: true,
    safetyStock: true,
    barcode: true,
    productCode: true,
    groupName: true,
    autoGroupingDisabled: true,
    hsCode: true,
    japanHsCode: true,
    coupangSku: true,
    imageUrl: true,
    sortOrder: true,
    minOrderQuantity: true,
    orderUnit: true,
    jpBuyPrice: true,
    jpSellPrice: true,
    krBuyPrice: true,
    krSellPrice: true,
    usBuyPrice: true,
    usSellPrice: true,
    regionalPrices: true,
    wholesaleAvailable: true,
    createdAt: true,
    updatedAt: true,
})

const getProductsPage = async (requestedPage: number, pageSize: number) => {
    const totalCount = await prisma.product.count()
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
    const page = Math.min(Math.max(1, requestedPage), totalPages)
    const products = await prisma.product.findMany({
        select: productSelect,
        orderBy: [
            { sortOrder: 'asc' },
            { createdAt: 'asc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
    })

    return { products, page, pageSize, totalCount, totalPages }
}

export default async function ProductsPage({ searchParams }: PageProps) {
    const params = (await searchParams) || {}
    const requestedPage = parsePositiveInt(firstParam(params.page), 1)
    const pageSize = parsePageSize(firstParam(params.pageSize))
    const productPage = await getProductsPage(requestedPage, pageSize)
    const products = productPage.products.map(({ imageUrl, updatedAt, ...product }) => ({
        ...product,
        imageUrl: imageUrl ? getProductImageUrl(product.id, updatedAt) : null,
    }))

    return (
        <div className="space-y-6">
            {/* Sticky Header */}
            <div className="sticky top-0 z-40 bg-white/80 dark:bg-[#1e1e1e]/80 backdrop-blur-xl pt-2 pb-2 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 border-b border-gray-100 dark:border-[#2a2a2a] shadow-sm dark:shadow-none transition-all duration-300">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3">
                            <Link href="/admin" className="p-1.5 hover:bg-gray-100 dark:hover:bg-[#252525] rounded-full text-gray-400 dark:text-gray-400 hover:text-[#d9361b] transition-all" title="Dashboard">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                            </Link>
                            <h1 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">상품 관리</h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <ProductForm />
                    </div>
                </div>
            </div>

            <div className="glass-panel overflow-hidden rounded-2xl border-t-2 border-t-[var(--color-brand-blue)] bg-white shadow-lg dark:bg-[#1e1e1e] dark:shadow-none">
                <ProductTable
                    initialProducts={products}
                    pagination={{
                        page: productPage.page,
                        pageSize: productPage.pageSize,
                        totalCount: productPage.totalCount,
                        totalPages: productPage.totalPages,
                    }}
                />
            </div>
        </div>
    )
}
