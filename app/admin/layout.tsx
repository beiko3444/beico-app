
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { unstable_cache } from "next/cache"
import AdminNav from "./AdminNav"

type LowStockCountRow = {
    count: number | bigint
}

const getCachedAdminCounts = unstable_cache(
    async () => {
        // 1. Pending Orders
        const pendingOrderCount = await prisma.order.count({
            where: {
                AND: [
                    { status: { not: 'CANCELLED' } },
                    {
                        OR: [
                            { trackingNumber: null },
                            { trackingNumber: '' },
                            { taxInvoiceIssued: false }
                        ]
                    }
                ]
            }
        })

        // 2. Low Stock Products (stock <= safetyStock) - count directly in DB
        const lowStockRows = await prisma.$queryRaw<LowStockCountRow[]>`
            SELECT COUNT(*)::int AS count
            FROM "Product"
            WHERE "stock" <= "safetyStock"
        `
        const lowStockRaw = lowStockRows[0]?.count ?? 0
        const lowStockCount = typeof lowStockRaw === "bigint" ? Number(lowStockRaw) : lowStockRaw

        // 3. Pending Partners
        const pendingPartnerCount = await prisma.user.count({
            where: { role: 'PARTNER', status: 'PENDING' }
        })

        // 4. Electricity Bill Status
        const now = new Date()
        const year = now.getFullYear()
        const month = now.getMonth() + 1
        const billExists = await prisma.electricityUsage.findUnique({
            where: {
                year_month: {
                    year,
                    month
                }
            }
        })
        const missingBill = billExists ? 0 : 1

        return {
            pendingOrders: pendingOrderCount,
            lowStock: lowStockCount,
            pendingPartners: pendingPartnerCount,
            missingBill
        }
    },
    ['admin-layout-counts-v1'],
    { revalidate: 60 }
)

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
        redirect('/login')
    }

    let counts = {
        pendingOrders: 0,
        lowStock: 0,
        pendingPartners: 0,
        missingBill: 0
    }
    try {
        counts = await getCachedAdminCounts()
    } catch {
        console.warn("Database unreachable in AdminLayout, using default counts.")
    }

    return (
        <div className="min-h-screen bg-gray-50/30 relative">
            <AdminNav counts={counts} />
            <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                {children}
            </main>
        </div>
    )
}
