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
        <div className="flex flex-col items-end gap-2 w-full">
            {/* Tax Invoice badges removed per user request to save space */}

            {/* Shipping Info Section - Enabled for relevant statuses */}
            {(status === 'PENDING' || status === 'APPROVED' || status === 'DEPOSIT_COMPLETED' || status === 'SHIPPED') && (
                <div className="flex flex-col items-end gap-2">
                    {isEditingTracking || !order.trackingNumber ? (
                        <div className="flex items-center gap-2">
                            <select
                                value={courier}
                                onChange={(e) => setCourier(e.target.value)}
                                className="px-2 py-1 border rounded text-xs w-[140px] font-bold text-gray-700 bg-gray-50"
                            >
                                <option value="Rosen">로젠택배</option>
                                <option value="CJ">CJ대한통운</option>
                                <option value="Lotte">롯데택배</option>
                            </select>
                            <input
                                type="text"
                                value={trackingNumber}
                                onChange={(e) => setTrackingNumber(e.target.value)}
                                placeholder="송장번호 입력"
                                className="px-2 py-1 bg-white text-[#d9361b] border border-gray-300 rounded text-xs w-[140px] font-bold placeholder-gray-300 focus:border-[#d9361b] outline-none transition-all"
                            />
                            <button
                                onClick={saveShippingInfo}
                                disabled={loading}
                                className="bg-[#d9361b] text-white px-3 py-1 rounded-md text-xs font-bold hover:brightness-110 shadow-md hover:shadow-lg active:scale-95 transition-all whitespace-nowrap"
                            >
                                저장
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2 text-xs text-gray-700 bg-white px-3 py-0.5 rounded border border-gray-200">
                                <span className="font-semibold text-gray-900">
                                    {courier === 'Rosen' ? 'Rosen (로젠택배)' :
                                        courier === 'CJ' ? 'CJ Logistics (CJ대한통운)' :
                                            courier === 'Lotte' ? 'Lotte (롯데택배)' : courier}
                                </span>
                                <span className="mx-1 text-gray-400">|</span>
                                <span className="">송장번호 : <span className="font-bold">{order.trackingNumber}</span></span>
                            </div>
                            <button
                                onClick={() => setIsEditingTracking(true)}
                                className="text-xs bg-[#d9361b] text-white px-2.5 py-1 rounded-md font-bold hover:brightness-110 shadow-sm hover:shadow-md active:scale-95 transition-all"
                            >
                                수정
                            </button>
                        </div>
                    )}
                </div>
            )}

            <div className="flex flex-col items-end gap-2 w-full">
                {/* Deposit Info removed per user request */}

                {/* Status Toggles */}
                <div className="flex items-center gap-2 flex-wrap justify-end">
                    {status === 'DEPOSIT_COMPLETED' && !adminDepositConfirmedAt && (
                        <button
                            onClick={confirmAdminDeposit}
                            disabled={loading}
                            className="bg-green-600 text-white px-4 py-1 rounded-md text-xs font-bold hover:bg-green-700 shadow-md hover:shadow-lg active:scale-95 transition-all"
                        >
                            {loading ? '처리 중...' : '입금확인'}
                        </button>
                    )}
                    {status === 'PENDING' && (
                        <button
                            onClick={() => updateStatus('DEPOSIT_COMPLETED')}
                            disabled={loading}
                            className="bg-gray-600 text-white px-4 py-1 rounded-md text-xs font-bold hover:bg-gray-700 shadow-md hover:shadow-lg active:scale-95 transition-all"
                        >
                            {loading ? '처리 중...' : '입금확인 (Confirm Deposit)'}
                        </button>
                    )}

                    {(status === 'PENDING' || status === 'DEPOSIT_COMPLETED' || status === 'SHIPPED' || status === 'APPROVED') && (
                        <>
                            <button
                                onClick={() => router.push(`/invoice/${order.id}`)}
                                className="bg-gray-700 text-white px-3 py-1 rounded-md text-xs font-bold hover:bg-gray-800 shadow-md hover:shadow-lg active:scale-95 transition-all"
                            >
                                거래명세표
                            </button>

                            <button
                                onClick={toggleTaxInvoice}
                                disabled={loading}
                                className={`px-3 py-1 rounded-md text-xs font-bold text-white shadow-md hover:shadow-lg active:scale-95 transition-all ${taxInvoiceIssued ? 'bg-gray-500 hover:bg-gray-600 border border-gray-400' : 'bg-[#d9361b] hover:brightness-110'}`}
                            >
                                {taxInvoiceIssued ? '계산서발급취소' : '세금계산서 발급'}
                            </button>
                        </>
                    )}

                    <button
                        type="button"
                        onClick={() => deleteOrder()}
                        disabled={loading}
                        className={`bg-gray-900 text-white px-3 py-1 rounded-md text-xs font-bold hover:bg-black shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        {loading ? '삭제 중...' : '주문삭제'}
                    </button>
                </div>
            </div>
        </div>
    )
}
