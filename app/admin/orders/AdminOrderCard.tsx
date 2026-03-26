'use client'

import React, { useState } from 'react'
import OrderActions from '@/components/OrderActions'
import OrderStatus from '@/components/OrderStatus'
import { Trash2, FileText, AlertTriangle, Copy, Check, Clock, Building2, Truck } from 'lucide-react'

export default function AdminOrderCard({ order }: { order: any }) {
    const [isDeleting, setIsDeleting] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [showInvoiceInfo, setShowInvoiceInfo] = useState(!order.taxInvoiceIssued);

    const date = new Date(order.createdAt)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const ampm = date.getHours() >= 12 ? '오후' : '오전'
    let hour = date.getHours() % 12
    if (hour === 0) hour = 12
    const minute = String(date.getMinutes()).padStart(2, '0')
    const orderNumber = order.orderNumber || order.id.slice(0, 8);
    const partnerName = order.user.partnerProfile?.businessName || order.user.name || '-'
    const representativeName = order.user.partnerProfile?.representativeName || '-'
    const formattedDate = `${year}-${month}-${day} ${ampm} ${hour}:${minute}`
    const partnerGrade = order.user.partnerProfile?.grade || 'C'

    // Calculate totals
    const productSupplyTotal = order.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
    const totalQuantity = order.items.reduce((sum: number, item: any) => sum + item.quantity, 0);
    const shippingFee = totalQuantity > 0 ? Math.ceil(totalQuantity / 100) * 3000 : 0;
    const shippingVat = Math.round(shippingFee * 0.1);
    const grandSupply = productSupplyTotal + shippingFee;
    const grandVat = Math.round(grandSupply * 0.1);
    const totalAmount = grandSupply + grandVat

    const gradeConfig: Record<string, { color: string, label: string }> = {
        'A': { color: '#10b981', label: 'A' },
        'B': { color: '#3b82f6', label: 'B' },
        'C': { color: '#f59e0b', label: 'C' },
        'D': { color: '#6b7280', label: 'D' },
    }
    const grade = gradeConfig[partnerGrade] || gradeConfig['C']

    const formatTimestamp = (ts: string | null) => {
        if (!ts) return null
        const d = new Date(ts)
        const mo = String(d.getMonth() + 1).padStart(2, '0')
        const da = String(d.getDate()).padStart(2, '0')
        const ho = String(d.getHours()).padStart(2, '0')
        const mi = String(d.getMinutes()).padStart(2, '0')
        return `${mo}/${da} ${ho}:${mi}`
    }

    const copyToClipboard = (text: string, field: string) => {
        if (!text || text === '-') return
        navigator.clipboard.writeText(text)
        setCopiedField(field)
        setTimeout(() => setCopiedField(null), 1500)
    }

    const handleDelete = async () => {
        if (!confirm('정말로 이 주문을 삭제하시겠습니까? 삭제 시 재고가 복구됩니다.')) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/orders/${order.id}`, { method: 'DELETE' });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || '주문 삭제 중 오류가 발생했습니다.');
            }
            alert('주문이 성공적으로 삭제되었습니다.');
            window.location.reload();
        } catch (error: any) {
            console.error(error);
            alert(error.message);
            setIsDeleting(false);
        }
    };

    const depositConfirmedAt = formatTimestamp(order.depositConfirmedAt)
    const adminDepositConfirmedAt = formatTimestamp(order.adminDepositConfirmedAt)

    return (
        <div className="w-full max-w-[520px] mx-auto mb-8">
            {/* ━━━ MAIN CARD ━━━ */}
            <div className="bg-[#1a1d23] rounded-[1.8rem] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.15)]">

                {/* ── TOP: 주문 헤더 (다크 그라데이션) ── */}
                <div className="bg-gradient-to-br from-[#1a1d23] via-[#22262e] to-[#2a2f38] px-6 pt-5 pb-4">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <div className="flex items-center gap-2.5 mb-1">
                                <h2 className="text-white text-xl font-black tracking-tight">
                                    #{orderNumber}
                                </h2>
                                <div
                                    className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black text-white"
                                    style={{ backgroundColor: grade.color }}
                                >
                                    {grade.label}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-gray-500">
                                <Clock size={11} />
                                <span>{formattedDate}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="bg-white/10 text-gray-400 rounded-lg px-2.5 py-1 text-[9px] font-bold tracking-wider uppercase">
                                도매
                            </span>
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="bg-red-500/15 text-red-400 rounded-lg px-2 py-1 text-[9px] font-bold hover:bg-red-500/25 transition-all flex items-center gap-1"
                            >
                                <Trash2 size={10} />
                                {isDeleting ? '...' : '삭제'}
                            </button>
                        </div>
                    </div>

                    {/* 업체 정보 인라인 */}
                    <div className="bg-white/[0.06] rounded-xl px-4 py-3 backdrop-blur-sm border border-white/[0.06]">
                        <div className="flex items-center gap-2 mb-2">
                            <Building2 size={13} className="text-gray-500" />
                            <span className="text-white font-black text-[14px]">{partnerName}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                            <div className="flex items-center gap-2 text-gray-500">
                                <span>배송지</span>
                            </div>
                            <span className="text-gray-300 font-medium text-right truncate">{order.user.partnerProfile?.address || '-'}</span>
                            <div className="flex items-center gap-2 text-gray-500">
                                <span>연락처</span>
                            </div>
                            <span className="text-gray-300 font-medium text-right">{order.user.partnerProfile?.contact || '-'}</span>
                        </div>
                    </div>
                </div>

                {/* ── 주문 상태 바 ── */}
                <div className="px-5 py-3 bg-[#1e2128]">
                    <OrderStatus
                        status={order.status}
                        trackingNumber={order.trackingNumber}
                        taxInvoiceIssued={order.taxInvoiceIssued}
                    />
                </div>

                {/* ── 계산서 발급 정보 ── */}
                <div className="px-5 py-4 border-t border-white/[0.06]">
                    <button
                        onClick={() => setShowInvoiceInfo(!showInvoiceInfo)}
                        className="w-full flex items-center justify-between group mb-0"
                    >
                        <div className="flex items-center gap-2">
                            <FileText size={13} className={order.taxInvoiceIssued ? 'text-emerald-400' : 'text-amber-400'} />
                            <span className="text-[12px] font-black text-gray-300">계산서 발급 정보</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {order.taxInvoiceIssued ? (
                                <span className="bg-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-md text-[9px] font-black">
                                    발급완료
                                </span>
                            ) : (
                                <span className="bg-amber-500/20 text-amber-400 px-2.5 py-0.5 rounded-md text-[9px] font-black flex items-center gap-1">
                                    <AlertTriangle size={9} />
                                    미발행
                                </span>
                            )}
                            <svg className={`w-3.5 h-3.5 text-gray-500 transition-transform ${showInvoiceInfo ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
                        </div>
                    </button>

                    {showInvoiceInfo && (
                        <div className="mt-3 space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                            {/* 사업자번호 */}
                            <div className="flex items-center justify-between bg-white/[0.04] rounded-lg px-3.5 py-2.5 group/row hover:bg-white/[0.07] transition-colors">
                                <span className="text-[10px] text-gray-500 font-medium">사업자번호</span>
                                <button
                                    onClick={() => copyToClipboard(order.user.partnerProfile?.businessRegNumber || '', 'bizNum')}
                                    className="flex items-center gap-1.5 text-[12px] font-black text-white hover:text-[#e43f29] transition-colors"
                                >
                                    {order.user.partnerProfile?.businessRegNumber || '-'}
                                    {copiedField === 'bizNum'
                                        ? <Check size={11} className="text-emerald-400" />
                                        : <Copy size={11} className="text-gray-600 group-hover/row:text-gray-400 transition-colors" />
                                    }
                                </button>
                            </div>
                            {/* 대표자 / 상호 */}
                            <div className="grid grid-cols-2 gap-1.5">
                                <div className="bg-white/[0.04] rounded-lg px-3.5 py-2.5">
                                    <span className="text-[10px] text-gray-500 font-medium block mb-0.5">대표자명</span>
                                    <span className="text-[12px] font-black text-white">{representativeName}</span>
                                </div>
                                <div className="bg-white/[0.04] rounded-lg px-3.5 py-2.5">
                                    <span className="text-[10px] text-gray-500 font-medium block mb-0.5">상호</span>
                                    <span className="text-[12px] font-bold text-gray-300 truncate block">{partnerName}</span>
                                </div>
                            </div>
                            {/* 이메일 */}
                            <div className="flex items-center justify-between bg-white/[0.04] rounded-lg px-3.5 py-2.5 group/row hover:bg-white/[0.07] transition-colors">
                                <span className="text-[10px] text-gray-500 font-medium">이메일</span>
                                <button
                                    onClick={() => copyToClipboard(order.user.partnerProfile?.email || '', 'email')}
                                    className="flex items-center gap-1.5 text-[11px] font-bold text-gray-300 hover:text-[#e43f29] transition-colors"
                                >
                                    <span className="truncate max-w-[200px]">{order.user.partnerProfile?.email || '-'}</span>
                                    {copiedField === 'email'
                                        ? <Check size={10} className="text-emerald-400 shrink-0" />
                                        : <Copy size={10} className="text-gray-600 group-hover/row:text-gray-400 shrink-0 transition-colors" />
                                    }
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── 입금 이력 ── */}
                {(depositConfirmedAt || adminDepositConfirmedAt) && (
                    <div className="px-5 pb-4 border-t border-white/[0.06] pt-3">
                        <div className="grid grid-cols-2 gap-1.5">
                            {depositConfirmedAt && (
                                <div className="bg-white/[0.04] rounded-lg px-3.5 py-2.5">
                                    <span className="text-[9px] text-gray-500 font-medium block mb-0.5">거래처 입금확인</span>
                                    <span className="text-[11px] font-bold text-gray-300">{depositConfirmedAt}</span>
                                </div>
                            )}
                            {adminDepositConfirmedAt && (
                                <div className="bg-emerald-500/10 rounded-lg px-3.5 py-2.5 border border-emerald-500/10">
                                    <span className="text-[9px] text-emerald-500/70 font-medium block mb-0.5">관리자 확인</span>
                                    <span className="text-[11px] font-bold text-emerald-400">{adminDepositConfirmedAt}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ━━━ DELIVERY SECTION ━━━ */}
            <div className="bg-white rounded-[1.4rem] -mt-3 mx-2 px-5 py-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-gray-100/80 relative z-10">
                <div className="flex items-center gap-2 mb-3">
                    <Truck size={14} className="text-gray-400" />
                    <h3 className="text-[13px] font-black text-gray-800">배송 상태 관리</h3>
                </div>
                <OrderActions order={order} />
            </div>

            {/* ━━━ PRODUCT LIST ━━━ */}
            <div className="bg-white rounded-[1.4rem] mx-2 mt-2 px-5 py-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-100/80">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[13px] font-black text-gray-800">
                        주문 상품
                        <span className="text-gray-400 font-bold ml-1.5">({order.items.length})</span>
                    </h3>
                    <span className="text-[10px] font-bold text-gray-400">
                        총 {totalQuantity.toLocaleString()}개
                    </span>
                </div>

                <div className="space-y-2">
                    {order.items.map((item: any) => {
                        const supplyPrice = item.price * item.quantity;
                        const vat = Math.round(supplyPrice * 0.1);
                        const lineTotal = supplyPrice + vat;
                        return (
                            <div key={item.id} className="bg-gray-50/80 rounded-xl p-3 hover:bg-gray-100/60 transition-colors">
                                <div className="flex gap-3">
                                    <div className="w-[60px] h-[60px] rounded-lg bg-gray-200 shrink-0 overflow-hidden">
                                        {item.product.imageUrl ? (
                                            <img src={item.product.imageUrl} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <span className="text-[8px] text-gray-400">N/A</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-gray-900 text-[13px] leading-tight truncate">{item.product.name}</h4>
                                        <p className="text-[9px] text-gray-400 truncate mt-0.5 mb-2">{item.product.nameJP || item.product.name}</p>

                                        <div className="flex items-center gap-0 text-[10px] bg-white rounded-lg overflow-hidden border border-gray-100">
                                            <div className="flex flex-col items-center px-2.5 py-1.5 border-r border-gray-100">
                                                <span className="text-gray-400 text-[8px]">단가</span>
                                                <span className="font-bold text-gray-800">{item.price.toLocaleString()}</span>
                                            </div>
                                            <div className="flex flex-col items-center px-2.5 py-1.5 border-r border-gray-100">
                                                <span className="text-gray-400 text-[8px]">수량</span>
                                                <span className="font-bold text-gray-800">{item.quantity}</span>
                                            </div>
                                            <div className="flex flex-col items-center px-2.5 py-1.5 border-r border-gray-100">
                                                <span className="text-gray-400 text-[8px]">공급가</span>
                                                <span className="font-bold text-gray-800">{supplyPrice.toLocaleString()}</span>
                                            </div>
                                            <div className="flex flex-col items-center px-2.5 py-1.5 border-r border-gray-100">
                                                <span className="text-gray-400 text-[8px]">VAT</span>
                                                <span className="font-bold text-gray-800">{vat.toLocaleString()}</span>
                                            </div>
                                            <div className="flex flex-col items-center px-2.5 py-1.5 bg-gray-50">
                                                <span className="text-[#e43f29] text-[8px] font-medium">합계</span>
                                                <span className="font-black text-gray-900">{lineTotal.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}

                    {/* 배송비 */}
                    {shippingFee > 0 && (
                        <div className="flex items-center justify-between bg-gray-50/80 rounded-xl px-4 py-3 border border-dashed border-gray-200">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center">
                                    <Truck size={14} className="text-gray-500" />
                                </div>
                                <div>
                                    <span className="text-[12px] font-black text-gray-800 block">배송비</span>
                                    <span className="text-[9px] text-gray-400">VAT: {shippingVat.toLocaleString()}</span>
                                </div>
                            </div>
                            <span className="text-[14px] font-black text-gray-800">{shippingFee.toLocaleString()}원</span>
                        </div>
                    )}
                </div>

                {/* ── 합계 ── */}
                <div className="mt-4 pt-3 border-t-2 border-gray-900">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex gap-3 text-[10px] text-gray-400 font-medium">
                            <span>공급가 {grandSupply.toLocaleString()}</span>
                            <span>VAT {grandVat.toLocaleString()}</span>
                        </div>
                    </div>
                    <div className="flex items-end justify-between">
                        <span className="text-[11px] font-black text-gray-500 tracking-widest uppercase">합계금액</span>
                        <span className="text-[28px] font-black text-[#e43f29] leading-none tracking-tight">
                            {totalAmount.toLocaleString()}
                            <span className="text-[14px] ml-0.5">원</span>
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}
