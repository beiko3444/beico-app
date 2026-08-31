'use client'

import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Copy, Layers, Pencil, RotateCcw, Search, SlidersHorizontal, Trash2, Unlink, X } from 'lucide-react'
import ProductForm, { type Product as ProductTableProduct } from "./product-form"
import ProductStockHistoryModal from './ProductStockHistoryModal'
import BarcodeDisplay from "@/components/BarcodeDisplay"
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
    PRODUCT_GRADES,
    readProductGradeOrderValue,
    readProductGradePriceValue,
    setProductGradeOrderValue,
    setProductGradePriceValue,
    type ProductGrade,
} from '@/lib/productGradePricing'

const draftKey = (grade: ProductGrade, productId: string) => `${grade}:${productId}`
const PRODUCT_TABLE_WIDTH = 1740
const PRODUCT_TABLE_COLS = 18

const normalizeGroupName = (value?: string | null) => String(value || '').trim()
const normalizeGroupKey = (value: string) => value.toLocaleLowerCase('ko-KR').replace(/\s+/g, ' ').trim()
const normalizeProductCode = (value?: string | null) => String(value || '').trim().toUpperCase()
const inferProductGroup = (product: ProductTableProduct) => {
    if (product.autoGroupingDisabled) return null

    const manualName = normalizeGroupName(product.groupName)
    if (manualName) {
        return { key: `group:${normalizeGroupKey(manualName)}`, name: manualName, source: '직접 그룹' as const }
    }

    const productName = normalizeGroupName(product.name)
    const colonBase = productName.split(/\s*[:：]\s*/)[0]?.trim()
    if (colonBase && colonBase !== productName && colonBase.length >= 4) {
        return { key: `group:${normalizeGroupKey(colonBase)}`, name: colonBase, source: '자동 그룹' as const }
    }

    const seriesMatch = productName.match(/^(.+?시리즈\s*\d+)/i)
    if (seriesMatch?.[1]) {
        const name = seriesMatch[1].trim()
        return { key: `group:${normalizeGroupKey(name)}`, name, source: '자동 그룹' as const }
    }

    const versionMatch = productName.match(/^(.+?V\s*\d+)/i)
    if (versionMatch?.[1]) {
        const name = versionMatch[1].replace(/\s+V\s*/i, 'V').trim()
        return { key: `group:${normalizeGroupKey(name)}`, name, source: '자동 그룹' as const }
    }

    const productCode = normalizeProductCode(product.productCode)
    const codeParts = productCode.split('-').filter(Boolean)
    if (codeParts.length >= 3 && /^\d+[A-Z]*$/i.test(codeParts[codeParts.length - 1] || '')) {
        const name = codeParts.slice(0, -1).join('-')
        return { key: `group:${normalizeGroupKey(name)}`, name, source: '자동 그룹' as const }
    }

    return null
}
const formatInteger = (value: number | string | null | undefined) => {
    const number = Number(value)
    if (!Number.isFinite(number)) return '0'
    return Math.round(number).toLocaleString('ko-KR')
}
const normalizeNumericDraft = (value: string, allowDecimal = false) => {
    const compact = value.replace(/[^\d.]/g, '')
    if (!allowDecimal) return compact.replace(/\D/g, '')

    const [integer = '', ...decimalParts] = compact.split('.')
    const decimal = decimalParts.join('').replace(/\D/g, '')
    return decimalParts.length > 0 ? `${integer}.${decimal}` : integer
}
const parseNumericDraft = (value: number | string | null | undefined) => {
    const number = Number(String(value ?? '').replace(/,/g, ''))
    return Number.isFinite(number) ? number : 0
}
const parseIntegerDraft = (value: number | string | null | undefined, fallback = 0) => {
    const number = Math.round(parseNumericDraft(value))
    return Number.isFinite(number) ? number : fallback
}
const formatNumberInput = (value: number | string | null | undefined) => {
    const raw = String(value ?? '').replace(/[,\s]/g, '')
    if (!raw) return ''

    const dotIndex = raw.indexOf('.')
    const integerRaw = dotIndex >= 0 ? raw.slice(0, dotIndex) : raw
    const decimalRaw = dotIndex >= 0 ? raw.slice(dotIndex + 1).replace(/\./g, '') : ''
    const integerNumber = Number(integerRaw || 0)
    const formattedInteger = Number.isFinite(integerNumber) ? integerNumber.toLocaleString('ko-KR') : '0'
    return dotIndex >= 0 ? `${formattedInteger}.${decimalRaw}` : formattedInteger
}

const LazyBarcodeCell = memo(function LazyBarcodeCell({ value }: { value: string | number | null | undefined }) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [canRenderBarcode, setCanRenderBarcode] = useState(false)
    const safeValue = value === null || value === undefined ? '' : String(value).trim()

    useEffect(() => {
        setCanRenderBarcode(false)
        if (!safeValue) return

        const node = containerRef.current
        if (!node || typeof IntersectionObserver === 'undefined') {
            const frame = window.requestAnimationFrame(() => setCanRenderBarcode(true))
            return () => window.cancelAnimationFrame(frame)
        }

        let frame = 0
        const observer = new IntersectionObserver(
            (entries) => {
                if (!entries.some(entry => entry.isIntersecting)) return
                observer.disconnect()
                frame = window.requestAnimationFrame(() => setCanRenderBarcode(true))
            },
            { rootMargin: '360px 0px' },
        )

        observer.observe(node)
        return () => {
            observer.disconnect()
            if (frame) window.cancelAnimationFrame(frame)
        }
    }, [safeValue])

    return (
        <div ref={containerRef} className="flex min-h-7 items-center justify-center">
            {canRenderBarcode ? (
                <BarcodeDisplay
                    value={safeValue}
                    width={0.82}
                    height={24}
                    fontSize={8}
                    containerClassName="justify-center"
                    buttonClassName="text-[8px] text-gray-400 hover:text-blue-600 border border-gray-200 rounded px-1 py-0.5 bg-white transition-colors"
                />
            ) : (
                <span className="max-w-[160px] truncate text-[10px] font-bold text-gray-400" title={safeValue}>
                    {safeValue || '-'}
                </span>
            )}
        </div>
    )
})

async function postBulkUpdate(url: string, payload: Record<string, unknown>) {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
    if (response.ok) return

    const data = await response.json().catch(() => null)
    throw new Error(data?.error || '등급별 발주 조건 저장에 실패했습니다.')
}

interface ProductRowProps {
    product: ProductTableProduct
    index: number
    activeGrade: ProductGrade
    onSelect: () => void
    onDragStartProduct: (productId: string) => void
    onDragEndProduct: () => void
    onSortOrderChange: (productId: string, newOrder: number) => void
    onDelete: (productId: string) => void
    onUngroup: (productId: string) => void
    onRestoreAutoGroup: (productId: string) => void
    checked: boolean
    onToggleCheck: (id: string) => void
    modifiedCost: string | undefined
    onCostChange: (id: string, val: string) => void
    modifiedWholesale: string | undefined
    onWholesaleChange: (id: string, val: string) => void
    modifiedRetail: string | undefined
    onRetailChange: (id: string, val: string) => void
    modifiedStock: string | undefined
    onStockChange: (id: string, val: string) => void
    modifiedMoq: string | undefined
    onMoqChange: (id: string, val: string) => void
    modifiedOrderUnit: string | undefined
    onOrderUnitChange: (id: string, val: string) => void
    onToggleOrderAvailability: (id: string) => void
}

