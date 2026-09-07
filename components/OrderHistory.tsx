'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, Truck, FileText, Banknote, Landmark, Package } from 'lucide-react'
import BarcodeDisplay from '@/components/BarcodeDisplay'

type OrderHistoryProduct = {
    name?: string | null
    nameJP?: string | null
    nameEN?: string | null
    imageUrl?: string | null
    productCode?: string | null
    barcode?: string | null
}

type OrderHistoryItem = {
    id?: string | null
    price?: number | null
    quantity?: number | null
    product?: OrderHistoryProduct | null
}

type OrderHistoryRow = {
    id?: string | null
    orderNumber?: string | null
    createdAt?: string | Date | null
    status?: string | null
    trackingNumber?: string | null
    courier?: string | null
    taxInvoiceIssued?: boolean
    items?: OrderHistoryItem[] | null
}

const parseTrackingNumbers = (value: string | null | undefined) => {
    if (!value) return []
    return value
        .split(/[,\n]/)
        .map((v) => v.trim())
        .filter(Boolean)
}

const safeText = (value: unknown, fallback = '') => {
    return typeof value === 'string' && value.trim() ? value : fallback
}

const safeNumber = (value: unknown, fallback = 0) => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
    if (typeof value === 'bigint') return Number(value)
    const normalized = String(value ?? '').replace(/,/g, '').trim()
    if (!normalized) return fallback
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : fallback
}

const safeNonNegativeInt = (value: unknown, fallback = 0) => {
    return Math.max(0, Math.floor(safeNumber(value, fallback)))
}

const formatNumber = (
    value: unknown,
    options?: Intl.NumberFormatOptions,
) => safeNumber(value).toLocaleString(undefined, options)

const formatMoney = (value: unknown, isUSD: boolean) => {
    return formatNumber(value, isUSD ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : {})
}

const formatOrderDate = (value: unknown, isKorean: boolean) => {
    const date = value ? new Date(value as string | number | Date) : new Date()
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date
    const locale = isKorean ? 'ko-KR' : 'ja-JP'
    const datePart = safeDate.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })
    const dayPart = safeDate.toLocaleDateString(locale, { weekday: 'short' })
    const timePart = safeDate.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false })
    return `${datePart}(${dayPart}) ${timePart}`
}

