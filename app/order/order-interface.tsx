'use client'

import { useMemo, useRef, useState } from 'react'
import Modal from '@/components/Modal'
import { useRouter } from 'next/navigation'
import BarcodeDisplay from '@/components/BarcodeDisplay'
import { Minus, Plus, ArrowRight, Search, PackageSearch, ChevronDown, ListChecks, X } from 'lucide-react'
import Badge from '@/components/ui/Badge'
import { buttonClass } from '@/components/ui/buttonClass'
import { fieldClass, selectClass } from '@/components/ui/field'
import ModalCloseButton from '@/components/ui/ModalCloseButton'
import { PartnerPageHeader, ProductThumb, themedGhost, themedSecondary } from './partner-ui'
import { isPartnerProductOrderable, normalizePartnerProductStatus, type PartnerProductStatus } from '@/lib/partnerProductStatus'
import { calculatePartnerOrderTotals } from '@/lib/partnerOrderPricing'

type Product = {
    id?: string | null
    name?: string | null
    sellPrice?: number | string | null
    imageUrl?: string | null
    productCode?: string | null
    barcode?: string | null
    nameJP?: string | null
    nameEN?: string | null
    minOrderQuantity?: number | string | null
    orderUnit?: number | string | null
    onlinePrice?: number | string | null
    jpBuyPrice?: number | string | null
    jpSellPrice?: number | string | null
    krBuyPrice?: number | string | null
    krSellPrice?: number | string | null
    usBuyPrice?: number | string | null
    usSellPrice?: number | string | null
    country?: string | null
    partnerSaleStatus?: string | null
}

type SafeProduct = {
    id: string
    name: string
    sellPrice: number
    imageUrl: string | null
    productCode: string | null
    barcode: string | null
    nameJP: string | null
    nameEN: string | null
    minOrderQuantity: number
    orderUnit: number
    onlinePrice: number
    jpBuyPrice: number
    jpSellPrice: number
    krBuyPrice: number
    krSellPrice: number
    usBuyPrice: number
    usSellPrice: number
    country: string | null
    partnerSaleStatus: PartnerProductStatus
}

const safeNumber = (value: unknown, fallback = 0) => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
    if (typeof value === 'bigint') return Number(value)
    const normalized = String(value ?? '').replace(/,/g, '').trim()
    if (!normalized) return fallback
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : fallback
}

const safeNonNegativeNumber = (value: unknown, fallback = 0) => {
    const parsed = safeNumber(value, fallback)
    return parsed >= 0 ? parsed : fallback
}

const safeNonNegativeInt = (value: unknown, fallback = 0) => {
    return Math.max(0, Math.floor(safeNonNegativeNumber(value, fallback)))
}

const safePositiveInt = (value: unknown, fallback = 1) => {
    const parsed = safeNumber(value, fallback)
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback
}

const safeText = (value: unknown, fallback = '') => {
    return typeof value === 'string' && value.trim() ? value : fallback
}

const formatNumber = (
    value: unknown,
    options?: Intl.NumberFormatOptions,
) => safeNumber(value).toLocaleString('ko-KR', options)

const formatMoney = (value: unknown, isUSD: boolean) => {
    return formatNumber(value, isUSD ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : {})
}

