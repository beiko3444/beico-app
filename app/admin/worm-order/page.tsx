'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, Copy, FileText, Loader2, Minus, Plus, Send, Sparkles, Mail } from 'lucide-react'

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
    const [moinLoginId, setMoinLoginId] = useState(process.env.NEXT_PUBLIC_MOIN_ID || '')
    const [moinPassword, setMoinPassword] = useState(process.env.NEXT_PUBLIC_MOIN_PW || '')
    const [transferAmountUsd, setTransferAmountUsd] = useState('')
    const [invoicePdf, setInvoicePdf] = useState<File | null>(null)
    const [remittanceError, setRemittanceError] = useState('')
    const [remittanceSuccess, setRemittanceSuccess] = useState('')
    const [remittanceSubmitting, setRemittanceSubmitting] = useState(false)
    const dateInputRef = useRef<HTMLInputElement>(null)

    const [emails, setEmails] = useState<any[]>([])
    const [loadingEmails, setLoadingEmails] = useState(false)
    const [emailError, setEmailError] = useState('')

    const fetchEmails = async () => {
        setLoadingEmails(true)
        setEmailError('')
        try {
            const res = await fetch('/api/admin/worm-order/emails')
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to fetch emails')
            setEmails(data.emails || [])
        } catch (err: any) {
            setEmailError(err.message)
        } finally {
            setLoadingEmails(false)
        }
    }

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

    const handleRemittanceApply = async () => {
        setRemittanceError('')
        setRemittanceSuccess('')

        if (!moinLoginId.trim() || !moinPassword.trim()) {
            setRemittanceError('Please enter MOIN login ID and password.')
            return
        }

        const normalizedAmount = transferAmountUsd.replace(/,/g, '').trim()
        const parsedAmount = Number(normalizedAmount)
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            setRemittanceError('Please enter a valid USD amount.')
            return
        }

        if (!invoicePdf) {
            setRemittanceError('Please upload an invoice PDF file.')
            return
        }

        const isPdf = invoicePdf.type === 'application/pdf' || invoicePdf.name.toLowerCase().endsWith('.pdf')
        if (!isPdf) {
            setRemittanceError('Only PDF files are allowed.')
            return
        }

        setRemittanceSubmitting(true)
        try {
            const submitData = new FormData()
            submitData.append('moinLoginId', moinLoginId.trim())
            submitData.append('moinPassword', moinPassword)
            submitData.append('amountUsd', parsedAmount.toFixed(2))
            submitData.append('invoicePdf', invoicePdf)

            const response = await fetch('/api/admin/worm-order/remittance', {
                method: 'POST',
                body: submitData,
            })
            const result = await response.json()

            if (!response.ok) {
                throw new Error(typeof result?.error === 'string' ? result.error : 'Failed to submit remittance.')
            }

            setRemittanceSuccess('Remittance application completed on MOIN BizPlus.')
            setMoinPassword('')
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to submit remittance.'
            if (message.toLowerCase().includes('playwright')) {
                setRemittanceError(`${message} (Install deps and redeploy: npm install playwright-core @sparticuz/chromium)`)
            } else {
                setRemittanceError(message)
            }
        } finally {
            setRemittanceSubmitting(false)
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

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-[11px] font-bold text-[#e34219] uppercase tracking-[0.2em]">MOIN BIZPLUS</p>
                        <h3 className="text-lg font-black text-[#111827]">Auto Remittance Application</h3>
                        <p className="text-xs text-gray-500 mt-1">
                            Fill amount + invoice PDF, then click apply to complete transfer submission automatically.
                        </p>
                    </div>
                    <Send size={18} className="text-[#e34219] mt-1" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-600 uppercase tracking-[0.12em]">
                            MOIN Login ID
                        </label>
                        <input
                            type="text"
                            value={moinLoginId}
                            onChange={(event) => setMoinLoginId(event.target.value)}
                            className="w-full h-11 px-3 rounded-lg border border-gray-300 text-[#111827] font-medium"
                            placeholder="Enter MOIN login ID"
                            autoComplete="username"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-600 uppercase tracking-[0.12em]">
                            MOIN Password
                        </label>
                        <input
                            type="password"
                            value={moinPassword}
                            onChange={(event) => setMoinPassword(event.target.value)}
                            className="w-full h-11 px-3 rounded-lg border border-gray-300 text-[#111827] font-medium"
                            placeholder="Enter MOIN password"
                            autoComplete="current-password"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-600 uppercase tracking-[0.12em]">
                            Transfer Amount (USD)
                        </label>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={transferAmountUsd}
                            onChange={(event) => {
                                const cleaned = event.target.value.replace(/[^0-9.,]/g, '')
                                setTransferAmountUsd(cleaned)
                            }}
                            className="w-full h-11 px-3 rounded-lg border border-gray-300 text-[#111827] font-medium"
                            placeholder="Ex. 1250.50"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-600 uppercase tracking-[0.12em]">
                            Invoice PDF
                        </label>
                        <label className="h-11 px-3 rounded-lg border border-dashed border-gray-300 text-[#111827] font-medium flex items-center justify-between cursor-pointer hover:bg-gray-50">
                            <div className="flex items-center gap-2 min-w-0">
                                <FileText size={16} className="shrink-0 text-gray-500" />
                                <span className="text-sm truncate">{invoicePdf?.name || 'Upload invoice PDF'}</span>
                            </div>
                            <span className="text-[11px] text-gray-500 font-bold uppercase">PDF</span>
                            <input
                                type="file"
                                accept=".pdf,application/pdf"
                                className="hidden"
                                onChange={(event) => {
                                    setRemittanceError('')
                                    setRemittanceSuccess('')
                                    const file = event.target.files?.[0] || null
                                    setInvoicePdf(file)
                                }}
                            />
                        </label>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                        The automation will log in, select Shanghai Oikki Trading Co.,Ltd, upload your PDF, check consent, and complete submission.
                    </p>
                    <button
                        type="button"
                        onClick={handleRemittanceApply}
                        disabled={remittanceSubmitting}
                        className="h-11 px-6 bg-[#111827] hover:bg-black text-white rounded-lg font-bold text-sm tracking-wide disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                    >
                        {remittanceSubmitting ? (
                            <>
                                <Loader2 size={15} className="animate-spin" />
                                Applying...
                            </>
                        ) : (
                            '신청하기'
                        )}
                    </button>
                </div>

                {remittanceError && (
                    <p className="text-sm font-semibold text-[#e34219]">{remittanceError}</p>
                )}
                {remittanceSuccess && (
                    <p className="text-sm font-semibold text-green-600">{remittanceSuccess}</p>
                )}
            </div>

            {/* ── 최근 메일 조회 (INBOX) ── */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-[#f8fafc] flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.2em]">INBOX</p>
                        <h2 className="text-lg font-black text-[#1f2937] flex items-center gap-2">
                            <Mail size={18} className="text-slate-500" /> Recent Replies (Michael)
                        </h2>
                    </div>
                    <button
                        onClick={fetchEmails}
                        disabled={loadingEmails}
                        className="h-9 px-4 bg-slate-800 text-white rounded-lg text-sm font-bold shadow hover:bg-slate-700 disabled:opacity-50 flex items-center gap-2 cursor-pointer transition-colors"
                    >
                        {loadingEmails && <Loader2 size={14} className="animate-spin" />}
                        {loadingEmails ? 'Loading...' : 'Fetch Emails'}
                    </button>
                </div>
                <div className="p-0">
                    {emailError && <div className="p-6 text-sm text-red-500 font-medium text-center">{emailError}</div>}
                    {!loadingEmails && emails.length === 0 && !emailError && (
                        <div className="p-10 text-center text-sm text-gray-500">Click "Fetch Emails" to load recent messages from michael@oikki.com.</div>
                    )}
                    {emails.map((email) => (
                        <div key={email.uid} className="border-b border-gray-100 last:border-0 p-5 hover:bg-slate-50 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-bold text-gray-900 text-[15px] max-w-[80%] leading-tight">{email.subject}</h3>
                                <span className="text-[12px] text-gray-400 font-medium whitespace-nowrap">{new Date(email.date).toLocaleString()}</span>
                            </div>
                            <div className="text-[13px] text-gray-600 line-clamp-3 overflow-hidden text-ellipsis leading-relaxed" dangerouslySetInnerHTML={{ __html: email.text }} />
                            {email.hasAttachments && (
                                <span className="inline-flex items-center gap-1 mt-3 text-[11px] font-bold text-[#e34219] bg-[#fff7f3] px-2 py-0.5 rounded border border-[#ffeadd]">
                                    📎 첨부파일 있음 (Daum 메일함 확인)
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
