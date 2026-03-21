
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import AdminNav from "./AdminNav"

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
        redirect('/login')
    }

    let pendingOrderCount = 0
    let lowStockCount = 0
    let pendingPartnerCount = 0
    let missingBill = 0

    try {
        // 1. Pending Orders
        pendingOrderCount = await prisma.order.count({
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

        // 2. Low Stock Products (Logic: stock < safetyStock)
        const allProducts = await prisma.product.findMany({
            select: { stock: true, safetyStock: true }
        })
        lowStockCount = allProducts.filter(p => p.stock <= p.safetyStock).length

        // 3. Pending Partners
        pendingPartnerCount = await prisma.user.count({
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
        missingBill = billExists ? 0 : 1
    } catch (error) {
        console.warn("Database unreachable in AdminLayout, using default counts.")
    }

    const counts = {
        pendingOrders: pendingOrderCount,
        lowStock: lowStockCount,
        pendingPartners: pendingPartnerCount,
        missingBill: missingBill
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
