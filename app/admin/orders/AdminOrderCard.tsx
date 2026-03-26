'use client'

import React, { useState } from 'react'
import OrderActions from '@/components/OrderActions'
import BarcodeDisplay from '@/components/BarcodeDisplay'
import OrderStatus from '@/components/OrderStatus'
import { Trash2, FileText, AlertTriangle, Copy, Check } from 'lucide-react'

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

    // Calculate totals
    const productSupplyTotal = order.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
    const totalQuantity = order.items.reduce((sum: number, item: any) => sum + item.quantity, 0);
    const shippingFee = totalQuantity > 0 ? Math.ceil(totalQuantity / 100) * 3000 : 0;
    const shippingVat = Math.round(shippingFee * 0.1);
    const grandSupply = productSupplyTotal + shippingFee;
    const grandVat = Math.round(grandSupply * 0.1);
    const totalAmount = grandSupply + grandVat

    const gradeColors: Record<string, { bg: string, text: string, border: string }> = {
        'A': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
        'B': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
        'C': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
        'D': { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
    }
    const gc = gradeColors[partnerGrade] || gradeColors['C']

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
            const res = await fetch(`/api/orders/${order.id}`, {
                method: 'DELETE',
            });

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
        <div className="bg-[#f8f9fa] rounded-[2.5rem] w-full max-w-[500px] mx-auto p-4 md:p-7 mb-10 border border-gray-200/60 shadow-[0_10px_40px_rgba(0,0,0,0.03)] relative transition-all hover:shadow-[0_10px_40px_rgba(0,0,0,0.06)] hover:border-gray-300">
            <OrderStatus
                status={order.status}
                trackingNumber={order.trackingNumber}
                taxInvoiceIssued={order.taxInvoiceIssued}
            />

            {/* ── 주문 헤더 ── */}
            <div className="bg-white rounded-[1.2rem] p-5 shadow-sm mb-4">
                <div className="flex justify-between items-start mb-3 pb-3 border-b border-gray-100">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-black text-gray-800 tracking-tight">
                                #{orderNumber}
                            </h2>
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black border ${gc.bg} ${gc.text} ${gc.border}`}>
                                {partnerGrade}등급
                            </span>
                        </div>
                        <span className="text-[11px] text-gray-400 font-medium">{formattedDate}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="bg-gray-100 text-gray-500 rounded-full px-3 py-1 text-[10px] font-bold">
                            도매
                        </span>
                        <button
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="flex items-center gap-1 bg-red-50 text-red-500 rounded-full px-2 py-1 text-[10px] font-bold hover:bg-red-100 transition-colors"
                        >
                            <Trash2 size={12} />
                            {isDeleting ? '진행중' : '삭제'}
                        </button>
                    </div>
                </div>

                {/* 주문자 / 업체 기본 정보 */}
                <div className="space-y-2 p-1">
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400 font-medium">업체명</span>
                        <span className="text-sm text-gray-900 font-black">{partnerName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400 font-medium w-16 shrink-0">배송지</span>
                        <span className="text-xs text-gray-800 font-bold max-w-full truncate text-right">{order.user.partnerProfile?.address || '-'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400 font-medium">연락처</span>
                        <span className="text-sm text-gray-800 font-bold">{order.user.partnerProfile?.contact || '-'}</span>
                    </div>
                </div>
            </div>

            {/* ── 계산서 발급 정보 블록 ── */}
            <div className={`rounded-[1.2rem] p-4 mb-4 border ${order.taxInvoiceIssued ? 'bg-emerald-50/50 border-emerald-200' : 'bg-orange-50/50 border-orange-200'}`}>
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <FileText size={14} className={order.taxInvoiceIssued ? 'text-emerald-600' : 'text-orange-600'} />
                        <h3 className={`text-xs font-black ${order.taxInvoiceIssued ? 'text-emerald-700' : 'text-orange-700'}`}>
                            계산서 발급 정보
                        </h3>
                    </div>
                    {order.taxInvoiceIssued ? (
                        <span className="bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full text-[9px] font-black border border-emerald-200">
                            ✅ 발급완료
                        </span>
                    ) : (
                        <span className="bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded-full text-[9px] font-black border border-orange-200 flex items-center gap-1">
                            <AlertTriangle size={10} />
                            미발행
                        </span>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
                    {/* 사업자번호 */}
                    <div className="col-span-2 flex justify-between items-center bg-white/60 rounded-lg px-3 py-2">
                        <span className="text-gray-400 font-medium">사업자번호</span>
                        <button
                            onClick={() => copyToClipboard(order.user.partnerProfile?.businessRegNumber || '', 'bizNum')}
                            className="flex items-center gap-1.5 font-black text-gray-900 hover:text-[#e43f29] transition-colors"
                        >
                            {order.user.partnerProfile?.businessRegNumber || '-'}
                            {copiedField === 'bizNum' ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} className="opacity-30" />}
                        </button>
                    </div>
                    {/* 대표자명 */}
                    <div className="flex flex-col bg-white/60 rounded-lg px-3 py-2">
                        <span className="text-gray-400 font-medium mb-0.5">대표자명</span>
                        <span className="font-black text-gray-900">{representativeName}</span>
                    </div>
                    {/* 상호 */}
                    <div className="flex flex-col bg-white/60 rounded-lg px-3 py-2">
                        <span className="text-gray-400 font-medium mb-0.5">상호</span>
                        <span className="font-bold text-gray-900 truncate">{partnerName}</span>
                    </div>
                    {/* 이메일 */}
                    <div className="flex flex-col bg-white/60 rounded-lg px-3 py-2">
                        <span className="text-gray-400 font-medium mb-0.5">이메일</span>
                        <button
                            onClick={() => copyToClipboard(order.user.partnerProfile?.email || '', 'email')}
                            className="flex items-center gap-1 font-bold text-gray-900 hover:text-[#e43f29] transition-colors text-left"
                        >
                            <span className="truncate">{order.user.partnerProfile?.email || '-'}</span>
                            {copiedField === 'email' ? <Check size={10} className="text-emerald-500 shrink-0" /> : <Copy size={10} className="opacity-30 shrink-0" />}
                        </button>
                    </div>
                    {/* FAX */}
                    <div className="flex flex-col bg-white/60 rounded-lg px-3 py-2">
                        <span className="text-gray-400 font-medium mb-0.5">FAX</span>
                        <span className="font-bold text-gray-900">{order.user.partnerProfile?.fax || '-'}</span>
                    </div>
                </div>
            </div>

            {/* ── 입금 이력 ── */}
            {(depositConfirmedAt || adminDepositConfirmedAt) && (
                <div className="bg-white rounded-[1.2rem] p-4 shadow-sm mb-4">
                    <h3 className="text-xs font-black text-gray-500 mb-2 flex items-center gap-1.5">
                        <span className="w-1 h-3 bg-[#424853] rounded-full"></span>
                        입금 확인 이력
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-[11px]">
                        {depositConfirmedAt && (
                            <div className="flex flex-col bg-gray-50 rounded-lg px-3 py-2">
                                <span className="text-gray-400 font-medium">거래처 입금확인</span>
                                <span className="font-bold text-gray-800 mt-0.5">{depositConfirmedAt}</span>
                            </div>
                        )}
                        {adminDepositConfirmedAt && (
                            <div className="flex flex-col bg-emerald-50 rounded-lg px-3 py-2">
                                <span className="text-gray-400 font-medium">관리자 입금확인</span>
                                <span className="font-bold text-emerald-700 mt-0.5">{adminDepositConfirmedAt}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── 배송 상태 관리 ── */}
            <div className="mb-6">
                <h3 className="text-[17px] font-black text-gray-800 mb-3 ml-1">배송 상태 관리</h3>
                <OrderActions order={order} />
            </div>

            {/* ── 주문 상품 목록 ── */}
            <div className="mb-6">
                <h3 className="text-[17px] font-black text-gray-800 mb-3 ml-1">
                    주문 상품 목록
                    <span className="ml-2 text-xs font-bold text-gray-400">({order.items.length}건)</span>
                </h3>

                <div className="space-y-3">
                    {order.items.map((item: any) => {
                        const supplyPrice = item.price * item.quantity;
                        const vat = Math.round(supplyPrice * 0.1);
                        return (
                            <div key={item.id} className="bg-white rounded-[1.2rem] p-4 shadow-sm flex flex-col">
                                <div className="flex gap-4">
                                    <div className="w-[84px] h-[84px] rounded-xl bg-black shrink-0 overflow-hidden flex items-center justify-center">
                                        {item.product.imageUrl ? (
                                            <img src={item.product.imageUrl} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-[10px] text-gray-500">이미지 없음</span>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                                        <div>
                                            <h4 className="font-bold text-gray-900 text-[14px] leading-tight truncate">{item.product.name}</h4>
                                            <p className="text-[10px] text-gray-400 truncate mb-2 mt-0.5">{item.product.nameJP || item.product.name}</p>
                                        </div>

                                        {/* Financial Row: 단가, 수량, 공급가, 부가세 */}
                                        <div className="flex items-center gap-4 text-[11px] border-b border-gray-50 pb-2 mb-2">
                                            <div className="flex flex-col">
                                                <span className="text-gray-400">단가</span>
                                                <span className="font-bold text-gray-900">{item.price.toLocaleString()}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-gray-400">수량</span>
                                                <span className="font-bold text-gray-900">{item.quantity}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-gray-400">공급가</span>
                                                <span className="font-bold text-gray-900">{supplyPrice.toLocaleString()}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-gray-400">부가세</span>
                                                <span className="font-bold text-gray-900">{vat.toLocaleString()}</span>
                                            </div>
                                        </div>

                                        {/* Code & Barcode Row */}
                                        <div className="flex items-center justify-between gap-4 text-[11px]">
                                            <div className="flex flex-col">
                                                <span className="text-gray-400">상품코드</span>
                                                <span className="font-bold text-gray-900 truncate">{item.product.productCode || '-'}</span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-gray-400">바코드</span>
                                                    {item.product.barcode ? (
                                                        <div className="flex flex-col items-center">
                                                            <div className="h-[14px] overflow-hidden opacity-90 mb-1">
                                                                <BarcodeDisplay value={item.product.barcode} width={1} height={14} fontSize={0} displayValue={false} showDownload={false} />
                                                            </div>
                                                            <span className="text-[9px] font-mono text-gray-400 leading-none">{item.product.barcode}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-300">없음</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}

                    {/* Shipping Fee */}
                    {shippingFee > 0 && (
                        <div className="bg-gray-50 border border-gray-100 rounded-[1.2rem] p-4 flex gap-4 items-center">
                            <div className="w-14 h-14 bg-gray-200 rounded-xl flex flex-col justify-center items-center text-gray-500 shrink-0">
                                <svg className="w-6 h-6 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>
                                <span className="text-[8px] font-bold">배송</span>
                            </div>
                            <div className="flex-1 flex justify-between items-center">
                                <div className="flex flex-col">
                                    <span className="font-black text-[15px] text-gray-900">배송비</span>
                                    <span className="text-[11px] text-gray-400 font-medium">수량: 1</span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="font-black text-[15px] text-gray-900">{shippingFee.toLocaleString()}</span>
                                    <span className="text-[10px] text-gray-400 mt-0.5">부가세: {shippingVat.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── 합계 ── */}
            <div className="border-t border-gray-200 pt-4 flex justify-between items-end px-1 mt-6">
                <div className="flex flex-col gap-1 w-full relative">
                    <div className="flex items-center gap-4 text-[11px] font-bold text-gray-500">
                        <span>공급가: {grandSupply.toLocaleString()}원</span>
                        <span>부가세: {grandVat.toLocaleString()}원</span>
                    </div>
                    <span className="text-[12px] font-black tracking-widest text-[#424853] mt-2">총 결제금액</span>
                </div>
                <div className="flex flex-col items-end shrink-0">
                    <span className="text-[11px] font-bold text-gray-500 mb-0.5">총 수량: {totalQuantity.toLocaleString()}</span>
                    <span className="text-[26px] font-black text-[#e43f29] leading-none mb-1">{totalAmount.toLocaleString()}원</span>
                </div>
            </div>

        </div>
    )
}
