'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, Copy, Download, FileText, Banknote, Info, Landmark, Package, PackageCheck, Truck } from 'lucide-react'
import BarcodeDisplay from '@/components/BarcodeDisplay'
import Badge, { type BadgeTone } from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import { buttonClass } from '@/components/ui/buttonClass'
import { PartnerPageHeader, ProductThumb } from '@/app/order/partner-ui'

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
    shippingFeeOverride?: number | null
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

const orderStatusBadge = (status: string, isKorean: boolean): { label: string; tone: BadgeTone } => {
    if (status === 'PENDING' || status === 'PENDING_DEPOSIT') return { label: isKorean ? '입금 대기' : '入金待ち', tone: 'warning' }
    if (status === 'DEPOSIT_COMPLETED') return { label: isKorean ? '배송 준비 중' : '発送準備中', tone: 'info' }
    if (status === 'SHIPPED') return { label: isKorean ? '배송 중' : '配送中', tone: 'info' }
    if (status === 'COMPLETED') return { label: isKorean ? '거래 완료' : '取引完了', tone: 'success' }
    if (status === 'CANCELED') return { label: isKorean ? '주문 취소' : 'キャンセル済み', tone: 'neutral' }
    return { label: isKorean ? '주문 접수' : '注文受付', tone: 'neutral' }
}

const courierName = (courier: string | null | undefined, isKorean: boolean) => (
    courier === 'Rosen' ? '로젠택배' :
        courier === 'CJ' ? 'CJ대한통운' :
            courier === 'Lotte' ? '롯데택배' : (safeText(courier) || (isKorean ? '택배' : '配送業者'))
)

