'use client'

import React, { useState } from 'react'
import OrderActions from '@/components/OrderActions'
import OrderStatus from '@/components/OrderStatus'
import { Trash2, Copy, Check } from 'lucide-react'

export default function AdminOrderCard({ order }: { order: any }) {
    const [isDeleting, setIsDeleting] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);

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

    const productSupplyTotal = order.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
    const totalQuantity = order.items.reduce((sum: number, item: any) => sum + item.quantity, 0);
    const shippingFee = totalQuantity > 0 ? Math.ceil(totalQuantity / 100) * 3000 : 0;
    const shippingVat = Math.round(shippingFee * 0.1);
    const grandSupply = productSupplyTotal + shippingFee;
    const grandVat = Math.round(grandSupply * 0.1);
    const totalAmount = grandSupply + grandVat

    const gradeStyle: Record<string, string> = {
        'A': 'bg-emerald-100 text-emerald-700',
        'B': 'bg-blue-100 text-blue-700',
        'C': 'bg-amber-100 text-amber-700',
        'D': 'bg-gray-100 text-gray-600',
    }

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
        if (!confirm('정말로 이 주문을 삭제하시겠습니까? 삭제 시 재고가 복구됩니다.')) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/orders/${order.id}`, { method: 'DELETE' });
            if (!res.ok) { const e = await res.json(); throw new Error(e.error || '오류'); }
            alert('삭제 완료'); window.location.reload();
        } catch (error: any) { alert(error.message); setIsDeleting(false); }
    };

    const depositConfirmedAt = formatTimestamp(order.depositConfirmedAt)
    const adminDepositConfirmedAt = formatTimestamp(order.adminDepositConfirmedAt)

    return (
        <div className={`w-full max-w-[480px] mx-auto rounded-2xl border shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden ${order.taxInvoiceIssued ? 'bg-gray-200 border-gray-300' : 'bg-white border-gray-200'}`}>

            {/* ── 헤더: 주문번호 + 등급 + 날짜 ── */}
            <div className="px-5 pt-4 pb-3 border-b border-gray-100">
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                        <h2 className="text-[15px] font-black text-gray-900">#{orderNumber}</h2>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${gradeStyle[partnerGrade] || gradeStyle['C']}`}>
                            {partnerGrade}
                        </span>
                        {!order.taxInvoiceIssued && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-500">
                                계산서 미발행
                            </span>
                        )}
                    </div>
                    <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="text-gray-300 hover:text-red-400 transition-colors p-1"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
                <span className="text-[11px] text-gray-400">{formattedDate}</span>
            </div>

            {/* ── 주문 상태 바 ── */}
            <div className="px-5 py-3 bg-gray-50/50 border-b border-gray-100">
                <OrderStatus
                    status={order.status}
                    trackingNumber={order.trackingNumber}
                    taxInvoiceIssued={order.taxInvoiceIssued}
                />
            </div>

            {/* ── 거래처 + 계산서 정보 (테이블 스타일) ── */}
            <div className="px-5 py-4 border-b border-gray-100">
                <table className="w-full text-[12px]">
                    <tbody>
                        <tr className="border-b border-gray-50">
                            <td className="text-gray-400 py-1.5 pr-3 w-20 align-top">사업자번호</td>
                            <td className="py-1.5">
                                <button
                                    onClick={() => copyToClipboard(order.user.partnerProfile?.businessRegNumber || '', 'biz')}
                                    className="flex items-center gap-1 text-gray-900 font-bold hover:text-[#d9361b] transition-colors text-left"
                                >
                                    {order.user.partnerProfile?.businessRegNumber || '-'}
                                    {copiedField === 'biz' ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} className="text-gray-300" />}
                                </button>
                            </td>
                        </tr>
                        <tr className="border-b border-gray-50">
                            <td className="text-gray-400 py-1.5 pr-3 align-top">상호</td>
                            <td className="py-1.5">
                                <button
                                    onClick={() => copyToClipboard(partnerName, 'partnerName')}
                                    className="flex items-center gap-1 text-gray-900 font-bold hover:text-[#d9361b] transition-colors text-left"
                                >
                                    {partnerName}
                                    {copiedField === 'partnerName' ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} className="text-gray-300" />}
                                </button>
                            </td>
                        </tr>
                        <tr className="border-b border-gray-50">
                            <td className="text-gray-400 py-1.5 pr-3 align-top">성명</td>
                            <td className="py-1.5">
                                <button
                                    onClick={() => copyToClipboard(representativeName, 'repName')}
                                    className="flex items-center gap-1 text-gray-900 font-bold hover:text-[#d9361b] transition-colors text-left"
                                >
                                    {representativeName}
                                    {copiedField === 'repName' ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} className="text-gray-300" />}
                                </button>
                            </td>
                        </tr>
                        <tr className="border-b border-gray-50">
                            <td className="text-gray-400 py-1.5 pr-3 align-top">이메일</td>
                            <td className="py-1.5">
                                <button
                                    onClick={() => copyToClipboard(order.user.partnerProfile?.email ? order.user.partnerProfile.email.split('@')[0] : '', 'email')}
                                    className="flex items-center gap-1 text-gray-900 font-bold hover:text-[#d9361b] transition-colors text-left"
                                >
                                    <span className="truncate max-w-[220px]">{order.user.partnerProfile?.email || '-'}</span>
                                    {copiedField === 'email' ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} className="text-gray-300" />}
                                </button>
                            </td>
                        </tr>
                        <tr className="border-b border-gray-50">
                            <td className="text-gray-400 py-1.5 pr-3 align-top">배송지</td>
                            <td className="text-gray-800 font-medium py-1.5 break-all text-[11px]">{order.user.partnerProfile?.address || '-'}</td>
                        </tr>
                        <tr>
                            <td className="text-gray-400 py-1.5 pr-3 align-top">연락처</td>
                            <td className="text-gray-900 font-bold py-1.5">{order.user.partnerProfile?.contact || '-'}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* ── 입금 확인 이력 ── */}
            {(depositConfirmedAt || adminDepositConfirmedAt) && (
                <div className="px-5 py-3 border-b border-gray-100 flex gap-4 text-[11px]">
                    {depositConfirmedAt && (
                        <div>
                            <span className="text-gray-400">거래처 입금확인</span>
                            <span className="text-gray-700 font-bold ml-2">{depositConfirmedAt}</span>
                        </div>
                    )}
                    {adminDepositConfirmedAt && (
                        <div>
                            <span className="text-gray-400">관리자 확인</span>
                            <span className="text-emerald-600 font-bold ml-2">{adminDepositConfirmedAt}</span>
                        </div>
                    )}
                </div>
            )}

            {/* ── 배송 + 액션 ── */}
            <div className="px-5 py-4 border-b border-gray-100">
                <OrderActions order={order} />
            </div>

            {/* ── 상품 목록 ── */}
            <div className="px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-[12px] font-black text-gray-800">주문 상품 ({order.items.length})</span>
                    <span className="text-[10px] text-gray-400 font-bold">총 {totalQuantity.toLocaleString()}개</span>
                </div>

                <div className="space-y-2">
                    {order.items.map((item: any) => {
                        const supplyPrice = item.price * item.quantity;
                        const vat = Math.round(supplyPrice * 0.1);
                        const lineTotal = supplyPrice + vat;
                        return (
                            <div key={item.id} className="flex gap-3 py-2 border-b border-gray-50 last:border-0">
                                <div className="w-12 h-12 rounded-lg bg-gray-100 shrink-0 overflow-hidden">
                                    {item.product.imageUrl ? (
                                        <img src={item.product.imageUrl} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-[7px] text-gray-400">N/A</div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <button
                                        onClick={() => copyToClipboard(item.product.name, `prodName-${item.id}`)}
                                        className="flex items-center gap-1 text-[12px] font-bold text-gray-900 hover:text-[#d9361b] transition-colors text-left w-full max-w-full"
                                    >
                                        <span className="truncate">{item.product.name}</span>
                                        {copiedField === `prodName-${item.id}` ? <Check size={12} className="text-emerald-500 shrink-0" /> : <Copy size={10} className="text-gray-300 shrink-0" />}
                                    </button>
                                    <p className="text-[9px] text-gray-400 truncate mt-0.5">{item.product.nameJP || ''}</p>
                                    <div className="mt-1.5 flex items-center gap-3 text-[12px]">
                                        <div className="flex items-center gap-1">
                                            <span className="text-gray-400 text-[11px]">단가</span>
                                            <span className="font-bold text-gray-800">{item.price.toLocaleString()}원</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="text-gray-400 text-[11px]">수량</span>
                                            <span className="font-bold text-[#d9361b]">{item.quantity}개</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center text-[10px] text-gray-400 gap-2 mt-0.5">
                                        <span>공급가 {supplyPrice.toLocaleString()}원</span>
                                        <span className="text-gray-300">|</span>
                                        <span>VAT {vat.toLocaleString()}원</span>
                                    </div>
                                </div>
                                <div className="text-right shrink-0 self-center">
                                    <span className="text-[12px] font-black text-gray-900">{lineTotal.toLocaleString()}</span>
                                </div>
                            </div>
                        )
                    })}

                    {shippingFee > 0 && (
                        <div className="flex items-center justify-between py-2 border-b border-gray-50">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center">
                                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>
                                </div>
                                <span className="text-[11px] font-bold text-gray-700">배송비</span>
                                <span className="text-[9px] text-gray-400">(VAT {shippingVat.toLocaleString()})</span>
                            </div>
                            <span className="text-[12px] font-black text-gray-900">{shippingFee.toLocaleString()}</span>
                        </div>
                    )}
                </div>

                {/* 합계 */}
                <div className="mt-3 pt-3 border-t-2 border-gray-900 flex items-end justify-between">
                    <div className="text-[10px] text-gray-400">
                        <span>공급가 {grandSupply.toLocaleString()}</span>
                        <span className="mx-2">·</span>
                        <span>VAT {grandVat.toLocaleString()}</span>
                    </div>
                    <span className="text-[22px] font-black text-[#d9361b] leading-none">
                        {totalAmount.toLocaleString()}<span className="text-[12px] ml-0.5">원</span>
                    </span>
                </div>
            </div>
        </div>
    )
}
