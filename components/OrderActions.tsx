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
        const statusName = newStatus === 'PENDING' ? '주문대기' :
            newStatus === 'DEPOSIT_COMPLETED' ? '입금완료' :
                newStatus === 'SHIPPED' ? '배송중' :
                    newStatus === 'APPROVED' ? '승인완료' : newStatus;
        if (!confirm(`주문 상태를 ${statusName}(으)로 변경하시겠습니까?`)) return
        setLoading(true)
        try {
            const body: any = { status: newStatus }
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
                alert(`상태 업데이트에 실패했습니다: ${data.error || '알 수 없는 오류'} (${res.status})`)
            }
        } catch (e) {
            console.error(e)
            alert('상태 업데이트 중 오류가 발생했습니다.')
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
                alert(`배송 정보 저장에 실패했습니다: ${data.error || '알 수 없는 오류'} (${res.status})`)
            }
        } catch (e) {
            console.error(e)
            alert('배송 정보 저장 중 오류가 발생했습니다.')
        } finally {
            setLoading(false)
        }
    }

    const deleteOrder = async () => {
        console.log("Delete button clicked, order ID:", order.id)
        if (!confirm("정말로 이 주문을 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.")) {
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
                const data = await res.json();
                alert(`삭제에 실패했습니다: ${data.error} (${res.status})`)
            }
        } catch (e) {
            console.error(e)
            alert('주문 삭제 중 오류가 발생했습니다.')
        } finally {
            setLoading(false)
        }
    }

    const toggleTaxInvoice = async () => {
        if (!confirm(`세금계산서 발급 상태를 ${!taxInvoiceIssued ? '발급' : '미발급'}(으)로 변경하시겠습니까?`)) return
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
                alert('세금계산서 상태 업데이트에 실패했습니다.')
            }
        } catch (e) {
            console.error(e)
            alert('세금계산서 상태 업데이트 중 오류가 발생했습니다.')
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
                            <span
                                className="inline-block px-3 py-1 text-white text-xs font-bold rounded border border-red-800 custom-gradient-45 shadow-sm relative z-10"
                            >
                                세금계산서 발급완료
                            </span>
                        </div>
                    ) : (
                        <span className="px-3 py-1 rounded text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200">
                            세금계산서 발행중
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
                        <span>📄</span> 거래명세표 확인
                    </button>
                )}
                {(status === 'DEPOSIT_COMPLETED' || status === 'SHIPPED') && order.trackingNumber && (
                    <div className="text-xs bg-white text-gray-800 px-3 py-1 rounded-lg border border-gray-200 font-medium text-right shadow-sm">
                        <span className="font-bold mr-2">
                            로젠택배
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
                `}
                </style>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-2.5 w-full">
            {/* Shipping Form */}
            <div className="flex gap-2 items-end">
                <div className="flex-1 flex flex-col gap-1">
                    <label className="text-[10px] text-gray-400 font-medium ml-0.5">택배사</label>
                    <select
                        value={courier}
                        onChange={(e) => setCourier(e.target.value)}
                        disabled={!isEditingTracking && !!order.trackingNumber}
                        className="w-full appearance-none border border-gray-200 rounded-xl px-3 py-2.5 text-[12px] text-gray-800 font-bold bg-gray-50 outline-none focus:border-[#e43f29] focus:bg-white transition-all"
                    >
                        <option value="Rosen">로젠택배</option>
                    </select>
                </div>
                <div className="flex-[2] flex flex-col gap-1">
                    <label className="text-[10px] text-gray-400 font-medium ml-0.5">송장번호</label>
                    <div className="flex gap-1.5">
                        <input
                            type="text"
                            value={trackingNumber}
                            onChange={(e) => setTrackingNumber(e.target.value)}
                            disabled={!isEditingTracking && !!order.trackingNumber}
                            placeholder="송장번호 입력"
                            className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-[12px] text-gray-800 font-bold bg-gray-50 outline-none focus:border-[#e43f29] focus:bg-white transition-all placeholder:text-gray-300 disabled:text-gray-400"
                        />
                        {(!order.trackingNumber || isEditingTracking) ? (
                            <button
                                onClick={saveShippingInfo}
                                disabled={loading}
                                className="bg-[#1a1d23] text-white px-4 rounded-xl font-bold text-[11px] hover:bg-[#2a2f38] transition-colors shrink-0 disabled:opacity-50"
                            >
                                저장
                            </button>
                        ) : (
                            <button
                                onClick={() => setIsEditingTracking(true)}
                                className="bg-gray-100 text-gray-600 px-4 rounded-xl font-bold text-[11px] hover:bg-gray-200 transition-colors shrink-0"
                            >
                                수정
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-1.5 mt-1">
                {/* 입금확인 버튼 */}
                {status === 'PENDING' ? (
                    <button
                        onClick={() => updateStatus('DEPOSIT_COMPLETED')}
                        disabled={loading}
                        className="col-span-2 py-3 text-[11px] font-black text-white rounded-xl flex gap-1.5 items-center justify-center bg-[#1a1d23] hover:bg-[#2a2f38] transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                        <svg className="w-4 h-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        입금확인
                    </button>
                ) : status === 'DEPOSIT_COMPLETED' && !adminDepositConfirmedAt ? (
                    <button
                        onClick={confirmAdminDeposit}
                        disabled={loading}
                        className="col-span-2 py-3 text-[11px] font-black text-white rounded-xl flex gap-1.5 items-center justify-center bg-[#1a1d23] hover:bg-[#2a2f38] transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                        <svg className="w-4 h-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                        관리자 입금확인
                    </button>
                ) : null}

                {/* 거래명세표 */}
                {(status === 'PENDING' || status === 'DEPOSIT_COMPLETED' || status === 'SHIPPED' || status === 'APPROVED') && (
                    <button
                        onClick={() => router.push(`/invoice/${order.id}`)}
                        className="py-3 text-[11px] font-black text-white rounded-xl flex gap-1.5 items-center justify-center bg-[#3b4250] hover:bg-[#4a5060] transition-all active:scale-[0.98]"
                    >
                        <svg className="w-4 h-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        거래명세표
                    </button>
                )}

                {/* 세금계산서 */}
                {(status === 'PENDING' || status === 'DEPOSIT_COMPLETED' || status === 'SHIPPED' || status === 'APPROVED') && (
                    <button
                        onClick={toggleTaxInvoice}
                        disabled={loading}
                        className={`py-3 text-[11px] font-black text-white rounded-xl flex gap-1.5 items-center justify-center transition-all active:scale-[0.98] disabled:opacity-50 ${taxInvoiceIssued ? 'bg-gray-400 hover:bg-gray-500' : 'bg-[#e43f29] hover:bg-[#cb3622]'}`}
                    >
                        <svg className="w-4 h-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        {taxInvoiceIssued ? '발행 취소' : '세금계산서'}
                    </button>
                )}
            </div>
        </div>
    )
}