const ProductRow = memo(function ProductRow({ product, index, activeGrade, onSelect, onDragStartProduct, onDragEndProduct, onSortOrderChange, onDelete, onUngroup, onRestoreAutoGroup, checked, onToggleCheck, modifiedCost, onCostChange, modifiedWholesale, onWholesaleChange, modifiedRetail, onRetailChange, modifiedStock, onStockChange, modifiedMoq, onMoqChange, modifiedOrderUnit, onOrderUnitChange, onToggleOrderAvailability }: ProductRowProps) {
    const legacyWholesale = {
        A: product.priceA,
        B: product.priceB,
        C: product.priceC ?? product.sellPrice,
        D: product.priceD,
    }[activeGrade] ?? product.sellPrice
    const costValue = modifiedCost !== undefined
        ? modifiedCost
        : readProductGradePriceValue(product.regionalPrices, activeGrade, 'cost', product.buyPrice || 0)
    const wholesaleValue = modifiedWholesale !== undefined
        ? modifiedWholesale
        : readProductGradePriceValue(product.regionalPrices, activeGrade, 'wholesale', legacyWholesale || 0)
    const retailValue = modifiedRetail !== undefined
        ? modifiedRetail
        : readProductGradePriceValue(product.regionalPrices, activeGrade, 'retail', product.onlinePrice || 0)
    const costNumber = parseNumericDraft(costValue)
    const wholesaleNumber = parseNumericDraft(wholesaleValue)
    const retailNumber = parseNumericDraft(retailValue)
    const wholesaleMargin = wholesaleNumber > 0 ? ((wholesaleNumber - costNumber) / wholesaleNumber) * 100 : 0
    const retailMargin = retailNumber > 0 ? ((retailNumber - wholesaleNumber) / retailNumber) * 100 : 0
    const visibleGroupName = normalizeGroupName(product.groupName)
    const ungrouped = product.autoGroupingDisabled === true

    const [tempOrder, setTempOrder] = useState<string>(String(index + 1))

    // Sync input value when index changes due to sorting
    if (String(index + 1) !== tempOrder && document.activeElement !== document.getElementById(`sort-input-${product.id}`)) {
        setTempOrder(String(index + 1))
    }

    const handleBlur = () => {
        const val = parseInt(tempOrder)
        if (!isNaN(val) && val !== index + 1) {
            onSortOrderChange(product.id, val - 1)
        } else {
            setTempOrder(String(index + 1))
        }
    }

    return (
        <tr
            onClick={onSelect}
            className={`text-[11px] border-b border-gray-100 hover:bg-gray-50 transition-colors group ${checked ? 'bg-blue-50/30' : ''}`}
        >
            <td className="px-2 py-1.5 border-r border-gray-100 last:border-0 text-center whitespace-nowrap">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleCheck(product.id)}
                    className="cursor-pointer"
                />
            </td>
            <td className="px-2 py-1.5 border-r border-gray-100 last:border-0 text-center whitespace-nowrap">
                <span
                    draggable
                    onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'move'
                        event.dataTransfer.setData('text/plain', product.id)
                        onDragStartProduct(product.id)
                    }}
                    onDragEnd={onDragEndProduct}
                    className="inline-flex h-6 w-6 cursor-grab items-center justify-center rounded-md text-gray-300 transition hover:bg-blue-50 hover:text-blue-600 active:cursor-grabbing"
                    title="끌어서 다른 그룹으로 이동"
                >
                    ≡
                </span>
            </td>
            <td className="px-2 py-1.5 border-r border-gray-100 last:border-0 text-center whitespace-nowrap">
                <input
                    id={`sort-input-${product.id}`}
                    type="text"
                    value={tempOrder}
                    onChange={(e) => setTempOrder(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={(e) => e.key === 'Enter' && handleBlur()}
                    className="w-8 text-center border border-gray-200 rounded py-0.5 text-[11px] focus:border-[var(--color-brand-blue)] outline-none font-bold bg-gray-50 focus:bg-white transition-colors"
                />
            </td>
            <td className="px-2 py-1.5 border-r border-gray-100 last:border-0 text-center whitespace-nowrap">
                <ProductForm
                    initialData={product}
                    trigger={
                        <div className="w-8 h-8 mx-auto bg-white rounded border border-gray-100 overflow-hidden flex items-center justify-center cursor-pointer hover:border-[var(--color-brand-blue)] transition-all shadow-sm group-hover:shadow-md">
                            {product.imageUrl ? (
                                <img src={product.imageUrl} alt={product.name} loading="lazy" className="w-full h-full object-cover" />
                            ) : (
                                <div className="text-center">
                                    <span className="text-[8px] font-bold text-gray-300">Img</span>
                                </div>
                            )}
                        </div>
                    }
                />
            </td>
            <td className="px-2 py-1.5 border-r border-gray-100 last:border-0 whitespace-nowrap">
                <ProductForm
                    initialData={product}
                    trigger={
                        <div className="cursor-pointer text-left">
                            <div className="font-bold text-gray-900 group-hover:text-[var(--color-brand-blue)] truncate">{product.name}</div>
                            {product.nameJP && (
                                <div className="text-[10px] text-gray-400 truncate">{product.nameJP}</div>
                            )}
                            {visibleGroupName && (
                                <div className="mt-0.5 truncate text-[10px] font-bold text-indigo-500">그룹: {visibleGroupName}</div>
                            )}
                            {ungrouped && (
                                <div className="mt-0.5 truncate text-[10px] font-bold text-amber-600">그룹 해제됨</div>
                            )}
                        </div>
                    }
                />
            </td>
            <td className="px-2 py-1.5 border-r border-gray-100 last:border-0 text-center tabular-nums whitespace-nowrap">
                <div className="flex flex-col items-center">
                    <input
                        type="text"
                        inputMode="numeric"
                        value={formatNumberInput(modifiedStock !== undefined ? modifiedStock : product.stock ?? 0)}
                        onChange={(event) => onStockChange(product.id, normalizeNumericDraft(event.target.value))}
                        className="w-16 rounded border border-emerald-200 bg-emerald-50/60 px-1 py-0.5 text-right text-[11px] font-black text-emerald-700 outline-none transition-colors focus:border-emerald-500"
                        title="관리자용 재고입니다. 도매 발주/파트너 주문 재고와는 연결하지 않습니다."
                    />
                    <ProductStockHistoryModal productId={product.id} productName={product.name} />
                </div>
            </td>
            <td className="px-2 py-1.5 border-r border-gray-100 last:border-0 text-center whitespace-nowrap">
                <button
                    onClick={() => onToggleOrderAvailability(product.id)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all border ${
                        product.wholesaleAvailable !== false
                            ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                            : 'bg-red-50 text-red-500 border-red-200 hover:bg-red-100'
                    }`}
                >
                    {product.wholesaleAvailable !== false ? '발주 가능' : '발주 불가능'}
                </button>
            </td>
            <td className="px-2 py-1.5 border-r border-gray-100 last:border-0 text-center text-gray-800 font-bold whitespace-nowrap">
                <input
                    type="text"
                    inputMode="numeric"
                    value={modifiedMoq !== undefined
                        ? formatNumberInput(modifiedMoq)
                        : formatNumberInput(readProductGradeOrderValue(product.regionalPrices, activeGrade, 'moq', product.minOrderQuantity || 1))}
                    onChange={(e) => onMoqChange(product.id, normalizeNumericDraft(e.target.value))}
                    className="w-12 text-center border border-gray-200 rounded py-0.5 text-[11px] focus:border-[var(--color-brand-blue)] outline-none font-bold bg-white transition-colors"
                />
            </td>
            <td className="px-2 py-1.5 border-r border-gray-100 last:border-0 text-center text-gray-800 font-bold whitespace-nowrap">
                <input
                    type="text"
                    inputMode="numeric"
                    value={modifiedOrderUnit !== undefined
                        ? formatNumberInput(modifiedOrderUnit)
                        : formatNumberInput(readProductGradeOrderValue(product.regionalPrices, activeGrade, 'orderUnit', product.orderUnit || 1))}
                    onChange={(e) => onOrderUnitChange(product.id, normalizeNumericDraft(e.target.value))}
                    className="w-12 text-center border border-gray-200 rounded py-0.5 text-[11px] focus:border-[var(--color-brand-blue)] outline-none font-bold bg-white transition-colors"
                />
            </td>
            <td className="px-2 py-1.5 border-r border-gray-100 last:border-0 text-center tabular-nums text-gray-500 whitespace-nowrap">
                <input
                    type="text"
                    inputMode="decimal"
                    value={formatNumberInput(costValue)}
                    onChange={(event) => onCostChange(product.id, normalizeNumericDraft(event.target.value, true))}
                    className="w-20 rounded border border-gray-200 bg-white px-1 py-0.5 text-right text-[11px] outline-none transition-colors focus:border-blue-500"
                />
            </td>
            <td className="px-2 py-1.5 border-r border-gray-100 last:border-0 text-center tabular-nums font-bold text-[var(--color-brand-blue)] whitespace-nowrap">
                <input
                    type="text"
                    inputMode="decimal"
                    value={formatNumberInput(wholesaleValue)}
                    onChange={(event) => onWholesaleChange(product.id, normalizeNumericDraft(event.target.value, true))}
                    className="w-20 rounded border border-blue-200 bg-blue-50/40 px-1 py-0.5 text-right text-[11px] font-bold text-blue-700 outline-none transition-colors focus:border-blue-500"
                />
            </td>
            <td className="px-2 py-1.5 border-r border-gray-100 last:border-0 text-center tabular-nums font-bold text-gray-700 whitespace-nowrap">
                <input
                    type="text"
                    inputMode="decimal"
                    value={formatNumberInput(retailValue)}
                    onChange={(event) => onRetailChange(product.id, normalizeNumericDraft(event.target.value, true))}
                    className="w-20 rounded border border-emerald-200 bg-emerald-50/40 px-1 py-0.5 text-right text-[11px] font-bold text-emerald-700 outline-none transition-colors focus:border-emerald-500"
                />
            </td>
            <td className="px-2 py-1.5 border-r border-gray-100 last:border-0 text-center tabular-nums whitespace-nowrap">
                <div className="flex flex-col items-center justify-center gap-0.5">
                    <div className="flex items-center gap-1">
                        <span className="text-[10px] text-blue-500 font-bold">W:</span>
                        <span className={`text-[10px] font-bold px-1 rounded ${wholesaleMargin > 30 ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-500'}`}>
                            {wholesaleMargin.toFixed(1)}%
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-500 font-bold">R:</span>
                        <span className={`text-[10px] font-bold px-1 rounded ${retailMargin > 30 ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-500'}`}>
                            {retailMargin.toFixed(1)}%
                        </span>
                    </div>
                </div>
            </td>
            <td className="px-2 py-1.5 border-r border-gray-100 last:border-0 text-center text-gray-500 font-mono text-[10px] whitespace-nowrap">{product.productCode ? String(product.productCode).toUpperCase() : '-'}</td>
            <td className="px-2 py-1.5 border-r border-gray-100 last:border-0 text-center text-gray-500 font-mono text-[10px] whitespace-nowrap">{product.hsCode || '-'}</td>
            <td className="px-2 py-1.5 border-r border-gray-100 last:border-0 text-center text-gray-500 font-mono text-[10px] whitespace-nowrap">{product.japanHsCode || '-'}</td>
            <td className="px-2 py-1.5 border-r border-gray-100 last:border-0 text-center text-gray-400 font-mono text-[10px] whitespace-nowrap">
                <LazyBarcodeCell value={product.barcode} />
            </td>
            <td className="px-2 py-1.5 text-center whitespace-nowrap">
                <div className="flex items-center justify-center gap-1">
                    <ProductForm
                        initialData={product}
                        trigger={
                            <button
                                type="button"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700"
                                title="수정"
                            >
                                <Pencil size={13} />
                            </button>
                        }
                    />
                    <ProductForm
                        initialData={product}
                        isCopy={true}
                        trigger={
                            <button
                                type="button"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-blue-100 bg-blue-50 text-blue-600 transition hover:bg-blue-600 hover:text-white"
                                title="복사"
                            >
                                <Copy size={13} />
                            </button>
                        }
                    />
                    <button
                        type="button"
                        onClick={() => ungrouped ? onRestoreAutoGroup(product.id) : onUngroup(product.id)}
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition ${
                            ungrouped
                                ? 'border-blue-100 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white'
                                : 'border-amber-100 bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white'
                        }`}
                        title={ungrouped ? '자동 그룹 복귀' : '그룹 해제'}
                    >
                        {ungrouped ? <RotateCcw size={13} /> : <Unlink size={13} />}
                    </button>
                    <button
                        type="button"
                        onClick={() => onDelete(product.id)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-100 bg-red-50 text-red-500 transition hover:bg-red-500 hover:text-white"
                        title="삭제"
                    >
                        <Trash2 size={13} />
                    </button>
                </div>
            </td>
        </tr>
    )
})

type ProductGroupView = {
    key: string
    name: string
    isNamed: boolean
    source: '직접 그룹' | '자동 그룹' | '단일 상품'
    products: ProductTableProduct[]
}

type ProductPagination = {
    page: number
    pageSize: number
    totalCount: number
    totalPages: number
}

type ProductViewMode = 'group' | 'sku'
type ProductAvailabilityFilter = 'all' | 'available' | 'unavailable'
type ProductStockFilter = 'all' | 'stocked' | 'empty'

const getProductStock = (product: ProductTableProduct) => Math.max(0, Number(product.stock) || 0)
const getProductSearchText = (product: ProductTableProduct) => [
    product.name,
    product.nameJP,
    product.nameEN,
    product.productCode,
    product.barcode,
    product.groupName,
    product.hsCode,
    product.japanHsCode,
].filter(Boolean).join(' ').toLocaleLowerCase('ko-KR')

function ProductPaginationControls({
    pagination,
    pageStart,
    pageEnd,
    onPageChange,
    onPageSizeChange,
    className = '',
}: {
    pagination: ProductPagination
    pageStart: number
    pageEnd: number
    onPageChange: (page: number) => void
    onPageSizeChange: (pageSize: number) => void
    className?: string
}) {
    const canGoPrev = pagination.page > 1
    const canGoNext = pagination.page < pagination.totalPages

    return (
        <div className={`flex flex-wrap items-center gap-2 ${className}`}>
            <div className="text-[11px] font-bold text-slate-500">
                전체 <span className="text-slate-900">{formatInteger(pagination.totalCount)}</span>개 중{' '}
                <span className="text-blue-700">{formatInteger(pageStart)}-{formatInteger(pageEnd)}</span> 표시
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
                <select
                    value={pagination.pageSize}
                    onChange={(event) => onPageSizeChange(Number(event.target.value))}
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-black text-slate-600 outline-none transition focus:border-blue-500"
                    title="한 페이지 상품 수"
                >
                    <option value={30}>30개씩</option>
                    <option value={50}>50개씩</option>
                    <option value={100}>100개씩</option>
                </select>
                <button
                    type="button"
                    onClick={() => onPageChange(pagination.page - 1)}
                    disabled={!canGoPrev}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
                    title="이전 페이지"
                >
                    <ChevronLeft size={15} />
                </button>
                <div className="min-w-20 text-center text-[11px] font-black tabular-nums text-slate-700">
                    {formatInteger(pagination.page)} / {formatInteger(pagination.totalPages)}
                </div>
                <button
                    type="button"
                    onClick={() => onPageChange(pagination.page + 1)}
                    disabled={!canGoNext}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
                    title="다음 페이지"
                >
                    <ChevronRight size={15} />
                </button>
            </div>
        </div>
    )
}

const ProductGroupHeader = memo(function ProductGroupHeader({
    group,
    expanded,
    checkedCount,
    selected,
    canDrop,
    onToggle,
    onToggleCheck,
    onSelect,
    onDropProduct,
}: {
    group: ProductGroupView
    expanded: boolean
    checkedCount: number
    selected: boolean
    canDrop: boolean
    onToggle: () => void
    onToggleCheck: () => void
    onSelect: () => void
    onDropProduct: (productId: string) => void
}) {
    const totalStock = group.products.reduce((sum, product) => sum + getProductStock(product), 0)
    const availableCount = group.products.filter(product => product.wholesaleAvailable !== false).length
    const representative = group.products[0]

    return (
        <tr
            onDragOver={(event) => {
                if (!canDrop) return
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
            }}
            onDrop={(event) => {
                if (!canDrop) return
                event.preventDefault()
                const productId = event.dataTransfer.getData('text/plain')
                if (productId) onDropProduct(productId)
            }}
            className={`border-b transition-colors ${
                canDrop
                    ? 'border-blue-300 bg-blue-100/80 ring-1 ring-inset ring-blue-300'
                    : selected
                        ? 'border-blue-100 bg-blue-50'
                        : 'border-blue-100 bg-slate-50 hover:bg-blue-50/60'
            }`}
        >
            <td colSpan={PRODUCT_TABLE_COLS} className="px-3 py-2">
                <div
                    className="flex min-w-0 cursor-pointer items-center justify-between gap-3"
                    role="button"
                    tabIndex={0}
                    onClick={onSelect}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') onSelect()
                    }}
                >
                    <div className="flex min-w-0 items-center gap-2">
                        <input
                            type="checkbox"
                            checked={group.products.length > 0 && checkedCount === group.products.length}
                            onChange={onToggleCheck}
                            onClick={(event) => event.stopPropagation()}
                            className="cursor-pointer"
                            title="그룹 SKU 전체 선택"
                        />
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation()
                                onToggle()
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-blue-200 bg-white text-blue-700 shadow-sm transition hover:bg-blue-50"
                            title={expanded ? '그룹 접기' : '그룹 펼치기'}
                        >
                            {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        </button>
                        {representative?.imageUrl ? (
                            <img src={representative.imageUrl} alt={group.name} loading="lazy" className="h-9 w-9 rounded-md border border-slate-200 bg-white object-cover shadow-sm" />
                        ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-blue-300">
                                <Layers size={15} />
                            </div>
                        )}
                        <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                                <span className="truncate text-[12px] font-black text-slate-950">상품 그룹 · {group.name}</span>
                                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-blue-600 shadow-sm">{group.products.length} SKU</span>
                                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-600">{group.source}</span>
                            </div>
                            <div className="mt-0.5 text-[10px] font-bold text-blue-500">
                                {canDrop ? '여기에 놓으면 이 그룹으로 이동합니다.' : '그룹을 누르면 요약이 표시되고, 화살표로 SKU 목록을 접고 펼칩니다.'}
                            </div>
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <div className="rounded-lg border border-emerald-200 bg-white px-3 py-1 text-right shadow-sm">
                            <div className="text-[9px] font-black text-emerald-600">발주 가능 SKU</div>
                            <div className="text-[12px] font-black tabular-nums text-emerald-700">{formatInteger(availableCount)}</div>
                        </div>
                        <div className="rounded-lg border border-emerald-200 bg-white px-3 py-1 text-right shadow-sm">
                            <div className="text-[9px] font-black text-emerald-600">관리용 재고 합계</div>
                            <div className="text-[13px] font-black tabular-nums text-emerald-700">{formatInteger(totalStock)}</div>
                        </div>
                    </div>
                </div>
            </td>
        </tr>
    )
})

function ProductSummaryPanel({
    group,
    activeGrade,
}: {
    group: ProductGroupView | null
    activeGrade: ProductGrade
}) {
    if (!group) {
        return (
            <aside className="border-t border-slate-100 bg-slate-50/80 p-4 xl:border-l xl:border-t-0">
                <div className="rounded-xl border border-dashed border-slate-200 bg-white p-5 text-center text-xs font-bold text-slate-400">
                    그룹이나 상품을 선택하면 요약이 표시됩니다.
                </div>
            </aside>
        )
    }

    const representative = group.products[0]
    const totalStock = group.products.reduce((sum, product) => sum + getProductStock(product), 0)
    const availableCount = group.products.filter(product => product.wholesaleAvailable !== false).length
    const unavailableCount = group.products.length - availableCount
    const wholesaleValues = group.products
        .map(product => readProductGradePriceValue(product.regionalPrices, activeGrade, 'wholesale', {
            A: product.priceA,
            B: product.priceB,
            C: product.priceC ?? product.sellPrice,
            D: product.priceD,
        }[activeGrade] ?? product.sellPrice ?? 0))
        .filter(value => Number.isFinite(value) && value > 0)
    const averageWholesale = wholesaleValues.length > 0
        ? wholesaleValues.reduce((sum, value) => sum + value, 0) / wholesaleValues.length
        : 0

    return (
        <aside className="border-t border-slate-100 bg-slate-50/80 p-3 xl:border-l xl:border-t-0">
            <div className="sticky top-20 space-y-3">
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                            {representative?.imageUrl ? (
                                <img src={representative.imageUrl} alt={group.name} loading="lazy" className="h-11 w-11 rounded-lg border border-slate-200 object-cover" />
                            ) : (
                                <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-300">
                                    <Layers size={18} />
                                </div>
                            )}
                            <div className="min-w-0">
                                <div className="truncate text-[12px] font-black text-slate-950">{group.name}</div>
                                <div className="mt-1 flex items-center gap-1">
                                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black text-blue-700">{group.products.length} SKU</span>
                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500">{group.source}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="mb-2 text-[11px] font-black text-slate-900">재고 요약</div>
                    <div className="divide-y divide-slate-100 text-[11px]">
                        <div className="flex items-center justify-between py-1.5">
                            <span className="font-bold text-slate-500">관리용 재고 합계</span>
                            <span className="font-black tabular-nums text-emerald-700">{formatInteger(totalStock)}</span>
                        </div>
                        <div className="flex items-center justify-between py-1.5">
                            <span className="font-bold text-slate-500">발주 가능</span>
                            <span className="font-black tabular-nums text-emerald-700">{formatInteger(availableCount)}</span>
                        </div>
                        <div className="flex items-center justify-between py-1.5">
                            <span className="font-bold text-slate-500">발주 불가</span>
                            <span className="font-black tabular-nums text-red-500">{formatInteger(unavailableCount)}</span>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="mb-2 text-[11px] font-black text-slate-900">{activeGrade}등급 가격 요약</div>
                    <div className="flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2 text-[11px]">
                        <span className="font-bold text-blue-700">평균 KR 도매가</span>
                        <span className="font-black tabular-nums text-blue-900">{formatInteger(Math.round(averageWholesale))}</span>
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="mb-2 text-[11px] font-black text-slate-900">SKU 미리보기</div>
                    <div className="space-y-2">
                        {group.products.slice(0, 6).map(product => (
                            <div key={product.id} className="flex items-center justify-between gap-2 text-[11px]">
                                <div className="min-w-0">
                                    <div className="truncate font-bold text-slate-700">{product.name}</div>
                                    <div className="truncate text-[10px] text-slate-400">{product.productCode || product.barcode || '-'}</div>
                                </div>
                                <span className="shrink-0 font-black tabular-nums text-emerald-700">{formatInteger(getProductStock(product))}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </aside>
    )
}

export default function ProductTable({
    initialProducts,
    pagination,
}: {
    initialProducts: ProductTableProduct[]
    pagination: ProductPagination
}) {
    const [products, setProducts] = useState(initialProducts)
    const [activeGrade, setActiveGrade] = useState<ProductGrade>('C')
    const [modifiedCosts, setModifiedCosts] = useState<Record<string, string>>({})
    const [modifiedWholesales, setModifiedWholesales] = useState<Record<string, string>>({})
    const [modifiedRetails, setModifiedRetails] = useState<Record<string, string>>({})
    const [modifiedStocks, setModifiedStocks] = useState<Record<string, string>>({})
    const [modifiedMoqs, setModifiedMoqs] = useState<Record<string, string>>({})
    const [modifiedOrderUnits, setModifiedOrderUnits] = useState<Record<string, string>>({})
    const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
    const [collapsedGroupKeys, setCollapsedGroupKeys] = useState<Set<string>>(new Set())
    const [viewMode, setViewMode] = useState<ProductViewMode>('group')
    const [productQuery, setProductQuery] = useState('')
    const [availabilityFilter, setAvailabilityFilter] = useState<ProductAvailabilityFilter>('all')
    const [stockFilter, setStockFilter] = useState<ProductStockFilter>('all')
    const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null)
    const [draggingProductId, setDraggingProductId] = useState<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const hasDraftChanges = useMemo(() => (
        Object.keys(modifiedCosts).length > 0
        || Object.keys(modifiedWholesales).length > 0
        || Object.keys(modifiedRetails).length > 0
        || Object.keys(modifiedStocks).length > 0
        || Object.keys(modifiedMoqs).length > 0
        || Object.keys(modifiedOrderUnits).length > 0
    ), [modifiedCosts, modifiedWholesales, modifiedRetails, modifiedStocks, modifiedMoqs, modifiedOrderUnits])
    const pageOffset = (pagination.page - 1) * pagination.pageSize
    const pageStart = pagination.totalCount === 0 ? 0 : pageOffset + 1
    const pageEnd = Math.min(pagination.totalCount, pageOffset + products.length)

    useEffect(() => {
        setProducts(initialProducts)
        setCheckedIds(new Set())
        setModifiedCosts({})
        setModifiedWholesales({})
        setModifiedRetails({})
        setModifiedStocks({})
        setModifiedMoqs({})
        setModifiedOrderUnits({})
        setCollapsedGroupKeys(new Set())
        setSelectedGroupKey(null)
        setDraggingProductId(null)
    }, [initialProducts])

    const filteredProducts = useMemo(() => {
        const query = productQuery.trim().toLocaleLowerCase('ko-KR')
        return products.filter(product => {
            if (query && !getProductSearchText(product).includes(query)) return false
            if (availabilityFilter === 'available' && product.wholesaleAvailable === false) return false
            if (availabilityFilter === 'unavailable' && product.wholesaleAvailable !== false) return false
            if (stockFilter === 'stocked' && getProductStock(product) <= 0) return false
            if (stockFilter === 'empty' && getProductStock(product) > 0) return false
            return true
        })
    }, [availabilityFilter, productQuery, products, stockFilter])

    const productGroups = useMemo<ProductGroupView[]>(() => {
        const inferred = filteredProducts.map(product => ({ product, candidate: inferProductGroup(product) }))
        const inferredCounts = new Map<string, number>()
        inferred.forEach(({ candidate }) => {
            if (!candidate) return
            inferredCounts.set(candidate.key, (inferredCounts.get(candidate.key) || 0) + 1)
        })

        const groups = new Map<string, ProductGroupView>()
        inferred.forEach(({ product, candidate }) => {
            const shouldGroup = Boolean(candidate && (candidate.source === '직접 그룹' || (inferredCounts.get(candidate.key) || 0) > 1))
            const key = shouldGroup && candidate ? candidate.key : `single:${product.id}`
            const name = shouldGroup && candidate ? candidate.name : product.name
            const source = shouldGroup && candidate ? candidate.source : '단일 상품'
            const existingGroup = groups.get(key)
            if (existingGroup) {
                existingGroup.products.push(product)
                if (source === '직접 그룹') existingGroup.source = '직접 그룹'
                return
            }
            groups.set(key, {
                key,
                name,
                isNamed: shouldGroup,
                source,
                products: [product],
            })
        })
        return Array.from(groups.values())
    }, [filteredProducts])

    const productIndexById = useMemo(
        () => new Map(products.map((product, index) => [product.id, pageOffset + index])),
        [pageOffset, products],
    )
    const visibleProductIds = useMemo(() => filteredProducts.map(product => product.id), [filteredProducts])
    const checkedVisibleCount = visibleProductIds.filter(id => checkedIds.has(id)).length
    const namedGroupKeys = useMemo(() => productGroups.filter(group => group.isNamed).map(group => group.key), [productGroups])
    const collapsedNamedGroupCount = namedGroupKeys.filter(key => collapsedGroupKeys.has(key)).length
    const selectedGroup = useMemo(
        () => productGroups.find(group => group.key === selectedGroupKey) || productGroups[0] || null,
        [productGroups, selectedGroupKey],
    )
    const groupKeyByProductId = useMemo(() => {
        const result = new Map<string, string>()
        productGroups.forEach(group => {
            group.products.forEach(product => result.set(product.id, group.key))
        })
        return result
    }, [productGroups])
    const hasActiveFilters = Boolean(productQuery.trim()) || availabilityFilter !== 'all' || stockFilter !== 'all'

    useEffect(() => {
        if (selectedGroup && selectedGroup.key !== selectedGroupKey) {
            setSelectedGroupKey(selectedGroup.key)
        }
    }, [selectedGroup, selectedGroupKey])

    const pushProductPage = useCallback((page: number, pageSize = pagination.pageSize) => {
        const nextPage = Math.min(Math.max(1, page), pagination.totalPages)
        if (nextPage === pagination.page && pageSize === pagination.pageSize) return
        if (hasDraftChanges && !confirm('저장하지 않은 수정사항이 있습니다. 페이지를 이동하시겠습니까?')) return

        const params = new URLSearchParams(searchParams.toString())
        if (nextPage <= 1) params.delete('page')
        else params.set('page', String(nextPage))
        if (pageSize === 50) params.delete('pageSize')
        else params.set('pageSize', String(pageSize))

        const query = params.toString()
        router.push(query ? `${pathname}?${query}` : pathname)
    }, [hasDraftChanges, pagination.page, pagination.pageSize, pagination.totalPages, pathname, router, searchParams])

    const handlePageSizeChange = useCallback((pageSize: number) => {
        pushProductPage(1, pageSize)
    }, [pushProductPage])

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return
            const target = event.target as HTMLElement | null
            const tagName = target?.tagName
            if (target?.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return

            if (event.key === 'ArrowLeft') {
                event.preventDefault()
                pushProductPage(pagination.page - 1)
            } else if (event.key === 'ArrowRight') {
                event.preventDefault()
                pushProductPage(pagination.page + 1)
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [pagination.page, pushProductPage])

    const saveOrder = useCallback(async (productIds: string[], startOrder = 0) => {
        try {
            await fetch('/api/products/reorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productIds, startOrder })
            })
            // router.refresh() // Optional: Refresh to sync server state
        } catch (e) {
            console.error(e)
            alert("Failed to save product order")
        }
    }, [])

    const onSortOrderChange = useCallback(async (productId: string, newIndex: number) => {
        // ... (existing code)
        const lastPageIndex = pageOffset + products.length - 1
        const clampedIndex = Math.max(pageOffset, Math.min(newIndex, lastPageIndex))
        const localIndex = clampedIndex - pageOffset
        const oldIndex = products.findIndex(p => p.id === productId)
        if (oldIndex === localIndex) return
        const newItems = [...products]
        const [movedProduct] = newItems.splice(oldIndex, 1)
        if (!movedProduct) return
        newItems.splice(localIndex, 0, movedProduct)
        setProducts(newItems)
        saveOrder(newItems.map(item => item.id), pageOffset)
    }, [pageOffset, products, saveOrder])

    const handleDelete = useCallback(async (id: string) => {
        if (!confirm('정말 삭제하시겠습니까? 관련 주문 데이터가 있을 경우 오류가 발생할 수 있습니다.')) return
        try {
            const res = await fetch(`/api/products/${id}`, { method: 'DELETE' })
            if (res.ok) {
                setProducts(prev => prev.filter(p => p.id !== id))
                router.refresh()
            } else {
                const data = await res.json()
                alert(data.error || '삭제 실패')
            }
        } catch (e) {
            console.error(e)
            alert('삭제 중 오류 발생')
        }
    }, [router])

    const patchProductGroups = useCallback(async (updates: Array<{ id: string; groupName: string | null; autoGroupingDisabled: boolean }>) => {
        if (updates.length === 0) return

        const previousProducts = products
        const updateMap = new Map(updates.map(update => [update.id, update]))
        setProducts(current => current.map(product => (
            updateMap.has(product.id)
                ? {
                    ...product,
                    groupName: updateMap.get(product.id)?.groupName ?? null,
                    autoGroupingDisabled: updateMap.get(product.id)?.autoGroupingDisabled ?? false,
                }
                : product
        )))

        try {
            const responses = await Promise.all(updates.map(update => fetch(`/api/products/${update.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    groupName: update.groupName,
                    autoGroupingDisabled: update.autoGroupingDisabled,
                }),
            })))
            if (responses.some(response => !response.ok)) {
                throw new Error('그룹 변경 저장에 실패했습니다.')
            }
            router.refresh()
        } catch (error) {
            console.error(error)
            setProducts(previousProducts)
            alert('그룹 변경 중 오류가 발생했습니다.')
        } finally {
            setDraggingProductId(null)
        }
    }, [products, router])

    const handleDropProductToGroup = useCallback((productId: string, targetGroup: ProductGroupView) => {
        if (!productId || groupKeyByProductId.get(productId) === targetGroup.key) {
            setDraggingProductId(null)
            return
        }
        setSelectedGroupKey(targetGroup.key)
        void patchProductGroups([{ id: productId, groupName: targetGroup.name, autoGroupingDisabled: false }])
    }, [groupKeyByProductId, patchProductGroups])

    const handleUngroupProduct = useCallback((productId: string) => {
        setSelectedGroupKey(`single:${productId}`)
        void patchProductGroups([{ id: productId, groupName: null, autoGroupingDisabled: true }])
    }, [patchProductGroups])

    const handleRestoreAutoGroup = useCallback((productId: string) => {
        const product = products.find(item => item.id === productId)
        const restoredGroup = product ? inferProductGroup({ ...product, groupName: null, autoGroupingDisabled: false }) : null
        setSelectedGroupKey(restoredGroup?.key || `single:${productId}`)
        void patchProductGroups([{ id: productId, groupName: null, autoGroupingDisabled: false }])
    }, [patchProductGroups, products])

    const handleToggleCheck = useCallback((id: string) => {
        setCheckedIds(current => {
            const next = new Set(current)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }, [])

    const handleToggleAll = useCallback(() => {
        if (visibleProductIds.length === 0) return
        setCheckedIds(current => {
            const allVisibleChecked = visibleProductIds.every(id => current.has(id))
            const next = new Set(current)
            visibleProductIds.forEach(id => {
                if (allVisibleChecked) next.delete(id)
                else next.add(id)
            })
            return next
        })
    }, [visibleProductIds])

    const handleToggleGroupCheck = useCallback((ids: string[]) => {
        setCheckedIds(current => {
            const allChecked = ids.every(id => current.has(id))
            const next = new Set(current)
            ids.forEach(id => {
                if (allChecked) next.delete(id)
                else next.add(id)
            })
            return next
        })
    }, [])

    const toggleGroup = useCallback((key: string) => {
        setCollapsedGroupKeys(current => {
            const next = new Set(current)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }, [])

    const handleCollapseAllGroups = useCallback(() => {
        setCollapsedGroupKeys(new Set(namedGroupKeys))
    }, [namedGroupKeys])

    const handleExpandAllGroups = useCallback(() => {
        setCollapsedGroupKeys(new Set())
    }, [])

    const resetFilters = useCallback(() => {
        setProductQuery('')
        setAvailabilityFilter('all')
        setStockFilter('all')
    }, [])

    const ensureProductChecked = useCallback((id: string) => {
        setCheckedIds(current => {
            if (current.has(id)) return current
            const next = new Set(current)
            next.add(id)
            return next
        })
    }, [])

    const handleCostChange = useCallback((id: string, val: string) => {
        setModifiedCosts(prev => ({ ...prev, [draftKey(activeGrade, id)]: val }))
        ensureProductChecked(id)
    }, [activeGrade, ensureProductChecked])

    const handleWholesaleChange = useCallback((id: string, val: string) => {
        setModifiedWholesales(prev => ({ ...prev, [draftKey(activeGrade, id)]: val }))
        ensureProductChecked(id)
    }, [activeGrade, ensureProductChecked])

    const handleRetailChange = useCallback((id: string, val: string) => {
        setModifiedRetails(prev => ({ ...prev, [draftKey(activeGrade, id)]: val }))
        ensureProductChecked(id)
    }, [activeGrade, ensureProductChecked])

    const handleStockChange = useCallback((id: string, val: string) => {
        setModifiedStocks(prev => ({ ...prev, [id]: val }))
        ensureProductChecked(id)
    }, [ensureProductChecked])

    const handleMoqChange = useCallback((id: string, val: string) => {
        setModifiedMoqs(prev => ({ ...prev, [draftKey(activeGrade, id)]: val }))
        ensureProductChecked(id)
    }, [activeGrade, ensureProductChecked])

    const handleOrderUnitChange = useCallback((id: string, val: string) => {
        setModifiedOrderUnits(prev => ({ ...prev, [draftKey(activeGrade, id)]: val }))
        ensureProductChecked(id)
    }, [activeGrade, ensureProductChecked])

    const handleToggleOrderAvailability = useCallback(async (id: string) => {
        const product = products.find(p => p.id === id)
        if (!product) return
        const newValue = product.wholesaleAvailable === false ? true : false
        try {
            const res = await fetch(`/api/products/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wholesaleAvailable: newValue })
            })
            if (res.ok) {
                setProducts(prev => prev.map(p => p.id === id ? { ...p, wholesaleAvailable: newValue } : p))
            } else {
                alert('변경 실패')
            }
        } catch {
            alert('오류 발생')
        }
    }, [products])

    const handleSaveChanges = async () => {
        if (checkedIds.size === 0) return

        const stockChangedIds = Array.from(checkedIds).filter(id => modifiedStocks[id] !== undefined)
        const changedGrades = PRODUCT_GRADES.filter(grade => (
            Array.from(checkedIds).some(id => (
                modifiedCosts[draftKey(grade, id)] !== undefined
                || modifiedWholesales[draftKey(grade, id)] !== undefined
                || modifiedRetails[draftKey(grade, id)] !== undefined
                || modifiedMoqs[draftKey(grade, id)] !== undefined
                || modifiedOrderUnits[draftKey(grade, id)] !== undefined
            ))
        ))
        const changedProductIds = new Set(Array.from(checkedIds).filter(id => (
            modifiedStocks[id] !== undefined
            || changedGrades.some(grade => (
                modifiedCosts[draftKey(grade, id)] !== undefined
                || modifiedWholesales[draftKey(grade, id)] !== undefined
                || modifiedRetails[draftKey(grade, id)] !== undefined
                || modifiedMoqs[draftKey(grade, id)] !== undefined
                || modifiedOrderUnits[draftKey(grade, id)] !== undefined
            ))
        )))

        if (changedProductIds.size === 0) {
            alert('수정된 값이 없습니다.')
            return
        }
        const gradeLabel = changedGrades.length > 0 ? `${changedGrades.join(', ')} 등급` : ''
        const stockLabel = stockChangedIds.length > 0 ? '관리용 재고' : ''
        const changeLabel = [stockLabel, gradeLabel].filter(Boolean).join(' / ')
        if (!confirm(`${changedProductIds.size}개 상품의 ${changeLabel} 수정사항을 저장하시겠습니까?`)) return

        setIsSaving(true)
        try {
            if (stockChangedIds.length > 0) {
                await postBulkUpdate('/api/products/bulk/stock', {
                    updates: stockChangedIds.map(id => ({
                        id,
                        stock: Math.max(0, parseIntegerDraft(modifiedStocks[id], 0)),
                    })),
                })
            }

            for (const grade of changedGrades) {
                const updates = Array.from(checkedIds).flatMap(id => {
                    const key = draftKey(grade, id)
                    const cost = modifiedCosts[key]
                    const wholesale = modifiedWholesales[key]
                    const retail = modifiedRetails[key]
                    const moq = modifiedMoqs[key]
                    const orderUnit = modifiedOrderUnits[key]
                    if ([cost, wholesale, retail, moq, orderUnit].every(value => value === undefined)) return []

                    return [{
                        id,
                        ...(cost !== undefined ? { cost: Math.max(0, parseNumericDraft(cost)) } : {}),
                        ...(wholesale !== undefined ? { wholesale: Math.max(0, parseNumericDraft(wholesale)) } : {}),
                        ...(retail !== undefined ? { retail: Math.max(0, parseNumericDraft(retail)) } : {}),
                        ...(moq !== undefined ? { moq: Math.max(1, parseIntegerDraft(moq, 1)) } : {}),
                        ...(orderUnit !== undefined ? { orderUnit: Math.max(1, parseIntegerDraft(orderUnit, 1)) } : {}),
                    }]
                })
                await postBulkUpdate('/api/products/bulk/grade-pricing', { grade, updates })
            }

            setProducts(currentProducts => currentProducts.map(product => {
                if (!changedProductIds.has(product.id)) return product
                let regionalPrices = product.regionalPrices
                let nextProduct = { ...product }

                const stockDraft = modifiedStocks[product.id]
                if (stockDraft !== undefined) {
                    nextProduct.stock = Math.max(0, parseIntegerDraft(stockDraft, 0))
                }

                for (const grade of changedGrades) {
                    const costDraft = modifiedCosts[draftKey(grade, product.id)]
                    const wholesaleDraft = modifiedWholesales[draftKey(grade, product.id)]
                    const retailDraft = modifiedRetails[draftKey(grade, product.id)]
                    const moqDraft = modifiedMoqs[draftKey(grade, product.id)]
                    const orderUnitDraft = modifiedOrderUnits[draftKey(grade, product.id)]
                    if (costDraft !== undefined) {
                        const cost = Math.max(0, parseNumericDraft(costDraft))
                        regionalPrices = setProductGradePriceValue(regionalPrices, grade, 'cost', cost)
                        if (grade === 'C') nextProduct.buyPrice = cost
                    }
                    if (wholesaleDraft !== undefined) {
                        const wholesale = Math.max(0, parseNumericDraft(wholesaleDraft))
                        regionalPrices = setProductGradePriceValue(regionalPrices, grade, 'wholesale', wholesale)
                        nextProduct = { ...nextProduct, [`price${grade}`]: wholesale }
                        if (grade === 'C') nextProduct.sellPrice = wholesale
                    }
                    if (retailDraft !== undefined) {
                        const retail = Math.max(0, parseNumericDraft(retailDraft))
                        regionalPrices = setProductGradePriceValue(regionalPrices, grade, 'retail', retail)
                        if (grade === 'C') nextProduct.onlinePrice = retail
                    }
                    if (moqDraft !== undefined) {
                        const moq = Math.max(1, parseIntegerDraft(moqDraft, 1))
                        regionalPrices = setProductGradeOrderValue(regionalPrices, grade, 'moq', moq)
                        if (grade === 'C') nextProduct.minOrderQuantity = moq
                    }
                    if (orderUnitDraft !== undefined) {
                        const orderUnit = Math.max(1, parseIntegerDraft(orderUnitDraft, 1))
                        regionalPrices = setProductGradeOrderValue(regionalPrices, grade, 'orderUnit', orderUnit)
                        if (grade === 'C') nextProduct.orderUnit = orderUnit
                    }
                }

                return { ...nextProduct, regionalPrices }
            }))
            alert('저장되었습니다.')
            setCheckedIds(new Set())
            setModifiedCosts({})
            setModifiedWholesales({})
            setModifiedRetails({})
            setModifiedStocks({})
            setModifiedMoqs({})
            setModifiedOrderUnits({})
            router.refresh()
        } catch (e) {
            console.error(e)
            alert('오류 발생')
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="overflow-hidden rounded-2xl bg-white">
            <div className="border-b border-slate-100 bg-white p-3">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-sm font-black text-slate-950">상품 관리</h2>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-600">
                                {formatInteger(pagination.totalCount)}개 상품
                            </span>
                            {hasActiveFilters ? (
                                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-black text-blue-700">
                                    현재 페이지 {formatInteger(filteredProducts.length)}개 표시
                                </span>
                            ) : null}
                        </div>
                        <p className="mt-1 text-[11px] font-medium text-slate-500">
                            등급별 가격과 관리용 재고를 한 화면에서 수정합니다. 페이지 이동은 좌우 방향키도 사용할 수 있습니다.
                        </p>
                    </div>
                    <ProductPaginationControls
                        pagination={pagination}
                        pageStart={pageStart}
                        pageEnd={pageEnd}
                        onPageChange={pushProductPage}
                        onPageSizeChange={handlePageSizeChange}
                        className="justify-start xl:justify-end"
                    />
                </div>

                <div className="mt-3 flex flex-col gap-2 2xl:flex-row 2xl:items-center 2xl:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
                            {(['group', 'sku'] as ProductViewMode[]).map(mode => (
                                <button
                                    key={mode}
                                    type="button"
                                    onClick={() => setViewMode(mode)}
                                    className={`h-8 rounded-lg px-3 text-[11px] font-black transition ${
                                        viewMode === mode
                                            ? 'bg-slate-950 text-white shadow-sm'
                                            : 'text-slate-500 hover:bg-white hover:text-slate-900'
                                    }`}
                                >
                                    {mode === 'group' ? '그룹' : 'SKU'}
                                </button>
                            ))}
                        </div>
                        <label className="flex h-10 w-full min-w-[260px] max-w-md items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[12px] text-slate-500 focus-within:border-blue-400 sm:w-[360px]">
                            <Search size={15} className="shrink-0 text-slate-400" />
                            <input
                                value={productQuery}
                                onChange={(event) => setProductQuery(event.target.value)}
                                placeholder="상품명, 상품코드, 바코드 검색"
                                className="min-w-0 flex-1 bg-transparent text-[12px] font-bold text-slate-700 outline-none placeholder:text-slate-400"
                            />
                            {productQuery ? (
                                <button type="button" onClick={() => setProductQuery('')} className="text-slate-400 hover:text-slate-700" title="검색어 지우기">
                                    <X size={14} />
                                </button>
                            ) : null}
                        </label>
                        <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
                            <SlidersHorizontal size={14} className="text-slate-400" />
                            <select
                                value={availabilityFilter}
                                onChange={(event) => setAvailabilityFilter(event.target.value as ProductAvailabilityFilter)}
                                className="bg-transparent text-[11px] font-black text-slate-600 outline-none"
                                title="발주 상태 필터"
                            >
                                <option value="all">발주 상태 전체</option>
                                <option value="available">발주 가능</option>
                                <option value="unavailable">발주 불가능</option>
                            </select>
                        </label>
                        <select
                            value={stockFilter}
                            onChange={(event) => setStockFilter(event.target.value as ProductStockFilter)}
                            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-black text-slate-600 outline-none"
                            title="재고 필터"
                        >
                            <option value="all">재고 상태 전체</option>
                            <option value="stocked">재고 있음</option>
                            <option value="empty">재고 없음</option>
                        </select>
                        {hasActiveFilters ? (
                            <button
                                type="button"
                                onClick={resetFilters}
                                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-black text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                            >
                                필터 초기화
                            </button>
                        ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={handleExpandAllGroups}
                            disabled={namedGroupKeys.length === 0 || collapsedNamedGroupCount === 0}
                            className="h-9 rounded-xl border border-blue-100 bg-blue-50 px-3 text-[11px] font-black text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            전체 펼치기
                        </button>
                        <button
                            type="button"
                            onClick={handleCollapseAllGroups}
                            disabled={namedGroupKeys.length === 0 || collapsedNamedGroupCount === namedGroupKeys.length}
                            className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-black text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            전체 접기
                        </button>
                        <div className="flex items-center gap-1 rounded-xl border border-blue-100 bg-blue-50 p-1">
                            {PRODUCT_GRADES.map(grade => {
                                const changedCount = Array.from(checkedIds).filter(id => (
                                    modifiedCosts[draftKey(grade, id)] !== undefined
                                    || modifiedWholesales[draftKey(grade, id)] !== undefined
                                    || modifiedRetails[draftKey(grade, id)] !== undefined
                                    || modifiedMoqs[draftKey(grade, id)] !== undefined
                                    || modifiedOrderUnits[draftKey(grade, id)] !== undefined
                                )).length
                                return (
                                    <button
                                        key={grade}
                                        type="button"
                                        onClick={() => setActiveGrade(grade)}
                                        className={`relative h-8 min-w-14 rounded-lg px-3 text-[11px] font-black transition ${
                                            activeGrade === grade
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'text-blue-700 hover:bg-white'
                                        }`}
                                    >
                                        {grade}등급
                                        {changedCount > 0 ? (
                                            <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[9px] ${activeGrade === grade ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'}`}>
                                                {changedCount}
                                            </span>
                                        ) : null}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>
            {checkedIds.size > 0 && (
                <div className="flex items-center justify-between gap-3 border-b border-blue-100 bg-blue-50 px-3 py-2">
                    <span className="text-xs font-bold text-blue-800">{checkedIds.size}개 상품 선택됨</span>
                    <button
                        onClick={handleSaveChanges}
                        disabled={isSaving}
                        className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-sm hover:bg-blue-700 transition disabled:opacity-50"
                    >
                        {isSaving ? '저장 중...' : '수정사항 저장하기'}
                    </button>
                </div>
            )}
            <div className="grid min-h-[520px] xl:grid-cols-[minmax(0,1fr)_310px]">
                <div className="min-w-0">
                    <div className="w-full overflow-x-auto pb-2">
                <table className="table-fixed border-collapse" style={{ width: PRODUCT_TABLE_WIDTH, minWidth: PRODUCT_TABLE_WIDTH }}>
                    <colgroup>
                        <col className="w-[34px]" />
                        <col className="w-[28px]" />
                        <col className="w-[44px]" />
                        <col className="w-[54px]" />
                        <col className="w-[260px]" />
                        <col className="w-[84px]" />
                        <col className="w-[84px]" />
                        <col className="w-[94px]" />
                        <col className="w-[94px]" />
                        <col className="w-[94px]" />
                        <col className="w-[94px]" />
                        <col className="w-[94px]" />
                        <col className="w-[100px]" />
                        <col className="w-[110px]" />
                        <col className="w-[94px]" />
                        <col className="w-[94px]" />
                        <col className="w-[150px]" />
                        <col className="w-[132px]" />
                    </colgroup>
                    <thead className="sticky top-0 z-10 bg-blue-700 text-white shadow-sm">
                        <tr>
                            <th className="px-2 py-1.5 text-center font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap w-8">
                                <input
                                    type="checkbox"
                                    onChange={handleToggleAll}
                                    checked={visibleProductIds.length > 0 && checkedVisibleCount === visibleProductIds.length}
                                    className="cursor-pointer"
                                />
                            </th>
                            <th className="px-2 py-1.5 text-center font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap w-8">순서</th>
                            <th className="px-2 py-1.5 text-center font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap w-8">No</th>
                            <th className="px-2 py-1.5 text-center font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap">이미지</th>
                            <th className="px-2 py-1.5 text-center font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap">상품명</th>
                            <th className="px-2 py-1.5 text-center font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap">관리용 재고</th>
                            <th className="px-2 py-1.5 text-center font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap">발주 상태</th>
                            <th className="px-2 py-1.5 text-center font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap">{activeGrade}등급 KR 최소수량</th>
                            <th className="px-2 py-1.5 text-center font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap">{activeGrade}등급 KR 주문단위</th>
                            <th className="px-2 py-1.5 text-center font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap">{activeGrade}등급 KR 매입가</th>
                            <th className="px-2 py-1.5 text-right font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap">{activeGrade}등급 KR 도매가</th>
                            <th className="px-2 py-1.5 text-right font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap">{activeGrade}등급 KR 판매가</th>
                            <th className="px-2 py-1.5 text-center font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap">마진(도매/소매)</th>
                            <th className="px-2 py-1.5 text-center font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap">상품코드</th>
                            <th className="px-2 py-1.5 text-center font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap">HS Code</th>
                            <th className="px-2 py-1.5 text-center font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap">JP HS</th>
                            <th className="px-2 py-1.5 text-center font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap">바코드</th>
                            <th className="px-2 py-1.5 text-center font-bold text-[11px] last:border-0 whitespace-nowrap">관리</th>
                        </tr>
                    </thead>
                    {filteredProducts.length === 0 ? (
                        <tbody className="divide-y divide-gray-100">
                            <tr>
                                <td colSpan={PRODUCT_TABLE_COLS} className="px-6 py-12 text-center text-gray-500">
                                    조건에 맞는 상품이 없습니다.
                                </td>
                            </tr>
                        </tbody>
                    ) : viewMode === 'sku' ? (
                        <tbody className="divide-y divide-gray-100">
                            {filteredProducts.map((product) => (
                                <ProductRow
                                    key={product.id}
                                    product={product}
                                    index={productIndexById.get(product.id) ?? 0}
                                    activeGrade={activeGrade}
                                    onSelect={() => setSelectedGroupKey(groupKeyByProductId.get(product.id) || null)}
                                    onDragStartProduct={setDraggingProductId}
                                    onDragEndProduct={() => setDraggingProductId(null)}
                                    onSortOrderChange={onSortOrderChange}
                                    onDelete={handleDelete}
                                    onUngroup={handleUngroupProduct}
                                    onRestoreAutoGroup={handleRestoreAutoGroup}
                                    checked={checkedIds.has(product.id)}
                                    onToggleCheck={handleToggleCheck}
                                    modifiedCost={modifiedCosts[draftKey(activeGrade, product.id)]}
                                    onCostChange={handleCostChange}
                                    modifiedWholesale={modifiedWholesales[draftKey(activeGrade, product.id)]}
                                    onWholesaleChange={handleWholesaleChange}
                                    modifiedRetail={modifiedRetails[draftKey(activeGrade, product.id)]}
                                    onRetailChange={handleRetailChange}
                                    modifiedStock={modifiedStocks[product.id]}
                                    onStockChange={handleStockChange}
                                    modifiedMoq={modifiedMoqs[draftKey(activeGrade, product.id)]}
                                    onMoqChange={handleMoqChange}
                                    modifiedOrderUnit={modifiedOrderUnits[draftKey(activeGrade, product.id)]}
                                    onOrderUnitChange={handleOrderUnitChange}
                                    onToggleOrderAvailability={handleToggleOrderAvailability}
                                />
                            ))}
                        </tbody>
                    ) : (
                        productGroups.map((group) => {
                            const expanded = !group.isNamed || !collapsedGroupKeys.has(group.key)
                            const checkedCount = group.products.filter(product => checkedIds.has(product.id)).length
                            return (
                                <Fragment key={group.key}>
                                    {group.isNamed ? (
                                        <tbody>
                                            <ProductGroupHeader
                                                group={group}
                                                expanded={expanded}
                                                checkedCount={checkedCount}
                                                selected={selectedGroup?.key === group.key}
                                                canDrop={Boolean(draggingProductId && !group.products.some(product => product.id === draggingProductId))}
                                                onToggle={() => toggleGroup(group.key)}
                                                onToggleCheck={() => handleToggleGroupCheck(group.products.map(product => product.id))}
                                                onSelect={() => setSelectedGroupKey(group.key)}
                                                onDropProduct={(productId) => handleDropProductToGroup(productId, group)}
                                            />
                                        </tbody>
                                    ) : null}
                                    <tbody className="divide-y divide-gray-100" hidden={group.isNamed && !expanded}>
                                        {group.products.map((product) => (
                                            <ProductRow
                                                key={product.id}
                                                product={product}
                                                index={productIndexById.get(product.id) ?? 0}
                                                activeGrade={activeGrade}
                                                onSelect={() => setSelectedGroupKey(group.key)}
                                                onDragStartProduct={setDraggingProductId}
                                                onDragEndProduct={() => setDraggingProductId(null)}
                                                onSortOrderChange={onSortOrderChange}
                                                onDelete={handleDelete}
                                                onUngroup={handleUngroupProduct}
                                                onRestoreAutoGroup={handleRestoreAutoGroup}
                                                checked={checkedIds.has(product.id)}
                                                onToggleCheck={handleToggleCheck}
                                                modifiedCost={modifiedCosts[draftKey(activeGrade, product.id)]}
                                                onCostChange={handleCostChange}
                                                modifiedWholesale={modifiedWholesales[draftKey(activeGrade, product.id)]}
                                                onWholesaleChange={handleWholesaleChange}
                                                modifiedRetail={modifiedRetails[draftKey(activeGrade, product.id)]}
                                                onRetailChange={handleRetailChange}
                                                modifiedStock={modifiedStocks[product.id]}
                                                onStockChange={handleStockChange}
                                                modifiedMoq={modifiedMoqs[draftKey(activeGrade, product.id)]}
                                                onMoqChange={handleMoqChange}
                                                modifiedOrderUnit={modifiedOrderUnits[draftKey(activeGrade, product.id)]}
                                                onOrderUnitChange={handleOrderUnitChange}
                                                onToggleOrderAvailability={handleToggleOrderAvailability}
                                            />
                                        ))}
                                    </tbody>
                                </Fragment>
                            )
                        })
                    )}
                    </table>
                </div>
                <div className="border-t border-slate-100 bg-white px-3 py-2">
                    <ProductPaginationControls
                        pagination={pagination}
                        pageStart={pageStart}
                        pageEnd={pageEnd}
                        onPageChange={pushProductPage}
                        onPageSizeChange={handlePageSizeChange}
                        className="justify-end"
                    />
                </div>
            </div>
            <ProductSummaryPanel group={selectedGroup} activeGrade={activeGrade} />
            </div>
        </div>
    )
}
