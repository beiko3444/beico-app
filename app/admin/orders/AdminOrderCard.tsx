'use client'

import React, { useState } from 'react'
import OrderActions from '@/components/OrderActions'
import { Copy, Check, Package, Truck, Phone, Mail, Building2, User, FileText } from 'lucide-react'

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
                                ${isDone ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/30 dark:shadow-none' :
                                    isCurrent ? 'bg-white dark:bg-[#1e1e1e] text-orange-600 dark:text-orange-400 border-[2.5px] border-orange-500 shadow-sm dark:shadow-none' :
                                        'bg-gray-50 dark:bg-[#1a1a1a] text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-[#2a2a2a]'}
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
                                ${isDone ? 'text-orange-600 dark:text-orange-400' :
                                    isCurrent ? 'text-gray-900 dark:text-white' :
                                        'text-gray-400 dark:text-gray-500'}
                            `}>
                                {step.label}
                            </span>
                        </div>
                        {index < steps.length - 1 && (
                            <div className={`flex-1 h-[2px] mx-1 mb-4 ${index < currentIndex ? 'bg-orange-400' : 'bg-gray-100 dark:bg-[#2a2a2a]'}`} />
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
        <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-gray-100 dark:border-[#2a2a2a] shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:shadow-none overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 bg-gray-50/50 dark:bg-[#1a1a1a] border-b border-gray-100 dark:border-[#2a2a2a]">
                <span className="text-gray-400 dark:text-gray-500">{icon}</span>
                <span className="text-[12px] font-bold text-gray-700 dark:text-gray-200 tracking-tight">{title}</span>
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
        <div className="flex items-center justify-between py-2.5 border-b border-gray-200 dark:border-[#2a2a2a] last:border-0 hover:bg-gray-50 dark:hover:bg-[#252525] transition-colors -mx-5 px-5">
            <span className="text-[11px] text-gray-500 dark:text-gray-400 shrink-0 w-24 font-medium">{label}</span>
            {copyable && onCopy && copyKey ? (
                <button
                    onClick={() => onCopy(value, copyKey)}
                    className="flex items-center gap-1.5 text-[12px] font-bold text-gray-800 dark:text-gray-200 hover:text-orange-500 transition-colors text-right"
                >
                    <span className="truncate max-w-[200px]">{value}</span>
                    {copiedField === copyKey
                        ? <Check size={12} className="text-emerald-500 shrink-0" />
                        : <Copy size={12} className="text-gray-300 dark:text-gray-500 shrink-0" />}
                </button>
            ) : (
                <span className="text-[12px] font-bold text-gray-800 dark:text-gray-200 text-right max-w-[230px] break-words">{value}</span>
            )}
        </div>
    )
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────
export default function AdminOrderCard({ order }: { order: any }) {
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
    const shippingTotal = shippingFee + shippingVat
    const grandSupply = productSupplyTotal + shippingFee
    const grandVat = Math.round(grandSupply * 0.1)
    const totalAmount = grandSupply + grandVat

    const gradeStyle: Record<string, { bg: string; text: string }> = {
        'A': { bg: 'bg-emerald-100 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-400' },
        'B': { bg: 'bg-blue-100 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-400' },
        'C': { bg: 'bg-amber-100 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400' },
        'D': { bg: 'bg-gray-100 dark:bg-[#2a2a2a]', text: 'text-gray-600 dark:text-gray-400' },
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

    const depositConfirmedAt = formatTimestamp(order.depositConfirmedAt)
    const adminDepositConfirmedAt = formatTimestamp(order.adminDepositConfirmedAt)
    const currentStepLabel = order.taxInvoiceIssued
        ? '계산서 완료'
        : order.trackingNumber || order.status === 'SHIPPED'
            ? '발송완료'
            : order.status === 'DEPOSIT_COMPLETED'
                ? '입금확인'
                : order.status === 'PENDING' || order.status === 'APPROVED'
                    ? '입금대기'
                    : '주문접수'
    const currentStepClass = order.taxInvoiceIssued
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800'
        : order.trackingNumber || order.status === 'SHIPPED'
            ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
            : order.status === 'DEPOSIT_COMPLETED'
                ? 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-[#252525] dark:text-gray-200 dark:border-[#2f2f2f]'
                : 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800'
    const summaryItems = [
        { label: '총 수량', value: `${totalQuantity.toLocaleString()}개` },
        { label: '상품 공급가', value: `${productSupplyTotal.toLocaleString()}원` },
        { label: '배송비', value: `${shippingFee.toLocaleString()}원` },
        { label: '부가세', value: `${grandVat.toLocaleString()}원` },
    ]

    return (
        <div className="relative w-full max-w-[1680px] mx-auto font-sans">
            <div className={`space-y-4 rounded-3xl ${order.taxInvoiceIssued ? 'bg-emerald-50/50 dark:bg-emerald-900/10 p-3 -m-3 border border-emerald-100 dark:border-emerald-800 shadow-[inset_0_2px_10px_rgba(16,185,129,0.05)] dark:shadow-none' : ''}`}>
                {/* ── 헤더 카드 (완전 라이트 테마) ── */}
                <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-gray-200 dark:border-[#2a2a2a] shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-none overflow-hidden">
                    <div className="px-6 pt-5 pb-4">
                        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)] xl:items-start">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${grade.bg} ${grade.text}`}>
                                        {partnerGrade} 등급
                                    </span>
                                    {order.taxInvoiceIssued ? (
                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800">
                                            ✅ 계산서 완료
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-800">
                                            ⚠️ 계산서 미발행
                                        </span>
                                    )}
                                </div>

                                <div className="flex flex-wrap items-end gap-x-3 gap-y-2 mt-1.5">
                                    <h2 className="text-[28px] font-black text-gray-900 dark:text-white tracking-tight flex items-baseline gap-1.5">
                                        <span className="text-gray-300 dark:text-gray-500 font-medium text-[22px]">#</span>{orderNumber}
                                    </h2>
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-[24px] font-bold text-gray-700 dark:text-gray-200 truncate">{partnerName}</span>
                                        <span className={`inline-flex items-center gap-1 border px-2.5 py-1 rounded-full text-[10px] font-black whitespace-nowrap ${currentStepClass}`}>
                                            주문 프로세스
                                            <span className="text-[11px]">{currentStepLabel}</span>
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                                    {formattedDate}
                                </div>

                                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                    <div className="rounded-xl border border-gray-100 dark:border-[#2a2a2a] bg-gray-50/70 dark:bg-[#181818] px-3 py-2.5">
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 dark:text-gray-400">
                                            <User size={12} />
                                            담당자
                                        </div>
                                        <div className="mt-1 text-[14px] font-bold text-gray-900 dark:text-white truncate">{representativeName}</div>
                                    </div>
                                    <div className="rounded-xl border border-gray-100 dark:border-[#2a2a2a] bg-gray-50/70 dark:bg-[#181818] px-3 py-2.5">
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 dark:text-gray-400">
                                            <Phone size={12} />
                                            연락처
                                        </div>
                                        <div className="mt-1 text-[14px] font-bold text-gray-900 dark:text-white truncate">{order.user.partnerProfile?.contact || '-'}</div>
                                    </div>
                                    <div className="rounded-xl border border-gray-100 dark:border-[#2a2a2a] bg-gray-50/70 dark:bg-[#181818] px-3 py-2.5 sm:col-span-2 xl:col-span-1">
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 dark:text-gray-400">
                                            <Mail size={12} />
                                            이메일
                                        </div>
                                        <div className="mt-1 text-[14px] font-bold text-gray-900 dark:text-white truncate">{order.user.partnerProfile?.email || '-'}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-gray-100 dark:border-[#2a2a2a] bg-gradient-to-br from-gray-50 to-white dark:from-[#181818] dark:to-[#141414] p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-[10px] font-black tracking-[0.18em] text-gray-400 dark:text-gray-500 uppercase">Order Summary</p>
                                        <h3 className="mt-1 text-[16px] font-black text-gray-900 dark:text-white">주문 프로세스 요약</h3>
                                    </div>
                                    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black whitespace-nowrap ${currentStepClass}`}>
                                        {currentStepLabel}
                                    </span>
                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-2.5">
                                    {summaryItems.map((item) => (
                                        <div key={item.label} className="rounded-xl border border-gray-100 dark:border-[#2a2a2a] bg-white/80 dark:bg-[#1e1e1e] px-3 py-2.5">
                                            <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500">{item.label}</div>
                                            <div className="mt-1 text-[14px] font-black text-gray-900 dark:text-white">{item.value}</div>
                                        </div>
                                    ))}
                                </div>

                                {(depositConfirmedAt || adminDepositConfirmedAt) && (
                                    <div className="mt-4 space-y-2 border-t border-gray-100 dark:border-[#2a2a2a] pt-4">
                                        {depositConfirmedAt && (
                                            <div className="flex items-center justify-between gap-3 text-[11px]">
                                                <span className="text-gray-500 dark:text-gray-400 font-medium">거래처 확인</span>
                                                <span className="font-bold text-gray-800 dark:text-gray-200">{depositConfirmedAt}</span>
                                            </div>
                                        )}
                                        {adminDepositConfirmedAt && (
                                            <div className="flex items-center justify-between gap-3 text-[11px]">
                                                <span className="text-gray-500 dark:text-gray-400 font-medium">관리자 확인</span>
                                                <span className="font-bold text-emerald-700 dark:text-emerald-400">{adminDepositConfirmedAt}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mt-5 pt-5 border-t border-gray-100 dark:border-[#2a2a2a]">
                            <ProgressSteps
                                status={order.status}
                                trackingNumber={order.trackingNumber}
                                taxInvoiceIssued={order.taxInvoiceIssued}
                            />
                        </div>
                    </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.72fr)] xl:items-start">
                    {/* ── 거래처 정보 ── */}
                    <Section title="거래처 정보" icon={<Building2 size={14} className="text-gray-400 dark:text-gray-500" />}>
                        <div className="flex flex-col relative z-10">
                            <InfoRow label="사업자번호" value={order.user.partnerProfile?.businessRegNumber || '-'} copyable copyKey="biz" copiedField={copiedField} onCopy={copyToClipboard} />
                            <InfoRow label="상호" value={partnerName} copyable copyKey="partnerName" copiedField={copiedField} onCopy={copyToClipboard} />
                            <InfoRow label="성명" value={representativeName} copyable copyKey="repName" copiedField={copiedField} onCopy={copyToClipboard} />
                            <InfoRow label="이메일" value={order.user.partnerProfile?.email || '-'} copyable copyKey="email" copiedField={copiedField} onCopy={copyToClipboard} />
                            <InfoRow label="연락처" value={order.user.partnerProfile?.contact || '-'} />
                            <InfoRow label="배송지" value={order.user.partnerProfile?.address || '-'} />
                        </div>
                    </Section>

                    <div className="space-y-4 xl:sticky xl:top-24 self-start">
                        {/* ── 배송 정보 + 액션 ── */}
                        <Section title="배송 처리" icon={<Truck size={14} className="text-gray-400 dark:text-gray-500" />}>
                            <div className="relative z-10">
                                <OrderActions order={order} />
                            </div>
                        </Section>

                        <Section title="결제 요약" icon={<FileText size={14} className="text-gray-400 dark:text-gray-500" />}>
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="rounded-xl border border-gray-100 dark:border-[#2a2a2a] bg-gray-50/80 dark:bg-[#181818] px-3 py-2.5">
                                        <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500">주문 상품</div>
                                        <div className="mt-1 text-[15px] font-black text-gray-900 dark:text-white">{order.items.length}종</div>
                                    </div>
                                    <div className="rounded-xl border border-gray-100 dark:border-[#2a2a2a] bg-gray-50/80 dark:bg-[#181818] px-3 py-2.5">
                                        <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500">총 수량</div>
                                        <div className="mt-1 text-[15px] font-black text-gray-900 dark:text-white">{totalQuantity.toLocaleString()}개</div>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-gray-100 dark:border-[#2a2a2a] bg-white dark:bg-[#1e1e1e] px-4 py-3">
                                    <div className="space-y-2.5 text-[12px]">
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-500 dark:text-gray-400 font-medium">상품 공급가</span>
                                            <span className="font-bold text-gray-800 dark:text-gray-200">{productSupplyTotal.toLocaleString()}원</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-500 dark:text-gray-400 font-medium">배송비</span>
                                            <span className="font-bold text-gray-800 dark:text-gray-200">{shippingFee.toLocaleString()}원</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-500 dark:text-gray-400 font-medium">배송비 VAT</span>
                                            <span className="font-bold text-gray-800 dark:text-gray-200">{shippingVat.toLocaleString()}원</span>
                                        </div>
                                        <div className="flex items-center justify-between border-t border-gray-100 dark:border-[#2a2a2a] pt-2.5">
                                            <span className="text-gray-500 dark:text-gray-400 font-medium">총 부가세</span>
                                            <span className="font-bold text-gray-800 dark:text-gray-200">{grandVat.toLocaleString()}원</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-orange-200/70 dark:border-orange-800 bg-gradient-to-r from-orange-50 to-orange-100/50 dark:from-orange-900/20 dark:to-orange-800/10 px-4 py-4">
                                    <p className="text-[11px] font-black text-orange-600 dark:text-orange-400">최종 결제금액</p>
                                    <p className="mt-1 text-[10px] text-orange-500/80 dark:text-orange-400/60 font-medium">모든 세금 포함</p>
                                    <div className="mt-3 flex items-end justify-between gap-3">
                                        <div>
                                            <div className="text-[11px] text-orange-500/80 dark:text-orange-400/70 font-medium">공급가 {grandSupply.toLocaleString()}원 + VAT {grandVat.toLocaleString()}원</div>
                                        </div>
                                        <div className="text-right flex items-baseline gap-1">
                                            <span className="text-[34px] font-black text-orange-600 dark:text-orange-400 leading-none">{totalAmount.toLocaleString()}</span>
                                            <span className="text-[14px] font-bold text-orange-500 dark:text-orange-400">원</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Section>
                    </div>
                </div>

                <Section title={`주문 상품 (총 ${totalQuantity.toLocaleString()}개)`} icon={<Package size={14} className="text-gray-400 dark:text-gray-500" />}>
                    <div className="flex flex-col relative z-10">
                        {order.items.map((item: any) => {
                            const supplyPrice = item.price * item.quantity
                            const vat = Math.round(supplyPrice * 0.1)
                            const lineTotal = supplyPrice + vat
                            return (
                                <div key={item.id} className="grid gap-3 py-3 border-b border-gray-100 dark:border-[#2a2a2a] last:border-b-0 md:grid-cols-[72px_minmax(0,1fr)_220px] md:items-center">
                                    <div className="w-[72px] h-[72px] rounded-2xl bg-gray-50 dark:bg-[#1a1a1a] shrink-0 overflow-hidden border border-gray-100 dark:border-[#2a2a2a] flex items-center justify-center">
                                        {item.product.imageUrl ? (
                                            <img src={item.product.imageUrl} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <Package size={24} className="text-gray-300 dark:text-gray-500" />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex flex-col justify-center">
                                        <button
                                            onClick={() => copyToClipboard(item.product.name, `prodName-${item.id}`)}
                                            className="flex items-center gap-1.5 text-[15px] font-bold text-gray-900 dark:text-white hover:text-orange-500 transition-colors text-left w-full"
                                        >
                                            <span className="truncate">{item.product.name}</span>
                                            {copiedField === `prodName-${item.id}`
                                                ? <Check size={12} className="text-emerald-500 shrink-0" />
                                                : <Copy size={12} className="text-gray-300 dark:text-gray-500 shrink-0" />}
                                        </button>
                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                            <span className="inline-flex items-center justify-center bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 text-[11px] font-black px-2.5 py-1 rounded-md border border-orange-100 dark:border-orange-800">
                                                {item.quantity.toLocaleString()}개
                                            </span>
                                            <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                                단가 <strong className="text-gray-700 dark:text-gray-200">{item.price.toLocaleString()}원</strong>
                                            </span>
                                            <span className="text-[11px] text-gray-400 dark:text-gray-500">
                                                공급가 {supplyPrice.toLocaleString()}원
                                            </span>
                                        </div>
                                    </div>
                                    <div className="rounded-2xl border border-gray-100 dark:border-[#2a2a2a] bg-gray-50/80 dark:bg-[#181818] px-4 py-3 text-left md:text-right">
                                        <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500">상품 결제 금액</div>
                                        <div className="mt-1 text-[20px] font-black text-gray-900 dark:text-white">{lineTotal.toLocaleString()}<span className="ml-1 text-[11px] font-bold text-gray-500 dark:text-gray-400">원</span></div>
                                        <div className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">공급가 {supplyPrice.toLocaleString()}원 + VAT {vat.toLocaleString()}원</div>
                                    </div>
                                </div>
                            )
                        })}

                        {shippingFee > 0 && (
                            <div className="mt-2 flex flex-col gap-2 rounded-2xl border border-gray-100 dark:border-[#2a2a2a] bg-gray-50/60 dark:bg-[#181818] px-4 py-4 md:flex-row md:items-center md:justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-white dark:bg-[#1e1e1e] shadow-sm dark:shadow-none border border-gray-100 dark:border-[#2a2a2a] flex items-center justify-center">
                                        <Truck size={16} className="text-gray-400 dark:text-gray-500" />
                                    </div>
                                    <div>
                                        <div className="text-[12px] font-bold text-gray-800 dark:text-gray-200">배송비</div>
                                        <div className="text-[10px] text-gray-500 dark:text-gray-400">기본 배송 {shippingFee.toLocaleString()}원 + VAT {shippingVat.toLocaleString()}원</div>
                                    </div>
                                </div>
                                <div className="text-left md:text-right">
                                    <div className="text-[18px] font-black text-gray-900 dark:text-white">{shippingTotal.toLocaleString()}<span className="ml-1 text-[11px] font-bold text-gray-500 dark:text-gray-400">원</span></div>
                                    <div className="text-[10px] text-gray-400 dark:text-gray-500">VAT 포함</div>
                                </div>
                            </div>
                        )}
                    </div>
                </Section>
            </div>
        </div>
    )
}
