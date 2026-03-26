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
                alert(`오류: ${data.error || 'Unknown'}`)
            }
        } catch (e) {
            console.error(e)
            alert('통신 오류')
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
                if (newStatus === 'PENDING') setAdminDepositConfirmedAt(null)
                router.refresh()
            } else {
                const data = await res.json()
                alert(`실패: ${data.error || '오류'} (${res.status})`)
            }
        } catch (e) {
            console.error(e)
            alert('상태 업데이트 오류')
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
                alert(`실패: ${data.error || '오류'}`)
            }
        } catch (e) {
            console.error(e)
            alert('배송 정보 저장 오류')
        } finally {
            setLoading(false)
        }
    }

    const deleteOrder = async () => {
        if (!confirm("정말로 이 주문을 삭제하시겠습니까?")) return
        setLoading(true)
        try {
            const res = await fetch(`/api/orders/${order.id}`, { method: 'DELETE', cache: 'no-store' })
            if (res.ok) window.location.reload()
            else { const d = await res.json(); alert(`실패: ${d.error}`) }
        } catch (e) {
            console.error(e)
            alert('삭제 오류')
        } finally {
            setLoading(false)
        }
    }

    const toggleTaxInvoice = async () => {
        if (!confirm(`세금계산서를 ${!taxInvoiceIssued ? '발급' : '미발급'}(으)로 변경하시겠습니까?`)) return
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
            } else alert('업데이트 실패')
        } catch (e) {
            console.error(e)
            alert('오류 발생')
        } finally {
            setLoading(false)
        }
    }

    // ── 파트너 뷰 ──
    if (isPartner) {
        return (
            <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                    {taxInvoiceIssued ? (
                        <span className="inline-block px-3 py-1 text-white text-xs font-bold rounded border border-red-800 bg-gradient-to-r from-red-800 via-red-500 to-red-800 shadow-sm">
                            세금계산서 발급완료
                        </span>
                    ) : (
                        <span className="px-3 py-1 rounded text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200">
                            세금계산서 발행중
                        </span>
                    )}
                    {status === 'PENDING' && (
                        <button onClick={() => deleteOrder()} disabled={loading}
                            className="bg-gray-600 text-white px-3 py-1 rounded text-xs hover:bg-gray-700 border border-gray-700 disabled:opacity-50">
                            {loading ? '삭제 중...' : '주문삭제'}
                        </button>
                    )}
                </div>
                {(status === 'DEPOSIT_COMPLETED' || status === 'SHIPPED') && (
                    <button onClick={() => router.push(`/invoice/${order.id}`)}
                        className="text-xs bg-[var(--color-brand-blue)] text-white px-3 py-1 rounded hover:opacity-90 flex items-center gap-2">
                        <span>📄</span> 거래명세표 확인
                    </button>
                )}
                {(status === 'DEPOSIT_COMPLETED' || status === 'SHIPPED') && order.trackingNumber && (
                    <div className="text-xs bg-white text-gray-800 px-3 py-1 rounded-lg border border-gray-200 font-medium shadow-sm">
                        <span className="font-bold mr-2">로젠택배</span>
                        <span className="text-[var(--color-brand-blue)]">송장번호 : <span className="font-bold">{order.trackingNumber}</span></span>
                    </div>
                )}
            </div>
        )
    }

    // ── 관리자 뷰 ──
    return (
        <div className="flex flex-col gap-3 w-full">
            {/* 배송 폼 */}
            <div className="flex gap-2 items-end">
                <div className="w-28 flex flex-col gap-0.5">
                    <label className="text-[10px] text-gray-400 ml-0.5">택배사</label>
                    <select
                        value={courier}
                        onChange={(e) => setCourier(e.target.value)}
                        disabled={!isEditingTracking && !!order.trackingNumber}
                        className="w-full appearance-none border border-gray-200 rounded-lg px-2.5 py-2 text-[11px] text-gray-800 font-bold bg-white outline-none focus:border-[#d9361b] transition-colors"
                    >
                        <option value="Rosen">로젠택배</option>
                    </select>
                </div>
                <div className="flex-1 flex flex-col gap-0.5">
                    <label className="text-[10px] text-gray-400 ml-0.5">송장번호</label>
                    <div className="flex gap-1.5">
                        <input
                            type="text"
                            value={trackingNumber}
                            onChange={(e) => setTrackingNumber(e.target.value)}
                            disabled={!isEditingTracking && !!order.trackingNumber}
                            placeholder="송장번호 입력"
                            className="flex-1 border border-gray-200 rounded-lg px-2.5 py-2 text-[11px] text-gray-800 font-bold bg-white outline-none focus:border-[#d9361b] transition-colors placeholder:text-gray-300"
                        />
                        {(!order.trackingNumber || isEditingTracking) ? (
                            <button onClick={saveShippingInfo} disabled={loading}
                                className="bg-[#d9361b] text-white px-3.5 rounded-lg font-bold text-[10px] hover:bg-[#c0301a] transition-colors disabled:opacity-50">
                                저장
                            </button>
                        ) : (
                            <button onClick={() => setIsEditingTracking(true)}
                                className="bg-gray-100 text-gray-600 px-3.5 rounded-lg font-bold text-[10px] hover:bg-gray-200 transition-colors">
                                수정
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* 액션 버튼 */}
            <div className="flex flex-col gap-1.5">
                {status === 'PENDING' ? (
                    <button onClick={() => updateStatus('DEPOSIT_COMPLETED')} disabled={loading}
                        className="w-full py-2.5 text-[11px] font-bold text-white rounded-lg flex gap-1.5 items-center justify-center bg-gray-800 hover:bg-gray-900 transition-colors disabled:opacity-50">
                        입금확인
                    </button>
                ) : status === 'DEPOSIT_COMPLETED' && !adminDepositConfirmedAt ? (
                    <button onClick={confirmAdminDeposit} disabled={loading}
                        className="w-full py-2.5 text-[11px] font-bold text-white rounded-lg flex gap-1.5 items-center justify-center bg-gray-800 hover:bg-gray-900 transition-colors disabled:opacity-50">
                        관리자 입금확인
                    </button>
                ) : null}

                <div className="grid grid-cols-2 gap-1.5">
                    {(status === 'PENDING' || status === 'DEPOSIT_COMPLETED' || status === 'SHIPPED' || status === 'APPROVED') && (
                        <button onClick={() => router.push(`/invoice/${order.id}`)}
                            className="py-2.5 text-[10px] font-bold text-white rounded-lg flex gap-1 items-center justify-center bg-gray-600 hover:bg-gray-700 transition-colors">
                            📄 거래명세표
                        </button>
                    )}
                    {(status === 'PENDING' || status === 'DEPOSIT_COMPLETED' || status === 'SHIPPED' || status === 'APPROVED') && (
                        <button onClick={toggleTaxInvoice} disabled={loading}
                            className={`py-2.5 text-[10px] font-bold text-white rounded-lg flex gap-1 items-center justify-center transition-colors disabled:opacity-50 ${taxInvoiceIssued ? 'bg-gray-400 hover:bg-gray-500' : 'bg-[#d9361b] hover:bg-[#c0301a]'}`}>
                            📋 {taxInvoiceIssued ? '계산서 취소' : '세금계산서'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