const normalizeProduct = (product: Product): SafeProduct | null => {
    const id = safeText(product?.id)
    if (!id) return null

    return {
        id,
        name: safeText(product.name, '상품 정보 없음'),
        sellPrice: safeNonNegativeNumber(product.sellPrice),
        imageUrl: safeText(product.imageUrl) || null,
        productCode: safeText(product.productCode) || null,
        barcode: safeText(product.barcode) || null,
        nameJP: safeText(product.nameJP) || null,
        nameEN: safeText(product.nameEN) || null,
        minOrderQuantity: safePositiveInt(product.minOrderQuantity, 1),
        orderUnit: safePositiveInt(product.orderUnit, 1),
        onlinePrice: safeNonNegativeNumber(product.onlinePrice),
        jpBuyPrice: safeNonNegativeNumber(product.jpBuyPrice),
        jpSellPrice: safeNonNegativeNumber(product.jpSellPrice),
        krBuyPrice: safeNonNegativeNumber(product.krBuyPrice),
        krSellPrice: safeNonNegativeNumber(product.krSellPrice),
        usBuyPrice: safeNonNegativeNumber(product.usBuyPrice),
        usSellPrice: safeNonNegativeNumber(product.usSellPrice),
        country: safeText(product.country) || null,
        partnerSaleStatus: normalizePartnerProductStatus(product.partnerSaleStatus),
    }
}

