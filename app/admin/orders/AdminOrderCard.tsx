'use client'

import { useState, useEffect } from 'react'
import OrderActions from '@/components/OrderActions'
import BarcodeDisplay from '@/components/BarcodeDisplay'
import OrderStatus from '@/components/OrderStatus'

export default function AdminOrderCard({ order }: { order: any }) {
    // If tax invoice is issued, start collapsed (false). Otherwise, always expanded (true).
    const [isExpanded, setIsExpanded] = useState(!order.taxInvoiceIssued)

    useEffect(() => {
        if (order.taxInvoiceIssued) {
            setIsExpanded(false)
        }
    }, [order.taxInvoiceIssued])

    const date = new Date(order.createdAt)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const ampm = date.getHours() >= 12 ? '오후' : '오전'
    let hour = date.getHours() % 12
    if (hour === 0) hour = 12
    const minute = String(date.getMinutes()).padStart(2, '0')
    const orderNumber = order.orderNumber || order.id.slice(0, 8);
    const formattedDate = `${year}년 ${month}월 ${day}일 ${ampm} ${hour}:${minute}`

    const formatSimpleDate = (dateInput: any) => {
        if (!dateInput) return '-';
        const d = new Date(dateInput);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const de = String(d.getDate()).padStart(2, '0');
        const h = String(d.getHours()).padStart(2, '0');
        const mi = String(d.getMinutes()).padStart(2, '0');
        const s = String(d.getSeconds()).padStart(2, '0');
        return `${y}. ${m}. ${de}. ${h}:${mi}:${s}`;
    };

    // Calculate totals
    const productSupplyTotal = order.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
    const totalQuantity = order.items.reduce((sum: number, item: any) => sum + item.quantity, 0);
    const shippingFee = totalQuantity > 0 ? Math.ceil(totalQuantity / 100) * 3000 : 0;
    const shippingVat = Math.round(shippingFee * 0.1);
    const grandSupply = productSupplyTotal + shippingFee;
    const grandVat = Math.round(grandSupply * 0.1);
    const totalAmount = grandSupply + grandVat

    return (
        <div className={`relative rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 border overflow-hidden group ${order.taxInvoiceIssued
            ? 'bg-gray-100 border-gray-200'
            : 'bg-white border-gray-100'
            }`}>
            {/* Main Info Row (Always Visible) */}
            <div className={`px-5 pt-5 pb-2 ${order.taxInvoiceIssued ? 'bg-gray-50/30' : ''}`}>
                <div className="flex flex-col md:flex-row gap-4 items-start justify-between">
                    {/* Left: Order Info & User */}
                    <div className="flex-1 min-w-0 w-full">
                        <div className="flex items-center flex-wrap gap-2 mb-2">
                            <span className="text-[10px] font-black text-[#d9361b] bg-red-50 px-2 py-0.5 rounded border border-red-100 whitespace-nowrap">
                                No. {orderNumber}
                            </span>
                            <span className="text-[11px] text-gray-400 font-medium whitespace-nowrap">{formattedDate}</span>
                            {order.taxInvoiceIssued && (
                                <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-100 flex items-center gap-1 whitespace-nowrap">
                                    <span>✅</span> 발행완료
                                </span>
                            )}
                        </div>

                        <div className="flex items-baseline flex-wrap gap-2 mb-2">
                            <h3 className="text-lg font-black text-gray-900 truncate">
                                {order.user.name || order.user.partnerProfile?.businessName || '상호명 미등록'}
                            </h3>
                            <span className="text-[11px] text-gray-400 font-medium whitespace-nowrap">({order.user.username})</span>
                            <span className="text-[11px] text-gray-300">|</span>
                            <span className="text-[11px] text-gray-500 font-bold whitespace-nowrap">
                                {order.user.partnerProfile?.businessRegNumber || '-'}
                            </span>
                        </div>

                        <div className="flex flex-col gap-1 text-[11px] text-gray-900 mt-2">
                            <div className="flex gap-2 items-start">
                                <span className="font-bold text-gray-500 w-12 shrink-0">배송지</span>
                                <span className="break-all leading-snug">{order.user.partnerProfile?.address || '-'}</span>
                            </div>
                            <div className="flex gap-2 items-center">
                                <span className="font-bold text-gray-500 w-12 shrink-0">연락처</span>
                                <span className="font-medium">{order.user.partnerProfile?.contact || '-'}</span>
                            </div>
                            <div className="flex gap-2 items-center">
                                <span className="font-bold text-gray-500 w-12 shrink-0">이메일</span>
                                <span className="font-medium text-gray-600">{order.user.partnerProfile?.email || '-'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Right: Status & Actions */}
                    <div className="flex flex-col items-end w-full md:w-auto gap-3 self-start mt-4 md:mt-0 border-t md:border-t-0 pt-3 md:pt-0 border-gray-50">
                        <OrderStatus
                            status={order.status}
                            trackingNumber={order.trackingNumber}
                            taxInvoiceIssued={order.taxInvoiceIssued}
                        />
                        <div className="flex flex-col items-end gap-2">
                            <div className="flex items-center gap-2">
                                <OrderActions order={order} />
                            </div>

                            {/* Collapsed Summary for Invoiced Orders */}
                            {order.taxInvoiceIssued && !isExpanded && (
                                <div className="flex items-center gap-4 text-[11px] mt-2 bg-gray-50/50 px-3 py-1.5 rounded-full border border-gray-100 whitespace-nowrap">
                                    <div className="flex gap-1.5 items-center">
                                        <span className="text-gray-400">총 수량:</span>
                                        <span className="font-bold text-gray-900">{totalQuantity.toLocaleString()}</span>
                                    </div>
                                    <div className="flex gap-1.5 items-center">
                                        <span className="text-gray-400">공급가:</span>
                                        <span className="font-bold text-gray-900">{grandSupply.toLocaleString()}</span>
                                    </div>
                                    <div className="flex gap-1.5 items-center">
                                        <span className="text-gray-400">부가세:</span>
                                        <span className="font-bold text-gray-900">{grandVat.toLocaleString()}</span>
                                    </div>
                                    <div className="flex gap-1.5 items-center border-l border-gray-200 pl-3 ml-2">
                                        <span className="font-bold text-[#d9361b]">합계:</span>
                                        <span className="font-black text-[#d9361b] text-[13px]">{totalAmount.toLocaleString()}원</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {(!order.taxInvoiceIssued || isExpanded) && (
                <div className="border-t border-gray-100 bg-gray-50/30 animate-in slide-in-from-top-2 duration-200">
                    <div className="px-4 pt-2 pb-6">
                        <div className="bg-white border-x border-b border-gray-100 border-t-2 border-t-red-500 rounded-xl overflow-hidden shadow-sm">
                            <div className="bg-gray-50 px-3 py-1.5 border-b border-gray-100 flex justify-between items-center">
                                <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">주문상세내역</h4>
                            </div>
                            <div className="grid grid-cols-[30px_1fr_40px_70px_70px_80px_100px] gap-y-0 border-b border-gray-100 text-[9px] uppercase tracking-wider text-gray-400 font-bold px-0 bg-gray-50/30">
                                <div className="text-center py-1">No</div>
                                <div className="px-2 py-1">상품명</div>
                                <div className="text-center py-1">수량</div>
                                <div className="text-right pr-2 py-1">공급가</div>
                                <div className="text-right pr-2 py-1">부가세</div>
                                <div className="px-2 py-1">코드</div>
                                <div className="px-2 py-1">바코드</div>
                            </div>
                            <ul className="divide-y divide-gray-100">
                                {order.items.map((item: any, i: number) => {
                                    const supplyPrice = item.price * item.quantity;
                                    const vat = Math.round(supplyPrice * 0.1);
                                    return (
                                        <li key={item.id} className="grid grid-cols-[30px_1fr_40px_70px_70px_80px_100px] items-center text-[10px] py-1 hover:bg-gray-50/50 transition-colors">
                                            <span className="text-gray-400 text-center">{i + 1}</span>
                                            <div className="px-2 min-w-0 flex items-center gap-2">
                                                <div className="w-5 h-5 rounded border border-gray-100 overflow-hidden shrink-0 bg-gray-50 flex items-center justify-center">
                                                    {item.product.imageUrl ? (
                                                        <img src={item.product.imageUrl} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-[6px] text-gray-300">Img</span>
                                                    )}
                                                </div>
                                                <div className="truncate">
                                                    <span className="text-gray-900 font-bold truncate block">{item.product.name}</span>
                                                    {item.product.nameJP && <span className="text-[9px] text-gray-400 truncate block">{item.product.nameJP}</span>}
                                                </div>
                                            </div>
                                            <div className="text-center font-bold text-gray-900">{item.quantity}</div>
                                            <div className="text-right pr-2 font-medium text-gray-600">{supplyPrice.toLocaleString()}</div>
                                            <div className="text-right pr-2 text-gray-400">{vat.toLocaleString()}</div>
                                            <div className="px-2 text-[9px] text-gray-400 truncate font-mono">{item.product.productCode || '-'}</div>
                                            <div className="px-2 truncate">
                                                {item.product.barcode ? <BarcodeDisplay value={item.product.barcode} width={0.5} height={10} fontSize={0} displayValue={false} showDownload={false} /> : '-'}
                                            </div>
                                        </li>
                                    )
                                })}
                                {/* Shipping & Totals */}
                                {shippingFee > 0 && (
                                    <li className="grid grid-cols-[30px_1fr_40px_70px_70px_auto] items-center text-[10px] py-1 bg-blue-50/20">
                                        <span className="text-center">-</span>
                                        <span className="px-2 font-bold text-gray-500">배송비 (Shipping)</span>
                                        <span className="text-center">1</span>
                                        <span className="text-right pr-2 font-medium text-gray-600">{shippingFee.toLocaleString()}</span>
                                        <span className="text-right pr-2 text-gray-400">{shippingVat.toLocaleString()}</span>
                                    </li>
                                )}
                                <li className="bg-gray-50/50 p-3 mt-2 flex justify-end items-center gap-6 text-[11px] border-t border-gray-100">
                                    <div className="flex gap-2 text-gray-500">
                                        <span>총 수량:</span>
                                        <span className="font-bold text-gray-900">{totalQuantity.toLocaleString()}</span>
                                    </div>
                                    <div className="flex gap-2 text-gray-500">
                                        <span>공급가:</span>
                                        <span className="font-bold text-gray-900">{grandSupply.toLocaleString()}</span>
                                    </div>
                                    <div className="flex gap-2 text-gray-500">
                                        <span>부가세:</span>
                                        <span className="font-bold text-gray-900">{grandVat.toLocaleString()}</span>
                                    </div>
                                    <div className="flex gap-2 text-[#d9361b] text-sm">
                                        <span className="font-bold">합계:</span>
                                        <span className="font-black">{totalAmount.toLocaleString()}원</span>
                                    </div>
                                </li>
                            </ul>
                        </div>

                        <div className="mt-4 px-4 py-3 bg-gray-100 rounded-xl flex justify-between items-center text-[10px] text-gray-500">
                            <div className="flex gap-4">
                                <span>주문시간: <span className="font-bold text-gray-700">{formattedDate}</span></span>
                                {order.depositConfirmedAt && <span>입금확인(사용자): <span className="font-bold text-gray-700">{formatSimpleDate(order.depositConfirmedAt)}</span></span>}
                            </div>
                            {order.adminDepositConfirmedAt && <span className="text-green-600 font-bold">✓ 관리자 입금 확인됨 ({formatSimpleDate(order.adminDepositConfirmedAt)})</span>}
                        </div>
                    </div>
                </div>
            )}
            {order.taxInvoiceIssued && (
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full py-2 flex items-center justify-center gap-1 text-gray-400 hover:text-gray-600 hover:bg-black/5 transition-all text-xs border-t border-black/5"
                >
                    <span className="font-bold">{isExpanded ? '상세내역 접기' : '상세내역 펼치기'}</span>
                    <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
            )}
        </div>
    )
}