export default function OrderHistory({ orders, userCountry }: { orders?: OrderHistoryRow[] | null, userCountry?: string | null }) {
    const router = useRouter()
    const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({})
    const [copiedTracking, setCopiedTracking] = useState<string | null>(null)
    const safeOrders = Array.isArray(orders) ? orders : []
    const isKorean = userCountry === 'Korea'

    const [historyFilter, setHistoryFilter] = useState<'active' | 'all'>('active')
    const activeOrders = safeOrders.filter(order => !['COMPLETED', 'CANCELED'].includes(safeText(order.status)))
    const displayedOrders = historyFilter === 'active' ? activeOrders : safeOrders
    const pageHeader = <PartnerPageHeader title={isKorean ? '주문내역' : '注文履歴'} description={isKorean ? '주문 진행 현황과 입금 정보를 확인하세요.' : 'ご注文の進行状況とお支払い情報をご確認いただけます。'} />

    if (safeOrders.length === 0) {
        return (
            <div className="space-y-5">
                {pageHeader}
                <EmptyState
                    icon={<Package size={20} />}
                    title={isKorean ? '주문내역이 없습니다.' : '注文履歴がありません。'}
                    action={<Link href="/order" className="ux-button-primary min-h-11 px-5">{isKorean ? '상품 주문하러 가기' : '商品を注文する'}</Link>}
                />
            </div>
        )
    }

    const copyTracking = async (value: string) => {
        try {
            await navigator.clipboard.writeText(value)
            setCopiedTracking(value)
            window.setTimeout(() => setCopiedTracking(current => current === value ? null : current), 1500)
        } catch { /* Clipboard may be blocked; the number stays visible to copy by hand. */ }
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
        <div className="space-y-5">
            {pageHeader}

            <div className="ux-tabs w-fit" role="tablist" aria-label={isKorean ? '주문 조회' : '注文表示'}>
                <button type="button" role="tab" aria-selected={historyFilter === 'active'} onClick={() => setHistoryFilter('active')}>{isKorean ? '진행 중' : '進行中'} <span className="tabular-nums">{activeOrders.length}</span></button>
                <button type="button" role="tab" aria-selected={historyFilter === 'all'} onClick={() => setHistoryFilter('all')}>{isKorean ? '전체 주문' : 'すべて'} <span className="tabular-nums">{safeOrders.length}</span></button>
            </div>
            {displayedOrders.length === 0 && <div className="ux-context">{isKorean ? '진행 중인 주문이 없습니다. 전체 주문에서 지난 거래를 확인하세요.' : '進行中の注文はありません。すべての注文から履歴をご確認ください。'}</div>}
            <div className="space-y-8">
            {displayedOrders.map((order, orderIndex) => {
                const safeOrder = order || {}
                const orderId = safeText(safeOrder.id) || `missing-order-${orderIndex}`
                const status = safeText(safeOrder.status)
                const isOrderCompleted = status === 'COMPLETED'
                const isCanceled = status === 'CANCELED'
                const items = Array.isArray(safeOrder.items) ? safeOrder.items : []
                const trackingNumbers = parseTrackingNumbers(safeText(safeOrder.trackingNumber))
                const isOrderLocked = isOrderCompleted || status === 'DEPOSIT_COMPLETED' || status === 'SHIPPED' || trackingNumbers.length > 0
                // The API only accepts a deposit request on an open order, so a canceled one only offers deletion.
                const canRequestDeposit = !isOrderLocked && !isCanceled
                const productSum = items.reduce((sum: number, item) => sum + (safeNumber(item?.price) * safeNonNegativeInt(item?.quantity)), 0);
                const totalQuantity = items.reduce((sum: number, item) => sum + safeNonNegativeInt(item?.quantity), 0);

                const isUSD = userCountry !== 'Korea' && userCountry !== 'Japan'
                const currencySymbol = userCountry === 'Korea' ? '₩' : userCountry === 'Japan' ? '¥' : '$'
                const money = (value: unknown) => `${currencySymbol}${formatMoney(value, isUSD)}`

                const shippingFee = isUSD ? 0 : (safeOrder.shippingFeeOverride ?? Math.ceil(totalQuantity / 100) * 3000);

                const supplyPrice = productSum + shippingFee;
                const vat = isUSD ? 0 : Math.round(supplyPrice * 0.1);
                const totalAmount = supplyPrice + vat;

                // Steps: Ordered -> Awaiting payment -> Payment confirmed -> Shipped.
                // activeStep is the step the order is waiting on; earlier steps are done.
                let activeStep = 0;
                if (status === 'PENDING') activeStep = 1;
                if (status === 'PENDING_DEPOSIT') activeStep = 1;
                if (status === 'DEPOSIT_COMPLETED') activeStep = 2;
                if (status === 'SHIPPED') activeStep = 3;
                if (status === 'COMPLETED') activeStep = 3;
                const allStepsDone = isOrderCompleted

                // Plain nouns, not past tense: a step that hasn't happened must not read as done.
                const steps = isKorean ? [
                    { label: '주문 접수', icon: Check },
                    { label: '입금 대기', icon: Banknote },
                    { label: '입금 확인', icon: PackageCheck },
                    { label: '배송', icon: Truck },
                ] : [
                    { label: '注文受付', icon: Check },
                    { label: '入金待ち', icon: Banknote },
                    { label: '入金確認', icon: PackageCheck },
                    { label: '発送', icon: Truck },
                ]
                const progress = allStepsDone ? 100 : (activeStep / (steps.length - 1)) * 100
                const badge = orderStatusBadge(status, isKorean)

                return (
                    <article key={orderId} className="space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm md:p-6">
                        <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <h2 className="whitespace-nowrap text-base font-bold tabular-nums">
                                <span className="sr-only">{isKorean ? '주문번호' : '注文番号'} </span>{safeText(safeOrder.orderNumber) || orderId.slice(0, 12)}
                            </h2>
                            <Badge tone={badge.tone}>{badge.label}</Badge>
                            <p className="ml-auto whitespace-nowrap text-sm text-[var(--muted-foreground)] tabular-nums" suppressHydrationWarning>
                                <span className="sr-only">{isKorean ? '주문일시' : '注文日時'} </span>{formatOrderDate(safeOrder.createdAt, isKorean)}
                            </p>
                        </header>

                        {!isCanceled && (
                            <div className="relative">
                                {/* Runs between the first and last step centres (4 equal columns → 12.5% in from each side). */}
                                <div aria-hidden className="absolute left-[12.5%] right-[12.5%] top-[18px] h-0.5 bg-[var(--border)]">
                                    <div className="h-full bg-slate-900 transition-all duration-500 dark:bg-slate-300" style={{ width: `${progress}%` }} />
                                </div>
                                <ol className="relative grid grid-cols-4" aria-label={isKorean ? '주문 진행 단계' : '注文の進行状況'}>
                                    {steps.map((step, idx) => {
                                        const done = allStepsDone || idx < activeStep
                                        const current = !allStepsDone && idx === activeStep
                                        const StepIcon = step.icon
                                        return (
                                            <li key={step.label} aria-current={current ? 'step' : undefined} className="flex flex-col items-center gap-2 text-center">
                                                <span className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${
                                                    done
                                                        ? 'bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900'
                                                        : current
                                                            ? 'border-2 border-brand-orange bg-[var(--card)] text-brand-orange-strong ring-4 ring-brand-orange/15 dark:text-[var(--brand-accent)]'
                                                            : 'border-2 border-[var(--border-strong)] bg-[var(--card)] text-[var(--muted-foreground)]'
                                                }`}>
                                                    {done ? <Check size={16} strokeWidth={3} aria-hidden /> : current ? <StepIcon size={16} strokeWidth={2.5} aria-hidden /> : idx + 1}
                                                </span>
                                                <span className={`break-keep text-xs font-semibold md:text-sm ${done || current ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'}`}>{step.label}</span>
                                            </li>
                                        )
                                    })}
                                </ol>
                            </div>
                        )}

                        <div className="grid gap-5 md:grid-cols-2 md:gap-8">
                            <section>
                                <h3 className="ux-section-title flex items-center gap-2">
                                    <Landmark size={16} className="text-[var(--muted-foreground)]" aria-hidden />
                                    {isKorean ? '입금 정보' : `お支払い情報${isUSD ? ' / Payment Info' : ''}`}
                                </h3>
                                <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
                                    <dt className="text-[var(--muted-foreground)]">{isKorean ? '은행' : `銀行名${isUSD ? ' / Bank' : ''}`}</dt>
                                    <dd className="font-semibold">{isKorean ? 'IBK기업은행' : 'IBK Industrial Bank of Korea'}</dd>
                                    <dt className="text-[var(--muted-foreground)]">{isKorean ? '계좌번호' : `口座番号${isUSD ? ' / Account' : ''}`}</dt>
                                    <dd className="font-semibold tabular-nums">656-045236-01-013</dd>
                                    <dt className="text-[var(--muted-foreground)]">{isKorean ? '예금주' : `名義人${isUSD ? ' / Holder' : ''}`}</dt>
                                    <dd className="font-semibold">주식회사 베이코</dd>
                                </dl>
                            </section>

                            <section>
                                <div className="flex flex-wrap items-center justify-between gap-2 md:max-w-sm">
                                    <h3 className="ux-section-title">{isKorean ? '결제 금액' : `お支払い金額${isUSD ? ' / Amount' : ''}`}</h3>
                                    <Badge tone={safeOrder.taxInvoiceIssued ? 'success' : 'neutral'}>
                                        {isKorean ? '계산서' : '請求書'} {safeOrder.taxInvoiceIssued ? (isKorean ? '발급 완료' : '発行済み') : (isKorean ? '미발급' : '未発行')}
                                    </Badge>
                                </div>
                                <dl className="mt-3 space-y-1.5 text-sm md:max-w-sm">
                                    <div className="flex justify-between gap-4 text-[var(--muted-foreground)]">
                                        <dt>{isKorean ? '공급가액' : `供給価額${isUSD ? ' / Supply Price' : ''}`}</dt>
                                        <dd className="tabular-nums">{money(supplyPrice)}</dd>
                                    </div>
                                    {!isUSD && (
                                        <div className="flex justify-between gap-4 text-[var(--muted-foreground)]">
                                            <dt>{isKorean ? '부가세 (10%)' : '消費税 (10%)'}</dt>
                                            <dd className="tabular-nums">{currencySymbol}{formatNumber(vat)}</dd>
                                        </div>
                                    )}
                                    <div className="flex items-baseline justify-between gap-4 border-t border-[var(--border)] pt-2">
                                        <dt className="font-bold">{isKorean ? '총 결제금액' : `合計金額${isUSD ? ' / Total Amount' : ''}`}</dt>
                                        <dd className="text-2xl font-bold tabular-nums">{money(totalAmount)}</dd>
                                    </div>
                                </dl>
                            </section>
                        </div>

                        {canRequestDeposit && (
                            <div className="ux-context flex items-start gap-3">
                                <Info size={16} className="mt-0.5 shrink-0 text-[var(--foreground)]" aria-hidden />
                                <p className="break-keep">
                                    {isKorean ? (
                                        <><strong className="font-bold text-[var(--foreground)]">총 {currencySymbol}{formatMoney(totalAmount, false)}</strong>을 입금하신 후 입금 확인을 요청해주세요. 입금 확인 후에는 주문을 취소할 수 없습니다.</>
                                    ) : isUSD ? (
                                        <>Please request confirmation after depositing <strong className="font-bold text-[var(--foreground)]">{currencySymbol}{formatMoney(totalAmount, true)}</strong>. Orders cannot be canceled after deposit confirmation.</>
                                    ) : (
                                        <><strong className="font-bold text-[var(--foreground)]">合計 {formatMoney(totalAmount, false)}ウォン</strong>を入金後、「入金確認の要請」ボタンを押してください。入金確認後は注文をキャンセルできません。</>
                                    )}
                                </p>
                            </div>
                        )}

                        {trackingNumbers.length > 0 ? (
                            <div className="ux-context flex items-start gap-3">
                                <Truck size={16} className="mt-0.5 shrink-0 text-[var(--foreground)]" aria-hidden />
                                <div className="min-w-0 flex-1 space-y-1">
                                    <p className="font-semibold text-[var(--foreground)]">{courierName(safeOrder.courier, isKorean)}</p>
                                    {trackingNumbers.map((num, idx) => (
                                        <div key={`${num}-${idx}`} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                            <span>{isKorean ? '송장번호' : '送り状番号'}{trackingNumbers.length > 1 ? ` ${idx + 1}` : ''}</span>
                                            <span className="font-mono text-sm text-[var(--foreground)]">{num}</span>
                                            <button type="button" onClick={() => void copyTracking(num)} className={buttonClass('ghost', 'sm')}>
                                                <Copy size={13} aria-hidden />
                                                <span aria-live="polite">{copiedTracking === num ? (isKorean ? '복사됨' : 'コピー済み') : (isKorean ? '복사' : 'コピー')}</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : isOrderLocked && !isOrderCompleted ? (
                            <div className="ux-context flex items-start gap-3">
                                <PackageCheck size={16} className="mt-0.5 shrink-0 text-[var(--foreground)]" aria-hidden />
                                <p>{isKorean ? '입금 확인 후 상품을 발송합니다.' : 'ご入金を確認後、商品を発送いたします。'}</p>
                            </div>
                        ) : null}

                        <div className="flex flex-wrap items-center gap-2">
                            {canRequestDeposit && (
                                <button
                                    type="button"
                                    onClick={() => toggleDeposit(orderId, status)}
                                    disabled={loadingMap[orderId]}
                                    className="ux-button-primary min-h-11 w-full px-5 text-sm disabled:opacity-60 sm:w-auto"
                                >
                                    {loadingMap[orderId] ? (isKorean ? '처리 중…' : '処理中…') : (isKorean ? '입금 확인 요청' : '入金確認の要請')}
                                </button>
                            )}
                            <Link href={`/invoice/${orderId}`} target="_blank" className={buttonClass('secondary', 'md', 'min-h-11 flex-1 sm:flex-none')}>
                                <FileText size={16} aria-hidden />
                                {isKorean ? '거래명세표' : '取引明細書'}
                            </Link>
                            <a href="/beiko_Business%20Registration%20Certificate.png" download="beiko_Business_Registration_Certificate.png" className={buttonClass('secondary', 'md', 'min-h-11 flex-1 sm:flex-none')}>
                                <Download size={16} aria-hidden />
                                {isKorean ? '사업자등록증' : '事業者登録証'}
                            </a>
                            {!isOrderLocked && (
                                <button
                                    type="button"
                                    onClick={() => handleDelete(orderId)}
                                    disabled={loadingMap[orderId]}
                                    className={buttonClass('danger', 'md', 'min-h-11 w-full sm:ml-auto sm:w-auto')}
                                >
                                    {isKorean ? '주문 취소' : '注文キャンセル'}
                                </button>
                            )}
                        </div>

                        <section className="border-t border-[var(--border)] pt-5">
                            <h3 className="ux-section-title flex items-center gap-2">
                                <Package size={16} className="text-[var(--muted-foreground)]" aria-hidden />
                                {isKorean ? '주문 상품 목록' : '注文商品リスト'}
                                <span className="font-semibold text-[var(--muted-foreground)] tabular-nums">{items.length}</span>
                            </h3>

                            <ul className="mt-2 divide-y divide-[var(--border)]">
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
                                        <li key={itemId} className="flex gap-4 py-4">
                                            <ProductThumb src={imageUrl || null} className="h-16 w-16 md:h-20 md:w-20" />
                                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                                <h4 className="break-keep break-words text-sm font-bold leading-snug">{productName}</h4>
                                                {!isKorean ? <p className="text-xs text-[var(--muted-foreground)]">{productSubName}</p> : null}
                                                <p className="text-xs text-[var(--muted-foreground)]">
                                                    {isKorean ? '상품코드' : '商品コード'}: {safeText(product?.productCode, '-')}
                                                </p>
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
                                                <div className="mt-1 flex items-end justify-between gap-3">
                                                    <span className="text-sm text-[var(--muted-foreground)] tabular-nums">{money(price)} × {formatNumber(quantity)}{isKorean ? '개' : '個'}</span>
                                                    <span className="text-base font-semibold tabular-nums">{money(price * quantity)}</span>
                                                </div>
                                            </div>
                                        </li>
                                    )
                                })}

                                {shippingFee > 0 && (
                                    <li className="flex gap-4 py-4">
                                        <div className="flex h-10 w-16 shrink-0 items-center justify-center text-[var(--muted-foreground)] md:w-20">
                                            <Truck size={20} aria-hidden />
                                        </div>
                                        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                                            <div>
                                                <h4 className="text-sm font-bold">{isKorean ? '배송비' : '送料'}</h4>
                                                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{isKorean ? `100개당 3,000원 (총 ${totalQuantity}개)` : `100個ごとに3,000ウォン（合計 ${totalQuantity}個）`}</p>
                                            </div>
                                            <span className="text-base font-semibold tabular-nums">{money(shippingFee)}</span>
                                        </div>
                                    </li>
                                )}
                            </ul>
                        </section>
                    </article>
                )
            })}
            </div>
        </div>
    )
}