export default function OrderInterface({ products, isKorean = false }: { products?: Product[] | null; isKorean?: boolean }) {
    const router = useRouter()
    const [quantities, setQuantities] = useState<Record<string, number>>({})
    const [showSummary, setShowSummary] = useState(false)
    const [showSelected, setShowSelected] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const submittingRef = useRef(false)
    const [orderError, setOrderError] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'AVAILABLE' | 'SOLD_OUT'>('ALL')
    const safeProducts = useMemo(
        () => (Array.isArray(products) ? products.map(normalizeProduct).filter((product): product is SafeProduct => Boolean(product)) : []),
        [products],
    )
    const copy = isKorean ? {
        productList: '상품 목록',
        productListHelper: '원하는 상품을 검색하고 수량을 입력해 주세요.',
        searchPlaceholder: '상품명 · 상품코드 · 바코드 검색',
        allProducts: '전체 상품',
        availableOnly: '주문 가능',
        soldOutOnly: '품절 상품',
        noResults: '검색 조건에 맞는 상품이 없습니다.',
        resultCount: '개 상품',
        selectedOnly: '선택 상품만',
        editQuantities: '수량 수정',
        resetFilters: '검색 조건 초기화',
        productCode: '상품코드:',
        noImage: '이미지 없음',
        noBarcode: '바코드 없음',
        soldOut: '품절',
        soldOutSub: '주문 불가',
        wholesaleKr: '도매 가격',
        retailKr: '권장 판매가',
        krPriceSub: '한국 기준',
        orderStatus: '주문 상태',
        orderStatusSub: '발주 가능 여부',
        available: '주문 가능',
        margin: '마진율',
        marginSub: '예상 마진',
        minimumOrder: '최소 주문 수량',
        minimumOrderSub: '최소 수량',
        orderUnit: '주문 단위',
        totalExcludingTax: '상품 합계 (부가세·배송비 별도)',
        totalExcludingTaxShort: '합계 · VAT·배송비 별도',
        orderNow: '주문 내용 확인',
        summaryTitle: '주문 내용 확인',
        shipping: '배송비',
        supply: '공급가액',
        tax: '부가세 (10%)',
        total: '총 결제금액',
        confirmOrder: '주문 확정',
        soldOutNotice: '현재 품절되어 주문할 수 없습니다.',
        soldOutOrderDisabled: '품절 상품은 주문할 수 없습니다.',
    } : {
        productList: '商品リスト',
        productListHelper: 'ご希望の商品を検索して数量を入力してください。',
        searchPlaceholder: '商品名・商品コード・バーコードで検索',
        allProducts: '全商品',
        availableOnly: '注文可能',
        soldOutOnly: '品切れ',
        noResults: '検索条件に一致する商品がありません。',
        resultCount: '件',
        selectedOnly: '選択した商品のみ',
        editQuantities: '数量を変更',
        resetFilters: '検索条件をリセット',
        productCode: '商品コード:',
        noImage: '画像なし',
        noBarcode: 'バーコードなし',
        soldOut: '品切れ',
        soldOutSub: '注文不可',
        wholesaleKr: '卸売価格 韓国',
        retailKr: '小売価格 韓国',
        krPriceSub: '韓国',
        orderStatus: '注文状態',
        orderStatusSub: '注文可否',
        available: '注文可能',
        margin: 'マージン',
        marginSub: '予想マージン',
        minimumOrder: '最小注文数量',
        minimumOrderSub: '最小数量',
        orderUnit: '注文単位',
        totalExcludingTax: '商品合計（税・送料別）',
        totalExcludingTaxShort: '合計・税・送料別',
        orderNow: '注文内容を確認',
        summaryTitle: '注文内容の確認',
        shipping: '送料',
        supply: '供給価額',
        tax: '消費税 (10%)',
        total: '合計金額',
        confirmOrder: '注文を確定する',
        soldOutNotice: '現在品切れです。再入荷時期はお知らせにてご案内します。',
        soldOutOrderDisabled: '品切れ商品のため注文できません。',
    }
    const displayProductName = (product: SafeProduct) => isKorean ? product.name : (product.nameJP || product.name)
    const filteredProducts = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLocaleLowerCase()

        return safeProducts.filter((product) => {
            const isSoldOut = product.partnerSaleStatus === 'SOLD_OUT'
            if (showSelected && !safeNonNegativeInt(quantities[product.id])) return false
            if (statusFilter === 'AVAILABLE' && isSoldOut) return false
            if (statusFilter === 'SOLD_OUT' && !isSoldOut) return false
            if (!normalizedQuery) return true

            return [product.name, product.nameJP, product.nameEN, product.productCode, product.barcode]
                .filter(Boolean)
                .some((value) => value?.toLocaleLowerCase().includes(normalizedQuery))
        })
    }, [safeProducts, searchQuery, statusFilter, showSelected, quantities])

    const handleQuantityChange = (productId: string, value: string | number) => {
        const qty = safeNonNegativeInt(value)
        const product = safeProducts.find(p => p.id === productId)
        if (!product || !isPartnerProductOrderable(product.partnerSaleStatus) || product.sellPrice <= 0) return

        setQuantities(prev => ({
            ...prev,
            [productId]: qty < 0 ? 0 : qty
        }))
    }

    const handleOrderNow = () => {
        setOrderError('')
        const minimumViolations = safeProducts
            .filter(p => isPartnerProductOrderable(p.partnerSaleStatus))
            .filter(p => {
                const qty = safeNonNegativeInt(quantities[p.id]);
                return qty > 0 && qty < p.minOrderQuantity;
            })
            .map(p => isKorean
                ? `- ${displayProductName(p)}: 주문 ${formatNumber(quantities[p.id])}개 / 최소 ${formatNumber(p.minOrderQuantity)}개`
                : `- ${displayProductName(p)}: 注文 ${formatNumber(quantities[p.id])}個 / 最小 ${formatNumber(p.minOrderQuantity)}個`);

        if (minimumViolations.length > 0) {
            alert(isKorean
                ? `최소 주문 수량이 미달된 상품이 있습니다:\n\n${minimumViolations.join('\n')}\n\n최소 주문 수량 이상으로 주문해 주세요.`
                : `最小注文数量に満たない商品があります:\n\n${minimumViolations.join('\n')}\n\n最小注文数量以上を入力してください。`);
            return;
        }

        const unitViolations = safeProducts
            .filter(p => isPartnerProductOrderable(p.partnerSaleStatus))
            .filter(p => {
                const qty = safeNonNegativeInt(quantities[p.id]);
                const orderUnit = p.orderUnit;
                return qty > 0 && qty % orderUnit !== 0;
            })
            .map(p => isKorean
                ? `- ${displayProductName(p)}: 주문 ${formatNumber(quantities[p.id])}개 / 주문 단위 ${formatNumber(p.orderUnit)}개`
                : `- ${displayProductName(p)}: 注文 ${formatNumber(quantities[p.id])}個 / 注文単位 ${formatNumber(p.orderUnit)}個`);

        if (unitViolations.length > 0) {
            alert(isKorean
                ? `주문 단위에 맞지 않는 상품이 있습니다:\n\n${unitViolations.join('\n')}\n\n설정된 주문 단위의 배수로 주문해 주세요.`
                : `注文単位に合わない商品があります:\n\n${unitViolations.join('\n')}\n\n設定された注文単位の倍数を入力してください。`);
            return;
        }
        setShowSummary(true);
    };

    const productTotal = safeProducts.reduce((sum, p) => {
        if (!isPartnerProductOrderable(p.partnerSaleStatus)) return sum
        return sum + (p.sellPrice * safeNonNegativeInt(quantities[p.id]))
    }, 0)

    const totalQuantity = safeProducts.reduce((sum, p) => (
        isPartnerProductOrderable(p.partnerSaleStatus) ? sum + safeNonNegativeInt(quantities[p.id]) : sum
    ), 0)
    const userCountry = safeProducts[0]?.country
    const currencySymbol = userCountry === 'Korea' ? '₩' : userCountry === 'Japan' ? '¥' : '$'

    // Same calculation the order API uses to store the total.
    const { isUSD, shippingFee, supplyTotal, vat, total: totalAmount } = calculatePartnerOrderTotals(productTotal, totalQuantity, userCountry)

    const hasItems = productTotal > 0
    const selectedCount = safeProducts.filter(p => isPartnerProductOrderable(p.partnerSaleStatus) && safeNonNegativeInt(quantities[p.id]) > 0).length
    const money = (value: unknown) => `${currencySymbol}${formatMoney(value, isUSD)}`
    const filtersActive = Boolean(searchQuery) || statusFilter !== 'ALL' || showSelected
    const resultMeta = <>
        <span className="whitespace-nowrap text-sm text-[var(--muted-foreground)] tabular-nums">{filteredProducts.length.toLocaleString()}{copy.resultCount}</span>
        {filtersActive ? (
            <button
                type="button"
                onClick={() => {
                    setSearchQuery('')
                    setStatusFilter('ALL')
                    setShowSelected(false)
                }}
                className={buttonClass('ghost', 'sm', themedGhost)}
            >
                <X size={14} aria-hidden />
                {copy.resetFilters}
            </button>
        ) : null}
    </>
    const selectedProducts = safeProducts.filter(p => isPartnerProductOrderable(p.partnerSaleStatus) && safeNonNegativeInt(quantities[p.id]) > 0)

    return (
        // Room for the fixed order bar only while it is showing.
        <div className={`space-y-5 ${hasItems ? 'pb-20 sm:pb-24' : ''}`}>
            {orderError && !showSummary && <p role="alert" className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">{orderError}</p>}
            <PartnerPageHeader id="partner-product-list-title" title={copy.productList} description={copy.productListHelper}>
                <div role="search" className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto] gap-2 lg:flex lg:w-auto lg:items-center">
                    {/* On desktop the result count sits at the start of the filter row it belongs to. */}
                    <div className="hidden lg:mr-2 lg:flex lg:items-center lg:gap-1">{resultMeta}</div>
                    <label className="relative block min-w-0 lg:w-[340px]">
                        <span className="sr-only">{copy.searchPlaceholder}</span>
                        <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" size={19} aria-hidden />
                        <input
                            type="search"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder={copy.searchPlaceholder}
                            className={fieldClass('h-12 bg-[var(--input-bg)] pl-11 pr-4 text-sm text-[var(--foreground)]')}
                        />
                    </label>
                    <select
                        aria-label={isKorean ? '상품 상태 필터' : '商品状態フィルター'}
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value as 'ALL' | 'AVAILABLE' | 'SOLD_OUT')}
                        className={selectClass(true, 'h-12 w-auto min-w-[116px] bg-[var(--input-bg)] text-sm text-[var(--foreground)] sm:min-w-[150px]')}
                    >
                        <option value="ALL">{copy.allProducts}</option>
                        <option value="AVAILABLE">{copy.availableOnly}</option>
                        <option value="SOLD_OUT">{copy.soldOutOnly}</option>
                    </select>
                    {/* Icon-only below lg so a secondary filter is not the biggest control; the count floats as a badge,
                        so the button keeps its width and the search box beside it never shifts when the cart fills. */}
                    <button
                        type="button"
                        aria-pressed={showSelected}
                        aria-label={`${copy.selectedOnly}${selectedCount > 0 ? ` (${selectedCount})` : ''}`}
                        title={copy.selectedOnly}
                        onClick={() => setShowSelected(value => !value)}
                        className={`relative inline-flex h-12 w-12 items-center justify-center gap-2 whitespace-nowrap rounded-lg border text-sm font-semibold transition-colors lg:w-auto lg:px-4 ${
                            showSelected
                                ? 'border-brand-orange bg-brand-orange-soft text-brand-orange-strong'
                                : 'border-[var(--border-strong)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--card-hover)]'
                        }`}
                    >
                        <ListChecks size={17} aria-hidden />
                        <span className="hidden lg:inline">{copy.selectedOnly}</span>
                        {selectedCount > 0 ? <span aria-hidden className="absolute -right-2 -top-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-orange px-1.5 text-[11px] font-bold leading-none text-white tabular-nums">{selectedCount}</span> : null}
                    </button>
                </div>
            </PartnerPageHeader>

            <div className="flex min-h-8 items-center justify-between gap-3 lg:hidden">{resultMeta}</div>

            {filteredProducts.length === 0 ? (
                <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--card)] px-6 text-center">
                    <PackageSearch size={34} className="text-[var(--muted-foreground)]" aria-hidden />
                    <p className="mt-3 text-sm font-bold text-[var(--muted-foreground)]">{copy.noResults}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredProducts.map((product) => {
                        const qty = safeNonNegativeInt(quantities[product.id])
                        const isSoldOut = product.partnerSaleStatus === 'SOLD_OUT'
                        const orderUnit = product.orderUnit
                        const displayRetail = product.country === 'Korea' ? product.krSellPrice : product.country === 'Japan' ? product.jpSellPrice : product.usSellPrice
                        const displayWholesale = product.sellPrice
                        const priceMissing = displayWholesale <= 0
                        const marginPercent = displayRetail > 0 ? ((displayRetail - displayWholesale) / displayRetail * 100).toFixed(1) : '0.0'
                        const priceSymbol = product.country === 'Korea' ? '₩' : product.country === 'Japan' ? '¥' : '$'
                        const priceOptions = product.country !== 'Korea' && product.country !== 'Japan'
                            ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                            : undefined
                        const wholesaleLabel = product.country === 'Korea' ? copy.wholesaleKr : product.country === 'Japan' ? '卸売価格 日本' : '卸売価格 米国'
                        const retailLabel = product.country === 'Korea' ? copy.retailKr : product.country === 'Japan' ? '小売価格 日本' : '小売価格 米国'

                        const invalidQuantity = qty > 0 && (qty < product.minOrderQuantity || qty % orderUnit !== 0)
                        return (
                            // Content stays top-aligned (no mt-auto), so a taller card in the same row never moves its neighbour.
                            <article key={product.id} data-partner-sale-status={isSoldOut ? 'sold-out' : 'available'} className={`flex flex-col rounded-2xl border bg-[var(--card)] p-4 sm:p-5 ${qty > 0 ? 'border-brand-orange ring-1 ring-brand-orange/20' : 'border-[var(--border)]'}`}>
                                <div className="flex items-start gap-4">
                                    <ProductThumb src={product.imageUrl} alt={displayProductName(product)} className="h-24 w-20 sm:h-28 sm:w-24" />
                                    <div className="min-w-0 flex-1">
                                        {isSoldOut || priceMissing ? <Badge tone="warning" className="mb-2">{isSoldOut ? copy.soldOut : (isKorean ? '가격 확인 필요' : '価格確認が必要')}</Badge> : null}
                                        <h2 className="break-keep break-words text-base font-bold leading-snug sm:text-lg">{displayProductName(product)}</h2>
                                        <div className="mt-2 flex flex-wrap items-baseline gap-x-2"><span className="text-xs text-[var(--muted-foreground)]">{wholesaleLabel}</span><strong className="text-2xl tabular-nums">{priceMissing ? '—' : `${priceSymbol}${formatNumber(displayWholesale, priceOptions)}`}</strong></div>
                                    </div>
                                </div>
                                <div className="mt-4 border-t border-[var(--border)] pt-3">
                                    <p className="mb-3 text-xs leading-5 text-[var(--muted-foreground)]">{copy.minimumOrderSub} {formatNumber(product.minOrderQuantity)}{isKorean ? '개' : '個'} · {copy.orderUnit} {formatNumber(orderUnit)}{isKorean ? '개' : '個'}</p>
                                    {isSoldOut || priceMissing ? <p className="rounded-lg bg-[var(--surface)] p-3 text-sm text-[var(--muted-foreground)]">{isSoldOut ? copy.soldOutOrderDisabled : (isKorean ? '거래 단가 확인 후 주문할 수 있습니다. 관리자에게 문의해 주세요.' : '価格確認後にご注文いただけます。管理者にお問い合わせください。')}</p> : <>
                                        <div className="flex flex-wrap items-center gap-4">
                                            <div className="flex h-12 items-center overflow-hidden rounded-lg border border-[var(--border-strong)]">
                                                <button type="button" aria-label={isKorean ? '수량 줄이기' : '数量を減らす'} onClick={() => handleQuantityChange(product.id, qty - orderUnit < product.minOrderQuantity ? 0 : qty - orderUnit)} className="flex h-full w-12 items-center justify-center hover:bg-[var(--surface)]"><Minus size={17} /></button>
                                                <input type="text" inputMode="numeric" aria-label={`${displayProductName(product)} ${isKorean ? '주문 수량' : '注文数量'}`} aria-invalid={invalidQuantity} aria-describedby={`quantity-help-${product.id}`} value={formatNumber(qty)} onChange={event => { const value = event.target.value.replace(/,/g, ''); if (/^\d*$/.test(value)) handleQuantityChange(product.id, value) }} className="h-full w-20 border-x border-[var(--border)] bg-transparent text-center text-lg font-bold tabular-nums" />
                                                <button type="button" aria-label={isKorean ? '수량 늘리기' : '数量を増やす'} onClick={() => handleQuantityChange(product.id, qty === 0 ? Math.ceil(product.minOrderQuantity / orderUnit) * orderUnit : qty + orderUnit)} className="flex h-full w-12 items-center justify-center hover:bg-[var(--surface)]"><Plus size={17} /></button>
                                            </div>
                                            <span className={`text-base font-semibold tabular-nums ${qty > 0 ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'}`}>{priceSymbol}{formatMoney(qty * product.sellPrice, isUSD)}</span>
                                        </div>
                                        {/* Reserved line: the hint appearing doesn't push the rest of the card down. */}
                                        <p id={`quantity-help-${product.id}`} className="mt-2 min-h-4 text-xs leading-4 text-[var(--danger)]">{invalidQuantity ? (isKorean ? '최소 수량 이상, 주문 단위의 배수로 입력해 주세요.' : '最小数量以上、注文単位の倍数で入力してください。') : ''}</p>
                                    </>}
                                </div>
                                <details className="group mt-1">
                                    <summary className="flex min-h-10 cursor-pointer list-none items-center justify-start gap-1 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] [&::-webkit-details-marker]:hidden">
                                        {isKorean ? '상품 자료·권장 판매가' : '商品情報・参考価格'}
                                        <ChevronDown size={16} aria-hidden className="transition-transform group-open:rotate-180" />
                                    </summary>
                                    <div className="space-y-3 pb-1 pt-1 text-sm text-[var(--muted-foreground)]">
                                        <p>{copy.productCode} {product.productCode || '—'}</p>
                                        {!isKorean && product.nameEN && <p>{product.nameEN}</p>}
                                        <p className="tabular-nums">{retailLabel} {displayRetail > 0 ? `${priceSymbol}${formatNumber(displayRetail, priceOptions)}` : '—'} · {copy.margin} {displayRetail > 0 && !priceMissing ? `${marginPercent}%` : '—'}</p>
                                        {product.barcode ? <div><BarcodeDisplay value={product.barcode} width={0.8} height={25} displayValue={false} containerClassName="gap-2 mb-1" buttonClassName={buttonClass('secondary', 'sm')} /><p className="mt-2 font-mono">{product.barcode}</p></div> : <p>{copy.noBarcode}</p>}
                                    </div>
                                </details>
                            </article>
                        )
                    })}
                </div>
            )}

            {hasItems && (
                // On phones this sits flush on the bottom tabs (68px + safe area, see UserNavbar) and carries the one shadow,
                // so bar and tabs read as one fixed block.
                <div id="partner-order-bar" className="fixed inset-x-0 bottom-[calc(68px+env(safe-area-inset-bottom))] z-40 border-t border-[var(--border-strong)] bg-[var(--card)] shadow-[0_-8px_24px_rgba(16,24,40,0.12)] sm:bottom-0">
                    {/* Same width and gutters as the page content in layout.tsx, so total and button line up with the cards. */}
                    <div className="mx-auto flex min-h-14 max-w-[1440px] items-center justify-between gap-3 px-3 py-2 sm:px-5 sm:py-4 lg:px-7">
                        <div className="min-w-0">
                            {/* Short label on phones so "별도" (excluded) is never cut off. */}
                            <p className="text-xs leading-tight text-[var(--muted-foreground)] sm:hidden">{copy.totalExcludingTaxShort}</p>
                            <p className="hidden text-sm text-[var(--muted-foreground)] sm:block">{copy.totalExcludingTax}</p>
                            <p className="text-xl font-bold leading-tight tabular-nums sm:text-2xl">{money(productTotal)}</p>
                        </div>

                        <button type="button" onClick={handleOrderNow} className={buttonClass('primary', 'md', 'h-11 px-5 text-[15px]')}>
                            {copy.orderNow} <span className="tabular-nums">({selectedCount})</span>
                            <ArrowRight size={18} strokeWidth={2.5} aria-hidden />
                        </button>
                    </div>
                </div>
            )}

            {
                showSummary && (
                    <Modal label={copy.summaryTitle} onClose={() => { if (!submittingRef.current) setShowSummary(false) }} className="flex items-center justify-center bg-slate-950/50 p-4">
                        <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col rounded-2xl bg-[var(--card)] shadow-2xl">
                            <div className="flex items-start justify-between gap-3 px-6 pb-4 pt-6">
                                <h3 className="text-lg font-extrabold">{copy.summaryTitle}</h3>
                                <ModalCloseButton label={isKorean ? '주문 확인 닫기' : '閉じる'} onClick={() => { if (!submittingRef.current) setShowSummary(false) }} className={`-mr-2 -mt-1.5 ${themedGhost}`} />
                            </div>

                            {/* Items and totals share one scroll area and one padding, so every amount ends on the same right edge. */}
                            <div className="min-h-0 flex-1 overflow-y-auto px-6">
                                <div className="divide-y divide-[var(--border)]">
                                    {selectedProducts.map(p => (
                                        <div key={p.id} className="flex items-center justify-between gap-3 py-3">
                                            <div className="min-w-0">
                                                <p className="break-keep text-sm font-bold">{displayProductName(p)}</p>
                                                <p className="mt-0.5 text-sm text-[var(--muted-foreground)] tabular-nums">
                                                    {isKorean ? `수량 ${formatNumber(quantities[p.id])}개` : `数量 ${formatNumber(quantities[p.id])}個`}
                                                </p>
                                            </div>
                                            <span className="shrink-0 text-right font-bold tabular-nums">{money(p.sellPrice * safeNonNegativeInt(quantities[p.id]))}</span>
                                        </div>
                                    ))}
                                    {shippingFee > 0 && (
                                        <div className="flex items-center justify-between gap-3 py-3">
                                            <span className="text-sm font-bold text-[var(--muted-foreground)]">{copy.shipping}</span>
                                            <span className="text-right font-bold tabular-nums">{money(shippingFee)}</span>
                                        </div>
                                    )}
                                </div>

                                <dl className="space-y-2 border-t-2 border-[var(--border-strong)] py-4 text-sm">
                                    <div className="flex justify-between gap-3 text-[var(--muted-foreground)]">
                                        <dt>{copy.supply}</dt>
                                        <dd className="tabular-nums">{money(supplyTotal)}</dd>
                                    </div>
                                    {!isUSD && (
                                        <div className="flex justify-between gap-3 text-[var(--muted-foreground)]">
                                            <dt>{copy.tax}</dt>
                                            <dd className="tabular-nums">{currencySymbol}{formatNumber(vat)}</dd>
                                        </div>
                                    )}
                                    <div className="flex items-baseline justify-between gap-3 border-t border-[var(--border)] pt-3">
                                        <dt className="text-base font-bold">{copy.total}</dt>
                                        <dd className="text-2xl font-bold tabular-nums">{money(totalAmount)}</dd>
                                    </div>
                                </dl>
                            </div>

                            <div className="border-t border-[var(--border)] px-6 pb-6 pt-4">
                                {orderError && <p role="alert" className="mb-3 text-sm text-[var(--danger)]">{orderError}</p>}
                                {/* Editing is the alternative to confirming, so the two sit side by side. */}
                                <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
                                    <button type="button" className={buttonClass('secondary', 'md', `h-12 ${themedSecondary}`)} disabled={submitting} onClick={() => { setShowSummary(false); setShowSelected(true); setSearchQuery(''); setStatusFilter('ALL') }}>{copy.editQuantities}</button>
                                    <button type="button" disabled={submitting} aria-busy={submitting}
                                        onClick={async () => {
                                            if (submittingRef.current) return
                                            submittingRef.current = true
                                            setSubmitting(true)
                                            setOrderError('')
                                            try {
                                                const items = safeProducts
                                                    .filter(p => isPartnerProductOrderable(p.partnerSaleStatus) && safeNonNegativeInt(quantities[p.id]) > 0)
                                                    .map(p => ({
                                                        productId: p.id,
                                                        quantity: safeNonNegativeInt(quantities[p.id]),
                                                        price: p.sellPrice
                                                    }))

                                                const res = await fetch('/api/orders', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ items, total: totalAmount })
                                                })

                                                if (res.ok) {

                                                    setShowSummary(false);
                                                    setQuantities({});
                                                    router.push('/order/history');
                                                } else {
                                                    const errorData = await res.json();
                                                    setOrderError(`${isKorean ? '주문 실패' : '注文に失敗しました'}: ${errorData.error}`);
                                                }
                                            } catch (e) {
                                                console.error(e)
                                                setOrderError(isKorean ? '주문 처리 중 오류가 발생했습니다. 다시 시도해 주세요.' : 'エラーが発生しました。再度お試しください。');
                                            } finally { submittingRef.current = false; setSubmitting(false) }
                                        }}
                                        className={buttonClass('primary', 'md', 'h-12 text-base')}
                                    >
                                        {submitting ? (isKorean ? '주문 접수 중…' : '注文処理中…') : copy.confirmOrder}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </Modal>
                )}
        </div>
    )
}
