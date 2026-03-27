'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, Copy, Minus, Plus, Sparkles } from 'lucide-react'

type WormSize = {
    id: string
    range: string
}

const WORM_SIZES: WormSize[] = [
    { id: 'LLLL', range: '160-220 PCs/kilo' },
    { id: 'LLL', range: '240-280 PCs/kilo' },
    { id: 'LL', range: '300-340 PCs/kilo' },
    { id: 'L+', range: '360-400 PCs/kilo' },
    { id: 'L', range: '400-440 PCs/kilo' },
    { id: 'M', range: '440-500 PCs/kilo' },
    { id: 'MS', range: '500-540 PCs/kilo' },
    { id: 'S', range: '540-600 PCs/kilo' },
]

function createInitialQuantities() {
    return WORM_SIZES.reduce<Record<string, number>>((acc, size) => {
        acc[size.id] = 0
        return acc
    }, {})
}

export default function WormOrderPage() {
    const today = new Date().toISOString().split('T')[0]
    const [quantities, setQuantities] = useState<Record<string, number>>(createInitialQuantities)
    const [receiveDate, setReceiveDate] = useState(today)
    const [generatedMessage, setGeneratedMessage] = useState('')
    const [validationError, setValidationError] = useState('')
    const [copied, setCopied] = useState(false)
    const dateInputRef = useRef<HTMLInputElement>(null)

    const selectedOrders = useMemo(() => {
        return WORM_SIZES
            .map((size) => ({ ...size, boxes: quantities[size.id] || 0 }))
            .filter((size) => size.boxes > 0)
    }, [quantities])

    const totalBoxes = useMemo(() => {
        return selectedOrders.reduce((sum, item) => sum + item.boxes, 0)
    }, [selectedOrders])

    const handleQuantityChange = (sizeId: string, nextValue: number) => {
        setCopied(false)
        setQuantities((prev) => ({
            ...prev,
            [sizeId]: Math.max(0, nextValue),
        }))
    }

    const handleGenerate = () => {
        setCopied(false)

        if (!receiveDate) {
            setValidationError('Please choose a receiving date.')
            return
        }

        if (selectedOrders.length === 0) {
            setValidationError('Please choose at least one worm size and box quantity.')
            return
        }

        setValidationError('')

        const receiveDateText = new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long',
        }).format(new Date(`${receiveDate}T00:00:00`))

        const lines = selectedOrders
            .map((item) => {
                const boxLabel = item.boxes > 1 ? 'boxes' : 'box'
                return `- ${item.id} (${item.range}): ${item.boxes} ${boxLabel}`
            })
            .join('\n')

        const totalLabel = totalBoxes > 1 ? 'boxes' : 'box'

        const message = [
            'Hi Michael,',
            '',
            `Please send the following worm order to arrive by ${receiveDateText}.`,
            `Total requested: ${totalBoxes} ${totalLabel}.`,
            '',
            lines,
            '',
            'Thanks.',
        ].join('\n')

        setGeneratedMessage(message)
    }

    const handleCopy = async () => {
        if (!generatedMessage) return

        try {
            await navigator.clipboard.writeText(generatedMessage)
            setCopied(true)
        } catch {
            setCopied(false)
            alert('Copy failed. Please copy the message manually.')
        }
    }

    useEffect(() => {
        const input = dateInputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null
        if (!input?.showPicker) return

        const timer = window.setTimeout(() => {
            try {
                input.showPicker?.()
            } catch {
                // Ignore browsers that block programmatic picker open.
            }
        }, 120)

        return () => window.clearTimeout(timer)
    }, [])

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-10">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl md:text-4xl font-black text-[#111827] tracking-tight">Worm Order</h1>
                <p className="text-sm text-gray-500 uppercase tracking-wider">Choose boxes by size, then pick receiving date</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <div className="flex flex-col md:flex-row md:items-end gap-4">
                    <div className="min-w-0">
                        <label htmlFor="receiveDate" className="block text-xs font-black text-gray-600 uppercase tracking-[0.15em] mb-2">
                            Receiving Date
                        </label>
                        <div
                            className="relative w-full md:w-[260px]"
                            onClick={() => {
                                const input = dateInputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null
                                try {
                                    input?.showPicker?.()
                                } catch {
                                    // Ignore unsupported browser behavior.
                                }
                            }}
                        >
                            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                ref={dateInputRef}
                                id="receiveDate"
                                type="date"
                                value={receiveDate}
                                onChange={(event) => {
                                    setCopied(false)
                                    setReceiveDate(event.target.value)
                                }}
                                min={today}
                                className="w-full h-11 pl-10 pr-3 rounded-lg border border-gray-300 text-[#111827] font-medium"
                            />
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleGenerate}
                        className="h-11 px-6 bg-[#e34219] hover:bg-[#cd3b17] text-white rounded-lg font-bold text-sm tracking-wide w-full md:w-auto"
                    >
                        Generate Message
                    </button>
                </div>
                {validationError && (
                    <p className="text-sm font-semibold text-[#e34219] mt-3">{validationError}</p>
                )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-[#fff7f3] flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-bold text-[#e34219] uppercase tracking-[0.2em]">WORM ORDER SHEET</p>
                        <h2 className="text-lg font-black text-[#1f2937]">How many boxes do you want to order?</h2>
                    </div>
                    <Sparkles size={18} className="text-[#e34219]" />
                </div>

                <div className="p-6 space-y-3">
                    {WORM_SIZES.map((size) => {
                        const current = quantities[size.id] || 0

                        return (
                            <div
                                key={size.id}
                                className="flex items-center justify-between gap-3 border border-gray-200 rounded-xl px-4 py-2.5"
                            >
                                <div>
                                    <div className="text-lg font-black text-[#111827] leading-none">{size.id}</div>
                                    <div className="text-xs text-gray-500 mt-0.5">{size.range}</div>
                                </div>

                                <div className="flex items-center rounded-lg border border-gray-300 overflow-hidden w-fit">
                                    <button
                                        type="button"
                                        onClick={() => handleQuantityChange(size.id, current - 1)}
                                        className="w-9 h-9 flex items-center justify-center text-gray-600 hover:bg-gray-50"
                                        aria-label={`${size.id} decrease`}
                                    >
                                        <Minus size={16} />
                                    </button>
                                    <input
                                        type="number"
                                        min={0}
                                        value={current}
                                        onChange={(event) => {
                                            const next = Number(event.target.value)
                                            handleQuantityChange(size.id, Number.isFinite(next) ? next : 0)
                                        }}
                                        className="w-14 h-9 text-center font-bold text-[#111827] outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleQuantityChange(size.id, current + 1)}
                                        className="w-9 h-9 flex items-center justify-center text-gray-600 hover:bg-gray-50"
                                        aria-label={`${size.id} increase`}
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {generatedMessage && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-3">
                    <textarea
                        readOnly
                        value={generatedMessage}
                        className="w-full h-60 border border-gray-300 rounded-xl p-4 text-sm leading-6 text-gray-800 bg-gray-50"
                    />
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="inline-flex items-center gap-2 h-10 px-4 border border-gray-300 rounded-lg font-semibold text-sm text-gray-700 hover:bg-gray-50"
                    >
                        <Copy size={15} />
                        {copied ? 'Copied' : 'Copy Message'}
                    </button>
                </div>
            )}
        </div>
    )
}