export default function OrderHistory({ orders, userCountry }: { orders?: OrderHistoryRow[] | null, userCountry?: string | null }) {
    const router = useRouter()
    const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({})
    const safeOrders = Array.isArray(orders) ? orders : []
    const isKorean = userCountry === 'Korea'

    if (safeOrders.length === 0) {
        return (
            <div className="flex items-center justify-center py-20 bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-sm dark:shadow-none border border-gray-100 dark:border-[#2a2a2a]">
                <div className="text-center">
                    <p className="text-xl font-bold text-gray-400 dark:text-gray-500">{isKorean ? '주문내역이 없습니다.' : '注文履歴がありません。'}</p>
                </div>
            </div>
        )
    }

    const toggleDeposit = async (orderId: string, currentStatus: string) => {
        if (currentStatus === 'DEPOSIT_COMPLETED') return

        const confirmMsg = isKorean
            ? '입금 완료 사실을 관리자에게 알리시겠습니까?'
            : '入金完了を管理者に通知しますか？'

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
                alert(isKorean ? '요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.' : `エラーが発生しました: ${data.error || '不明なエラー'}`)
            } else {
                router.refresh()
            }
        } catch {
            alert(isKorean ? '통신 오류가 발생했습니다.' : '通信エラーが発生しました。')
        } finally {
            setLoadingMap(prev => ({ ...prev, [orderId]: false }))
        }
    }

    const handleDelete = async (orderId: string) => {
        if (!confirm(isKorean ? '주문을 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.' : '注文を削除しますか？削除後は復元できません。')) return
        setLoadingMap(prev => ({ ...prev, [orderId]: true }))
        try {
            const res = await fetch(`/api/orders/${orderId}`, { method: 'DELETE' })
            if (res.ok) router.refresh()
            else alert(isKorean ? '주문 삭제 중 오류가 발생했습니다.' : '削除中にエラーが発生しました。')
        } catch { alert(isKorean ? '통신 오류가 발생했습니다.' : '通信エラーが発生しました。') }
        finally { setLoadingMap(prev => ({ ...prev, [orderId]: false })) }
    }

    return (
        <div className="space-y-6">
            {/* Header Title Layer */}
            <div className="mb-4 md:mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4 px-4 md:px-0 pt-2 md:pt-0">
                <div className="flex items-baseline gap-3 text-left">
                    <h1 className="text-3xl md:text-4xl font-black text-[#111827] dark:text-white tracking-tight">
                        {isKorean ? '주문내역' : '注文履歴'}
                    </h1>
                    <span className="text-sm font-normal text-gray-400 dark:text-gray-500 tracking-wide">{isKorean ? '주문 진행 현황' : 'Order History'}</span>
                </div>
            </div>

            {safeOrders.map((order, orderIndex) => {
                const safeOrder = order || {}
                const orderId = safeText(safeOrder.id) || `missing-order-${orderIndex}`
                const status = safeText(safeOrder.status)
                const isOrderCompleted = status === 'COMPLETED'
                const items = Array.isArray(safeOrder.items) ? safeOrder.items : []
                const trackingNumbers = parseTrackingNumbers(safeText(safeOrder.trackingNumber))
                const isOrderLocked = isOrderCompleted || status === 'DEPOSIT_COMPLETED' || status === 'SHIPPED' || trackingNumbers.length > 0
                const productSum = items.reduce((sum: number, item) => sum + (safeNumber(item?.price) * safeNonNegativeInt(item?.quantity)), 0);
                const totalQuantity = items.reduce((sum: number, item) => sum + safeNonNegativeInt(item?.quantity), 0);

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
                if (status === 'PENDING') activeStep = 1; // Payment Wait
                if (status === 'PENDING_DEPOSIT') activeStep = 1;
                if (status === 'DEPOSIT_COMPLETED') activeStep = 2; // Paid
                if (status === 'SHIPPED') activeStep = 3; // Shipped
                if (safeOrder.taxInvoiceIssued) activeStep = 4; // Invoice

                // If cancelled (not in standard flow), handle gracefully (maybe show as step 0 or error state)

                const steps = isKorean ? [
                    { label: '주문 접수', sub: '주문완료', icon: Check },
                    { label: '입금 대기', sub: '입금대기중', icon: Banknote },
                    { label: '입금 확인', sub: '입금완료', icon: Check },
                    { label: '배송', sub: '배송중', icon: Truck },
                    { label: '계산서 발급', sub: '발급완료', icon: FileText },
                ] : [
                    { label: '注文完了', sub: isUSD ? 'Order Placed' : '注文済み', icon: Check },
                    { label: '入金待ち', sub: isUSD ? 'Awaiting Payment' : '確認待ち', icon: Banknote },
                    { label: '入金完了', sub: isUSD ? 'Payment Confirmed' : '確認済み', icon: Check },
                    { label: '出荷完了', sub: isUSD ? 'Shipped' : '配送中', icon: Truck },
                    { label: '請求書発行完了', sub: isUSD ? 'Invoice Issued' : '発行済み', icon: FileText },
                ]

                return (
                    <div key={orderId} className={`bg-white dark:bg-[#1e1e1e] rounded-xl md:rounded-2xl p-2 md:p-4 pb-6 md:pb-8 shadow-md dark:shadow-none border border-gray-100 dark:border-[#2a2a2a] mb-8 mx-4 md:mx-0 last:mb-0 transition-all duration-300 ${isOrderCompleted ? 'opacity-80 brightness-[0.92] grayscale-[0.1]' : ''}`}>
                        {/* Order No & Date Box */}
                        <div className="bg-white dark:bg-[#1e1e1e] rounded-xl py-2 px-2 flex flex-row justify-between items-center gap-4 mb-0">
                            <div className="flex flex-col text-sm">
                                <span className="text-gray-400 dark:text-gray-500 mb-0.5 text-xs">{isKorean ? '주문일시' : `注文日時${isUSD ? ' / Order Date' : ''}`}</span>
                                <span className="font-bold text-gray-700 dark:text-gray-400" suppressHydrationWarning>
                                    {(() => {
                                        return formatOrderDate(safeOrder.createdAt, isKorean);
                                    })()}
                                </span>
                            </div>
                            <div className="flex flex-col text-right text-sm">
                                <span className="text-gray-400 dark:text-gray-500 mb-0.5 text-xs">{isKorean ? '주문번호' : `注文番号${isUSD ? ' / Order No' : ''}`}</span>
                                <span className="font-bold text-gray-900 dark:text-white font-inter tracking-[0.01em]">{safeText(safeOrder.orderNumber) || orderId.slice(0, 12)}</span>
                            </div>
                        </div>

                        {isOrderCompleted && (
                            <div className="mx-1 mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
                                <div className="text-sm font-black text-emerald-700">{isKorean ? '거래완료' : '取引完了'}</div>
                                <div className="mt-1 text-[11px] font-bold text-emerald-600">{isKorean ? '관리자가 주문을 완료 처리했습니다.' : '管理者が注文を完了処理しました。'}</div>
                            </div>
                        )}
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
                                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-tight">{isKorean ? '입금 정보' : `お支払い情報${isUSD ? ' / Payment Info' : ''}`}</h3>
                            </div>

                            <div className="flex flex-col gap-0.5 tracking-tight">
                                {/* Bank Details */}
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-900 dark:text-white text-xs min-w-[100px]">{isKorean ? '은행' : `銀行名${isUSD ? ' / Bank' : ''}`}</span>
                                    <span className="font-bold text-gray-900 dark:text-white">{isKorean ? 'IBK기업은행' : 'IBK Industrial Bank of Korea'}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-900 dark:text-white text-xs min-w-[100px]">{isKorean ? '계좌번호' : `口座番号${isUSD ? ' / Account' : ''}`}</span>
                                    <span className="font-bold text-gray-900 dark:text-white font-inter">656-045236-01-013</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-900 dark:text-white text-xs min-w-[100px]">{isKorean ? '예금주' : `名義人${isUSD ? ' / Holder' : ''}`}</span>
                                    <span className="font-bold text-gray-900 dark:text-white uppercase">주식회사 베이코</span>
                                </div>

                                {/* Separator & Total Amount Details */}
                                <div className="flex justify-between items-center pt-1.5 pb-0 mt-1 border-t border-gray-100 dark:border-[#2a2a2a]">
                                    <span className="font-bold text-sm text-gray-900 dark:text-white underline decoration-[#e34219]/30 decoration-2 underline-offset-4">{isKorean ? '총 결제금액' : `合計金額${isUSD ? ' / Total Amount' : ''}`}</span>
                                    <span className="font-bold text-lg text-[#e34219] font-inter"><span className="text-[0.7em] mr-0.5">{currencySymbol}</span>{formatMoney(totalAmount, isUSD)}</span>
                                </div>
                                <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
                                    <span>{isKorean ? '공급가액' : `供給価額${isUSD ? ' / Supply Price' : ''}`}</span>
                                    <span className="font-medium font-inter"><span className="text-[9px] mr-0.5">{currencySymbol}</span>{formatMoney(supplyPrice, isUSD)}</span>
                                </div>
                                {!isUSD && (
                                    <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
                                        <span>{isKorean ? '부가세 (10%)' : '消費税 (10%)'}</span>
                                        <span className="font-medium font-inter"><span className="text-[9px] mr-0.5">{currencySymbol}</span>{formatNumber(vat)}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {!isOrderLocked && (
                            <div className="bg-[#FFF5F5] border border-[#e34219] rounded-xl py-3 px-3 flex items-start gap-3 mb-4 mx-1">
                                <div className="w-5 h-5 rounded-full bg-[#e34219] text-white flex items-center justify-center shrink-0 mt-0.5 font-bold text-sm font-serif">i</div>
                                <div className="text-xs text-gray-600 dark:text-gray-400 flex flex-col gap-1.5">
                                    <p className="leading-relaxed">
                                        {isKorean ? (
                                            <><span className="font-bold text-[#e34219]">총 {currencySymbol}{formatMoney(totalAmount, false)}</span>을 입금하신 후 입금 확인을 요청해주세요. 입금 확인 후에는 주문을 취소할 수 없습니다.</>
                                        ) : isUSD ? (
                                            <>Please request confirmation after depositing <span className="font-bold text-[#e34219]">{currencySymbol}{formatMoney(totalAmount, true)}</span>. Orders cannot be canceled after deposit confirmation.</>
                                        ) : (
                                            <><span className="font-bold text-[#e34219]">合計 {formatMoney(totalAmount, false)}ウォン</span>を入金後、「入金確認の要請」ボタンを押してください。入金確認後は注文をキャンセルできません。</>
                                        )}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="bg-white dark:bg-[#1e1e1e] rounded-xl mb-4 px-1">
                            <div className={`grid ${isOrderLocked ? 'grid-cols-1' : 'grid-cols-2'} gap-2`}>
                                <button
                                    onClick={() => !isOrderLocked && toggleDeposit(orderId, status)}
                                    disabled={loadingMap[orderId] || isOrderLocked}
                                    className={`h-13 border-2 rounded-lg font-bold transition-all flex flex-col items-center justify-center leading-tight
                                        ${isOrderLocked
                                            ? 'border-gray-200 dark:border-[#2a2a2a] text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-[#1a1a1a] cursor-not-allowed'
                                            : 'border-[#e34219] text-white bg-[#e34219] hover:bg-[#cc3b16]'
                                        }`}
                                >
                                    {loadingMap[orderId] ? (isKorean ? '처리 중...' : 'Processing...') : (
                                        isOrderLocked ? (
                                            <>
                                                {isOrderCompleted ? (
                                                    <div className="flex flex-col items-center text-emerald-700">
                                                        <span className="text-sm font-black">{isKorean ? '거래완료' : '取引完了'}</span>
                                                        <span className="text-[11px] font-bold">{isKorean ? '주문 완료 처리됨' : '注文処理完了'}</span>
                                                    </div>
                                                ) : trackingNumbers.length > 0 ? (
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-sm font-black text-[#e34219]">
                                                            {safeOrder.courier === 'Rosen' ? '로젠택배' :
                                                                safeOrder.courier === 'CJ' ? 'CJ대한통운' :
                                                                    safeOrder.courier === 'Lotte' ? '롯데택배' : (safeText(safeOrder.courier) || '배송중')}
                                                        </span>
                                                        <div className="mt-0.5 flex flex-col items-center">
                                                            {trackingNumbers.map((num, idx) => (
                                                                <span key={`${num}-${idx}`} className="text-[11px] font-inter font-bold">
                                                                    {isKorean ? `송장번호 ${idx + 1}` : `Tracking No ${idx + 1}`}: {num}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <span className="text-sm md:text-base font-bold">{isKorean ? '입금 확인 후 상품을 발송합니다.' : 'ご入金を確認後、商品を発送いたします。'}</span>
                                                        <span className="text-[10px] md:text-[11px] font-medium opacity-80">{isKorean ? '배송 준비 중' : isUSD ? 'Products will be shipped after deposit.' : '発送準備中'}</span>
                                                    </>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <span className="text-sm font-bold">{isKorean ? '입금 확인 요청' : '入金確認の要請'}</span>
                                                <span className="text-[10px] md:text-[11px] font-medium opacity-80">{isKorean ? '입금 후 눌러주세요' : '入金後に押してください'}</span>
                                            </>
                                        )
                                    )}
                                </button>
                                {!isOrderLocked && (
                                    <button
                                        onClick={() => handleDelete(orderId)}
                                        disabled={loadingMap[orderId]}
                                        className="h-13 border-2 border-gray-200 dark:border-[#2a2a2a] text-gray-400 dark:text-gray-500 bg-white dark:bg-[#1e1e1e] rounded-lg font-bold transition-all hover:bg-gray-50 dark:hover:bg-[#252525] flex flex-col items-center justify-center leading-tight"
                                    >
                                        <span className="text-sm font-bold">{isKorean ? '주문 취소' : '注文キャンセル'}</span>
                                        <span className="text-[10px] md:text-[11px] font-medium opacity-80">{isKorean ? '접수된 주문 삭제' : '注文を削除'}</span>
                                    </button>
                                )}
                            </div>

                            <div className="flex gap-2 w-full mt-2">
                                <Link
                                    href={`/invoice/${orderId}`}
                                    target="_blank"
                                    style={{ color: 'inherit' }}
                                    className="flex-1 h-14 border-2 border-[#111827] dark:border-gray-600 text-[#111827] dark:text-white bg-white dark:bg-[#1e1e1e] rounded-lg font-bold transition-all hover:bg-gray-50 dark:hover:bg-[#252525] flex flex-col items-center justify-center leading-tight pb-1 px-1 text-center"
                                >
                                    <span className="text-[11px] md:text-[13px] font-bold">{isKorean ? '거래명세표 확인' : '取引明細書を確認する'}</span>
                                    <span className="text-[9px] md:text-[10px] font-bold opacity-60">{isKorean ? '주문 거래명세표' : 'Check Transaction'}</span>
                                </Link>
                                <a
                                    href="/beiko_Business%20Registration%20Certificate.png"
                                    download="beiko_Business_Registration_Certificate.png"
                                    style={{ color: 'inherit' }}
                                    className="flex-1 h-14 border-2 border-gray-300 dark:border-[#2a2a2a] text-gray-700 dark:text-gray-400 bg-white dark:bg-[#1e1e1e] rounded-lg font-bold transition-all hover:bg-gray-50 dark:hover:bg-[#252525] flex flex-col items-center justify-center leading-tight pb-1 px-1 text-center"
                                >
                                    <span className="text-[11px] md:text-[13px] font-bold">{isKorean ? '사업자등록증' : '事業者登録証'}</span>
                                    <span className="text-[9px] md:text-[10px] font-bold opacity-60">{isKorean ? '베이코 사업자등록증 다운로드' : 'Business Reg. Download'}</span>
                                </a>
                            </div>
                        </div>
                        <div className="border-t border-gray-100 dark:border-[#2a2a2a] mx-5 mt-4 mb-3" />

                        {/* Order Items List */}
                        <div className="mt-8 px-1">
                            <div className="flex items-center gap-2 mb-4">
                                <Package size={17} className="text-[#e34219]" />
                                <h3 className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight">{isKorean ? '주문 상품 목록' : '注文商品リスト'} {!isKorean ? <span className="text-gray-400 dark:text-gray-500 font-medium ml-1">/ Order Item List</span> : null}</h3>
                            </div>

                            <div className="space-y-3">
                                {items.map((item, idx: number) => {
                                    const product = item?.product || null
                                    const itemId = safeText(item?.id) || `${orderId}-${idx}`
                                    const imageUrl = safeText(product?.imageUrl)
                                    const barcode = safeText(product?.barcode)
                                    const price = safeNumber(item?.price)
                                    const quantity = safeNonNegativeInt(item?.quantity)
                                    const productName = isKorean
                                        ? safeText(product?.name) || '상품 정보 없음'
                                        : safeText(product?.nameJP) || safeText(product?.name) || '商品情報なし'
                                    const productSubName = safeText(product?.nameEN) || safeText(product?.name) || (product ? productName : (isKorean ? '삭제되었거나 연결되지 않은 상품' : '削除または未接続の商品'))

                                    return (
                                    <div key={itemId} className="bg-white dark:bg-[#1e1e1e] border border-gray-100 dark:border-[#2a2a2a] rounded-xl p-4 flex gap-4 md:items-center shadow-sm dark:shadow-none relative overflow-hidden">
                                        <div className="flex flex-col items-center gap-1.5 shrink-0">
                                            <span className="text-[10px] font-extrabold text-gray-900 dark:text-white uppercase tracking-tighter">No. {idx + 1}</span>
                                            <div className="w-16 h-16 md:w-20 md:h-20 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#2a2a2a] rounded-lg flex items-center justify-center shrink-0 p-1">
                                                {imageUrl ? (
                                                    <img src={imageUrl} alt="" className="w-full h-full object-contain" />
                                                ) : (
                                                    <span className="text-xs text-gray-300 dark:text-gray-500">{isKorean ? '이미지 없음' : 'No Img'}</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                                            <h4 className="font-bold text-sm text-gray-900 dark:text-white truncate leading-tight">{productName}</h4>
                                            {!isKorean ? <p className="text-xs text-gray-900 dark:text-white font-medium leading-tight">{productSubName}</p> : null}
                                            <div className="text-[10px] text-gray-400 dark:text-gray-500 font-medium font-inter leading-tight">
                                                {isKorean ? '상품코드' : 'Code'}: {safeText(product?.productCode, '-')}
                                            </div>
                                            {barcode && (
                                                <div className="mt-1 flex justify-start">
                                                    <BarcodeDisplay
                                                        value={barcode}
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
                                                    <span className="font-bold text-gray-900 dark:text-white font-inter"><span className="text-[0.8em] mr-0.5">{currencySymbol}</span>{formatMoney(price, isUSD)}</span>
                                                    <span className="text-gray-900 dark:text-white font-inter font-medium">x {formatNumber(quantity)}{isKorean ? '개' : 'ea'}</span>
                                                </div>
                                                <span className="font-bold text-base md:text-lg text-gray-900 dark:text-white font-inter leading-none">
                                                    <span className="text-[0.8em] mr-0.5">{currencySymbol}</span>{formatMoney(price * quantity, isUSD)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    )
                                })}

                                {shippingFee > 0 && (
                                    <div className="bg-white dark:bg-[#1e1e1e] border border-gray-100 dark:border-[#2a2a2a] rounded-xl px-4 py-2 flex gap-4 items-start shadow-sm dark:shadow-none">
                                        <div className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center shrink-0 mt-1">
                                            <Truck className="text-[#e34219]" size={20} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-center h-full py-0.5">
                                                <div>
                                                    <h4 className="font-bold text-sm text-gray-900 dark:text-white leading-tight">{isKorean ? '배송비' : '送料'}</h4>
                                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">{isKorean ? `100개당 3,000원 (총 ${totalQuantity}개)` : `100個ごとに3,000ウォン（合計 ${totalQuantity}個）`}</p>
                                                </div>
                                                <span className="font-bold text-base md:text-lg text-gray-900 dark:text-white font-inter">
                                                    <span className="text-[0.8em] mr-0.5">{currencySymbol}</span>{formatMoney(shippingFee, isUSD)}
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
