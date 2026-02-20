'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function OrderActions({ order, isPartner = false }: { order: any, isPartner?: boolean }) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [status, setStatus] = useState(order.status)
    const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber || '')
    const [taxInvoiceIssued, setTaxInvoiceIssued] = useState(order.taxInvoiceIssued || false)
    const [adminDepositConfirmedAt, setAdminDepositConfirmedAt] = useState(order.adminDepositConfirmedAt)
    const [courier, setCourier] = useState(order.courier || 'Rosen')
    const [isEditingTracking, setIsEditingTracking] = useState(false)

    const confirmAdminDeposit = async () => {
        if (!confirm("입금 내역을 확인하셨습니까? 관리자 확인 시간을 기록합니다.")) return
        setLoading(true)
        try {
            const now = new Date().toISOString()
            const res = await fetch(`/api/orders/${order.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adminDepositConfirmedAt: now })
            })
            if (res.ok) {
                setAdminDepositConfirmedAt(now)
                router.refresh()
            } else {
                const data = await res.json()
                alert(`입금 확인 처리 중 오류가 발생했습니다: ${data.error || 'Unknown error'}`)
            }
        } catch (e) {
            console.error(e)
            alert('통신 오류가 발생했습니다.')
        } finally {
            setLoading(false)
        }
    }

    const updateStatus = async (newStatus: string) => {
        if (!confirm(`Change order status to ${newStatus}?`)) return
        setLoading(true)
        try {
            const body: any = { status: newStatus }
            // Reset times if moving back to PENDING
            if (newStatus === 'PENDING') {
                body.depositConfirmedAt = null
                body.adminDepositConfirmedAt = null
            }
            const res = await fetch(`/api/orders/${order.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })
            if (res.ok) {
                setStatus(newStatus)
                if (newStatus === 'PENDING') {
                    setAdminDepositConfirmedAt(null)
                }
                router.refresh()
            } else {
                const data = await res.json()
                alert(`Failed to update status: ${data.error || 'Unknown error'} (${res.status})`)
            }
        } catch (e) {
            console.error(e)
            alert('Error updating status')
        } finally {
            setLoading(false)
        }
    }

    const saveShippingInfo = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/orders/${order.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trackingNumber, courier, status: 'SHIPPED' })
            })
            if (res.ok) {
                setIsEditingTracking(false)
                setStatus('SHIPPED')
                router.refresh()
            } else {
                const data = await res.json()
                alert(`Failed to save shipping info: ${data.error || 'Unknown error'} (${res.status})`)
            }
        } catch (e) {
            console.error(e)
            alert('Error saving shipping info')
        } finally {
            setLoading(false)
        }
    }

    const deleteOrder = async () => {
        console.log("Delete button clicked, order ID:", order.id)
        if (!confirm("Are you sure you want to DELETE this order? This cannot be undone.")) {
            console.log("Delete cancelled by user")
            return
        }
        console.log("Proceeding with delete...")
        setLoading(true)
        try {
            const res = await fetch(`/api/orders/${order.id}`, {
                method: 'DELETE',
                cache: 'no-store'
            })
            console.log("Delete response status:", res.status)
            if (res.ok) {
                console.log("Delete success, reloading...")
                window.location.reload()
            } else {
                const data = await res.json()
                alert(`Failed to delete: ${data.error} (${res.status})`)
            }
        } catch (e) {
            console.error(e)
            alert('Error deleting order')
        } finally {
            setLoading(false)
        }
    }

    const toggleTaxInvoice = async () => {
        if (!confirm(`Mark Tax Invoice as ${!taxInvoiceIssued ? 'ISSUED' : 'NOT ISSUED'}?`)) return
        setLoading(true)
        try {
            const res = await fetch(`/api/orders/${order.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taxInvoiceIssued: !taxInvoiceIssued })
            })
            if (res.ok) {
                setTaxInvoiceIssued(!taxInvoiceIssued)
                router.refresh()
            } else {
                alert('Failed to update tax invoice status')
            }
        } catch (e) {
            console.error(e)
            alert('Error updating tax invoice status')
        } finally {
            setLoading(false)
        }
    }

    if (isPartner) {
        return (
            <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                    {taxInvoiceIssued ? (
                        <div className="flex items-center gap-2 relative">
                            <span // Rectangular shape with animated gradient
                                className="inline-block px-3 py-1 text-white text-xs font-bold rounded border border-red-800 custom-gradient-45 shadow-sm relative z-10"
                            >
                                세금계산서 발급완료 (Issued)
                            </span>
                        </div>
                    ) : (
                        <span className="px-3 py-1 rounded text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200">
                            세금계산서 발행중 (Pending Invoice)
                        </span>
                    )}
                    {status === 'PENDING' && (
                        <button
                            type="button"
                            onClick={() => deleteOrder()}
                            disabled={loading}
                            className={`bg-gray-600 text-white px-3 py-1 rounded text-xs hover:bg-gray-700 shadow-sm transition-colors border border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {loading ? '삭제 중...' : '주문삭제'}
                        </button>
                    )}
                </div>
                {(status === 'DEPOSIT_COMPLETED' || status === 'SHIPPED') && (
                    <button
                        onClick={() => router.push(`/invoice/${order.id}`)}
                        className="text-xs bg-[var(--color-brand-blue)] text-white px-3 py-1 rounded hover:opacity-90 transition-opacity flex items-center gap-2"
                    >
                        <span>📄</span> 거래명세표 확인 (Transaction Statement)
                    </button>
                )}
                {(status === 'DEPOSIT_COMPLETED' || status === 'SHIPPED') && order.trackingNumber && (
                    <div className="text-xs bg-white text-gray-800 px-3 py-1 rounded-lg border border-gray-200 font-medium text-right shadow-sm">
                        <span className="font-bold mr-2">
                            {order.courier === 'Rosen' ? 'Rosen (로젠택배)' :
                                order.courier === 'CJ' ? 'CJ Logistics (CJ대한통운)' :
                                    order.courier === 'Lotte' ? 'Lotte (롯데택배)' : order.courier}
                        </span>
                        <span className="text-[var(--color-brand-blue)]">송장번호 : <span className="font-bold">{order.trackingNumber}</span></span>
                    </div>
                )}
                <style jsx>{`
                    .custom-gradient-45 {
                        background: linear-gradient(45deg, #991b1b, #ef4444, #991b1b);
                        background-size: 200% 200%;
                        animation: gradient-45 3s ease-in-out infinite alternate;
                    }
                    @keyframes gradient-45 {
                        0% { background-position: 0% 50%; }
                        100% { background-position: 100% 50%; }
                    }
                `}</style>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-3 w-full">
            {/* Shipping Info Section */}
            <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                    <label className="text-[11px] text-gray-400 ml-1">Carrier selection</label>
                    <div className="relative">
                        <select
                            value={courier}
                            onChange={(e) => setCourier(e.target.value)}
                            disabled={!isEditingTracking && !!order.trackingNumber}
                            className="w-full appearance-none border border-gray-200 rounded-lg p-3 text-sm text-gray-800 font-medium bg-white outline-none focus:border-[#ea580c]"
                        >
                            <option value="Rosen">Rosen Courier (CJ Logistics)</option>
                            <option value="CJ">CJ Logistics</option>
                            <option value="Lotte">Lotte Courier</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-[11px] text-gray-400 ml-1">Tracking Number</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={trackingNumber}
                            onChange={(e) => setTrackingNumber(e.target.value)}
                            disabled={!isEditingTracking && !!order.trackingNumber}
                            placeholder="Enter tracking no."
                            className="flex-1 border border-gray-200 rounded-lg p-3 text-sm text-gray-800 font-medium bg-white outline-none focus:border-[#ea580c]"
                        />
                        {(!order.trackingNumber || isEditingTracking) ? (
                            <button
                                onClick={saveShippingInfo}
                                disabled={loading}
                                className="bg-[#e43f29] text-white px-6 rounded-lg font-bold text-sm w-[80px]"
                            >
                                Save
                            </button>
                        ) : (
                            <button
                                onClick={() => setIsEditingTracking(true)}
                                className="bg-gray-100 text-gray-600 px-6 rounded-lg font-bold text-sm w-[80px]"
                            >
                                Edit
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-2 mt-2 w-full">
                {/* Confirmation Button */}
                {status === 'PENDING' ? (
                    <button
                        onClick={() => updateStatus('DEPOSIT_COMPLETED')}
                        disabled={loading}
                        className="w-full py-4 text-sm font-bold text-white rounded-[1rem] flex gap-2 items-center justify-center bg-[#424853] hover:bg-[#2d323a] transition-colors"
                    >
                        <svg className="w-5 h-5 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        Confirm Deposit (입금확인)
                    </button>
                ) : status === 'DEPOSIT_COMPLETED' && !adminDepositConfirmedAt ? (
                    <button
                        onClick={confirmAdminDeposit}
                        disabled={loading}
                        className="w-full py-4 text-sm font-bold text-white rounded-[1rem] flex gap-2 items-center justify-center bg-[#424853] hover:bg-[#2d323a] transition-colors"
                    >
                        <svg className="w-5 h-5 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                        Admin Confirm Deposit (입금확인)
                    </button>
                ) : null}

                {/* Statement Button */}
                {(status === 'PENDING' || status === 'DEPOSIT_COMPLETED' || status === 'SHIPPED' || status === 'APPROVED') && (
                    <button
                        onClick={() => router.push(`/invoice/${order.id}`)}
                        className="w-full py-4 text-sm font-bold text-white rounded-[1rem] flex gap-2 items-center justify-center bg-[#515966] hover:bg-[#424853] transition-colors"
                    >
                        <svg className="w-5 h-5 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        Statement (거래명세표)
                    </button>
                )}

                {/* Tax Invoice Button */}
                {(status === 'PENDING' || status === 'DEPOSIT_COMPLETED' || status === 'SHIPPED' || status === 'APPROVED') && (
                    <button
                        onClick={toggleTaxInvoice}
                        disabled={loading}
                        className={`w-full py-4 text-sm font-bold text-white rounded-[1rem] flex gap-2 items-center justify-center transition-colors ${taxInvoiceIssued ? 'bg-gray-400 hover:bg-gray-500' : 'bg-[#e43f29] hover:bg-[#cb3622]'}`}
                    >
                        <svg className="w-5 h-5 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        {taxInvoiceIssued ? '계산서 발행 취소' : 'Issue Tax Invoice (세금계산서 발급)'}
                    </button>
                )}
            </div>
        </div>
    )
}
