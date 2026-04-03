'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, ShoppingBag, CreditCard, X, Info, Truck, FileText, Banknote, Landmark, Package } from 'lucide-react'
import BarcodeDisplay from '@/components/BarcodeDisplay'

export default function OrderHistory({ orders, userCountry }: { orders: any[], userCountry?: string | null }) {
    const router = useRouter()
    const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({})

    if (!orders || orders.length === 0) {
        return (
            <div className="flex items-center justify-center py-20 bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-sm dark:shadow-none border border-gray-100 dark:border-[#2a2a2a]">
                <div className="text-center">
                    <p className="text-xl font-bold text-gray-400 dark:text-gray-500">注文履歴がありません / 주문내역이 없습니다.</p>
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
            if (!res.ok) {
                const data = await res.json()
                alert(`오류가 발생했습니다: ${data.error || 'Unknown error'}`)
            } else {
                router.refresh()
            }
        } catch (e) {
            alert("通信エラー / 통신 오류")
        } finally {
            setLoadingMap(prev => ({ ...prev, [orderId]: false }))
        }
    }

    const handleDelete = async (orderId: string) => {
        if (!confirm("注文을 완전히 삭제하시겠습니까? (復元不可) / 주문을 완전히 삭제하시겠습니까? (복구 불가능)")) return
        setLoadingMap(prev => ({ ...prev, [orderId]: true }))
        try {
            const res = await fetch(`/api/orders/${orderId}`, { method: 'DELETE' })
            if (res.ok) router.refresh()
            else alert("削除中にエラーが発生했습니다 / 삭제 중 오류가 발생했습니다.")
        } catch (e) { alert("通信エラー / 통신 오류") }
        finally { setLoadingMap(prev => ({ ...prev, [orderId]: false })) }
    }

    return (
        <div className="space-y-6">
            {/* Header Title Layer */}
            <div className="mb-4 md:mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4 px-4 md:px-0 pt-2 md:pt-0">
                <div className="flex items-baseline gap-3 text-left">
                    <h1 className="text-3xl md:text-4xl font-black text-[#111827] dark:text-white tracking-tight">
                        注文履歴
                    </h1>
                    <span className="text-sm font-normal text-gray-400 dark:text-gray-500 tracking-wide uppercase">Order History</span>
                </div>
            </div>

            {orders.map(order => {
                const productSum = order.items.reduce((sum: number, item: any) => sum + (item.price * (item.quantity || 0)), 0);
                const totalQuantity = order.items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);

                const isUSD = userCountry !== 'Korea' && userCountry !== 'Japan'
                const currencySymbol = userCountry === 'Korea' ? '₩' : userCountry === 'Japan' ? '¥' : '$'

                const shippingFee = isUSD ? 0 : Math.ceil(totalQuantity / 100) * 3000;

                const supplyPrice = productSum + shippingFee;
                const vat = isUSD ? 0 : Math.round(supplyPrice * 0.1);
                const totalAmount = supplyPrice + vat;

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
                    { label: "注文完了", sub: isUSD ? "Order Placed" : "주문완료", icon: Check },
                    { label: "入金待ち", sub: isUSD ? "Awaiting Payment" : "입금대기중", icon: Banknote },
                    { label: "入金完了", sub: isUSD ? "Payment Confirmed" : "입금완료", icon: Check },
                    { label: "出荷完了", sub: isUSD ? "Shipped" : "배송중", icon: Truck },
                    { label: "請求書発行完了", sub: isUSD ? "Invoice Issued" : "계산서발급완료", icon: FileText },
                ];

                return (
                    <div key={order.id} className={`bg-white dark:bg-[#1e1e1e] rounded-xl md:rounded-2xl p-2 md:p-4 pb-6 md:pb-8 shadow-md dark:shadow-none border border-gray-100 dark:border-[#2a2a2a] mb-8 mx-4 md:mx-0 last:mb-0 transition-all duration-300 ${order.taxInvoiceIssued ? 'opacity-70 brightness-[0.8] grayscale-[0.2]' : ''}`}>
                        {/* Order No & Date Box */}
                        <div className="bg-white dark:bg-[#1e1e1e] rounded-xl py-2 px-2 flex flex-row justify-between items-center gap-4 mb-0">
                            <div className="flex flex-col text-sm">
                                <span className="text-gray-400 dark:text-gray-500 mb-0.5 text-xs">注文日時 / {isUSD ? 'Order Date' : '주문일시'}</span>
                                <span className="font-bold text-gray-700 dark:text-gray-400" suppressHydrationWarning>
                                    {(() => {
                                        const d = new Date(order.createdAt);
                                        const datePart = d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
                                        const dayPart = d.toLocaleDateString('ja-JP', { weekday: 'short' });
                                        const timePart = d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false });
                                        return `${datePart}(${dayPart}) ${timePart}`;
                                    })()}
                                </span>
                            </div>
                            <div className="flex flex-col text-right text-sm">
                                <span className="text-gray-400 dark:text-gray-500 mb-0.5 text-xs">注文番号 / {isUSD ? 'Order No' : '주문번호'}</span>
                                <span className="font-bold text-gray-900 dark:text-white font-inter tracking-[0.01em]">{order.orderNumber || order.id.slice(0, 12)}</span>
                            </div>
                        </div>
                        <div className="border-t border-gray-100 dark:border-[#2a2a2a] mx-5 my-0.5" />

                        {/* Progress Stepper moved under Order No */}
                        <div className="bg-white dark:bg-[#1e1e1e] rounded-xl py-1 px-1 mb-1">
                            <div className="relative flex justify-between items-start overflow-hidden pt-2">
                                {/* Connecting Line Container (Grey Background) */}
                                <div className="absolute top-[26px] left-[10%] right-[10%] h-[2px] bg-gray-100 dark:bg-[#2a2a2a] z-0">
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
                                                ${isActive ? 'bg-[#e34219] shadow-[0_0_0_4px_rgba(227,66,25,0.1)]' : 'bg-gray-200 dark:bg-[#2a2a2a] text-gray-400 dark:text-gray-500'}
                                            `}>
                                                {isActive ? <step.icon size={16} strokeWidth={3} /> : idx + 1}
                                            </div>
                                            <div className="text-center">
                                                <div className={`text-[11px] md:text-sm font-bold mb-0.5 whitespace-nowrap ${isActive ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                                                    {step.label}
                                                </div>
                                                <div className="text-[10px] md:text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide whitespace-nowrap">
                                                    {step.sub}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Payment Information & Totals Summary */}
                        <div className="bg-white dark:bg-[#1e1e1e] rounded-xl pt-4 px-2 pb-2 mb-1">
                            <div className="flex items-center gap-2 mb-3 border-b border-gray-100 dark:border-[#2a2a2a] pb-2">
                                <Landmark size={14} className="text-[#e34219]" />
                                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-tight">お支払い情報 / {isUSD ? 'Payment Info' : '입금정보'}</h3>
                            </div>

                            <div className="flex flex-col gap-0.5 tracking-tight">
                                {/* Bank Details */}
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-900 dark:text-white text-xs min-w-[100px]">銀行名 / {isUSD ? 'Bank' : '은행'}</span>
                                    <span className="font-bold text-gray-900 dark:text-white">IBK Industrial Bank of Korea (기업은행)</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-900 dark:text-white text-xs min-w-[100px]">口座番号 / {isUSD ? 'Account' : '계좌'}</span>
                                    <span className="font-bold text-gray-900 dark:text-white font-inter">656-045236-01-013</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-900 dark:text-white text-xs min-w-[100px]">名義人 / {isUSD ? 'Holder' : '예금주'}</span>
                                    <span className="font-bold text-gray-900 dark:text-white uppercase">주식회사 베이코</span>
                                </div>

                                {/* Separator & Total Amount Details */}
                                <div className="flex justify-between items-center pt-1.5 pb-0 mt-1 border-t border-gray-100 dark:border-[#2a2a2a]">
                                    <span className="font-bold text-sm text-gray-900 dark:text-white underline decoration-[#e34219]/30 decoration-2 underline-offset-4">合計金額 / {isUSD ? 'Total Amount' : '총 합계금액'}</span>
                                    <span className="font-bold text-lg text-[#e34219] font-inter"><span className="text-[0.7em] mr-0.5">{currencySymbol}</span>{totalAmount.toLocaleString(undefined, isUSD ? { minimumFractionDigits: 2 } : {})}</span>
                                </div>
                                <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
                                    <span>供給価額 / {isUSD ? 'Supply Price' : '공급가액'}</span>
                                    <span className="font-medium font-inter"><span className="text-[9px] mr-0.5">{currencySymbol}</span>{supplyPrice.toLocaleString(undefined, isUSD ? { minimumFractionDigits: 2 } : {})}</span>
                                </div>
                                {!isUSD && (
                                    <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
                                        <span>消費税 / 부가세 (10%)</span>
                                        <span className="font-medium font-inter"><span className="text-[9px] mr-0.5">{currencySymbol}</span>{vat.toLocaleString()}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {order.status !== 'DEPOSIT_COMPLETED' && order.status !== 'SHIPPED' && (
                            <div className="bg-[#FFF5F5] border border-[#e34219] rounded-xl py-3 px-3 flex items-start gap-3 mb-4 mx-1">
                                <div className="w-5 h-5 rounded-full bg-[#e34219] text-white flex items-center justify-center shrink-0 mt-0.5 font-bold text-sm font-serif">i</div>
                                <div className="text-xs text-gray-600 dark:text-gray-400 flex flex-col gap-1.5">
                                    <p className="leading-relaxed">
                                        <span className="font-bold text-[#e34219]">合計 {totalAmount.toLocaleString(undefined, isUSD ? { minimumFractionDigits: 2 } : {})}{isUSD ? '$' : 'ウォン'}</span>{isUSD ? ' を入金後、' : 'を入金後、'}「入金確認の要請」ボタンを押してください.入金確認後の注文キャンセル는 できません.
                                    </p>
                                    <p className="font-medium leading-relaxed">
                                        {isUSD ? `Please request confirmation after depositing ${currencySymbol}${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}. Orders cannot be canceled after deposit confirmation.` : "합계 금액을 입금하신 후 확인 요청을 해주세요. 입금 확인 후에는 주문을 취소할 수 없습니다."}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="bg-white dark:bg-[#1e1e1e] rounded-xl mb-4 px-1">
                            <div className={`grid ${order.status === 'DEPOSIT_COMPLETED' || order.trackingNumber ? 'grid-cols-1' : 'grid-cols-2'} gap-2`}>
                                <button
                                    onClick={() => order.status !== 'DEPOSIT_COMPLETED' && !order.trackingNumber && toggleDeposit(order.id, order.status)}
                                    disabled={loadingMap[order.id] || order.status === 'DEPOSIT_COMPLETED' || !!order.trackingNumber}
                                    className={`h-13 border-2 rounded-lg font-bold transition-all flex flex-col items-center justify-center leading-tight
                                        ${order.status === 'DEPOSIT_COMPLETED' || order.trackingNumber
                                            ? 'border-gray-200 dark:border-[#2a2a2a] text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-[#1a1a1a] cursor-not-allowed'
                                            : 'border-[#e34219] text-white bg-[#e34219] hover:bg-[#cc3b16]'
                                        }`}
                                >
                                    {loadingMap[order.id] ? 'Processing...' : (
                                        order.status === 'DEPOSIT_COMPLETED' || order.trackingNumber ? (
                                            <>
                                                {order.trackingNumber ? (
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-sm font-black text-[#e34219]">
                                                            {order.courier === 'Rosen' ? '로젠택배' :
                                                                order.courier === 'CJ' ? 'CJ대한통운' :
                                                                    order.courier === 'Lotte' ? '롯데택배' : (order.courier || '배송중')}
                                                        </span>
                                                        <span className="text-[11px] font-inter font-bold mt-0.5">{isUSD ? 'Tracking No' : '송장번호'}: {order.trackingNumber}</span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <span className="text-sm md:text-base font-bold">ご入金を確認後、商品を発送いたします.</span>
                                                        <span className="text-[10px] md:text-[11px] font-medium opacity-80">{isUSD ? 'Products will be shipped after deposit.' : '입금확인 후 제품이 발송됩니다.'}</span>
                                                    </>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <span className="text-sm font-bold">入金確認の要請</span>
                                                <span className="text-[10px] md:text-[11px] font-medium opacity-80">(입금완료 시 눌러주세요)</span>
                                            </>
                                        )
                                    )}
                                </button>
                                {order.status !== 'DEPOSIT_COMPLETED' && !order.trackingNumber && (
                                    <button
                                        onClick={() => handleDelete(order.id)}
                                        disabled={loadingMap[order.id]}
                                        className="h-13 border-2 border-gray-200 dark:border-[#2a2a2a] text-gray-400 dark:text-gray-500 bg-white dark:bg-[#1e1e1e] rounded-lg font-bold transition-all hover:bg-gray-50 dark:hover:bg-[#252525] flex flex-col items-center justify-center leading-tight"
                                    >
                                        <span className="text-sm font-bold">注文キャンセル</span>
                                        <span className="text-[10px] md:text-[11px] font-medium opacity-80">(주문취소)</span>
                                    </button>
                                )}
                            </div>

                            <div className="flex gap-2 w-full mt-2">
                                <Link
                                    href={`/invoice/${order.id}`}
                                    target="_blank"
                                    className="flex-1 h-14 border-2 border-[#111827] dark:border-gray-600 text-[#111827] dark:text-white bg-white dark:bg-[#1e1e1e] rounded-lg font-bold transition-all hover:bg-gray-50 dark:hover:bg-[#252525] flex flex-col items-center justify-center leading-tight pb-1 px-1 text-center"
                                >
                                    <span className="text-[11px] md:text-[13px] font-bold">取引明細書を確認する</span>
                                    <span className="text-[9px] md:text-[10px] font-bold opacity-60">{isUSD ? 'Check Transaction' : '거래명세표 확인하기'}</span>
                                </Link>
                                <a
                                    href="/beiko_Business%20Registration%20Certificate.png"
                                    download="beiko_Business_Registration_Certificate.png"
                                    className="flex-1 h-14 border-2 border-gray-300 dark:border-[#2a2a2a] text-gray-700 dark:text-gray-400 bg-white dark:bg-[#1e1e1e] rounded-lg font-bold transition-all hover:bg-gray-50 dark:hover:bg-[#252525] flex flex-col items-center justify-center leading-tight pb-1 px-1 text-center"
                                >
                                    <span className="text-[11px] md:text-[13px] font-bold">事業者登録証</span>
                                    <span className="text-[9px] md:text-[10px] font-bold opacity-60">{isUSD ? 'Business Reg. Download' : '사업자등록증 다운로드'}</span>
                                </a>
                            </div>
                        </div>
                        <div className="border-t border-gray-100 dark:border-[#2a2a2a] mx-5 mt-4 mb-3" />

                        {/* Order Items List */}
                        <div className="mt-8 px-1">
                            <div className="flex items-center gap-2 mb-4">
                                <Package size={17} className="text-[#e34219]" />
                                <h3 className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight">注文商品リスト <span className="text-gray-400 dark:text-gray-500 font-medium ml-1">/ {isUSD ? 'Order Item List' : '주문상품목록'}</span></h3>
                            </div>

                            <div className="space-y-3">
                                {order.items.map((item: any, idx: number) => (
                                    <div key={idx} className="bg-white dark:bg-[#1e1e1e] border border-gray-100 dark:border-[#2a2a2a] rounded-xl p-4 flex gap-4 md:items-center shadow-sm dark:shadow-none relative overflow-hidden">
                                        <div className="flex flex-col items-center gap-1.5 shrink-0">
                                            <span className="text-[10px] font-extrabold text-gray-900 dark:text-white uppercase tracking-tighter">No. {idx + 1}</span>
                                            <div className="w-16 h-16 md:w-20 md:h-20 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#2a2a2a] rounded-lg flex items-center justify-center shrink-0 p-1">
                                                {item.product.imageUrl ? (
                                                    <img src={item.product.imageUrl} alt="" className="w-full h-full object-contain" />
                                                ) : (
                                                    <span className="text-xs text-gray-300 dark:text-gray-500">No Img</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                                            <h4 className="font-bold text-sm text-gray-900 dark:text-white truncate leading-tight">{item.product.nameJP || item.product.name}</h4>
                                            <p className="text-xs text-gray-900 dark:text-white font-medium leading-tight">{item.product.nameEN || item.product.name}</p>
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
                                                    <span className="font-bold text-gray-900 font-inter"><span className="text-[0.8em] mr-0.5">{currencySymbol}</span>{item.price.toLocaleString(undefined, isUSD ? { minimumFractionDigits: 2 } : {})}</span>
                                                    <span className="text-gray-900 font-inter font-medium">x {item.quantity}ea</span>
                                                </div>
                                                <span className="font-bold text-base md:text-lg text-gray-900 font-inter leading-none">
                                                    <span className="text-[0.8em] mr-0.5">{currencySymbol}</span>{(item.price * item.quantity).toLocaleString(undefined, isUSD ? { minimumFractionDigits: 2 } : {})}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {shippingFee > 0 && (
                                    <div className="bg-white border border-gray-100 rounded-xl px-4 py-2 flex gap-4 items-start shadow-sm">
                                        <div className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center shrink-0 mt-1">
                                            <Truck className="text-[#e34219]" size={20} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-center h-full py-0.5">
                                                <div>
                                                    <h4 className="font-bold text-sm text-gray-900 leading-tight">送料 <span className="text-gray-400 font-normal text-xs">/ 배송비</span></h4>
                                                    <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">※ 100개당 3,000원 추가 (총 {totalQuantity}개)</p>
                                                </div>
                                                <span className="font-bold text-base md:text-lg text-gray-900 font-inter">
                                                    <span className="text-[0.8em] mr-0.5">{currencySymbol}</span>{shippingFee.toLocaleString()}
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
