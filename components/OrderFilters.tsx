'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'

export default function OrderFilters() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [startDate, setStartDate] = useState(searchParams.get('startDate') || '')
    const [endDate, setEndDate] = useState(searchParams.get('endDate') || '')

    useEffect(() => {
        setStartDate(searchParams.get('startDate') || '')
        setEndDate(searchParams.get('endDate') || '')
    }, [searchParams])

    const applyFilters = () => {
        const params = new URLSearchParams(searchParams.toString())
        if (startDate) params.set('startDate', startDate)
        else params.delete('startDate')

        if (endDate) params.set('endDate', endDate)
        else params.delete('endDate')

        router.push(`?${params.toString()}`)
    }

    const resetFilters = () => {
        setStartDate('')
        setEndDate('')
        router.push('?')
    }

    return (
        <div className="flex flex-wrap items-end gap-4 mb-6 p-4 glass-panel bg-white dark:bg-[#1e1e1e] rounded-lg shadow-sm dark:shadow-none border border-gray-100 dark:border-[#2a2a2a]">
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Start Date</label>
                <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-[#2a2a2a] rounded-md shadow-sm dark:shadow-none focus:ring-[var(--color-brand-blue)] focus:border-[var(--color-brand-blue)] text-sm bg-white dark:bg-[#1e1e1e] text-gray-900 dark:text-white"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">End Date</label>
                <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-[#2a2a2a] rounded-md shadow-sm dark:shadow-none focus:ring-[var(--color-brand-blue)] focus:border-[var(--color-brand-blue)] text-sm bg-white dark:bg-[#1e1e1e] text-gray-900 dark:text-white"
                />
            </div>
            <div className="flex gap-2">
                <button
                    onClick={applyFilters}
                    className="px-4 py-2 bg-[var(--color-brand-blue)] text-white text-sm font-semibold rounded-md hover:opacity-90 transition-opacity shadow-sm dark:shadow-none"
                >
                    Apply Filter
                </button>
                <button
                    onClick={resetFilters}
                    className="px-4 py-2 bg-white dark:bg-[#1e1e1e] text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-[#2a2a2a] text-sm font-semibold rounded-md hover:bg-gray-50 dark:hover:bg-[#252525] transition-colors shadow-sm dark:shadow-none"
                >
                    Reset
                </button>
            </div>
        </div>
    )
}
