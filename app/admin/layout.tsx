
import { prisma } from "@/lib/prisma"
import AdminNav from "./AdminNav"

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
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

    // 2. Low Stock Products (Logic: stock < safetyStock)
    // Prisma doesn't support column comparison in 'where' easily, so we fetch minimal data
    const allProducts = await prisma.product.findMany({
        select: { stock: true, safetyStock: true }
    })
    const lowStockCount = allProducts.filter(p => p.stock <= p.safetyStock).length

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
