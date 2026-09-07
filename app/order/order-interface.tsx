'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import BarcodeDisplay from '@/components/BarcodeDisplay'
import { Minus, Plus, ArrowRight, Search, PackageSearch, CircleAlert } from 'lucide-react'
import { isPartnerProductOrderable, normalizePartnerProductStatus, type PartnerProductStatus } from '@/lib/partnerProductStatus'

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
    appliedGrade?: string
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
    appliedGrade?: string
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
) => safeNumber(value).toLocaleString(undefined, options)

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
        appliedGrade: safeText(product.appliedGrade) || undefined,
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
        totalExcludingTax: '합계 금액 (부가세 별도)',
        totalExcludingTaxSub: '상품 합계',
        orderNow: '주문하기',
        orderNowSub: '선택 상품 주문',
        summaryTitle: '주문 내용 확인',
        summarySub: '최종 주문 확인',
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
        resultCount: '商品',
        productCode: 'Product Code:',
        noImage: 'No Image',
        noBarcode: 'No Barcode',
        soldOut: '品切れ',
        soldOutSub: 'SOLD OUT',
        wholesaleKr: '卸売価格 韓国',
        retailKr: '小売価格 韓国',
        krPriceSub: 'KOREA',
        orderStatus: '注文状態',
        orderStatusSub: 'Order Status',
        available: '注文可能',
        margin: 'マージン',
        marginSub: 'Margin%',
        minimumOrder: '最小注文数量',
        minimumOrderSub: 'Min Order',
        orderUnit: 'Order Unit',
        totalExcludingTax: '合計金額 (税抜)',
        totalExcludingTaxSub: 'Total (Excl. Tax)',
        orderNow: '今すぐ注文する',
        orderNowSub: 'ORDER NOW',
        summaryTitle: '注文内容の確認',
        summarySub: 'Order Summary',
        shipping: '配送料 (Shipping)',
        supply: '供給価額 (Supply)',
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
            if (statusFilter === 'AVAILABLE' && isSoldOut) return false
            if (statusFilter === 'SOLD_OUT' && !isSoldOut) return false
            if (!normalizedQuery) return true

            return [product.name, product.nameJP, product.nameEN, product.productCode, product.barcode]
                .filter(Boolean)
                .some((value) => value?.toLocaleLowerCase().includes(normalizedQuery))
        })
    }, [safeProducts, searchQuery, statusFilter])

    const handleQuantityChange = (productId: string, value: string | number) => {
        const qty = safeNonNegativeInt(value)
        const product = safeProducts.find(p => p.id === productId)
        if (!product || !isPartnerProductOrderable(product.partnerSaleStatus)) return

        setQuantities(prev => ({
            ...prev,
            [productId]: qty < 0 ? 0 : qty
        }))
    }

    const handleOrderNow = () => {
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

    const totalQuantity = Object.values(quantities).reduce((sum, q) => sum + safeNonNegativeInt(q), 0)
    const userCountry = safeProducts[0]?.country
    const currencySymbol = userCountry === 'Korea' ? '₩' : userCountry === 'Japan' ? '¥' : '$'
    const isUSD = userCountry !== 'Korea' && userCountry !== 'Japan'

    // Shipping: 3000 base + 3000 extra for every 100 items starting from 101
    // Disabled for US pricing users as requested
    const shippingFee = (totalQuantity > 0 && !isUSD) ? Math.ceil(totalQuantity / 100) * 3000 : 0

    const supplyTotal = productTotal + shippingFee
    const vat = isUSD ? 0 : Math.round(supplyTotal * 0.1)
    const totalAmount = supplyTotal + vat

    const hasItems = productTotal > 0


    return (
        <div className="space-y-6 pb-32">
            <section aria-labelledby="partner-product-list-title" className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h1 id="partner-product-list-title" className="text-2xl font-black text-slate-950 sm:text-3xl dark:text-white">{copy.productList}</h1>
                    <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">{copy.productListHelper}</p>
                </div>
                <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                    <label className="relative block min-w-0 flex-1 lg:w-[360px]">
                        <span className="sr-only">{copy.searchPlaceholder}</span>
                        <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
                        <input
                            type="search"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder={copy.searchPlaceholder}
                            className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold text-slate-900 shadow-sm placeholder:font-medium dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        />
                    </label>
                    <select
                        aria-label={isKorean ? '상품 상태 필터' : '商品状態フィルター'}
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value as 'ALL' | 'AVAILABLE' | 'SOLD_OUT')}
                        className="h-12 min-w-[150px] rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    >
                        <option value="ALL">{copy.allProducts}</option>
                        <option value="AVAILABLE">{copy.availableOnly}</option>
                        <option value="SOLD_OUT">{copy.soldOutOnly}</option>
                    </select>
                </div>
            </section>

            <div className="flex items-center justify-between border-b border-slate-200 pb-3 text-xs font-bold text-slate-400 dark:border-slate-800">
                <span>{filteredProducts.length.toLocaleString()} {copy.resultCount}</span>
                {searchQuery || statusFilter !== 'ALL' ? (
                    <button
                        type="button"
                        onClick={() => {
                            setSearchQuery('')
                            setStatusFilter('ALL')
                        }}
                        className="text-[#d9361b] hover:text-[#b92c16]"
                    >
                        {isKorean ? '검색 조건 초기화' : '検索条件をリセット'}
                    </button>
                ) : null}
            </div>

            {filteredProducts.length === 0 ? (
                <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 text-center dark:border-slate-700 dark:bg-slate-900">
                    <PackageSearch size={34} className="text-slate-300 dark:text-slate-600" />
                    <p className="mt-3 text-sm font-bold text-slate-500 dark:text-slate-400">{copy.noResults}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                    {filteredProducts.map((product, index) => {
                        const qty = safeNonNegativeInt(quantities[product.id])
                        const isSoldOut = product.partnerSaleStatus === 'SOLD_OUT'
                        const orderUnit = product.orderUnit
                        const displayRetail = product.country === 'Korea' ? product.krSellPrice : product.country === 'Japan' ? product.jpSellPrice : product.usSellPrice
                        const displayWholesale = product.country === 'Korea' ? product.krBuyPrice : product.country === 'Japan' ? product.jpBuyPrice : product.usBuyPrice
                        const marginPercent = displayRetail > 0 ? ((displayRetail - displayWholesale) / displayRetail * 100).toFixed(1) : '0.0'
                        const priceSymbol = product.country === 'Korea' ? '₩' : product.country === 'Japan' ? '¥' : '$'
                        const priceOptions = product.country !== 'Korea' && product.country !== 'Japan'
                            ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                            : undefined
                        const wholesaleLabel = product.country === 'Korea' ? copy.wholesaleKr : product.country === 'Japan' ? '卸売価格 日本' : '卸売価格 米国'
                        const retailLabel = product.country === 'Korea' ? copy.retailKr : product.country === 'Japan' ? '小売価格 日本' : '小売価格 米国'
                        const regionLabel = product.country === 'Korea' ? copy.krPriceSub : product.country === 'Japan' ? 'JAPAN' : 'UNITED STATES'

                        return (
                            <article
                                key={product.id}
                                data-partner-sale-status={isSoldOut ? 'sold-out' : 'available'}
                                className={`group flex h-full flex-col overflow-hidden rounded-2xl border bg-white shadow-[0_8px_28px_rgba(15,23,42,0.06)] transition-shadow hover:shadow-[0_14px_36px_rgba(15,23,42,0.10)] dark:bg-slate-900 ${isSoldOut ? 'border-rose-200 dark:border-rose-900/80' : 'border-slate-200 dark:border-slate-800'}`}
                            >
                                <div className="flex flex-1 flex-col p-4 sm:p-5">
                                    <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-4 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-5">
                                        <div className="flex min-h-[142px] items-center justify-center overflow-hidden rounded-xl bg-slate-100 p-2 sm:min-h-[184px] dark:bg-slate-800">
                                            {product.imageUrl ? (
                                                <img src={product.imageUrl} alt={product.name} className="max-h-[168px] max-w-full object-contain mix-blend-multiply transition-transform duration-300 group-hover:scale-[1.03] dark:mix-blend-normal" />
                                            ) : (
                                                <span className="text-center text-sm font-bold text-slate-400">{copy.noImage}</span>
                                            )}
                                        </div>

                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-start justify-between gap-2">
                                                <span
                                                    role="status"
                                                    aria-label={isSoldOut ? (isKorean ? '품절 상품' : '品切れ商品') : (isKorean ? '주문 가능 상품' : '注文可能商品')}
                                                    className={`inline-flex shrink-0 items-center rounded-lg px-3 py-1.5 text-sm font-black ${isSoldOut ? 'bg-rose-500 text-white' : 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900'}`}
                                                >
                                                    {isSoldOut ? copy.soldOut : copy.available}
                                                </span>
                                                <span className="pt-1 text-sm font-bold tabular-nums text-slate-300 dark:text-slate-600">{String(index + 1).padStart(3, '0')}</span>
                                            </div>
                                            <h2 className="mt-3 break-words text-lg font-bold leading-snug text-slate-950 sm:text-2xl dark:text-white">{displayProductName(product)}</h2>
                                            {!isKorean ? <p className="mt-1 line-clamp-1 text-xs font-semibold text-slate-400">{product.nameEN || product.name}</p> : null}
                                            <p className="mt-3 text-sm font-bold text-slate-500 dark:text-slate-400">
                                                {copy.productCode} <span className="font-mono text-slate-800 dark:text-slate-200">{product.productCode || '-'}</span>
                                            </p>

                                            {product.barcode ? (
                                                <div className="mt-2 max-w-full overflow-hidden">
                                                    <BarcodeDisplay
                                                        value={product.barcode}
                                                        width={0.8}
                                                        height={25}
                                                        displayValue={false}
                                                        containerClassName="gap-2 mb-1"
                                                        buttonClassName="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm font-bold text-slate-500 transition-colors hover:border-[#d9361b] hover:bg-[#d9361b] hover:text-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                                                    />
                                                    <p className="mt-1 font-mono text-sm font-semibold text-slate-500">{product.barcode}</p>
                                                </div>
                                            ) : (
                                                <p className="mt-3 text-sm font-bold text-slate-300 dark:text-slate-600">{copy.noBarcode}</p>
                                            )}
                                        </div>
                                    </div>

                                    {isSoldOut ? (
                                        <div className="mt-4 flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-base font-medium leading-6 text-rose-700 dark:bg-rose-950/25 dark:text-rose-300">
                                            <CircleAlert size={17} className="mt-0.5 shrink-0" />
                                            <span>{copy.soldOutNotice}</span>
                                        </div>
                                    ) : null}

                                    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/70">
                                        <div className="grid grid-cols-2 border-b border-slate-200 dark:border-slate-700">
                                            <div className="border-r border-slate-200 px-4 py-3 dark:border-slate-700">
                                                <p className="text-base font-semibold text-slate-700 dark:text-slate-200">{wholesaleLabel}</p>
                                                {!isKorean && <p className="text-sm font-medium text-slate-500">{regionLabel}</p>}
                                                <p className="mt-2 text-right text-2xl font-bold tabular-nums text-slate-950 dark:text-white"><span className="mr-1 text-sm">{priceSymbol}</span>{formatNumber(displayWholesale, priceOptions)}</p>
                                            </div>
                                            <div className="px-4 py-3">
                                                <p className="text-base font-semibold text-slate-700 dark:text-slate-200">{retailLabel}</p>
                                                {!isKorean && <p className="text-sm font-medium text-slate-500">{regionLabel}</p>}
                                                <p className="mt-2 text-right text-2xl font-bold tabular-nums text-slate-950 dark:text-white"><span className="mr-1 text-sm">{priceSymbol}</span>{formatNumber(displayRetail, priceOptions)}</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2">
                                            <div className={`border-r border-slate-200 px-4 py-3 dark:border-slate-700 ${isSoldOut ? 'bg-rose-50/70 dark:bg-rose-950/20' : ''}`}>
                                                <p className="text-base font-semibold text-slate-700 dark:text-slate-200">{copy.orderStatus}</p>
                                                {!isKorean && <p className="text-sm font-medium text-slate-500">{copy.orderStatusSub}</p>}
                                                <p className={`mt-2 text-right text-lg font-black ${isSoldOut ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{isSoldOut ? copy.soldOut : copy.available}</p>
                                            </div>
                                            <div className="px-4 py-3">
                                                <p className="text-base font-semibold text-slate-700 dark:text-slate-200">{copy.margin}</p>
                                                {!isKorean && <p className="text-sm font-medium text-slate-500">{copy.marginSub}</p>}
                                                <p className="mt-2 text-right text-2xl font-bold tabular-nums text-[#e34219]">{marginPercent}%</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-4 border-t border-slate-100 bg-white px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-5 dark:border-slate-800 dark:bg-slate-900">
                                    <div>
                                        <p className="text-base font-semibold text-slate-700 dark:text-slate-200">{copy.minimumOrder}</p>
                                        <p className="mt-1 text-sm font-medium leading-6 text-slate-600">{copy.minimumOrderSub}: {formatNumber(product.minOrderQuantity)}{isKorean ? '개' : 'EA'} · {copy.orderUnit}: {formatNumber(orderUnit)}{isKorean ? '개' : 'EA'}</p>
                                    </div>

                                    {isSoldOut ? (
                                        <div className="rounded-xl bg-slate-100 px-4 py-3 text-center text-sm font-medium text-slate-600 sm:min-w-[220px] dark:bg-slate-800 dark:text-slate-400">{copy.soldOutOrderDisabled}</div>
                                    ) : (
                                        <div className={`flex h-12 items-center overflow-hidden rounded-xl border shadow-sm ${qty === 0 ? 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900' : 'border-[#e34219] bg-[#fff7f3] dark:bg-[#2a1a1a]'}`}>
                                            <button type="button" aria-label={isKorean ? '수량 줄이기' : '数量を減らす'} onClick={() => handleQuantityChange(product.id, Math.max(0, qty - orderUnit))} className="flex h-full w-11 items-center justify-center text-slate-700 hover:bg-slate-50 dark:text-white dark:hover:bg-slate-800">
                                                <Minus size={16} strokeWidth={2.5} />
                                            </button>
                                            <input
                                                aria-label={isKorean ? `${displayProductName(product)} 주문 수량` : `${displayProductName(product)} 注文数量`}
                                                inputMode="numeric"
                                                type="text"
                                                value={formatNumber(qty)}
                                                onChange={(event) => {
                                                    const value = event.target.value.replace(/,/g, '')
                                                    if (/^\d*$/.test(value)) handleQuantityChange(product.id, value)
                                                }}
                                                className={`h-full w-20 border-x border-y-0 border-slate-200 bg-transparent text-center text-lg font-black outline-none dark:border-slate-700 ${qty > 0 ? 'text-[#e34219]' : 'text-slate-900 dark:text-white'}`}
                                            />
                                            <button type="button" aria-label={isKorean ? '수량 늘리기' : '数量を増やす'} onClick={() => handleQuantityChange(product.id, qty + orderUnit)} className="flex h-full w-11 items-center justify-center text-slate-700 hover:bg-slate-50 dark:text-white dark:hover:bg-slate-800">
                                                <Plus size={16} strokeWidth={2.5} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </article>
                        )
                    })}
                </div>
            )}

            {/* Sticky Footer */}
            {hasItems && (
                <div className="fixed bottom-[calc(68px+env(safe-area-inset-bottom))] sm:bottom-0 left-0 right-0 bg-white/95 dark:bg-[#1e1e1e]/95 backdrop-blur-xl border-t border-gray-200 dark:border-[#2a2a2a] p-4 md:px-8 md:py-6 z-50 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] dark:shadow-none animate-in slide-in-from-bottom duration-300">
                    <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-end items-end md:items-center gap-4 md:gap-12">
                        <div className="text-right flex flex-col items-end">
                            <div className="flex flex-col items-end mb-1 text-gray-400 dark:text-gray-500 gap-0.5">
                                <span className="text-sm font-black leading-tight">{copy.totalExcludingTax}</span>
                                <span className="text-xs font-bold uppercase tracking-widest leading-none">{copy.totalExcludingTaxSub}</span>
                            </div>
                            <p className="text-4xl font-medium text-[#111827] dark:text-white leading-none font-inter tracking-tighter">
                                <span className="text-[0.5em] mr-1">{currencySymbol}</span>{formatMoney(productTotal, isUSD)}
                            </p>
                        </div>

                        <button
                            onClick={handleOrderNow}
                            className="h-14 px-10 bg-[#e34219] hover:bg-[#d03a15] text-white rounded-lg shadow-[0_4px_14px_0_rgba(227,66,25,0.12)] hover:shadow-[0_6px_20px_0_rgba(227,66,25,0.18)] transition-all active:scale-[0.98] flex items-center justify-end md:justify-center gap-3 font-bold text-[15px] tracking-wide group w-full md:w-auto"
                        >
                            <div className="flex flex-col items-end md:items-start leading-none">
                                <span className="text-lg">{copy.orderNow}</span>
                                <span className="text-sm opacity-70 font-bold tracking-[0.2em] -mt-0.5">{copy.orderNowSub}</span>
                            </div>
                            <ArrowRight size={20} strokeWidth={2.5} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </div>
            )}

            {
                showSummary && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-[#1e1e1e] rounded-[32px] shadow-2xl dark:shadow-none max-w-md w-full p-8 relative animate-in zoom-in-95 duration-200 overflow-hidden">
                            <button
                                onClick={() => setShowSummary(false)}
                                className="absolute top-6 right-6 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-[#2a2a2a] transition-colors"
                            >
                                ✕
                            </button>

                            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">{copy.summaryTitle}</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-8 font-medium uppercase tracking-widest">{copy.summarySub}</p>

                            <div className="space-y-4 mb-6 max-h-[40vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
                                {safeProducts.filter(p => isPartnerProductOrderable(p.partnerSaleStatus) && safeNonNegativeInt(quantities[p.id]) > 0).map(p => (
                                    <div key={p.id} className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-[#2a2a2a]">
                                        <div>
                                            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{displayProductName(p)}</p>
                                            <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
                                                {!isKorean && p.nameEN ? <span className="mr-1">{p.nameEN}</span> : null}
                                                <span>{isKorean ? `수량 ${formatNumber(quantities[p.id])}개` : `× ${formatNumber(quantities[p.id])}`}</span>
                                            </p>
                                        </div>
                                        <span className="font-bold text-gray-900 dark:text-white"><span className="text-[0.7em] mr-0.5">{currencySymbol}</span>{formatMoney(p.sellPrice * safeNonNegativeInt(quantities[p.id]), isUSD)}</span>
                                    </div>
                                ))}
                                {shippingFee > 0 && (
                                    <div className="flex justify-between items-center py-2 border-t border-dashed border-gray-200 dark:border-[#2a2a2a] mt-2">
                                        <span className="text-sm font-bold text-gray-600 dark:text-gray-400">{copy.shipping}</span>
                                        <span className="font-bold text-gray-900 dark:text-white"><span className="text-[0.7em] mr-0.5">{currencySymbol}</span>{formatMoney(shippingFee, isUSD)}</span>
                                    </div>
                                )}
                            </div>

                            <div className="bg-gray-50 dark:bg-[#1a1a1a] rounded-2xl p-6 space-y-3 mb-8">
                                <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 font-medium">
                                    <span>{copy.supply}</span>
                                    <span><span className="text-[0.8em] mr-0.5">{currencySymbol}</span>{formatMoney(supplyTotal, isUSD)}</span>
                                </div>
                                {!isUSD && (
                                    <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 font-medium">
                                        <span>{copy.tax}</span>
                                        <span><span className="text-[0.8em] mr-0.5">{currencySymbol}</span>{formatNumber(vat)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-baseline pt-4 border-t border-gray-200 dark:border-[#2a2a2a] mt-2">
                                    <span className="font-bold text-lg text-gray-900 dark:text-white">{copy.total}</span>
                                    <span className="text-3xl font-black text-[#e34219]"><span className="text-[0.5em] mr-1">{currencySymbol}</span>{formatMoney(totalAmount, isUSD)}</span>
                                </div>
                            </div>

                            <button
                                onClick={async () => {
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
                                            alert(isKorean ? '주문이 접수되었습니다. 감사합니다!' : 'ご注文ありがとうございます！');
                                            setShowSummary(false);
                                            setQuantities({});
                                            router.push('/order/history');
                                        } else {
                                            const errorData = await res.json();
                                            alert(`${isKorean ? '주문 실패' : '注文に失敗しました'}: ${errorData.error}`);
                                        }
                                    } catch (e) {
                                        console.error(e)
                                        alert(isKorean ? '주문 처리 중 오류가 발생했습니다.' : 'エラーが発生しました。');
                                    }
                                }}
                                className="w-full bg-[#111827] dark:bg-white text-white dark:text-[#111827] py-4 rounded-xl font-bold text-lg hover:bg-black dark:hover:bg-gray-200 transition-colors shadow-xl dark:shadow-none"
                            >
                                {copy.confirmOrder}
                            </button>
                        </div>
                    </div>
                )}
        </div>
    )
}
