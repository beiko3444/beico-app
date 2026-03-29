'use client'

import React, { useState } from 'react'
import OrderActions from '@/components/OrderActions'
import { Trash2, Copy, Check, Package, Truck, MapPin, Phone, Mail, Building2, User, Hash, FileText, ChevronRight } from 'lucide-react'

// ── 진행 단계 컴포넌트 (라이트 테마 통합형) ──────────────────────────────
function ProgressSteps({ status, trackingNumber, taxInvoiceIssued }: {
    status: string;
    trackingNumber?: string | null;
    taxInvoiceIssued?: boolean;
}) {
    const steps = [
        { label: '주문접수', key: 'ORDERED' },
        { label: '입금대기', key: 'PENDING_DEPOSIT' },
        { label: '입금확인', key: 'DEPOSIT_COMPLETED' },
        { label: '발송완료', key: 'SHIPPED' },
        { label: '계산서', key: 'INVOICED' },
    ]

    const getCurrentStepIndex = () => {
        if (taxInvoiceIssued) return 4
        if (trackingNumber || status === 'SHIPPED') return 3
        if (status === 'DEPOSIT_COMPLETED') return 2
        if (status === 'PENDING' || status === 'APPROVED') return 1
        return 0
    }

    const currentIndex = getCurrentStepIndex()

    return (
        <div className="flex items-center gap-0 mt-2 px-1">
            {steps.map((step, index) => {
                const isDone = index < currentIndex
                const isCurrent = index === currentIndex

                return (
                    <React.Fragment key={step.key}>
                        <div className="flex flex-col items-center">
                            <div className={`
                                w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black transition-all z-10
                                ${isDone ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/30' :
                                    isCurrent ? 'bg-white text-orange-600 border-[2.5px] border-orange-500 shadow-sm' :
                                        'bg-gray-50 text-gray-400 border border-gray-200'}
                            `}>
                                {isDone ? (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : (
                                    <span>{index + 1}</span>
                                )}
                            </div>
                            <span className={`text-[9px] mt-1.5 font-bold whitespace-nowrap
                                ${isDone ? 'text-orange-600' :
                                    isCurrent ? 'text-gray-900' :
                                        'text-gray-400'}
                            `}>
                                {step.label}
                            </span>
                        </div>
                        {index < steps.length - 1 && (
                            <div className={`flex-1 h-[2px] mx-1 mb-4 ${index < currentIndex ? 'bg-orange-400' : 'bg-gray-100'}`} />
                        )}
                    </React.Fragment>
                )
            })}
        </div>
    )
}

// ── 섹션 래퍼 ──────────────────────────────────────────────────────
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 bg-gray-50/50 border-b border-gray-100">
                <span className="text-gray-400">{icon}</span>
                <span className="text-[12px] font-bold text-gray-700 tracking-tight">{title}</span>
            </div>
            <div className="px-5 py-4">
                {children}
            </div>
        </div>
    )
}

