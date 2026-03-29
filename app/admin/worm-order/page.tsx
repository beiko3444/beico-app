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
    const [hasFetched, setHasFetched] = useState(false)
    const [selectedEmailUid, setSelectedEmailUid] = useState<string | null>(null)

    // ── 관세사 메일 전달 관련 State ──
    const [forwardEmail, setForwardEmail] = useState('')
    const [forwarding, setForwarding] = useState(false)
    const [forwardError, setForwardError] = useState('')
    const [forwardSuccess, setForwardSuccess] = useState('')

    const handleForwardEmail = async (uid: string) => {
        if (!forwardEmail) {
            setForwardError('받을 이메일 주소를 입력해주세요.')
            return
        }
        setForwarding(true)
        setForwardError('')
        setForwardSuccess('')

        try {
            const res = await fetch('/api/admin/worm-order/emails/forward', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid, toEmail: forwardEmail })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || '이메일 전달 실패')
            setForwardSuccess('메일과 첨부파일이 지정된 주소로 성공적으로 전달되었습니다.')
            setTimeout(() => setForwardSuccess(''), 5000)
            setForwardEmail('')
        } catch (err: any) {
            setForwardError(err.message)
        } finally {
            setForwarding(false)
        }
    }

    // ── 자동 페치 & 게이지 관련 State ──
    const [fetchProgress, setFetchProgress] = useState(0)

    useEffect(() => {
        fetchEmails()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const fetchEmails = async () => {
        setLoadingEmails(true)
        setEmailError('')
        setHasFetched(false)
        setSelectedEmailUid(null)
        setFetchProgress(0)

        // 가짜(Fake) 프로그레스 메이커 (로딩 중일 때 90%까지 꾸준히 증가)
        let currentProgress = 0
        const interval = setInterval(() => {
            currentProgress += Math.random() * 15
            if (currentProgress > 90) currentProgress = 90
            setFetchProgress(currentProgress)
        }, 400)

        try {
            const res = await fetch('/api/admin/worm-order/emails')
            clearInterval(interval)
            setFetchProgress(100) // 100% 꽉 채우기

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to fetch emails')
            
            const fetchedEmails = data.emails || []
            setEmails(fetchedEmails)
            if (fetchedEmails.length > 0) {
                setSelectedEmailUid(fetchedEmails[0].uid)
            }
            
            setHasFetched(true)
            
            // 0.5초 뒤 게이지 숨김
            setTimeout(() => setFetchProgress(0), 500)
        } catch (err: any) {
            clearInterval(interval)
            setFetchProgress(0)
            setEmailError(err.message)
            setHasFetched(true)
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

                <div className="p-4 md:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                    {WORM_SIZES.map((size) => {
                        const current = quantities[size.id] || 0
                        const isSelected = current > 0

                        return (
                            <div
                                key={size.id}
                                className={`flex flex-col gap-3 justify-between border rounded-xl p-4 transition-all duration-200 ${
                                    isSelected ? 'border-[#e34219] bg-[#fff7f3] shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'
                                }`}
                            >
                                <div>
                                    <div className="text-[17px] font-black text-[#111827] leading-none">{size.id}</div>
                                    <div className="text-[11px] text-gray-500 mt-1.5">{size.range}</div>
                                </div>

                                <div className={`flex items-center rounded-lg border overflow-hidden w-full transition-colors ${isSelected ? 'border-[#e34219]/30 bg-white' : 'border-gray-300 bg-white'}`}>
                                    <button
                                        type="button"
                                        onClick={() => handleQuantityChange(size.id, current - 1)}
                                        className="w-10 h-[38px] flex items-center justify-center text-gray-600 hover:bg-gray-50 flex-shrink-0"
                                        aria-label={`${size.id} decrease`}
                                    >
                                        <Minus size={15} />
                                    </button>
                                    <input
                                        type="number"
                                        min={0}
                                        value={current}
                                        onChange={(event) => {
                                            const next = Number(event.target.value)
                                            handleQuantityChange(size.id, Number.isFinite(next) ? next : 0)
                                        }}
                                        className="flex-1 min-w-0 h-[38px] text-center font-black text-[#111827] outline-none text-[15px]"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleQuantityChange(size.id, current + 1)}
                                        className="w-10 h-[38px] flex items-center justify-center text-gray-600 hover:bg-gray-50 flex-shrink-0"
                                        aria-label={`${size.id} increase`}
                                    >
                                        <Plus size={15} />
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
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden relative">
                
                {/* 상단 프로그레스 게이지 바 */}
                {fetchProgress > 0 && (
                    <div className="absolute top-0 left-0 w-full h-[4px] bg-slate-100 z-10 overflow-hidden">
                        <div 
                            className="h-full bg-orange-500 transition-all duration-300 ease-out"
                            style={{ width: `${fetchProgress}%` }}
                        />
                    </div>
                )}

                <div className="px-6 py-4 border-b border-gray-100 bg-[#f8fafc] flex items-center justify-between mt-[2px]">
                    <div>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.2em] relative">INBOX
                            {loadingEmails && <span className="absolute -top-1 -right-3 flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span></span>}
                        </p>
                        <h2 className="text-lg font-black text-[#1f2937] flex items-center gap-2">
                            <Mail size={18} className="text-slate-500" /> Documents
                        </h2>
                    </div>
                    <button
                        onClick={fetchEmails}
                        disabled={loadingEmails}
                        className="h-9 px-4 bg-slate-800 text-white rounded-lg text-sm font-bold shadow hover:bg-slate-700 disabled:opacity-50 flex items-center gap-2 cursor-pointer transition-colors relative overflow-hidden"
                    >
                        {loadingEmails && <Loader2 size={14} className="animate-spin relative z-10" />}
                        <span className="relative z-10">{loadingEmails ? '스캔 중...' : 'Fetch Emails'}</span>
                    </button>
                </div>
                <div className="flex flex-col md:flex-row min-h-[500px] border-t border-gray-100">
                    {/* 좌측 리스트 패널 */}
                    <div className="w-full md:w-[35%] bg-white border-r border-gray-100 overflow-y-auto max-h-[600px] relative">
                        {emailError && <div className="p-4 text-sm text-red-500 font-medium text-center">{emailError}</div>}
                        
                        {loadingEmails && (
                            <div className="p-10 flex flex-col items-center justify-center gap-4 text-slate-400 h-full mt-20">
                                <span className="text-[13px] font-bold text-orange-500 tracking-wider">스캔 진행률 {Math.round(fetchProgress)}%</span>
                                <div className="w-[120px] h-[3px] bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-orange-500 transition-all duration-300 ease-out" style={{ width: `${fetchProgress}%` }} />
                                </div>
                                <span className="text-[12px] font-medium text-slate-400 animate-pulse mt-1">Daum 서버의 메일함을 순차 탐색하고 있습니다...</span>
                            </div>
                        )}

                        {hasFetched && !loadingEmails && emails.length === 0 && !emailError && (
                            <div className="p-10 text-center text-[13px] font-medium text-gray-500 bg-gray-50/50 mt-10">
                                메일 본문에 <span className="font-bold text-gray-700">'michael@oikki.com'</span>이 포함된<br />최근 메일이 없습니다.
                            </div>
                        )}

                        {!loadingEmails && emails.length > 0 && (
                            <div className="divide-y divide-gray-100">
                                {emails.map((email) => {
                                    const isSelected = selectedEmailUid === email.uid
                                    return (
                                        <button
                                            key={email.uid}
                                            onClick={() => setSelectedEmailUid(email.uid)}
                                            className={`w-full text-left p-4 hover:bg-slate-50 transition-colors ${
                                                isSelected ? 'bg-orange-50/50 border-l-[3px] border-orange-500 pl-[13px]' : 'border-l-[3px] border-transparent pl-4'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <span className={`text-[11px] font-bold ${isSelected ? 'text-orange-500' : 'text-gray-400'}`}>
                                                    {new Date(email.date).toLocaleDateString()}
                                                </span>
                                                {email.hasAttachments && <span className="text-[11px]">📎</span>}
                                            </div>
                                            <h3 className={`text-[14px] font-bold leading-snug line-clamp-2 ${isSelected ? 'text-gray-900' : 'text-gray-600'}`}>
                                                {email.subject}
                                            </h3>
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* 우측 본문 렌더링 패널 */}
                    <div className="w-full md:w-[65%] bg-gray-50/30 flex flex-col">
                        {!selectedEmailUid ? (
                            <div className="flex-1 flex items-center justify-center p-10 text-[13px] text-gray-400 font-medium">
                                {emails.length > 0 ? "좌측에서 메일을 선택하시면 내용이 표시됩니다." : ""}
                            </div>
                        ) : (() => {
                            const selectedEmail = emails.find(e => e.uid === selectedEmailUid)
                            if (!selectedEmail) return null
                            return (
                                <div className="flex flex-col h-full max-h-[600px]">
                                    {/* 상세 헤더 */}
                                    <div className="p-6 bg-white border-b border-gray-100 shrink-0">
                                        <h2 className="text-[18px] font-black text-gray-900 leading-tight mb-2 pr-4">{selectedEmail.subject}</h2>
                                        <div className="flex items-center gap-3 text-[12px] text-gray-500 font-medium tracking-tight">
                                            <span>수신일시: {new Date(selectedEmail.date).toLocaleString()}</span>
                                        </div>
                                        
                                        {/* 첨부파일 다운로드 */}
                                        {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                                            <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-2">
                                                {selectedEmail.attachments.map((att: any) => (
                                                    <a
                                                        key={att.index}
                                                        href={`/api/admin/worm-order/emails/attachment?uid=${selectedEmail.uid}&index=${att.index}`}
                                                        className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#e34219] bg-[#fff7f3] hover:bg-[#ffeadd] px-3 py-1.5 rounded-lg border border-[#ffeadd] transition-colors"
                                                        title="새 탭에서 열거나 다운로드하려면 클릭하세요"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                    >
                                                        📎 {att.filename} <span className="font-normal text-[10px] text-orange-400 opacity-80 ml-0.5">({Math.round(att.size / 1024)}KB)</span>
                                                    </a>
                                                ))}
                                            </div>
                                        )}

                                        {/* ── [NEW] 관세사 메일 전달 영역 ── */}
                                        <div className="mt-5 p-4 rounded-xl border border-orange-100 bg-orange-50/50 flex flex-col gap-3">
                                            <label className="text-[13px] font-bold text-gray-800 flex items-center gap-1.5 focus-within:text-orange-600 transition-colors">
                                                <Send size={15} className="text-orange-600" />
                                                이 메일의 첨부파일을 지정된 이메일로 바로 전달하기
                                            </label>
                                            <div className="flex gap-2 w-full">
                                                <input 
                                                    type="email"
                                                    value={forwardEmail}
                                                    onChange={(e) => setForwardEmail(e.target.value)}
                                                    placeholder="수신자 이메일 주소 (예: customs@example.com)" 
                                                    className="flex-1 px-3 h-10 rounded-lg border border-gray-300 text-[13px] outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-shadow bg-white"
                                                    disabled={forwarding}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && forwardEmail && !forwarding) {
                                                            handleForwardEmail(selectedEmail.uid)
                                                        }
                                                    }}
                                                />
                                                <button
                                                    onClick={() => handleForwardEmail(selectedEmail.uid)}
                                                    disabled={forwarding || !forwardEmail.includes('@')}
                                                    className="px-5 h-10 rounded-lg bg-orange-600 text-white font-bold text-[13px] hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm whitespace-nowrap"
                                                >
                                                    {forwarding ? <Loader2 size={14} className="animate-spin" /> : null}
                                                    {forwarding ? '전송중...' : '해당 양식으로 전달'}
                                                </button>
                                            </div>
                                            {forwardError && <p className="text-[12px] font-bold text-red-500">{forwardError}</p>}
                                            {forwardSuccess && <p className="text-[12px] font-bold text-emerald-600">{forwardSuccess}</p>}
                                        </div>
                                    </div>
                                    {/* 메일 본문 내용 */}
                                    <div className="p-6 overflow-y-auto bg-white flex-1 text-[14px]">
                                        <div 
                                            className="w-full text-gray-800 break-words leading-relaxed max-w-none"
                                            style={{ whiteSpace: selectedEmail.text.includes('<html') ? 'normal' : 'pre-wrap' }}
                                            dangerouslySetInnerHTML={{ __html: selectedEmail.text }} 
                                        />
                                    </div>
                                </div>
                            )
                        })()}
                    </div>
                </div>
            </div>
        </div>
    )
}
