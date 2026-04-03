'use client'

import Link from 'next/link'

interface OrderSummaryProps {
    pendingCount: number
    depositCount: number
    shippingCount: number
    completedCount: number
    recentOrders: any[]
}

export default function DashboardOrderSummary({
    pendingCount,
    depositCount,
    shippingCount,
    completedCount,
    recentOrders
}: OrderSummaryProps) {
    return (
        <div className="bg-white dark:bg-[#1e1e1e] rounded-[2rem] shadow-sm dark:shadow-none border border-gray-100 dark:border-[#2a2a2a] overflow-hidden mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
            {/* Header */}
            <div className="bg-gray-50/50 dark:bg-[#1a1a1a] p-6 border-b border-gray-100 dark:border-[#2a2a2a] flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[var(--color-brand-blue)] rounded-xl flex items-center justify-center text-white shadow-lg dark:shadow-none shadow-red-100">
                        <span className="text-xl">📝</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-gray-900 dark:text-white">주문 관리 현황 (Order Overview)</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">실시간 주문 상태 및 최근 내역 요약</p>
                    </div>
                </div>
                <Link
                    href="/admin/orders"
                    className="text-[11px] font-black bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#2a2a2a] px-4 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-[#252525] hover:border-gray-300 transition-all text-gray-500 dark:text-gray-400 flex items-center gap-2 group"
                >
                    전체 주문 관리 이동
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-gray-100 dark:divide-[#2a2a2a]">
                {/* Status Cards (Left Side) */}
                <div className="lg:col-span-4 p-6 grid grid-cols-2 gap-4">
                    <Link href="/admin/orders" className="bg-orange-50/50 dark:bg-orange-900/20 p-5 rounded-2xl border border-orange-100 dark:border-orange-800 hover:shadow-md hover:scale-[1.02] transition-all group flex flex-col justify-between h-32 relative overflow-hidden">
                        <div className="absolute right-[-10px] top-[-10px] w-16 h-16 bg-orange-100 rounded-full opacity-50 group-hover:scale-125 transition-transform"></div>
                        <span className="text-xs font-black text-orange-400 uppercase tracking-widest z-10">승인 대기 (Pending)</span>
                        <div className="flex items-end gap-2 z-10">
                            <span className="text-4xl font-black text-orange-600 leading-none">{pendingCount}</span>
                            <span className="text-xs font-bold text-orange-400 mb-1">건</span>
                        </div>
                    </Link>

                    <Link href="/admin/orders" className="bg-blue-50/50 dark:bg-blue-900/20 p-5 rounded-2xl border border-blue-100 dark:border-blue-800 hover:shadow-md hover:scale-[1.02] transition-all group flex flex-col justify-between h-32 relative overflow-hidden">
                        <div className="absolute right-[-10px] top-[-10px] w-16 h-16 bg-blue-100 rounded-full opacity-50 group-hover:scale-125 transition-transform"></div>
                        <span className="text-xs font-black text-blue-400 uppercase tracking-widest z-10">입금 대기 (Deposit)</span>
                        <div className="flex items-end gap-2 z-10">
                            <span className="text-4xl font-black text-blue-600 leading-none">{depositCount}</span>
                            <span className="text-xs font-bold text-blue-400 mb-1">건</span>
                        </div>
                    </Link>

                    <Link href="/admin/orders?type=tracking" className="bg-purple-50/50 dark:bg-purple-900/20 p-5 rounded-2xl border border-purple-100 dark:border-purple-800 hover:shadow-md hover:scale-[1.02] transition-all group flex flex-col justify-between h-32 relative overflow-hidden">
                        <div className="absolute right-[-10px] top-[-10px] w-16 h-16 bg-purple-100 rounded-full opacity-50 group-hover:scale-125 transition-transform"></div>
                        <span className="text-xs font-black text-purple-400 uppercase tracking-widest z-10">배송 준비 (Shipping)</span>
                        <div className="flex items-end gap-2 z-10">
                            <span className="text-4xl font-black text-purple-600 leading-none">{shippingCount}</span>
                            <span className="text-xs font-bold text-purple-400 mb-1">건</span>
                        </div>
                    </Link>

                    <div className="bg-gray-50/50 dark:bg-[#1a1a1a] p-5 rounded-2xl border border-gray-100 dark:border-[#2a2a2a] flex flex-col justify-between h-32">
                        <span className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">완료 (Completed)</span>
                        <div className="flex items-end gap-2">
                            <span className="text-4xl font-black text-gray-600 dark:text-gray-400 leading-none">{completedCount}</span>
                            <span className="text-xs font-bold text-gray-400 dark:text-gray-500 mb-1">건</span>
                        </div>
                    </div>
                </div>

                {/* Recent Orders List (Right Side) */}
                <div className="lg:col-span-8 p-6 flex flex-col">
                    <h3 className="text-sm font-black text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <span className="w-1.5 h-4 bg-gray-900 dark:bg-white rounded-full"></span>
                        최근 접수된 주문 (Recent Activity)
                    </h3>

                    <div className="flex-1 overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50/50 dark:bg-[#1a1a1a] text-[10px] uppercase text-gray-400 dark:text-gray-500 font-black">
                                <tr>
                                    <th className="py-2.5 px-4 rounded-l-lg">주문번호</th>
                                    <th className="py-2.5 px-2">주문자</th>
                                    <th className="py-2.5 px-2">주문금액</th>
                                    <th className="py-2.5 px-2 text-center">상태</th>
                                    <th className="py-2.5 px-4 text-right rounded-r-lg">일시</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {recentOrders.length > 0 ? (
                                    recentOrders.map((order, i) => (
                                        <tr key={order.id} className="group hover:bg-gray-50/80 transition-colors">
                                            <td className="py-3 px-4">
                                                <span className="text-[11px] font-black text-[#d9361b] bg-red-50 px-2 py-0.5 rounded border border-red-100">
                                                    {order.orderNumber || order.id.slice(0, 8)}
                                                </span>
                                            </td>
                                            <td className="py-3 px-2">
                                                <div className="flex flex-col">
                                                    <span className="text-[11px] font-bold text-gray-900">
                                                        {order.user.partnerProfile?.businessName || order.user.name}
                                                    </span>
                                                    <span className="text-[9px] text-gray-400">{order.user.username}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-2">
                                                <span className="text-[11px] font-bold text-gray-900">
                                                    {order.total.toLocaleString()}원
                                                </span>
                                            </td>
                                            <td className="py-3 px-2 text-center">
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${order.status === 'PENDING' ? 'bg-orange-50 border-orange-100 text-orange-500' :
                                                        order.status === 'APPROVED' ? 'bg-blue-50 border-blue-100 text-blue-500' :
                                                            order.status === 'SHIPPED' ? 'bg-purple-50 border-purple-100 text-purple-500' :
                                                                'bg-gray-50 border-gray-100 text-gray-500'
                                                    }`}>
                                                    {order.status}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-right text-[10px] text-gray-400 font-medium">
                                                {new Date(order.createdAt).toLocaleDateString()}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="py-8 text-center text-xs text-gray-400 italic">
                                            최근 주문 내역이 없습니다.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}
