'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

function splitAddress(fullAddress: string): { main: string; detail: string } {
    const match = fullAddress.match(/^(.+[로길]\s+\d+(?:-\d+)?)\s*(.*)$/)
    if (match) return { main: match[1].trim(), detail: match[2].trim() }
    return { main: fullAddress, detail: '' }
}

export default function OrderActions({ order, isPartner = false }: { order: any, isPartner?: boolean }) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [status, setStatus] = useState(order.status)
    const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber || '')
    const [taxInvoiceIssued, setTaxInvoiceIssued] = useState(order.taxInvoiceIssued || false)
    const [adminDepositConfirmedAt, setAdminDepositConfirmedAt] = useState(order.adminDepositConfirmedAt)
    const [courier, setCourier] = useState(order.courier || 'Rosen')
    const [isEditingTracking, setIsEditingTracking] = useState(false)

    // 로젠 송장출력
    const [showLogenForm, setShowLogenForm] = useState(false)
    const [logenLoading, setLogenLoading] = useState(false)
    const [logenError, setLogenError] = useState<string | null>(null)
    const [logenTrackingNumber, setLogenTrackingNumber] = useState<string | null>(null)
    const [logenStep, setLogenStep] = useState<string | null>(null)
    const partnerAddress = order.user?.partnerProfile?.address || ''
    const { main: defaultMainAddr, detail: defaultDetailAddr } = splitAddress(partnerAddress)
    const [logenPhone, setLogenPhone] = useState(order.user?.partnerProfile?.contact || '')
    const [logenName, setLogenName] = useState(order.user?.partnerProfile?.businessName || order.user?.name || '')
    const [logenAddress, setLogenAddress] = useState(defaultMainAddr)
    const [logenDetailAddress, setLogenDetailAddress] = useState(defaultDetailAddr)

    const submitLogenShipping = async () => {
        setLogenLoading(true)
        setLogenError(null)
        setLogenTrackingNumber(null)
        setLogenStep(null)
        try {
            const res = await fetch('/api/admin/worm-order/logen-shipping', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipientPhone: logenPhone,
                    recipientName: logenName,
                    recipientAddress: logenAddress,
                    recipientDetailAddress: logenDetailAddress,
                }),
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({ error: '송장 출력 실패' }))
                setLogenError(data.error || '송장 출력 실패')
                return
            }

            // SSE stream
            const reader = res.body?.getReader()
            if (!reader) { setLogenError('스트림 연결 실패'); return }

            const decoder = new TextDecoder()
            let buffer = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                let currentEvent = ''
                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        currentEvent = line.slice(7).trim()
                    } else if (line.startsWith('data: ')) {
                        const data = JSON.parse(line.slice(6))
                        if (currentEvent === 'step') {
                            setLogenStep(data.step)
                        } else if (currentEvent === 'done') {
                            setLogenTrackingNumber(data.trackingNumber)
                            setLogenStep('완료!')
                            if (data.trackingNumber && !trackingNumber) {
                                await fetch(`/api/orders/${order.id}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ trackingNumber: data.trackingNumber, courier: 'Rosen', status: 'SHIPPED' }),
                                })
                                setTrackingNumber(data.trackingNumber)
                                setStatus('SHIPPED')
                                router.refresh()
                            }
                        } else if (currentEvent === 'error') {
                            setLogenError(data.error)
                        }
                    }
                }
            }
        } catch (e) {
            setLogenError('통신 오류가 발생했습니다.')
        } finally {
            setLogenLoading(false)
        }
    }

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

    const issueTaxInvoiceAPI = async () => {
        if (taxInvoiceIssued) {
            // 이미 발급된 경우: 상태만 토글 (취소)
            if (!confirm('세금계산서 발급 상태를 미발급으로 변경하시겠습니까?\n(바로빌에서 발급된 계산서는 별도로 취소해야 합니다)')) return
            setLoading(true)
            try {
                const res = await fetch(`/api/orders/${order.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ taxInvoiceIssued: false })
                })
                if (res.ok) {
                    setTaxInvoiceIssued(false)
                    router.refresh()
                } else alert('업데이트 실패')
            } catch (e) {
                console.error(e)
                alert('오류 발생')
            } finally {
                setLoading(false)
            }
            return
        }

        // 미발급 → 바로빌 API로 발급
        if (!confirm('바로빌을 통해 전자세금계산서를 발급하시겠습니까?\n\n발급 후에는 국세청에 전송됩니다.')) return
        setLoading(true)
        try {
            const res = await fetch('/api/admin/tax-invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: order.id })
            })
            const data = await res.json()
            if (res.ok && data.success) {
                setTaxInvoiceIssued(true)
                alert(`✅ 세금계산서 발급 완료\n관리번호: ${data.mgtKey}`)
                router.refresh()
            } else {
                const debugInfo = data.debug ? `\nCERTKEY 로드: ${data.debug.certkeyLoaded}, 접두사: ${data.debug.certkeyPrefix}\nCorpNum: ${data.debug.corpNum}, ContactID: ${data.debug.contactId}` : ''
                alert(`❌ 발급 실패\n${data.error || '알 수 없는 오류'}${debugInfo}`)
            }
        } catch (e) {
            console.error(e)
            alert('세금계산서 발급 중 통신 오류가 발생했습니다.')
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
                        <span className="px-3 py-1 rounded text-xs font-bold bg-gray-100 dark:bg-[#2a2a2a] text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-[#2a2a2a]">
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
                    <div className="text-xs bg-white dark:bg-[#1e1e1e] text-gray-800 dark:text-gray-200 px-3 py-1 rounded-lg border border-gray-200 dark:border-[#2a2a2a] font-medium shadow-sm dark:shadow-none">
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
                    <label className="text-[10px] text-gray-400 dark:text-gray-500 ml-0.5">택배사</label>
                    <select
                        value={courier}
                        onChange={(e) => setCourier(e.target.value)}
                        disabled={!isEditingTracking && !!order.trackingNumber}
                        className="w-full appearance-none border border-gray-200 dark:border-[#2a2a2a] rounded-lg px-2.5 py-2 text-[11px] text-gray-800 dark:text-gray-200 font-bold bg-white dark:bg-[#1e1e1e] outline-none focus:border-[#d9361b] transition-colors"
                    >
                        <option value="Rosen">로젠택배</option>
                    </select>
                </div>
                <div className="flex-1 flex flex-col gap-0.5">
                    <label className="text-[10px] text-gray-400 dark:text-gray-500 ml-0.5">송장번호</label>
                    <div className="flex gap-1.5">
                        <input
                            type="text"
                            value={trackingNumber}
                            onChange={(e) => setTrackingNumber(e.target.value)}
                            disabled={!isEditingTracking && !!order.trackingNumber}
                            placeholder="송장번호 입력"
                            className="flex-1 border border-gray-200 dark:border-[#2a2a2a] rounded-lg px-2.5 py-2 text-[11px] text-gray-800 dark:text-gray-200 font-bold bg-white dark:bg-[#1e1e1e] outline-none focus:border-[#d9361b] transition-colors placeholder:text-gray-300 dark:placeholder:text-gray-500"
                        />
                        {(!order.trackingNumber || isEditingTracking) ? (
                            <button onClick={saveShippingInfo} disabled={loading}
                                className="bg-[#d9361b] text-white px-3.5 rounded-lg font-bold text-[10px] hover:bg-[#c0301a] transition-colors disabled:opacity-50">
                                저장
                            </button>
                        ) : (
                            <button onClick={() => setIsEditingTracking(true)}
                                className="bg-gray-100 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-400 px-3.5 rounded-lg font-bold text-[10px] hover:bg-gray-200 dark:hover:bg-[#252525] transition-colors">
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
                        taxInvoiceIssued ? (
                            <button disabled className="py-2.5 text-[10px] font-bold text-white rounded-lg flex gap-1 items-center justify-center bg-gray-400 cursor-not-allowed">
                                ✅ 발급완료
                            </button>
                        ) : (
                            <button onClick={issueTaxInvoiceAPI} disabled={loading}
                                className="py-2.5 text-[10px] font-bold text-white rounded-lg flex gap-1 items-center justify-center transition-colors disabled:opacity-50 bg-[#d9361b] hover:bg-[#c0301a]">
                                📋 세금계산서
                            </button>
                        )
                    )}
                </div>

                {/* 로젠 송장출력 */}
                <button
                    onClick={() => { setShowLogenForm(v => !v); setLogenError(null); setLogenTrackingNumber(null) }}
                    className="w-full py-2.5 text-[10px] font-bold text-white rounded-lg flex gap-1 items-center justify-center bg-blue-600 hover:bg-blue-700 transition-colors"
                >
                    🚚 로젠 송장출력
                </button>

                {showLogenForm && (
                    <div className="mt-1 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl flex flex-col gap-2">
                        <div className="flex flex-col gap-0.5">
                            <label className="text-[10px] text-gray-500 dark:text-gray-400 font-bold">수하인 전화번호</label>
                            <input type="text" value={logenPhone} onChange={e => setLogenPhone(e.target.value)}
                                className="border border-gray-200 dark:border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-[11px] text-gray-800 dark:text-gray-200 bg-white dark:bg-[#1e1e1e] outline-none focus:border-blue-400" />
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <label className="text-[10px] text-gray-500 dark:text-gray-400 font-bold">수하인명 (업체명)</label>
                            <input type="text" value={logenName} onChange={e => setLogenName(e.target.value)}
                                className="border border-gray-200 dark:border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-[11px] text-gray-800 dark:text-gray-200 bg-white dark:bg-[#1e1e1e] outline-none focus:border-blue-400" />
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <label className="text-[10px] text-gray-500 dark:text-gray-400 font-bold">주소 (검색용)</label>
                            <input type="text" value={logenAddress} onChange={e => setLogenAddress(e.target.value)}
                                className="border border-gray-200 dark:border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-[11px] text-gray-800 dark:text-gray-200 bg-white dark:bg-[#1e1e1e] outline-none focus:border-blue-400" />
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <label className="text-[10px] text-gray-500 dark:text-gray-400 font-bold">상세주소</label>
                            <input type="text" value={logenDetailAddress} onChange={e => setLogenDetailAddress(e.target.value)}
                                className="border border-gray-200 dark:border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-[11px] text-gray-800 dark:text-gray-200 bg-white dark:bg-[#1e1e1e] outline-none focus:border-blue-400" />
                        </div>
                        {logenError && (
                            <p className="text-[10px] text-red-600 font-bold">{logenError}</p>
                        )}
                        {logenTrackingNumber && (
                            <p className="text-[11px] text-blue-700 font-bold">✅ 송장번호: {logenTrackingNumber}</p>
                        )}
                        {logenLoading && logenStep && (
                            <div className="flex items-center gap-2 px-2 py-1.5 bg-blue-100 border border-blue-200 rounded-lg">
                                <Loader2 size={12} className="animate-spin text-blue-600 shrink-0" />
                                <span className="text-[10px] font-bold text-blue-700">{logenStep}</span>
                            </div>
                        )}
                        <button
                            onClick={submitLogenShipping}
                            disabled={logenLoading}
                            className="w-full py-2 text-[11px] font-bold text-white rounded-lg flex gap-1.5 items-center justify-center bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-60"
                        >
                            {logenLoading ? (
                                <><Loader2 size={12} className="animate-spin" /> 자동화 진행 중...</>
                            ) : '송장 출력 실행'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
