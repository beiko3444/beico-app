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
        const isCompleted = currentStatus === 'DEPOSIT_COMPLETED'
        const targetStatus = isCompleted ? 'PENDING' : 'DEPOSIT_COMPLETED'
        const confirmMsg = isCompleted
            ? "入金確認をキャンセルしますか？ / 입금 확인을 취소하시겠습니까?"
            : "管理者に完了を通知しますか？ / 입금 완료 사실을 관리자에게 알리시겠습니까?"

        if (!confirm(confirmMsg)) return

        setLoadingMap(prev => ({ ...prev, [orderId]: true }))
        try {
            const res = await fetch(`/api/orders/${orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: targetStatus })
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
                const totalAmount = Math.round(order.total * 1.1)

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
                    { label: "注文完了", sub: "Ordered", icon: Check },
                    { label: "入金待ち", sub: "Payment", icon: Banknote },
                    { label: "入金完了", sub: "Paid", icon: Check },
                    { label: "出荷完了", sub: "Shipped", icon: Truck },
                    { label: "請求書\n発行完了", sub: "Invoice", icon: FileText },
                ];

                return (
                    <div key={order.id} className="bg-white rounded-none md:rounded-2xl pb-8 md:p-6 border-b-8 border-gray-100 md:border md:shadow-sm last:border-0">
                        {/* Order No & Date Box */}
                        <div className="bg-[#f8f9fa] rounded-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 mx-4 md:mx-0">
                            <div className="flex flex-col text-sm">
                                <span className="text-gray-400 mb-1 text-xs">注文番号 / 주문번호</span>
                                <span className="font-extrabold text-xl text-gray-900 tracking-tight">{order.orderNumber || order.id.slice(0, 12)}</span>
                            </div>
                            <div className="flex flex-col text-sm md:text-right">
                                <span className="text-gray-400 mb-1 text-xs">注文日時 / 주문일시</span>
                                <span className="font-bold text-gray-700">
                                    {new Date(order.createdAt).toLocaleDateString()} {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 gap-3 mb-6 px-4 md:px-0">
                            <button
                                onClick={() => toggleDeposit(order.id, order.status)}
                                disabled={loadingMap[order.id]}
                                className={`h-12 border-2 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2
                                    ${order.status === 'DEPOSIT_COMPLETED'
                                        ? 'border-gray-300 text-gray-400 bg-gray-50'
                                        : 'border-[#e34219] text-[#e34219] bg-white hover:bg-orange-50'
                                    }`}
                            >
                                {loadingMap[order.id] ? 'Processing...' : (
                                    order.status === 'DEPOSIT_COMPLETED' ? '入金確認完了 (Confirmed)' : '入金確認の要請 (Confirm)'
                                )}
                            </button>
                            <button
                                onClick={() => handleDelete(order.id)}
                                disabled={loadingMap[order.id]}
                                className="h-12 border border-gray-200 text-gray-400 bg-white rounded-lg font-bold text-sm hover:bg-gray-50 transition-all"
                            >
                                注文キャンセル (Cancel)
                            </button>
                        </div>

                        {/* Alert Box */}
                        <div className="bg-[#fef2f2] rounded-xl p-5 flex items-start gap-4 mb-8 mx-4 md:mx-0">
                            <div className="w-5 h-5 rounded-full bg-[#e34219] text-white flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs font-serif">i</div>
                            <div className="text-xs leading-relaxed text-gray-600">
                                <span className="font-bold text-[#e34219]">{totalAmount.toLocaleString()}ウォン</span>を入金後、「入金確認の要請」ボタンを押してください。入金確認後の注文キャンセルはできません。<br />
                                <span className="text-gray-400 mt-1 block font-medium">합계 금액을 입금하신 후 확인 요청을 해주세요. 입금 확인 후에는 주문을 취소할 수 없습니다.</span>
                            </div>
                        </div>

                        {/* Progress Stepper */}
                        <div className="relative flex justify-between items-start px-2 md:px-12 mb-10 overflow-hidden mx-4 md:mx-0">
                            {/* Connecting Line */}
                            <div className="absolute top-[18px] left-0 right-0 h-[2px] bg-gray-100 -z-10" />
                            <div
                                className="absolute top-[18px] left-0 h-[2px] bg-[#e34219] -z-10 transition-all duration-500"
                                style={{ width: `${(activeStep / (steps.length - 1)) * 100}%` }}
                            />

                            {steps.map((step, idx) => {
                                const isActive = idx <= activeStep;
                                const isCurrent = idx === activeStep;

                                return (
                                    <div key={idx} className="flex flex-col items-center gap-2 bg-white px-1">
                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs transition-all duration-300
                                            ${isActive ? 'bg-[#e34219] shadow-[0_0_0_4px_rgba(227,66,25,0.1)]' : 'bg-gray-100 text-gray-400'}
                                        `}>
                                            {isActive ? <step.icon size={16} strokeWidth={3} /> : idx + 1}
                                        </div>
                                        <div className="text-center">
                                            <div className={`text-[10px] md:text-xs font-bold mb-0.5 whitespace-pre-line ${isActive ? 'text-gray-900' : 'text-gray-300'}`}>
                                                {step.label}
                                            </div>
                                            <div className="text-[9px] font-bold text-gray-300 uppercase tracking-wide">
                                                {step.sub}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Order Items List */}
                        <div className="mt-8 mx-4 md:mx-0">
                            <div className="flex items-center gap-2 mb-4">
                                <ShoppingBag className="text-[#e34219]" size={20} fill="#e34219" />
                                <h3 className="text-base font-bold text-gray-900">注文商品リスト <span className="text-gray-400 font-normal ml-1">/ 주문 상품 목록</span></h3>
                            </div>

                            <div className="space-y-3">
                                {order.items.map((item: any, idx: number) => (
                                    <div key={idx} className="bg-white border border-gray-100 rounded-xl p-4 flex gap-4 md:items-center">
                                        <div className="w-16 h-16 md:w-20 md:h-20 bg-gray-50 border border-gray-100 rounded-lg flex items-center justify-center shrink-0 p-1">
                                            {item.product.imageUrl ? (
                                                <img src={item.product.imageUrl} alt="" className="w-full h-full object-contain" />
                                            ) : (
                                                <span className="text-xs text-gray-300">No Img</span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-sm text-gray-900 truncate">{item.product.nameJP || item.product.name}</h4>
                                            <p className="text-xs text-gray-400 font-medium mb-1">{item.product.nameEN || item.product.name}</p>
                                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 mt-2">
                                                <span className="text-blue-400 font-medium">Code: {item.product.productCode || '-'}</span>
                                                <span className="font-bold text-gray-900">₩{item.price.toLocaleString()}</span>
                                                <span className="text-gray-400">x {item.quantity}ea</span>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <span className="block font-bold text-base md:text-lg text-gray-900">₩{(item.price * item.quantity).toLocaleString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Payment Information */}
                        <div className="mt-8 bg-[#f8f9fa] rounded-xl p-6 mx-4 md:mx-0">
                            <div className="flex items-center gap-2 mb-6 border-b border-gray-200 pb-2">
                                <Landmark size={16} className="text-gray-500" />
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">お支払い情報 / PAYMENT INFORMATION</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 text-sm">
                                <div className="flex justify-between md:justify-start md:gap-8">
                                    <span className="text-gray-500 min-w-[140px]">銀行名 / Bank Name</span>
                                    <span className="font-bold text-gray-900">ウリ銀行 (Woori Bank)</span>
                                </div>
                                <div className="flex justify-between md:justify-start md:gap-8 md:col-start-2 md:justify-end md:text-right">
                                    {/* Empty or additional info */}
                                </div>
                                <div className="flex justify-between md:justify-start md:gap-8">
                                    <span className="text-gray-500 min-w-[140px]">口座番号 / Account No.</span>
                                    <span className="font-bold text-gray-900 tracking-wide font-mono">1002-445-88822</span>
                                </div>
                                <div className="flex justify-between md:justify-start md:gap-8">
                                    <span className="text-gray-500 min-w-[140px]">名義人 / Account Holder</span>
                                    <span className="font-bold text-gray-900">Beiko Co., Ltd.</span>
                                </div>
                            </div>
                        </div>

                        {/* Footer Totals */}
                        <div className="mt-6 flex flex-col gap-2 m-4 md:mx-0">
                            <div className="flex justify-between text-xs text-gray-500">
                                <span>供給価額 / 공급가액</span>
                                <span className="font-medium">₩{order.total.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-xs text-gray-500">
                                <span>消費税 / 부가세 (10%)</span>
                                <span className="font-medium">₩{Math.round(order.total * 0.1).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center mt-2 pt-4 border-t border-gray-100">
                                <span className="font-bold text-base text-gray-900">合計金額 / 총 합계금액</span>
                                <span className="font-black text-2xl text-[#e34219]">₩{totalAmount.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
