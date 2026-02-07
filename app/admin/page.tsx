import Link from 'next/link'
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import DashboardStatistics from '@/components/DashboardStatistics'
import DashboardCalendarWidget from '@/components/DashboardCalendarWidget'

export default async function AdminDashboard() {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
        redirect('/login')
    }

    // 1. Fetch Key Counts
    // @ts-ignore - Task model exists in schema but might need prisma generate
    const [
        pendingCount,
        depositReqCount,
        approvedNoTrackingCount,
        completedCount,
        pendingTaxInvoices,
        recentOrders,
        analyticsOrders,
        allTasks
    ] = await Promise.all([
        prisma.order.count({ where: { status: 'PENDING' } }),
        prisma.order.count({
            where: {
                depositConfirmedAt: { not: null },
                adminDepositConfirmedAt: null
            }
        }),
        prisma.order.count({
            where: {
                status: 'APPROVED',
                OR: [{ trackingNumber: null }, { trackingNumber: '' }]
            }
        }),
        prisma.order.count({ where: { status: { in: ['SHIPPED', 'COMPLETED'] } } }),
        prisma.order.count({
            where: {
                status: 'APPROVED',
                taxInvoiceIssued: false
            }
        }),
        prisma.order.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: { user: { include: { partnerProfile: true } } }
        }),
        prisma.order.findMany({
            where: { status: { in: ['APPROVED', 'SHIPPED', 'COMPLETED'] } },
            include: {
                items: { include: { product: true } },
                user: { include: { partnerProfile: true } }
            }
        }),
        // @ts-ignore
        prisma.task.findMany({ orderBy: { date: 'asc' } })
    ])

    // 2. Process Analytics Data
    const now = new Date()

    // Daily Data (Last 14 days)
    const dailyData = Array.from({ length: 14 }).map((_, i) => {
        const d = new Date()
        d.setDate(now.getDate() - (13 - i))
        const dateStr = d.toISOString().split('T')[0]
        const label = `${d.getMonth() + 1}/${d.getDate()}`
        const value = analyticsOrders
            .filter((o: any) => o.createdAt.toISOString().split('T')[0] === dateStr)
            .reduce((sum: number, o: any) => sum + o.total, 0)
        return { label, value }
    })

    // Monthly Data (Last 12 months)
    const monthlyData = Array.from({ length: 12 }).map((_, i) => {
        const d = new Date()
        d.setMonth(now.getMonth() - (11 - i))
        const year = d.getFullYear()
        const month = d.getMonth()
        const label = `${year}-${String(month + 1).padStart(2, '0')}`
        const value = analyticsOrders
            .filter((o: any) => {
                const od = new Date(o.createdAt)
                return od.getFullYear() === year && od.getMonth() === month
            })
            .reduce((sum: number, o: any) => sum + o.total, 0)
        return { label, value }
    })

    // Yearly Data (Last 5 years)
    const yearlyData = Array.from({ length: 5 }).map((_, i) => {
        const year = now.getFullYear() - (4 - i)
        const label = `${year}`
        const value = analyticsOrders
            .filter((o: any) => new Date(o.createdAt).getFullYear() === year)
            .reduce((sum: number, o: any) => sum + o.total, 0)
        return { label, value }
    })

    // Top Products
    const productStats: Record<string, { id: string, name: string, quantity: number, total: number }> = {}
    analyticsOrders.forEach((order: any) => {
        order.items.forEach((item: any) => {
            if (!productStats[item.productId]) {
                productStats[item.productId] = {
                    id: item.productId,
                    name: item.product.name,
                    quantity: 0,
                    total: 0
                }
            }
            productStats[item.productId].quantity += item.quantity
            productStats[item.productId].total += item.price * item.quantity
        })
    })
    const topProducts = Object.values(productStats).sort((a, b) => b.quantity - a.quantity)

    // Top Partners
    const partnerStats: Record<string, { name: string, orderCount: number, total: number }> = {}
    analyticsOrders.forEach((order: any) => {
        const partnerName = order.user.partnerProfile?.businessName || order.user.name
        if (!partnerStats[partnerName]) {
            partnerStats[partnerName] = { name: partnerName, orderCount: 0, total: 0 }
        }
        partnerStats[partnerName].orderCount += 1
        partnerStats[partnerName].total += order.total
    })
    const topPartners = Object.values(partnerStats).sort((a, b) => b.total - a.total)

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            {/* 1. Calendar Widget (Moved to Top) */}
            <DashboardCalendarWidget tasks={allTasks} />

            {/* 2. Action Required (Notifications) */}
            {(pendingTaxInvoices > 0 || approvedNoTrackingCount > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pendingTaxInvoices > 0 && (
                        <Link href="/admin/orders?type=invoice" className="flex items-center justify-between p-4 bg-red-50 border border-red-100 rounded-2xl hover:bg-red-100 transition-all group">
                            <div className="flex items-center gap-3">
                                <span className="flex items-center justify-center w-8 h-8 bg-[#d9361b] text-white rounded-full text-sm font-bold animate-pulse">!</span>
                                <div>
                                    <p className="text-[#d9361b] font-bold text-sm">계산서 미발행 {pendingTaxInvoices}건</p>
                                    <p className="text-[10px] text-red-400">Tax Invoice Required</p>
                                </div>
                            </div>
                            <span className="text-red-300 group-hover:translate-x-1 transition-transform">→</span>
                        </Link>
                    )}
                    {approvedNoTrackingCount > 0 && (
                        <Link href="/admin/orders?type=tracking" className="flex items-center justify-between p-4 bg-gray-800 border border-gray-700 rounded-2xl hover:bg-gray-700 transition-all group">
                            <div className="flex items-center gap-3">
                                <span className="flex items-center justify-center w-8 h-8 bg-gray-600 text-white rounded-full text-sm animate-bounce">📦</span>
                                <div>
                                    <p className="text-white font-bold text-sm">운송장 미입력 {approvedNoTrackingCount}건</p>
                                    <p className="text-[10px] text-gray-400">Tracking Number Missing</p>
                                </div>
                            </div>
                            <span className="text-gray-500 group-hover:translate-x-1 transition-transform">→</span>
                        </Link>
                    )}
                </div>
            )}

            {/* 3. Sales Analytics */}
            <div className="grid grid-cols-1 xl:grid-cols-10 gap-6">
                <div className="xl:col-span-12">
                    <DashboardStatistics
                        dailySales={dailyData}
                        monthlySales={monthlyData}
                        yearlySales={yearlyData}
                        topProducts={topProducts}
                        topPartners={topPartners}
                    />
                </div>
            </div>

            {/* 4. Recent Transactions Table */}
            <div className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-gray-900"></span>
                        최근 주문 내역
                    </h2>
                    <Link href="/admin/orders" className="text-xs font-bold text-gray-400 hover:text-gray-900 transition-colors">
                        전체보기 →
                    </Link>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50/50 text-[10px] uppercase text-gray-400 font-black">
                            <tr>
                                <th className="py-3 px-4 rounded-l-xl">주문번호</th>
                                <th className="py-3 px-4">주문자</th>
                                <th className="py-3 px-4">주문금액</th>
                                <th className="py-3 px-4 text-center">상태</th>
                                <th className="py-3 px-4 text-right rounded-r-xl">일시</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {recentOrders.length > 0 ? (
                                recentOrders.map((order: any) => (
                                    <tr key={order.id} className="group hover:bg-gray-50/80 transition-colors text-xs font-medium">
                                        <td className="py-3 px-4">
                                            <span className="font-bold text-gray-900">{order.orderNumber || order.id.slice(0, 8)}</span>
                                        </td>
                                        <td className="py-3 px-4 text-gray-600">
                                            {order.user.partnerProfile?.businessName || order.user.name}
                                        </td>
                                        <td className="py-3 px-4 text-gray-900 font-bold">
                                            {order.total.toLocaleString()}원
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className={`inline-block px-2 py-1 rounded-md text-[10px] font-bold ${order.status === 'PENDING' ? 'bg-orange-50 text-orange-500' :
                                                order.status === 'APPROVED' ? 'bg-blue-50 text-blue-500' :
                                                    order.status === 'SHIPPED' ? 'bg-purple-50 text-purple-500' :
                                                        order.status === 'COMPLETED' ? 'bg-green-50 text-green-500' :
                                                            'bg-gray-50 text-gray-500'
                                                }`}>
                                                {order.status}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-right text-gray-400">
                                            {new Date(order.createdAt).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-gray-400 italic">
                                        최근 주문 내역이 없습니다.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
