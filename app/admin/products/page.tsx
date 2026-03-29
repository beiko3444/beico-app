import { prisma } from "@/lib/prisma"
import { unstable_cache } from "next/cache"
import ProductForm from "./product-form"
import Link from 'next/link'
import ProductTable from "./ProductTable"

// Force dynamic to ensure we get fresh data
export const dynamic = 'force-dynamic'

const getCachedProducts = unstable_cache(
    async () => prisma.product.findMany({
        orderBy: { sortOrder: 'asc' }
    }),
    ['admin-products-page-v1'],
    { revalidate: 60 }
)

export default async function ProductsPage() {
    const products = await getCachedProducts()

    return (
        <div className="space-y-6">
            {/* Sticky Header */}
            <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl pt-2 pb-2 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 border-b border-gray-100 shadow-sm transition-all duration-300">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3">
                            <Link href="/admin" className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 hover:text-[#d9361b] transition-all" title="Dashboard">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                            </Link>
                            <h1 className="text-lg font-black text-gray-900 tracking-tight">상품 관리</h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <ProductForm />
                    </div>
                </div>
            </div>

            <div className="glass-panel p-1 rounded-2xl shadow-lg bg-white border-t-2 border-t-[var(--color-brand-blue)] overflow-x-auto">
                <ProductTable initialProducts={products} />
            </div>
        </div>
    )
}
