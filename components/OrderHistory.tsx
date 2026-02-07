'use client'

import { useState } from 'react'
import OrderActions from '@/components/OrderActions'
import BarcodeDisplay from '@/components/BarcodeDisplay'
import OrderStatus from '@/components/OrderStatus'
import { useRouter } from 'next/navigation'

export default function OrderHistory({ orders }: { orders: any[] }) {
    const router = useRouter()
    const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({})

    if (!orders || orders.length === 0) {
        return (
            <div className="flex items-center justify-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="text-center">
                    <p className="text-xl font-bold text-gray-400">주문내역이 없습니다.</p>
                </div>
            </div>
        )
    }

    const toggleDeposit = async (orderId: string, currentStatus: string) => {
        const isCompleted = currentStatus === 'DEPOSIT_COMPLETED'
        const targetStatus = isCompleted ? 'PENDING' : 'DEPOSIT_COMPLETED'
        const confirmMsg = isCompleted
            ? "입금 확인을 취소하시겠습니까?"
            : "입금 완료 사실을 관리자에게 알리시겠습니까?"

        if (!confirm(confirmMsg)) return

        setLoadingMap(prev => ({ ...prev, [orderId]: true }))
        try {
            const res = await fetch(`/api/orders/${orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: targetStatus })
            })
            if (res.ok) {
                router.refresh()
            } else {
                alert("오류가 발생했습니다.")
            }
        } catch (e) {
            console.error(e)
            alert("통신 오류가 발생했습니다.")
        } finally {
            setLoadingMap(prev => ({ ...prev, [orderId]: false }))
        }
    }

    return (
        <div className="">
            <div className="space-y-4">
                {orders.map(order => (
                    <div key={order.id} className="glass-panel rounded-xl bg-white shadow-sm transition-all relative">
                        {/* 
                            We use two layers:
                            1. Main Content (Dims when tax invoice is issued)
                            2. Company Stamp (Always bright, positioned on top)
                        */}

                        {/* Main Content Layer */}
                        <div className={`p-6 transition-all rounded-xl ${order.taxInvoiceIssued ? 'bg-gray-200 brightness-75 shadow-inner' : ''}`}>
                            <div className="flex flex-col border-b border-gray-100 pb-2 mb-2 gap-4">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div className="flex flex-col sm:flex-row items-center gap-6">
                                        {/* Stamp Section */}
                                        {order.taxInvoiceIssued && (
                                            <div className="flex items-center justify-center shrink-0">
                                                <img
                                                    src="/bko.png"
                                                    alt="Stamp"
                                                    className="w-20 h-auto -rotate-12 block"
                                                    style={{ filter: 'brightness(1.1) saturate(1.2)' }}
                                                />
                                            </div>
                                        )}

                                        {/* Info Section */}
                                        <div className="flex flex-col items-start">
                                            <p className="text-xs text-gray-500 font-medium" suppressHydrationWarning>
                                                {new Date(order.createdAt).toLocaleDateString()} {new Date(order.createdAt).toLocaleTimeString()}
                                            </p>
                                            <p className="text-base font-bold text-gray-800">
                                                주문번호# {order.orderNumber || order.id.slice(0, 8)}
                                            </p>
                                            {(order.status === 'SHIPPED' || order.taxInvoiceIssued) && (
                                                <button
                                                    onClick={() => router.push(`/invoice/${order.id}`)}
                                                    className="mt-2 bg-gray-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-md hover:bg-gray-800 transition-all active:scale-95 flex items-center justify-center gap-1.5 w-max"
                                                >
                                                    <span>📄</span> 거래명세표 출력
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="w-full md:w-auto flex flex-col items-end gap-1.5">
                                        {(order.status === 'PENDING' || order.status === 'PENDING_DEPOSIT' || order.status === 'DEPOSIT_COMPLETED' || order.status === 'SHIPPED' || order.taxInvoiceIssued) && (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    {order.status === 'DEPOSIT_COMPLETED' ? (
                                                        <div className="bg-orange-100 text-orange-600 px-3 py-1.5 rounded-lg text-xs font-bold border border-orange-200 cursor-default">
                                                            배송대기중 (Preparing for Shipping)
                                                        </div>
                                                    ) : order.status === 'SHIPPED' ? (
                                                        <div className="flex flex-col items-end gap-1">
                                                            <div className="bg-green-100 text-green-600 px-3 py-1.5 rounded-lg text-xs font-bold border border-green-200 cursor-default w-40 text-center">
                                                                🚚 출고완료 (Released)
                                                            </div>
                                                            {order.trackingNumber && (
                                                                <div className="flex items-center gap-1 w-40">
                                                                    <div className="bg-blue-50/50 border border-blue-100 px-2 py-1.5 rounded-lg text-[10px] text-[var(--color-brand-blue)] font-bold shrink-0 min-w-[50px] text-center">
                                                                        {order.courier === 'Rosen' ? '로젠' :
                                                                            order.courier === 'CJ' ? 'CJ' :
                                                                                order.courier === 'Lotte' ? '롯데' : order.courier || '배송'}
                                                                    </div>
                                                                    <div className="flex-grow bg-blue-50/50 border border-blue-100 px-2 py-1.5 rounded-lg text-[11px] font-black text-[var(--color-brand-blue)] text-center">
                                                                        {order.trackingNumber}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (order.status === 'PENDING' || order.status === 'PENDING_DEPOSIT') ? (
                                                        <button
                                                            onClick={() => toggleDeposit(order.id, order.status)}
                                                            disabled={loadingMap[order.id]}
                                                            className="bg-black hover:bg-gray-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-md transition-all active:scale-95 disabled:opacity-50"
                                                        >
                                                            {loadingMap[order.id] ? '처리중...' : '입금확인 (Deposit Completed)'}
                                                        </button>
                                                    ) : null}

                                                    {(order.status === 'PENDING' || order.status === 'PENDING_DEPOSIT') && (
                                                        <button
                                                            onClick={async () => {
                                                                if (!confirm("주문을 완전히 삭제하시겠습니까? (복구 불가능)")) return
                                                                setLoadingMap(prev => ({ ...prev, [order.id]: true }))
                                                                try {
                                                                    const res = await fetch(`/api/orders/${order.id}`, {
                                                                        method: 'DELETE'
                                                                    })
                                                                    if (res.ok) router.refresh()
                                                                    else alert("삭제 중 오류가 발생했습니다.")
                                                                } catch (e) { alert("통신 오류가 발생했습니다.") }
                                                                finally { setLoadingMap(prev => ({ ...prev, [order.id]: false })) }
                                                            }}
                                                            disabled={loadingMap[order.id]}
                                                            className="bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-300 transition-all active:scale-95"
                                                        >
                                                            주문삭제 (Delete Order)
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="text-right">
                                                    {(order.status === 'PENDING' || order.status === 'PENDING_DEPOSIT') && (
                                                        <p className="text-[10px] text-gray-500 font-medium tracking-tight">
                                                            합계 <span className="text-black font-bold">{Math.round(order.total * 1.1).toLocaleString()}원</span>을 입금 후, <span className="text-black font-bold">입금확인</span> 버튼을 눌러주세요. <br />
                                                            <span className="text-[#d9361b] font-bold">입금확인 이후 주문은 삭제가 불가능합니다.</span>
                                                        </p>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="mt-2">
                                    <OrderStatus
                                        status={order.status}
                                        trackingNumber={order.trackingNumber}
                                        taxInvoiceIssued={order.taxInvoiceIssued}
                                    />
                                </div>
                            </div>

                            <div className="bg-white border border-gray-100 border-t-red-500 rounded-lg p-4">
                                <h4 className="text-xs font-semibold text-gray-700 mb-2">주문상세내역</h4>
                                <div className="grid grid-cols-[40px_1fr_60px_100px_100px_160px] gap-y-0 pb-2 border-b border-black text-[11px] uppercase tracking-wider text-gray-700 font-bold px-0">
                                    <div className="text-center">No.</div>
                                    <div className="px-2">상품명</div>
                                    <div className="text-center">수량</div>
                                    <div className="text-right pr-4">금액</div>
                                    <div className="px-2">상품번호</div>
                                    <div className="px-2">바코드</div>
                                </div>
                                <ul className="divide-y divide-dashed divide-gray-200 border-b-2 border-black">
                                    {order.items.map((item: any, i: number) => (
                                        <li key={item.id} className="grid grid-cols-[40px_1fr_60px_100px_100px_160px] items-center text-[11px] py-1 gap-y-0 border-b border-dashed border-gray-200 last:border-0 even:bg-gray-100/70">
                                            <span className="text-gray-700 font-medium text-center self-stretch flex items-center justify-center">{String(i + 1).padStart(2, '0')}</span>
                                            <div className="min-w-0 px-2 self-stretch flex items-center gap-2">
                                                <div className="w-8 h-8 rounded border border-gray-100 overflow-hidden shrink-0 bg-gray-50 flex items-center justify-center">
                                                    {item.product.imageUrl ? (
                                                        <img src={item.product.imageUrl} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-[8px] text-gray-300">N/A</span>
                                                    )}
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-gray-800 block truncate font-medium" title={item.product.name}>
                                                        {item.product.name}
                                                    </span>
                                                    {item.product.nameJP && (
                                                        <span className="text-[10px] text-gray-500 leading-tight truncate">
                                                            {item.product.nameJP}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-center self-stretch flex items-center justify-center">
                                                <span className="text-gray-600 font-semibold">
                                                    {item.quantity.toLocaleString()}
                                                </span>
                                            </div>
                                            <span className="font-bold text-gray-900 text-right pr-4 self-stretch flex items-center justify-end">
                                                {(item.price * item.quantity).toLocaleString()} 원
                                            </span>
                                            <div className="text-gray-900 text-[11px] truncate px-2 self-stretch flex items-center" title={item.product.productCode || ''}>
                                                {item.product.productCode || '-'}
                                            </div>
                                            <div className="flex flex-col items-start justify-center h-full">
                                                {item.product.barcode && (
                                                    <div className="bg-white border border-gray-100 rounded overflow-hidden">
                                                        <BarcodeDisplay
                                                            value={item.product.barcode}
                                                            width={1}
                                                            height={15}
                                                            fontSize={0}
                                                            displayValue={false}
                                                            showDownload={false}
                                                        />
                                                    </div>
                                                )}
                                                <span className="text-gray-900 text-[10px] mt-[1px] whitespace-nowrap">
                                                    {item.product.barcode || '-'}
                                                </span>
                                            </div>
                                        </li>
                                    ))}
                                    {/* Shipping Fee as a Row */}
                                    {(() => {
                                        const totalQuantity = order.items.reduce((sum: number, item: any) => sum + item.quantity, 0);
                                        const shippingFee = totalQuantity > 0 ? Math.ceil(totalQuantity / 100) * 3000 : 0;
                                        if (shippingFee === 0) return null;
                                        return (
                                            <li className="grid grid-cols-[40px_1fr_60px_100px_100px_160px] items-center text-[11px] py-1 gap-y-0 even:bg-gray-100/70">
                                                <span className="text-gray-700 font-medium text-center">-</span>
                                                <div className="min-w-0 px-2 flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded border border-gray-100 overflow-hidden shrink-0 bg-gray-50 flex items-center justify-center">
                                                        <span className="text-[12px]">📦</span>
                                                    </div>
                                                    <span className="text-gray-800 font-bold">배송비 (Shipping Fee)</span>
                                                </div>
                                                <div className="text-center">1</div>
                                                <span className="font-bold text-gray-900 text-right pr-4">
                                                    {shippingFee.toLocaleString()} 원
                                                </span>
                                                <div className="px-2 text-gray-400">SHIPPING</div>
                                                <div className="px-2 text-gray-400">-</div>
                                            </li>
                                        );
                                    })()}
                                </ul>

                                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-start gap-8">
                                    {/* Left: Bank Info */}
                                    <div className="flex flex-col gap-2">
                                        <h4 className="text-[12px] font-bold text-gray-800">입금계좌 안내 (Bank Info)</h4>
                                        <div className="min-w-[240px]">
                                            <div className="text-[12px] font-bold text-orange-600 mb-0.5">
                                                Toss Bank (토스뱅크)
                                            </div>
                                            <div className="text-[14px] font-bold text-[var(--color-brand-blue)] mb-1 tracking-tight">
                                                1000-0918-2374
                                            </div>
                                            <div className="text-[11px] text-gray-500">
                                                예금주: <span className="text-gray-700 font-medium">BEIKO</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Totals */}
                                    <div className="relative min-w-[240px]">
                                        <div className="grid grid-cols-[auto_120px] gap-y-1 text-[12px]">
                                            {(() => {
                                                const productTotal = order.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
                                                const totalQuantity = order.items.reduce((sum: number, item: any) => sum + item.quantity, 0);
                                                const shippingFee = totalQuantity > 0 ? Math.ceil(totalQuantity / 100) * 3000 : 0;
                                                const supplyTotal = productTotal + shippingFee;

                                                return (
                                                    <>
                                                        <span className="text-gray-500 text-left">공급가액 (Supply Total):</span>
                                                        <span className="text-gray-900 font-medium text-right">{supplyTotal.toLocaleString()} 원</span>

                                                        <span className="text-gray-500 text-left">부가세 (VAT):</span>
                                                        <span className="text-gray-900 font-medium text-right">{Math.round(supplyTotal * 0.1).toLocaleString()} 원</span>

                                                        <div className="col-span-2 relative mt-2 pt-2 border-t border-gray-100">
                                                            <div className="relative flex items-center justify-end">
                                                                {order.taxInvoiceIssued && (
                                                                    <div className="absolute right-full mr-8 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                                                                        <img
                                                                            src="/bko.png"
                                                                            alt="Stamp"
                                                                            className="w-20 h-auto opacity-100 brightness-110 -rotate-12 select-none"
                                                                        />
                                                                    </div>
                                                                )}
                                                                <div className="flex items-center gap-12">
                                                                    <span className="text-[var(--color-brand-blue)] font-bold text-lg text-left">합계 :</span>
                                                                    <span className="text-[var(--color-brand-blue)] font-bold text-lg w-[120px] text-right">{Math.round(supplyTotal * 1.1).toLocaleString()} 원</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Company Stamp Layer - Stays bright, positioned relative to Total amount */}

                    </div>
                ))}
            </div>
        </div>
    )
}
