'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ShoppingBag, CreditCard, X, Info, Truck, FileText, Banknote, Landmark } from 'lucide-react'
import BarcodeDisplay from '@/components/BarcodeDisplay'

export default function OrderHistory({ orders }: { orders: any[] }) {
    const router = useRouter()
    const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({})

    if (!orders || orders.length === 0) {
        return (
            <div className="flex items-center justify-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="text-center">
                    <p className="text-xl font-bold text-gray-400">注文履歴がありません / 주문내역이 없습니다.</p>
                </div>
            </div>
        )
    }

    const toggleDeposit = async (orderId: string, currentStatus: string) => {
        if (currentStatus === 'DEPOSIT_COMPLETED') return

        const confirmMsg = "관리자에 완료를 통지하시겠습니까? / 입금 완료 사실을 관리자에게 알리시겠습니까?"

        if (!confirm(confirmMsg)) return

        setLoadingMap(prev => ({ ...prev, [orderId]: true }))
        try {
            const res = await fetch(`/api/orders/${orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'DEPOSIT_COMPLETED' })
            })
            if (!res.ok) alert("エラーが発生しました / 오류가 발생했습니다.")
            else router.refresh()
        } catch (e) {
            alert("通信エラー / 통신 오류")
        } finally {
            setLoadingMap(prev => ({ ...prev, [orderId]: false }))
        }
    }

    const handleDelete = async (orderId: string) => {
        if (!confirm("注文を完全に削除しますか？ (復元不可) / 주문을 완전히 삭제하시겠습니까? (복구 불가능)")) return
        setLoadingMap(prev => ({ ...prev, [orderId]: true }))
        try {
            const res = await fetch(`/api/orders/${orderId}`, { method: 'DELETE' })
            if (res.ok) router.refresh()
            else alert("削除中にエラーが発生しました / 삭제 중 오류가 발생했습니다.")
        } catch (e) { alert("通信エラー / 통신 오류") }
        finally { setLoadingMap(prev => ({ ...prev, [orderId]: false })) }
    }

    return (
        <div className="space-y-8">
            {/* Header Title Layer */}
            <div className="mb-4 md:mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 px-4 md:px-0 pt-6 md:pt-0">
                <div className="flex items-baseline gap-3 text-left">
                    <h1 className="text-3xl md:text-4xl font-black text-[#111827] tracking-tight">
                        注文履歴
                    </h1>
                    <span className="text-sm font-normal text-gray-400 tracking-wide uppercase">Order History</span>
                </div>
            </div>

            {orders.map(order => {
                const supplyPrice = order.items.reduce((sum: number, item: any) => sum + (item.price * (item.quantity || 0)), 0);
                const vat = Math.round(supplyPrice * 0.1);
                const totalAmount = supplyPrice + vat;
                const totalQuantity = order.items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
                const shippingFee = Math.floor(totalQuantity / 100) * 3000;

                // Stepper Logic
                // Steps: Ordered -> Payment -> Paid -> Shipped -> Invoice
                // Mapping status to active step index (0-based)
                let activeStep = 0;
                if (order.status === 'PENDING') activeStep = 1; // Payment Wait
                if (order.status === 'PENDING_DEPOSIT') activeStep = 1;
                if (order.status === 'DEPOSIT_COMPLETED') activeStep = 2; // Paid
                if (order.status === 'SHIPPED') activeStep = 3; // Shipped
                if (order.taxInvoiceIssued) activeStep = 4; // Invoice

                // If cancelled (not in standard flow), handle gracefully (maybe show as step 0 or error state)

                const steps = [
                    { label: "注文完了", sub: "주문완료", icon: Check },
                    { label: "入金待ち", sub: "입금대기중", icon: Banknote },
                    { label: "入金完了", sub: "입금완료", icon: Check },
                    { label: "出荷完了", sub: "배송중", icon: Truck },
                    { label: "請求書発行完了", sub: "계산서발급완료", icon: FileText },
                ];

                return (
                    <div key={order.id} className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 shadow-md border border-gray-100 mb-6 mx-4 md:mx-0 last:mb-0">
                        {/* Order No & Date Box */}
                        <div className="bg-white rounded-xl py-2 px-5 flex flex-row justify-between items-center gap-4 mb-0 mx-4 md:mx-0">
                            <div className="flex flex-col text-sm">
                                <span className="text-gray-400 mb-0.5 text-xs">注文日時 / 주문일시</span>
                                <span className="font-bold text-gray-700" suppressHydrationWarning>
                                    {new Date(order.createdAt).toLocaleDateString()} {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            <div className="flex flex-col text-right text-sm">
                                <span className="text-gray-400 mb-0.5 text-xs">注文番号 / 주문번호</span>
                                <span className="font-bold text-gray-700 font-inter tracking-widest">{order.orderNumber || order.id.slice(0, 12)}</span>
                            </div>
                        </div>
                        <div className="border-t border-gray-100 mx-5 my-1" />

                        {/* Progress Stepper moved under Order No */}
                        <div className="bg-white rounded-xl py-1 px-6 mb-1 mx-4 md:mx-0">
                            <div className="relative flex justify-between items-start overflow-hidden pt-2">
                                {/* Connecting Line Container (Grey Background) */}
                                <div className="absolute top-[26px] left-[10%] right-[10%] h-[1px] bg-gray-200 -z-10">
                                    {/* Active Progress Line (Red) */}
                                    <div
                                        className="h-full bg-[#e34219] transition-all duration-500"
                                        style={{ width: `${(activeStep / (steps.length - 1)) * 100}%` }}
                                    />
                                </div>

                                {steps.map((step, idx) => {
                                    const isActive = idx <= activeStep;

                                    return (
                                        <div key={idx} className="flex-1 flex flex-col items-center gap-2 focus:outline-none relative z-10">
                                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs transition-all duration-300
                                                ${isActive ? 'bg-[#e34219] shadow-[0_0_0_4px_rgba(227,66,25,0.1)]' : 'bg-gray-200 text-gray-400'}
                                            `}>
                                                {isActive ? <step.icon size={16} strokeWidth={3} /> : idx + 1}
                                            </div>
                                            <div className="text-center">
                                                <div className={`text-[10px] md:text-xs font-bold mb-0.5 whitespace-nowrap ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                                                    {step.label}
                                                </div>
                                                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                                                    {step.sub}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Payment Information & Totals Summary */}
                        <div className="bg-white rounded-xl p-5 mb-3 mx-4 md:mx-0">
                            <div className="flex items-center gap-2 mb-3 border-b border-gray-100 pb-2">
                                <Landmark size={14} className="text-[#e34219]" />
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-tight">お支払い情報 / 입금정보</h3>
                            </div>

                            <div className="flex flex-col gap-0.5 tracking-tight">
                                {/* Bank Details */}
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-900 text-xs min-w-[100px]">銀行名 / 은행</span>
                                    <span className="font-bold text-gray-900">Woori Bank (우리은행)</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-900 text-xs min-w-[100px]">口座番号 / 계좌</span>
                                    <span className="font-bold text-gray-900 font-inter">1005-704-096332</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-900 text-xs min-w-[100px]">名義人 / 예금주</span>
                                    <span className="font-bold text-gray-900 uppercase">XTRACKER</span>
                                </div>

                                {/* Separator & Total Amount Details */}
                                <div className="flex justify-between items-center py-1.5 mt-1 border-t border-gray-100">
                                    <span className="font-bold text-sm text-gray-900 underline decoration-[#e34219]/30 decoration-2 underline-offset-4">合計金額 / 총 합계금액</span>
                                    <span className="font-bold text-lg text-[#e34219] font-inter"><span className="text-sm mr-0.5">₩</span>{totalAmount.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-xs text-gray-400">
                                    <span>供給価額 / 공급가액</span>
                                    <span className="font-medium font-inter">₩{supplyPrice.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-xs text-gray-400">
                                    <span>消費税 / 부가세 (10%)</span>
                                    <span className="font-medium font-inter">₩{vat.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="bg-white rounded-xl mb-1 mx-4 md:mx-0">
                            <div className={`grid ${order.status === 'DEPOSIT_COMPLETED' ? 'grid-cols-1' : 'grid-cols-2'} gap-2`}>
                                <button
                                    onClick={() => order.status !== 'DEPOSIT_COMPLETED' && toggleDeposit(order.id, order.status)}
                                    disabled={loadingMap[order.id] || order.status === 'DEPOSIT_COMPLETED'}
                                    className={`h-13 border-2 rounded-lg font-bold transition-all flex items-center justify-center gap-2
                                        ${order.status === 'DEPOSIT_COMPLETED'
                                            ? 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed'
                                            : 'border-[#e34219] text-[#e34219] bg-white hover:bg-orange-50'
                                        }`}
                                >
                                    {loadingMap[order.id] ? 'Processing...' : (
                                        order.status === 'DEPOSIT_COMPLETED' ? (
                                            <div className="flex flex-col items-center leading-tight py-1">
                                                <span className="text-sm md:text-base font-bold">ご入金を確認後、商品を発送いたします。</span>
                                                <span className="text-[11px] md:text-sm font-medium opacity-80">입금확인 후 제품이 발송됩니다.</span>
                                            </div>
                                        ) : (
                                            <span className="text-sm">入金確認の要請 (Confirm Deposit)</span>
                                        )
                                    )}
                                </button>
                                {order.status !== 'DEPOSIT_COMPLETED' && (
                                    <button
                                        onClick={() => handleDelete(order.id)}
                                        disabled={loadingMap[order.id]}
                                        className="h-12 border border-gray-200 text-gray-400 bg-white rounded-lg font-bold text-sm hover:bg-gray-50 transition-all font-bold"
                                    >
                                        注文キャンセル (Cancel)
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Alert Box */}
                        {order.status !== 'DEPOSIT_COMPLETED' && (
                            <div className="bg-[#f0ebeb] border border-[#ead7d3] rounded-xl p-5 flex items-start gap-4 mb-4 mx-4 md:mx-0">
                                <div className="w-5 h-5 rounded-full bg-[#e34219] text-white flex items-center justify-center shrink-0 mt-0.5 font-bold text-sm font-serif">i</div>
                                <div className="text-xs leading-relaxed text-gray-600">
                                    <span className="font-bold text-[#e34219]">合計 {totalAmount.toLocaleString()}ウォン</span>を入금 후、「入金確認의 요성」보턴을 눌러주세요. 입금확인 후 주문취소는 불가능합니다.
                                    <span className="text-gray-400 mt-1 block font-medium">합계 금액을 입금하신 후 확인 요청을 해주세요. 입금 확인 후에는 주문을 취소할 수 없습니다.</span>
                                </div>
                            </div>
                        )}

                        {/* Order Items List */}
                        <div className="mt-8 mx-4 md:mx-0">
                            <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-3">
                                <h3 className="text-base font-extrabold text-gray-900 tracking-tight">注文商品リスト <span className="text-gray-400 font-medium ml-1">/ 주문상품목록</span></h3>
                            </div>

                            <div className="space-y-3">
                                {order.items.map((item: any, idx: number) => (
                                    <div key={idx} className="bg-white border border-gray-100 rounded-xl p-4 flex gap-4 md:items-center shadow-sm relative overflow-hidden">
                                        <div className="flex flex-col items-center gap-1.5 shrink-0">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">No. {idx + 1}</span>
                                            <div className="w-16 h-16 md:w-20 md:h-20 bg-white border border-gray-100 rounded-lg flex items-center justify-center shrink-0 p-1">
                                                {item.product.imageUrl ? (
                                                    <img src={item.product.imageUrl} alt="" className="w-full h-full object-contain" />
                                                ) : (
                                                    <span className="text-xs text-gray-300">No Img</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                                            <h4 className="font-bold text-sm text-gray-900 truncate leading-tight">{item.product.nameJP || item.product.name}</h4>
                                            <p className="text-xs text-gray-900 font-medium leading-tight">{item.product.nameEN || item.product.name}</p>
                                            <div className="text-[10px] text-blue-400 font-medium font-inter leading-tight">
                                                Code: {item.product.productCode || '-'}
                                            </div>
                                            {item.product.barcode && (
                                                <div className="mt-1 flex justify-start">
                                                    <BarcodeDisplay
                                                        value={item.product.barcode}
                                                        height={12}
                                                        width={0.8}
                                                        fontSize={10}
                                                        showDownload={false}
                                                        displayValue={true}
                                                    />
                                                </div>
                                            )}
                                            <div className="flex items-end justify-between mt-1">
                                                <div className="flex items-center gap-2 text-xs leading-tight">
                                                    <span className="font-bold text-gray-900 font-inter">₩{item.price.toLocaleString()}</span>
                                                    <span className="text-gray-900 font-inter font-medium">x {item.quantity}ea</span>
                                                </div>
                                                <span className="font-bold text-base md:text-lg text-gray-900 font-inter leading-none">
                                                    ₩{(item.price * item.quantity).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {shippingFee > 0 && (
                                    <div className="bg-orange-50/50 border border-orange-100 rounded-xl p-4 flex gap-4 md:items-center shadow-sm">
                                        <div className="w-16 h-16 md:w-20 md:h-20 bg-white border border-orange-100 rounded-lg flex items-center justify-center shrink-0">
                                            <Truck className="text-[#e34219]" size={24} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <h4 className="font-bold text-sm text-gray-900">送料 <span className="text-gray-400 font-normal">/ 배송비</span></h4>
                                                    <p className="text-[10px] text-gray-500 mt-0.5">※ 100개당 3,000원 추가 (총 {totalQuantity}개)</p>
                                                </div>
                                                <span className="font-bold text-base md:text-lg text-[#e34219] font-inter">
                                                    ₩{shippingFee.toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
