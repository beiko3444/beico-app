'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

interface RevenueData {
    label: string
    value: number
}

interface TopProduct {
    id: string
    name: string
    quantity: number
    total: number
    image?: string | null
}

interface TopPartner {
    name: string
    orderCount: number
    total: number
}

interface DashboardStatsProps {
    dailySales: RevenueData[]
    monthlySales: RevenueData[]
    yearlySales: RevenueData[]
    topProducts: TopProduct[]
    topPartners: TopPartner[]
}

export default function DashboardStatistics({
    dailySales,
    monthlySales,
    yearlySales,
    topProducts,
    topPartners
}: DashboardStatsProps) {
    const [view, setView] = useState<'daily' | 'monthly' | 'yearly'>('daily')
    const [statTab, setStatTab] = useState<'products' | 'partners'>('products')

    const salesData = useMemo(() => {
        if (view === 'daily') return dailySales
        if (view === 'monthly') return monthlySales
        return yearlySales
    }, [view, dailySales, monthlySales, yearlySales])

    const maxSalesValue = Math.max(...salesData.map(d => d.value), 1)

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
            {/* Sales Trend Chart (Col Span 2) */}
            <div className="lg:col-span-2 glass-panel bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden relative">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
                    <div>
                        <h2 className="text-xl font-black text-[var(--color-brand-blue)] flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[var(--color-brand-blue)] animate-pulse"></span>
                            매출 트렌드 분석 (Revenue)
                        </h2>
                        <p className="text-xs text-gray-400 mt-1 font-medium ml-4">기간별 매출 추이를 확인하세요.</p>
                    </div>

                    <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100">
                        {['daily', 'monthly', 'yearly'].map((v) => (
                            <button
                                key={v}
                                onClick={() => setView(v as any)}
                                className={`px-4 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all ${view === v ? 'bg-white text-[var(--color-brand-blue)] shadow-sm scale-105' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                {v === 'daily' ? 'Daily' : v === 'monthly' ? 'Monthly' : 'Yearly'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="relative h-64 flex items-end justify-between gap-2 sm:gap-4 px-2 z-10">
                    {/* Grid Lines */}
                    <div className="absolute inset-x-0 inset-y-0 flex flex-col justify-between pointer-events-none opacity-30">
                        {[0, 1, 2, 3, 4].map(i => (
                            <div key={i} className="border-b border-gray-100 w-full h-px border-dashed"></div>
                        ))}
                    </div>

                    {salesData.map((item, i) => (
                        <div key={i} className="relative flex-1 group flex flex-col items-center justify-end h-full">
                            {/* Tooltip */}
                            <div className="absolute bottom-full mb-3 opacity-0 group-hover:opacity-100 transition-all duration-300 z-50 pointer-events-none translate-y-2 group-hover:translate-y-0">
                                <div className="bg-gray-900 text-white text-[10px] font-bold py-1.5 px-3 rounded-lg shadow-xl whitespace-nowrap">
                                    {item.label} : ₩ {item.value.toLocaleString()}
                                    <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                                </div>
                            </div>

                            {/* Bar */}
                            <div className="w-full max-w-[30px] sm:max-w-[40px] relative flex flex-col justify-end group-hover:scale-y-105 transition-transform origin-bottom duration-300">
                                <div
                                    className="w-full rounded-t-lg transition-all duration-1000 ease-out bg-gradient-to-t from-[var(--color-brand-blue)] to-[#ff8c7a] opacity-80 group-hover:opacity-100 shadow-[0_0_15px_rgba(217,54,27,0.3)]"
                                    style={{ height: `${(item.value / maxSalesValue) * 100}%` }}
                                ></div>
                            </div>

                            {/* Label */}
                            <span className="text-[9px] font-bold text-gray-400 mt-3 rotate-0 transition-colors group-hover:text-[var(--color-brand-blue)]">
                                {item.label.split('-').pop()}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Top Rankings (Col Span 1) */}
            <div className="lg:col-span-1 glass-panel bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-black text-gray-900">현황 랭킹 (Top Ranks)</h2>
                    <div className="flex bg-gray-50 p-0.5 rounded-lg border border-gray-100">
                        <button
                            onClick={() => setStatTab('products')}
                            className={`px-3 py-1 rounded-md text-[10px] font-black transition-all ${statTab === 'products' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
                        >
                            상품
                        </button>
                        <button
                            onClick={() => setStatTab('partners')}
                            className={`px-3 py-1 rounded-md text-[10px] font-black transition-all ${statTab === 'partners' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
                        >
                            파트너
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto pr-1 custom-scrollbar">
                    {statTab === 'products' ? (
                        <div className="space-y-4">
                            {topProducts.length > 0 ? topProducts.slice(0, 5).map((product, i) => (
                                <div key={i} className="flex items-center gap-3 group">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${i === 0 ? 'bg-yellow-100 text-yellow-600' : i === 1 ? 'bg-gray-100 text-gray-500' : i === 2 ? 'bg-orange-50 text-orange-400' : 'bg-gray-50 text-gray-400'}`}>
                                        {i + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-bold text-gray-900 truncate">{product.name}</p>
                                        <p className="text-[10px] text-gray-400">{product.quantity.toLocaleString()}개 판매</p>
                                    </div>
                                    <span className="text-[11px] font-black text-gray-900 tabular-nums">
                                        {product.total.toLocaleString()}
                                    </span>
                                </div>
                            )) : (
                                <p className="text-center text-xs text-gray-400 py-10">데이터가 없습니다.</p>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {topPartners.length > 0 ? topPartners.slice(0, 5).map((partner, i) => (
                                <div key={i} className="flex items-center gap-3 group">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${i === 0 ? 'bg-blue-100 text-blue-600' : i === 1 ? 'bg-gray-100 text-gray-500' : i === 2 ? 'bg-blue-50 text-blue-400' : 'bg-gray-50 text-gray-400'}`}>
                                        {i + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-bold text-gray-900 truncate">{partner.name}</p>
                                        <p className="text-[10px] text-gray-400">{partner.orderCount}건 주문</p>
                                    </div>
                                    <span className="text-[11px] font-black text-gray-900 tabular-nums">
                                        {partner.total.toLocaleString()}
                                    </span>
                                </div>
                            )) : (
                                <p className="text-center text-xs text-gray-400 py-10">데이터가 없습니다.</p>
                            )}
                        </div>
                    )}
                </div>

                <div className="mt-6 pt-4 border-t border-gray-50 flex justify-between items-center text-[10px] text-gray-400 font-medium">
                    <span>* 최근 30일 기준 (Last 30 days)</span>
                    <Link href="/admin/orders" className="hover:text-[var(--color-brand-blue)] flex items-center gap-1">
                        더보기 <span>→</span>
                    </Link>
                </div>
            </div>
        </div>
    )
}
