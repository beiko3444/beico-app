'use client'

import { useState, useMemo } from 'react'

interface RevenueData {
    label: string
    value: number
}

interface SalesDashboardProps {
    daily: RevenueData[]
    monthly: RevenueData[]
    yearly: RevenueData[]
}

export default function SalesDashboard({ daily, monthly, yearly }: SalesDashboardProps) {
    const [view, setView] = useState<'daily' | 'monthly' | 'yearly'>('daily')

    const data = useMemo(() => {
        if (view === 'daily') return daily
        if (view === 'monthly') return monthly
        return yearly
    }, [view, daily, monthly, yearly])

    const maxValue = Math.max(...data.map(d => d.value), 1)

    return (
        <div className="glass-panel bg-white dark:bg-[#1e1e1e] p-8 rounded-2xl shadow-sm dark:shadow-none border border-gray-100 dark:border-[#2a2a2a] border-t-[var(--color-brand-blue)] mb-10 overflow-hidden">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h2 className="text-xl font-bold text-[var(--color-brand-blue)]">매출 현황 (Revenue Analytics)</h2>
                    <p className="text-sm text-gray-400 mt-1">Check your sales performance visually</p>
                </div>

                <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100">
                    <button
                        onClick={() => setView('daily')}
                        className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${view === 'daily' ? 'bg-white text-[var(--color-brand-blue)] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        일일 (Daily)
                    </button>
                    <button
                        onClick={() => setView('monthly')}
                        className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${view === 'monthly' ? 'bg-white text-[var(--color-brand-blue)] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        월별 (Monthly)
                    </button>
                    <button
                        onClick={() => setView('yearly')}
                        className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${view === 'yearly' ? 'bg-white text-[var(--color-brand-blue)] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        연간 (Yearly)
                    </button>
                </div>
            </div>

            <div className="relative h-40 flex items-end justify-between gap-1 md:gap-4 px-2">
                {/* Horizontal Grid Lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                    {[0, 1, 2, 3].map(i => (
                        <div key={i} className="border-b border-gray-50 w-full h-0"></div>
                    ))}
                </div>

                {data.map((item, i) => (
                    <div key={i} className="relative flex-1 group flex flex-col items-center justify-end h-full">
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                            <div className="bg-gray-800 text-white text-[10px] py-1 px-2 rounded whitespace-nowrap shadow-xl">
                                {item.label}: {item.value.toLocaleString()} KRW
                            </div>
                        </div>

                        {/* Bar */}
                        <div
                            className="w-full max-w-[40px] bg-gradient-to-t from-[var(--color-brand-blue)] to-blue-400 rounded-t-lg transition-all duration-500 ease-out group-hover:brightness-110"
                            style={{ height: `${(item.value / maxValue) * 100}%` }}
                        ></div>

                        {/* Label */}
                        <span className="text-[10px] text-gray-400 mt-2 rotate-45 md:rotate-0 origin-left whitespace-nowrap">
                            {item.label}
                        </span>
                    </div>
                ))}
            </div>

            <div className="mt-12 flex justify-end">
                <div className="bg-blue-50 px-4 py-2 rounded-xl">
                    <span className="text-xs text-blue-400 font-bold uppercase mr-2">Total Selection:</span>
                    <span className="text-[var(--color-brand-blue)] font-extrabold">
                        {data.reduce((acc, curr) => acc + curr.value, 0).toLocaleString()} <small>KRW</small>
                    </span>
                </div>
            </div>
        </div>
    )
}