// ── 정보 행 ────────────────────────────────────────────────────────
function InfoRow({ label, value, copyable, copyKey, copiedField, onCopy }: {
    label: string
    value: string
    copyable?: boolean
    copyKey?: string
    copiedField?: string | null
    onCopy?: (text: string, key: string) => void
}) {
    if (!value || value === '-') return null

    return (
        <div className="flex items-center justify-between py-2.5 border-b border-gray-200 last:border-0 hover:bg-gray-50 transition-colors -mx-5 px-5">
            <span className="text-[11px] text-gray-500 shrink-0 w-24 font-medium">{label}</span>
            {copyable && onCopy && copyKey ? (
                <button
                    onClick={() => onCopy(value, copyKey)}
                    className="flex items-center gap-1.5 text-[12px] font-bold text-gray-800 hover:text-orange-500 transition-colors text-right"
                >
                    <span className="truncate max-w-[200px]">{value}</span>
                    {copiedField === copyKey
                        ? <Check size={12} className="text-emerald-500 shrink-0" />
                        : <Copy size={12} className="text-gray-300 shrink-0" />}
                </button>
            ) : (
                <span className="text-[12px] font-bold text-gray-800 text-right max-w-[230px] break-words">{value}</span>
            )}
        </div>
    )
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────
export default function AdminOrderCard({ order }: { order: any }) {
    const [isDeleting, setIsDeleting] = useState(false)
    const [copiedField, setCopiedField] = useState<string | null>(null)

    const date = new Date(order.createdAt)
    const orderNumber = order.orderNumber || order.id.slice(0, 8)
    const partnerName = order.user.partnerProfile?.businessName || order.user.name || '-'
    const representativeName = order.user.partnerProfile?.representativeName || '-'
    const partnerGrade = order.user.partnerProfile?.grade || 'C'

    const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`

    const productSupplyTotal = order.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0)
    const totalQuantity = order.items.reduce((sum: number, item: any) => sum + item.quantity, 0)
    const shippingFee = totalQuantity > 0 ? Math.ceil(totalQuantity / 100) * 3000 : 0
    const shippingVat = Math.round(shippingFee * 0.1)
    const grandSupply = productSupplyTotal + shippingFee
    const grandVat = Math.round(grandSupply * 0.1)
    const totalAmount = grandSupply + grandVat

    const gradeStyle: Record<string, { bg: string; text: string }> = {
        'A': { bg: 'bg-emerald-100', text: 'text-emerald-700' },
        'B': { bg: 'bg-blue-100', text: 'text-blue-700' },
        'C': { bg: 'bg-amber-100', text: 'text-amber-700' },
        'D': { bg: 'bg-gray-100', text: 'text-gray-600' },
    }
    const grade = gradeStyle[partnerGrade] || gradeStyle['C']

    const formatTimestamp = (ts: string | null) => {
        if (!ts) return null
        const d = new Date(ts)
        return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    }

    const copyToClipboard = (text: string, field: string) => {
        if (!text || text === '-') return
        navigator.clipboard.writeText(text)
        setCopiedField(field)
        setTimeout(() => setCopiedField(null), 1500)
    }

    const handleDelete = async () => {
        if (!confirm('정말로 이 주문을 삭제하시겠습니까? 삭제 시 재고가 복구됩니다.')) return
        setIsDeleting(true)
        try {
            const res = await fetch(`/api/orders/${order.id}`, { method: 'DELETE' })
            if (!res.ok) { const e = await res.json(); throw new Error(e.error || '오류') }
            alert('삭제 완료'); window.location.reload()
        } catch (error: any) { alert(error.message); setIsDeleting(false) }
    }

    const depositConfirmedAt = formatTimestamp(order.depositConfirmedAt)
    const adminDepositConfirmedAt = formatTimestamp(order.adminDepositConfirmedAt)

    return (
        <div className={`w-full max-w-[480px] mx-auto space-y-4 font-sans transition-opacity duration-300 ${order.taxInvoiceIssued ? 'opacity-60 saturate-[.60] hover:opacity-100 hover:saturate-100' : ''}`}>

            {/* ── 헤더 카드 (완전 라이트 테마) ── */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-[0_4px_20px_rgba(0,0,0,0.04)] overflow-hidden">
                <div className="px-6 pt-5 pb-4">
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${grade.bg} ${grade.text}`}>
                                    {partnerGrade} 등급
                                </span>
                                {order.taxInvoiceIssued ? (
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-100">
                                        ✅ 계산서 완료
                                    </span>
                                ) : (
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-orange-50 text-orange-600 border border-orange-100">
                                        ⚠️ 계산서 미발행
                                    </span>
                                )}
                            </div>
                            <div className="flex items-baseline gap-3 mt-1.5 flex-wrap">
                                <h2 className="text-[24px] font-black text-gray-900 tracking-tight flex items-baseline gap-1.5">
                                    <span className="text-gray-300 font-medium text-[20px]">#</span>{orderNumber}
                                </h2>
                                <span className="text-[20px] font-bold text-gray-700">{partnerName}</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-gray-500 font-medium">
                                <span>{formattedDate}</span>
                            </div>
                        </div>
                        <button
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                        >
                            <Trash2 size={15} />
                        </button>
                    </div>

                    <div className="mt-5 pt-5 border-t border-gray-100">
                        <ProgressSteps
                            status={order.status}
                            trackingNumber={order.trackingNumber}
                            taxInvoiceIssued={order.taxInvoiceIssued}
                        />
                    </div>
                </div>
            </div>

            {/* ── 거래처 정보 ── */}
            <Section title="거래처 정보" icon={<Building2 size={14} className="text-gray-400" />}>
                <div className="flex flex-col">
                    <InfoRow label="사업자번호" value={order.user.partnerProfile?.businessRegNumber || '-'} copyable copyKey="biz" copiedField={copiedField} onCopy={copyToClipboard} />
                    <InfoRow label="상호" value={partnerName} copyable copyKey="partnerName" copiedField={copiedField} onCopy={copyToClipboard} />
                    <InfoRow label="성명" value={representativeName} copyable copyKey="repName" copiedField={copiedField} onCopy={copyToClipboard} />
                    <InfoRow label="이메일" value={order.user.partnerProfile?.email || '-'} copyable copyKey="email" copiedField={copiedField} onCopy={copyToClipboard} />
                    <InfoRow label="연락처" value={order.user.partnerProfile?.contact || '-'} />
                    <InfoRow label="배송지" value={order.user.partnerProfile?.address || '-'} />
                </div>
            </Section>

            {/* ── 배송 정보 + 액션 ── */}
            <Section title="배송 처리" icon={<Truck size={14} className="text-gray-400" />}>
                <div className="mb-3">
                    <OrderActions order={order} />
                </div>
                {(depositConfirmedAt || adminDepositConfirmedAt) && (
                    <div className="pt-3 border-t border-gray-100 flex flex-wrap gap-x-4 gap-y-2">
                        {depositConfirmedAt && (
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] text-gray-500 font-medium">거래처 확인</span>
                                <span className="text-[11px] font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded flex items-center gap-1">
                                    <Check size={10} /> {depositConfirmedAt}
                                </span>
                            </div>
                        )}
                        {adminDepositConfirmedAt && (
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] text-gray-500 font-medium">관리자 확인</span>
                                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1">
                                    <Check size={10} /> {adminDepositConfirmedAt}
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </Section>

            {/* ── 주문 상품 ── */}
            <Section title={`주문 상품 (총 ${totalQuantity.toLocaleString()}개)`} icon={<Package size={14} className="text-gray-400" />}>
                <div className="flex flex-col">
                    {order.items.map((item: any) => {
                        const supplyPrice = item.price * item.quantity
                        const vat = Math.round(supplyPrice * 0.1)
                        const lineTotal = supplyPrice + vat
                        return (
                            <div key={item.id} className="flex gap-4 py-3 border-b border-gray-100 last:border-b-0">
                                {/* 상품 이미지 */}
                                <div className="w-14 h-14 rounded-xl bg-gray-50 shrink-0 overflow-hidden border border-gray-100 flex items-center justify-center">
                                    {item.product.imageUrl ? (
                                        <img src={item.product.imageUrl} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <Package size={20} className="text-gray-300" />
                                    )}
                                </div>
                                {/* 상품 정보 */}
                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                    <button
                                        onClick={() => copyToClipboard(item.product.name, `prodName-${item.id}`)}
                                        className="flex items-center gap-1.5 text-[14px] font-bold text-gray-900 hover:text-orange-500 transition-colors text-left w-full"
                                    >
                                        <span className="truncate">{item.product.name}</span>
                                        {copiedField === `prodName-${item.id}`
                                            ? <Check size={12} className="text-emerald-500 shrink-0" />
                                            : <Copy size={12} className="text-gray-300 shrink-0" />}
                                    </button>
                                    <div className="mt-1.5 flex items-center gap-2">
                                        <span className="inline-flex items-center justify-center bg-orange-50 text-orange-600 text-[11px] font-black px-2 py-0.5 rounded-md border border-orange-100">
                                            {item.quantity.toLocaleString()}개
                                        </span>
                                        <span className="text-[11px] text-gray-500">
                                            단가 <strong className="text-gray-700">{item.price.toLocaleString()}원</strong>
                                        </span>
                                    </div>
                                </div>
                                {/* 소계 */}
                                <div className="text-right shrink-0 self-center">
                                    <div className="text-[14px] font-black text-gray-900">{lineTotal.toLocaleString()}<span className="text-[10px] text-gray-500 font-medium ml-0.5">원</span></div>
                                    <div className="text-[10px] text-gray-400 mt-0.5">+ VAT 포함</div>
                                </div>
                            </div>
                        )
                    })}

                    {/* 배송비 */}
                    {shippingFee > 0 && (
                        <div className="flex items-center justify-between py-3 border-b border-gray-100 -mx-5 px-5 bg-gray-50/50">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center">
                                    <Truck size={14} className="text-gray-400" />
                                </div>
                                <div>
                                    <span className="text-[12px] font-bold text-gray-800">배송비</span>
                                    <span className="text-[10px] text-gray-500 ml-1.5">(VAT 포함)</span>
                                </div>
                            </div>
                            <span className="text-[14px] font-black text-gray-900">{shippingFee.toLocaleString()}<span className="text-[10px] text-gray-500 font-medium ml-0.5">원</span></span>
                        </div>
                    )}
                </div>

                {/* ── 최종 합계 ── */}
                <div className="mt-4 pt-4 border-t-2 border-gray-100">
                    <div className="flex flex-col gap-2 mb-4">
                        <div className="flex items-center justify-between">
                            <span className="text-[12px] text-gray-500 font-medium">공급가액</span>
                            <span className="text-[13px] font-bold text-gray-700">{grandSupply.toLocaleString()}원</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[12px] text-gray-500 font-medium">부가세 (10%)</span>
                            <span className="text-[13px] font-bold text-gray-700">{grandVat.toLocaleString()}원</span>
                        </div>
                    </div>
                    
                    <div className="flex items-center justify-between bg-gradient-to-r from-orange-50 to-orange-100/50 rounded-xl p-4 border border-orange-200/60 shadow-[inset_0_1px_2px_rgba(255,255,255,0.5)]">
                        <div>
                            <p className="text-[12px] text-orange-600 font-black">최종 결제금액</p>
                            <p className="text-[10px] text-orange-500/80 font-medium mt-0.5 tracking-tight">모든 세금 포함</p>
                        </div>
                        <div className="text-right flex items-baseline gap-0.5">
                            <span className="text-[28px] font-black text-orange-600 tracking-tight leading-none">
                                {totalAmount.toLocaleString()}
                            </span>
                            <span className="text-[14px] font-bold text-orange-500">원</span>
                        </div>
                    </div>
                </div>
            </Section>
        </div>
    )
}
