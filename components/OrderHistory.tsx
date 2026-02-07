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
                            레이어 구조:
                            1. 메인 콘텐츠 (세금계산서 발행 시 흐려짐)
                            2. 회사 직인 (항상 밝게 표시, 최상단 배치)
                        */}

                        {/* Main Content Layer */}
                        <div className={`p-6 transition-all rounded-xl ${order.taxInvoiceIssued ? 'bg-gray-200 brightness-75 shadow-inner' : ''}`}>
                            <div className="flex flex-col border-b border-gray-100 pb-2 mb-2 gap-4">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div className="flex flex-col sm:flex-row items-center gap-6">
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
                                                            배송 대기 중
                                                        </div>
                                                    ) : order.status === 'SHIPPED' ? (
                                                        <div className="flex flex-col items-end gap-1">
                                                            <div className="bg-green-100 text-green-600 px-3 py-1.5 rounded-lg text-xs font-bold border border-green-200 cursor-default w-40 text-center">
                                                                🚚 출고완료
                                                            </div>
                                                            {order.trackingNumber && (
                                                                <div className="flex items-center gap-1 w-40">
                                                                    <div className="bg-red-50/50 border border-red-100 px-2 py-1.5 rounded-lg text-[10px] text-red-600 font-bold shrink-0 min-w-[50px] text-center">
                                                                        {order.courier === 'Rosen' ? '로젠' :
                                                                            order.courier === 'CJ' ? 'CJ' :
                                                                                order.courier === 'Lotte' ? '롯데' : order.courier || '배송'}
                                                                    </div>
                                                                    <div className="flex-grow bg-red-50/50 border border-red-100 px-2 py-1.5 rounded-lg text-[11px] font-black text-red-600 text-center">
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
                                                            {loadingMap[order.id] ? '처리중...' : '입금확인'}
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
                                                            주문삭제
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

                            <div className="bg-white border border-gray-100 border-t-red-500 rounded-xl p-3 md:p-6 overflow-hidden">
                                <h4 className="text-xs font-black text-gray-900 mb-4 flex items-center gap-2">
                                    <span className="w-1 h-3 bg-red-500 rounded-full"></span>
                                    주문상세내역
                                </h4>

                                {/* Items Header - Desktop only */}
                                <div className="hidden md:grid grid-cols-[40px_1fr_60px_100px_100px_140px] gap-2 pb-2 border-b-2 border-gray-900 text-[10px] uppercase tracking-widest text-gray-500 font-black px-2">
                                    <div className="text-center">No.</div>
                                    <div className="px-2">상품명</div>
                                    <div className="text-center">수량</div>
                                    <div className="text-right pr-4">금액</div>
                                    <div className="px-2">상품번호</div>
                                    <div className="px-2">바코드</div>
                                </div>

                                <ul className="divide-y divide-dashed divide-gray-100 md:border-b-2 md:border-gray-900">
                                    {order.items.map((item: any, i: number) => (
                                        <li key={item.id} className="flex flex-col md:grid md:grid-cols-[40px_1fr_60px_100px_100px_140px] items-start md:items-center text-[11px] py-4 md:py-2 gap-3 md:gap-2 border-gray-200 hover:bg-gray-50/50 transition-colors px-1 md:px-2 rounded-lg md:rounded-none">
                                            {/* No. & Price/Qty for Mobile */}
                                            <div className="flex md:hidden justify-between items-center w-full border-b border-gray-50 pb-2">
                                                <span className="text-[10px] font-black text-black tabular-nums">항목 #{String(i + 1).padStart(2, '0')}</span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-gray-400 font-black">수량: <span className="text-gray-900">{item.quantity}</span></span>
                                                    <span className="text-[#d9361b] font-black">{(item.price * item.quantity).toLocaleString()}원</span>
                                                </div>
                                            </div>

                                            <span className="hidden md:flex text-gray-400 font-black text-center self-stretch items-center justify-center tabular-nums">{String(i + 1).padStart(2, '0')}</span>

                                            <div className="min-w-0 flex items-center gap-3 flex-1 w-full md:w-auto">
                                                <div className="w-10 h-10 md:w-8 md:h-8 rounded-lg border border-gray-100 overflow-hidden shrink-0 bg-white flex items-center justify-center p-0.5">
                                                    {item.product.imageUrl ? (
                                                        <img src={item.product.imageUrl} alt="" className="w-full h-full object-contain" />
                                                    ) : (
                                                        <span className="text-[8px] text-gray-300">N/A</span>
                                                    )}
                                                </div>
                                                <div className="flex flex-col min-w-0 flex-1">
                                                    <span className="text-gray-900 block truncate font-bold text-xs md:text-[11px]" title={item.product.name}>
                                                        {item.product.name}
                                                    </span>
                                                    {item.product.nameJP && (
                                                        <span className="text-[10px] text-gray-400 leading-tight truncate font-medium">
                                                            {item.product.nameJP}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Quantity - Desktop only */}
                                            <div className="hidden md:flex text-center self-stretch items-center justify-center">
                                                <span className="text-gray-900 font-black tabular-nums">
                                                    {item.quantity.toLocaleString()}
                                                </span>
                                            </div>

                                            {/* Price - Desktop only */}
                                            <span className="hidden md:flex font-black text-gray-900 text-right pr-4 self-stretch items-center justify-end tabular-nums">
                                                {(item.price * item.quantity).toLocaleString()}
                                            </span>

                                            {/* Product Code */}
                                            <div className="flex md:flex-col items-center md:items-start gap-2 md:gap-0 w-full md:w-auto">
                                                <span className="md:hidden text-[9px] text-gray-400 font-black uppercase">상품ID:</span>
                                                <div className="text-gray-700 text-[10px] md:text-[11px] font-mono font-bold truncate flex-1 md:flex-none">
                                                    {item.product.productCode || '-'}
                                                </div>
                                            </div>

                                            {/* Barcode */}
                                            <div className="flex flex-row md:flex-col items-center md:items-start gap-3 md:gap-0 w-full md:w-auto">
                                                <div className="hidden md:block">
                                                    {item.product.barcode && (
                                                        <div className="bg-white border border-gray-50 rounded p-0.5 scale-90 origin-left">
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
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="md:hidden text-[9px] text-gray-400 font-black uppercase tracking-tighter shrink-0">바코드:</span>
                                                    <span className="text-gray-900 text-[10px] font-mono font-bold tabular-nums">
                                                        {item.product.barcode || '-'}
                                                    </span>
                                                </div>
                                            </div>
                                        </li>
                                    ))}

                                    {/* Shipping Fee */}
                                    {(() => {
                                        const totalQuantity = order.items.reduce((sum: number, item: any) => sum + item.quantity, 0);
                                        const shippingFee = totalQuantity > 0 ? Math.ceil(totalQuantity / 100) * 3000 : 0;
                                        if (shippingFee === 0) return null;
                                        return (
                                            <li className="flex flex-col md:grid md:grid-cols-[40px_1fr_60px_100px_100px_140px] items-start md:items-center text-[11px] py-4 md:py-2 px-1 md:px-2 bg-red-50/30 md:bg-transparent rounded-lg md:rounded-none">
                                                <div className="flex md:hidden justify-between items-center w-full mb-2">
                                                    <span className="text-[10px] font-black text-red-300">포장비</span>
                                                    <span className="text-red-600 font-black">{shippingFee.toLocaleString()}원</span>
                                                </div>
                                                <span className="hidden md:flex text-gray-400 font-black text-center self-stretch items-center justify-center italic">S</span>
                                                <div className="min-w-0 flex items-center gap-3 flex-1">
                                                    <div className="w-10 h-10 md:w-8 md:h-8 rounded-lg border border-red-50 overflow-hidden shrink-0 bg-red-50 flex items-center justify-center text-lg">
                                                        📦
                                                    </div>
                                                    <span className="text-red-900 font-black text-xs md:text-[11px]">배송비</span>
                                                </div>
                                                <div className="hidden md:block text-center tabular-nums font-black text-gray-400">1</div>
                                                <span className="hidden md:flex font-black text-red-600 text-right pr-4 items-center justify-end tabular-nums">
                                                    {shippingFee.toLocaleString()}
                                                </span>
                                                <div className="hidden md:block px-2 text-red-200 font-black text-[9px] uppercase">배송</div>
                                                <div className="md:hidden flex items-center gap-2 mt-1">
                                                    <span className="text-[9px] text-red-300 font-black uppercase">유형:</span>
                                                    <span className="text-red-600 text-[10px] font-bold">일반</span>
                                                </div>
                                            </li>
                                        );
                                    })()}
                                </ul>

                                <div className="mt-8 flex flex-col md:flex-row justify-between items-stretch md:items-end gap-8 pt-4">
                                    {/* Left: Bank Info */}
                                    <div className="flex flex-col gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100 flex-1 relative group">
                                        <div className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></span>
                                            <h4 className="text-[12px] font-black text-gray-800 uppercase tracking-widest">입금 계좌 정보</h4>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-[11px] font-black text-orange-600 flex items-center gap-1">
                                                <span className="bg-orange-600 text-white text-[8px] px-1 rounded">BANK</span>
                                                토스뱅크 (Toss Bank)
                                            </div>
                                            <div className="text-xl md:text-2xl font-black text-gray-900 tracking-tight font-mono select-all">
                                                1000-0918-2374
                                            </div>
                                            <div className="text-[11px] text-gray-500 font-medium">
                                                예금주: <span className="text-gray-900 font-black">BEIKO</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Totals */}
                                    <div className="flex-1 md:max-w-xs space-y-4">
                                        <div className="space-y-2 border-b border-gray-100 pb-4">
                                            {(() => {
                                                const productTotal = order.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
                                                const totalQuantity = order.items.reduce((sum: number, item: any) => sum + item.quantity, 0);
                                                const shippingFee = totalQuantity > 0 ? Math.ceil(totalQuantity / 100) * 3000 : 0;
                                                const supplyTotal = productTotal + shippingFee;

                                                return (
                                                    <div className="space-y-2">
                                                        <div className="flex justify-between items-center text-[11px] font-bold">
                                                            <span className="text-gray-400">공급가액 <span className="text-[8px] opacity-60">공급가</span></span>
                                                            <span className="text-gray-900 tabular-nums">{supplyTotal.toLocaleString()}원</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-[11px] font-bold">
                                                            <span className="text-gray-400">부가세 <span className="text-[8px] opacity-60">VAT</span></span>
                                                            <span className="text-gray-900 tabular-nums">{Math.round(supplyTotal * 0.1).toLocaleString()}원</span>
                                                        </div>

                                                        <div className="mt-4 pt-4 border-t-4 border-double border-red-500 relative">
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-red-500 font-black text-sm uppercase tracking-tighter">총 합계 금액</span>
                                                                <span className="text-red-600 font-black text-2xl tabular-nums">
                                                                    {Math.round(supplyTotal * 1.1).toLocaleString()} <span className="text-xs font-normal">원</span>
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
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
