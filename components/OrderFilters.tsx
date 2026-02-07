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
        <div className="flex flex-wrap items-end gap-4 mb-6 p-4 glass-panel bg-white rounded-lg shadow-sm border border-gray-100">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-[var(--color-brand-blue)] focus:border-[var(--color-brand-blue)] text-sm"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-[var(--color-brand-blue)] focus:border-[var(--color-brand-blue)] text-sm"
                />
            </div>
            <div className="flex gap-2">
                <button
                    onClick={applyFilters}
                    className="px-4 py-2 bg-[var(--color-brand-blue)] text-white text-sm font-semibold rounded-md hover:opacity-90 transition-opacity shadow-sm"
                >
                    Apply Filter
                </button>
                <button
                    onClick={resetFilters}
                    className="px-4 py-2 bg-white text-gray-600 border border-gray-300 text-sm font-semibold rounded-md hover:bg-gray-50 transition-colors shadow-sm"
                >
                    Reset
                </button>
            </div>
        </div>
    )
}
