'use client'

import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronRight, Copy, Layers, Pencil, RefreshCw, RotateCcw, Search, SlidersHorizontal, Trash2, Unlink, X } from 'lucide-react'
import ProductForm, { type Product as ProductTableProduct } from "./product-form"
import ProductStockHistoryModal from './ProductStockHistoryModal'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    PRODUCT_GRADES,
    readProductGradeOrderValue,
    readProductGradePriceValue,
    setProductGradeOrderValue,
    setProductGradePriceValue,
    type ProductGrade,
} from '@/lib/productGradePricing'
import {
    classifyProductCatalogCategory,
    getGroupedSkuLabel,
    PRODUCT_CATALOG_CATEGORIES,
    PRODUCT_CATALOG_CATEGORY_LABELS,
    type ProductCatalogCategory,
} from '@/lib/productCatalogDisplay'
import {
    DEFAULT_PRODUCT_TABLE_COLUMNS,
    normalizeProductTableColumns,
    PRODUCT_TABLE_COLUMN_OPTIONS,
    PRODUCT_TABLE_COLUMNS_STORAGE_KEY,
    type ProductTableColumnKey,
} from '@/lib/productTableColumns'

const draftKey = (grade: ProductGrade, productId: string) => `${grade}:${productId}`
const FIXED_PRODUCT_TABLE_WIDTH = 40 + 68 + 78 + 72 + 360
const CNY_RATE_CACHE_KEY = 'admin-product-cny-krw-rate-v1'
type PurchaseCurrency = 'CNY' | 'USD'
type ProductContextMenu = { productId: string, x: number, y: number }

const getPurchaseCurrency = (product: ProductTableProduct): PurchaseCurrency => (
    product.purchaseCurrency === 'USD' ? 'USD' : 'CNY'
)

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
    displayName?: string
    groupOrder: number
    activeGrade: ProductGrade
    visibleColumns: ProductTableColumnKey[]
    onSelect: () => void
    onDragStartProduct: (productId: string) => void
    onDragEndProduct: () => void
    onGroupOrderChange: (productId: string, newOrder: number) => void
    onDelete: (productId: string) => void
    onUngroup: (productId: string) => void
    onRestoreAutoGroup: (productId: string) => void
    checked: boolean
    onToggleCheck: (id: string) => void
    modifiedCost: string | undefined
    onCostChange: (id: string, val: string) => void
    modifiedCnyCost: string | undefined
    modifiedUsdCost: string | undefined
    onForeignCostChange: (id: string, currency: PurchaseCurrency, val: string) => void
    cnyRateAvailable: boolean
    usdRateAvailable: boolean
    onOpenContextMenu: (productId: string, x: number, y: number) => void
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

const ProductRow = memo(function ProductRow({ product, displayName, groupOrder, activeGrade, visibleColumns, onSelect, onDragStartProduct, onDragEndProduct, onGroupOrderChange, onDelete, onUngroup, onRestoreAutoGroup, checked, onToggleCheck, modifiedCost, onCostChange, modifiedCnyCost, modifiedUsdCost, onForeignCostChange, cnyRateAvailable, usdRateAvailable, onOpenContextMenu, modifiedWholesale, onWholesaleChange, modifiedRetail, onRetailChange, modifiedStock, onStockChange, modifiedMoq, onMoqChange, modifiedOrderUnit, onOrderUnitChange, onToggleOrderAvailability }: ProductRowProps) {
    const legacyWholesale = {
        A: product.priceA,
        B: product.priceB,
        C: product.priceC ?? product.sellPrice,
        D: product.priceD,
    }[activeGrade] ?? product.sellPrice
    const costValue = modifiedCost !== undefined
        ? modifiedCost
        : readProductGradePriceValue(product.regionalPrices, activeGrade, 'cost', product.buyPrice || 0)
    const purchaseCurrency = getPurchaseCurrency(product)
    const purchaseRateAvailable = purchaseCurrency === 'USD' ? usdRateAvailable : cnyRateAvailable
    const foreignCostValue = purchaseCurrency === 'USD'
        ? modifiedUsdCost !== undefined ? modifiedUsdCost : product.usdPurchasePrice || ''
        : modifiedCnyCost !== undefined ? modifiedCnyCost : product.cnyBuyPrice || ''
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
    const stockNumber = Math.max(0, parseIntegerDraft(modifiedStock !== undefined ? modifiedStock : product.stock ?? 0))
    const safetyStockNumber = Math.max(0, parseIntegerDraft(product.safetyStock ?? 0))
    const stockStatus = stockNumber <= 0
        ? { label: '품절', className: 'border-red-200 bg-red-50 text-red-700' }
        : safetyStockNumber > 0 && stockNumber <= safetyStockNumber
            ? { label: '부족', className: 'border-amber-200 bg-amber-50 text-amber-700' }
            : { label: '정상', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' }

    const handleBlur = (value: string) => {
        const val = parseInt(value)
        if (!isNaN(val) && val !== groupOrder) {
            onGroupOrderChange(product.id, val - 1)
        }
    }

    const cellClass = 'px-3 py-2.5 text-center whitespace-nowrap'

    const renderOptionalCell = (column: ProductTableColumnKey) => {
        switch (column) {
            case 'barcode':
                return (
                    <td key={column} className={`${cellClass} font-mono text-[12px] font-bold text-slate-600`}>
                        {product.barcode || '-'}
                    </td>
                )
            case 'stock':
                return (
                    <td key={column} className={`${cellClass} tabular-nums`}>
                        <div className="flex items-center justify-center gap-1">
                            <input
                                type="text"
                                inputMode="numeric"
                                value={formatNumberInput(modifiedStock !== undefined ? modifiedStock : product.stock ?? 0)}
                                onChange={(event) => onStockChange(product.id, normalizeNumericDraft(event.target.value))}
                                className="h-10 w-[76px] rounded-md border border-emerald-400 bg-emerald-50 px-2 text-right text-[15px] font-black text-emerald-900 outline-none transition-colors focus:border-emerald-700 focus:bg-white"
                                title="관리자용 재고"
                            />
                            <ProductStockHistoryModal productId={product.id} productName={product.name} compact />
                        </div>
                    </td>
                )
            case 'safetyStock':
                return (
                    <td key={column} className={`${cellClass} tabular-nums text-[14px] font-black text-slate-700`}>
                        {safetyStockNumber > 0 ? formatInteger(safetyStockNumber) : '-'}
                    </td>
                )
            case 'stockStatus':
                return (
                    <td key={column} className={cellClass}>
                        <span className={`inline-flex min-w-[56px] items-center justify-center rounded-md border px-2.5 py-1.5 text-[12px] font-black ${stockStatus.className}`}>
                            {stockStatus.label}
                        </span>
                    </td>
                )
            case 'availability':
                return (
                    <td key={column} className={cellClass}>
                        <button
                            type="button"
                            onClick={() => onToggleOrderAvailability(product.id)}
                            className={`rounded-md border px-2.5 py-1.5 text-[12px] font-black transition ${product.wholesaleAvailable !== false ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-600'}`}
                        >
                            {product.wholesaleAvailable !== false ? '발주 가능' : '발주 불가능'}
                        </button>
                    </td>
                )
            case 'moq':
                return (
                    <td key={column} className={cellClass}>
                        <input type="text" inputMode="numeric" value={modifiedMoq !== undefined ? formatNumberInput(modifiedMoq) : formatNumberInput(readProductGradeOrderValue(product.regionalPrices, activeGrade, 'moq', product.minOrderQuantity || 1))} onChange={(event) => onMoqChange(product.id, normalizeNumericDraft(event.target.value))} className="h-9 w-16 rounded-md border border-slate-300 px-2 text-center text-[13px] font-bold outline-none focus:border-blue-500" />
                    </td>
                )
            case 'orderUnit':
                return (
                    <td key={column} className={cellClass}>
                        <input type="text" inputMode="numeric" value={modifiedOrderUnit !== undefined ? formatNumberInput(modifiedOrderUnit) : formatNumberInput(readProductGradeOrderValue(product.regionalPrices, activeGrade, 'orderUnit', product.orderUnit || 1))} onChange={(event) => onOrderUnitChange(product.id, normalizeNumericDraft(event.target.value))} className="h-9 w-16 rounded-md border border-slate-300 px-2 text-center text-[13px] font-bold outline-none focus:border-blue-500" />
                    </td>
                )
            case 'cost':
                return (
                    <td key={column} className={`${cellClass} tabular-nums`}>
                        <div className="relative mx-auto w-[94px]">
                            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-black text-slate-400">₩</span>
                            <input type="text" inputMode="decimal" value={formatNumberInput(costValue)} onChange={(event) => onCostChange(product.id, normalizeNumericDraft(event.target.value, true))} className="h-9 w-full rounded-md border border-slate-300 bg-slate-50 pl-6 pr-2 text-right text-[13px] font-black text-slate-800 outline-none focus:border-blue-500 focus:bg-white" title="환산된 한화 매입가이며 직접 수정할 수도 있습니다." />
                        </div>
                    </td>
                )
            case 'cnyCost':
                return (
                    <td key={column} className={`${cellClass} tabular-nums`}>
                        <div className="relative mx-auto w-[94px]">
                            <span className={`pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-black ${purchaseCurrency === 'USD' ? 'text-blue-600' : 'text-red-500'}`}>
                                {purchaseCurrency === 'USD' ? 'US$' : 'CN¥'}
                            </span>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={formatNumberInput(foreignCostValue)}
                                placeholder="0"
                                onChange={(event) => onForeignCostChange(product.id, purchaseCurrency, normalizeNumericDraft(event.target.value, true))}
                                disabled={!purchaseRateAvailable}
                                className={`h-9 w-full rounded-md border pl-9 pr-2 text-right text-[13px] font-black outline-none focus:bg-white disabled:cursor-not-allowed disabled:opacity-50 ${purchaseCurrency === 'USD' ? 'border-blue-200 bg-blue-50 text-blue-800 focus:border-blue-500' : 'border-red-200 bg-red-50 text-red-800 focus:border-red-500'}`}
                                title={purchaseRateAvailable ? `${purchaseCurrency} 매입가를 입력하면 한화 매입가가 즉시 계산됩니다. 우클릭으로 통화를 변경할 수 있습니다.` : '환율을 불러온 뒤 입력할 수 있습니다.'}
                            />
                        </div>
                    </td>
                )
            case 'wholesale':
                return (
                    <td key={column} className={`${cellClass} tabular-nums`}>
                        <input type="text" inputMode="decimal" value={formatNumberInput(wholesaleValue)} onChange={(event) => onWholesaleChange(product.id, normalizeNumericDraft(event.target.value, true))} className="h-9 w-20 rounded-md border border-blue-300 bg-blue-50 px-2 text-right text-[13px] font-black text-blue-800 outline-none focus:border-blue-600" />
                    </td>
                )
            case 'retail':
                return (
                    <td key={column} className={`${cellClass} tabular-nums`}>
                        <input type="text" inputMode="decimal" value={formatNumberInput(retailValue)} onChange={(event) => onRetailChange(product.id, normalizeNumericDraft(event.target.value, true))} className="h-9 w-20 rounded-md border border-emerald-300 bg-emerald-50 px-2 text-right text-[13px] font-black text-emerald-800 outline-none focus:border-emerald-600" />
                    </td>
                )
            case 'margin':
                return (
                    <td key={column} className={`${cellClass} tabular-nums text-[12px] font-bold`}>
                        <div className="text-blue-600">도매 {wholesaleMargin.toFixed(1)}%</div>
                        <div className="text-emerald-600">판매 {retailMargin.toFixed(1)}%</div>
                    </td>
                )
            case 'productCode':
                return <td key={column} className={`${cellClass} font-mono text-[12px] font-semibold text-slate-600`}>{product.productCode ? String(product.productCode).toUpperCase() : '-'}</td>
            case 'hsCode':
                return <td key={column} className={`${cellClass} font-mono text-[12px] font-semibold text-slate-600`}>{product.hsCode || '-'}</td>
            case 'japanHsCode':
                return <td key={column} className={`${cellClass} font-mono text-[12px] font-semibold text-slate-600`}>{product.japanHsCode || '-'}</td>
            case 'actions':
                return (
                    <td key={column} className={cellClass}>
                        <div className="flex items-center justify-center gap-1">
                            <ProductForm initialData={product} trigger={<button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:border-blue-500 hover:text-blue-700" title="수정"><Pencil size={13} /></button>} />
                            <ProductForm initialData={product} isCopy={true} trigger={<button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-blue-100 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white" title="복사"><Copy size={13} /></button>} />
                            <button type="button" onClick={() => ungrouped ? onRestoreAutoGroup(product.id) : onUngroup(product.id)} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-amber-100 bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white" title={ungrouped ? '자동 그룹 복귀' : '그룹 해제'}>{ungrouped ? <RotateCcw size={13} /> : <Unlink size={13} />}</button>
                            <button type="button" onClick={() => onDelete(product.id)} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-100 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white" title="삭제"><Trash2 size={13} /></button>
                        </div>
                    </td>
                )
        }
    }

    return (
        <tr
            id={`product-row-${product.id}`}
            onClick={onSelect}
            onContextMenu={(event) => {
                event.preventDefault()
                onOpenContextMenu(product.id, event.clientX, event.clientY)
            }}
            className={`group h-[68px] border-b border-slate-200 text-[13px] transition-colors hover:bg-blue-50/50 ${checked ? 'bg-blue-50/70' : ungrouped ? 'bg-amber-50/60' : 'bg-white even:bg-slate-50/50'}`}
        >
            <td className={cellClass}>
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleCheck(product.id)}
                    className="cursor-pointer"
                />
            </td>
            <td className={`${cellClass} tabular-nums text-[13px] font-black text-slate-800`}>
                {product.productNumber}
            </td>
            <td className={cellClass}>
                <div className="flex items-center justify-center gap-1">
                    <span
                    draggable
                    onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'move'
                        event.dataTransfer.setData('text/plain', product.id)
                        onDragStartProduct(product.id)
                    }}
                    onDragEnd={onDragEndProduct}
                    className="inline-flex h-6 w-5 cursor-grab items-center justify-center rounded-md text-slate-300 transition hover:bg-blue-50 hover:text-blue-600 active:cursor-grabbing"
                    title="끌어서 다른 그룹으로 이동"
                >
                    ⠿
                </span>
                <input
                    key={`${product.id}:${groupOrder}`}
                    id={`sort-input-${product.id}`}
                    type="text"
                    defaultValue={groupOrder}
                    onBlur={(event) => handleBlur(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') event.currentTarget.blur()
                    }}
                    className="h-9 w-10 rounded-md border border-slate-300 bg-white text-center text-[13px] font-bold outline-none transition-colors focus:border-blue-500"
                />
                </div>
            </td>
            <td className={cellClass}>
                <ProductForm
                    initialData={product}
                    trigger={
                        <div className="mx-auto flex h-12 w-12 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm transition-all hover:border-blue-400 group-hover:shadow-md">
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
            <td className={`${cellClass} text-left`}>
                <ProductForm
                    initialData={product}
                    trigger={
                        <div className="cursor-pointer text-left" title={product.name}>
                            <div className="flex min-w-0 items-center gap-2">
                                <div className="truncate text-[14px] font-black text-slate-950 group-hover:text-blue-700">{displayName || product.name}</div>
                                {ungrouped ? (
                                    <span className="shrink-0 rounded-md border border-amber-200 bg-amber-100 px-1.5 py-0.5 text-[9px] font-black text-amber-800">단일 SKU</span>
                                ) : null}
                            </div>
                            {product.nameJP && (
                                <div className="mt-0.5 truncate text-[12px] font-semibold text-slate-600">{product.nameJP}</div>
                            )}
                            {visibleGroupName && !displayName && (
                                <div className="mt-0.5 truncate text-[10px] font-bold text-indigo-500">그룹: {visibleGroupName}</div>
                            )}
                        </div>
                    }
                />
            </td>
            {visibleColumns.map(renderOptionalCell)}
        </tr>
    )
})

type ProductGroupView = {
    key: string
    name: string
    isNamed: boolean
    isManuallyUngrouped: boolean
    source: '직접 그룹' | '자동 그룹' | '단일 상품'
    products: ProductTableProduct[]
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

const ProductGroupHeader = memo(function ProductGroupHeader({
    group,
    expanded,
    checkedCount,
    selected,
    canDrop,
    columnCount,
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
    columnCount: number
    onToggle: () => void
    onToggleCheck: () => void
    onSelect: () => void
    onDropProduct: (productId: string) => void
}) {
    const totalStock = group.products.reduce((sum, product) => sum + getProductStock(product), 0)
    const lowStockCount = group.products.filter(product => {
        const stock = getProductStock(product)
        const safetyStock = Math.max(0, Number(product.safetyStock) || 0)
        return stock <= 0 || (safetyStock > 0 && stock <= safetyStock)
    }).length
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
            className={`border-y transition-colors ${
                canDrop
                    ? 'border-blue-300 bg-blue-100/80 ring-1 ring-inset ring-blue-300'
                    : selected
                        ? 'border-blue-100 bg-blue-50'
                        : 'border-slate-200 bg-slate-100 hover:bg-blue-50'
            }`}
        >
            <td colSpan={columnCount} className="px-3 py-2.5">
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
                                <span className="truncate text-[13px] font-black text-slate-950">{group.name}</span>
                                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-blue-600 shadow-sm">{group.products.length} SKU</span>
                                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-600">{group.source}</span>
                            </div>
                            <div className="mt-0.5 text-[10px] font-bold text-blue-500">
                                {canDrop ? '여기에 놓으면 이 그룹으로 이동합니다.' : '화살표로 SKU 목록을 접고 펼칩니다.'}
                            </div>
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <div className="rounded-lg border border-emerald-200 bg-white px-3 py-1 text-right shadow-sm">
                            <div className="text-[9px] font-black text-amber-700">재고 부족 SKU</div>
                            <div className={`text-[12px] font-black tabular-nums ${lowStockCount > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{formatInteger(lowStockCount)}</div>
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
    onClose,
}: {
    group: ProductGroupView
    activeGrade: ProductGrade
    onClose: () => void
}) {
    const representative = group.products[0]
    const totalStock = group.products.reduce((sum, product) => sum + getProductStock(product), 0)
    const costValues = group.products
        .map(product => readProductGradePriceValue(product.regionalPrices, activeGrade, 'cost', product.buyPrice || 0))
        .filter(value => Number.isFinite(value) && value > 0)
    const retailValues = group.products
        .map(product => readProductGradePriceValue(product.regionalPrices, activeGrade, 'retail', product.onlinePrice || 0))
        .filter(value => Number.isFinite(value) && value > 0)
    const averageCost = costValues.length > 0
        ? costValues.reduce((sum, value) => sum + value, 0) / costValues.length
        : 0
    const averageRetail = retailValues.length > 0
        ? retailValues.reduce((sum, value) => sum + value, 0) / retailValues.length
        : 0

    return (
        <aside className="border-t border-slate-200 bg-slate-50 p-3 xl:border-l xl:border-t-0" aria-label="선택한 상품 요약">
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
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                            title="요약 닫기"
                            aria-label="선택한 상품 요약 닫기"
                        >
                            <X size={15} />
                        </button>
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="mb-2 text-[11px] font-black text-slate-900">재고 요약</div>
                    <div className="divide-y divide-slate-100 text-[11px]">
                        <div className="flex items-center justify-between py-1.5">
                            <span className="font-bold text-slate-500">재고 합계</span>
                            <span className="font-black tabular-nums text-emerald-700">{formatInteger(totalStock)}</span>
                        </div>
                        <div className="flex items-center justify-between py-1.5">
                            <span className="font-bold text-slate-500">SKU 수</span>
                            <span className="font-black tabular-nums text-slate-800">{formatInteger(group.products.length)}</span>
                        </div>
                        <div className="flex items-center justify-between py-1.5">
                            <span className="font-bold text-slate-500">평균 매입가</span>
                            <span className="font-black tabular-nums text-slate-800">{formatInteger(Math.round(averageCost))}원</span>
                        </div>
                        <div className="flex items-center justify-between py-1.5">
                            <span className="font-bold text-slate-500">평균 판매가</span>
                            <span className="font-black tabular-nums text-blue-700">{formatInteger(Math.round(averageRetail))}원</span>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="mb-2 text-[11px] font-black text-slate-900">SKU 미리보기</div>
                    <div className="space-y-2">
                        {group.products.slice(0, 6).map(product => (
                            <div key={product.id} className="flex items-center justify-between gap-2 text-[11px]">
                                <div className="min-w-0">
                                    <div className="truncate font-bold text-slate-700" title={product.name}>
                                        {group.isNamed
                                            ? getGroupedSkuLabel({
                                                productName: product.name,
                                                groupName: group.name,
                                                productCode: product.productCode,
                                            })
                                            : product.name}
                                    </div>
                                    <div className="truncate font-mono text-[10px] text-slate-400">{product.barcode || '-'}</div>
                                </div>
                                <div className="shrink-0 text-right text-[10px] tabular-nums">
                                    <div className="font-black text-emerald-700">재고 {formatInteger(getProductStock(product))}</div>
                                    <div className="text-slate-500">매입 {formatInteger(readProductGradePriceValue(product.regionalPrices, activeGrade, 'cost', product.buyPrice || 0))} / 판매 {formatInteger(readProductGradePriceValue(product.regionalPrices, activeGrade, 'retail', product.onlinePrice || 0))}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </aside>
    )
}

export default function ProductTable({ initialProducts }: { initialProducts: ProductTableProduct[] }) {
    const [products, setProducts] = useState(initialProducts)
    const activeGrade: ProductGrade = 'C'
    const [activeCategory, setActiveCategory] = useState<ProductCatalogCategory>('soft')
    const [cnyKrwRate, setCnyKrwRate] = useState<number | null>(null)
    const [usdKrwRate, setUsdKrwRate] = useState<number | null>(null)
    const [cnyRateUpdatedAt, setCnyRateUpdatedAt] = useState<string | null>(null)
    const [isCnyRateLoading, setIsCnyRateLoading] = useState(true)
    const [cnyRateError, setCnyRateError] = useState(false)
    const [modifiedCnyCosts, setModifiedCnyCosts] = useState<Record<string, string>>({})
    const [modifiedUsdCosts, setModifiedUsdCosts] = useState<Record<string, string>>({})
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
    const [productContextMenu, setProductContextMenu] = useState<ProductContextMenu | null>(null)
    const orderSaveQueueRef = useRef<Promise<void>>(Promise.resolve())
    const [isSaving, setIsSaving] = useState(false)
    const [visibleColumns, setVisibleColumns] = useState<ProductTableColumnKey[]>(DEFAULT_PRODUCT_TABLE_COLUMNS)
    const [columnsHydrated, setColumnsHydrated] = useState(false)
    const [columnSettingsOpen, setColumnSettingsOpen] = useState(false)
    const columnSettingsRef = useRef<HTMLDivElement>(null)
    const router = useRouter()

    const loadCnyRate = useCallback(async () => {
        setIsCnyRateLoading(true)
        setCnyRateError(false)
        try {
            const response = await fetch('/api/exchange-rates', { cache: 'no-store' })
            if (!response.ok) throw new Error('환율 조회 실패')
            const data = await response.json()
            const cnyRate = Number(data?.cnyKrw)
            const usdRate = Number(data?.usdKrw)
            if (!Number.isFinite(cnyRate) || cnyRate <= 0 || !Number.isFinite(usdRate) || usdRate <= 0) {
                throw new Error('유효하지 않은 환율')
            }

            const updatedAt = typeof data?.updatedAt === 'string' ? data.updatedAt : new Date().toISOString()
            setCnyKrwRate(cnyRate)
            setUsdKrwRate(usdRate)
            setCnyRateUpdatedAt(updatedAt)
            window.localStorage.setItem(CNY_RATE_CACHE_KEY, JSON.stringify({ cnyRate, usdRate, updatedAt }))
        } catch (error) {
            console.error('[products] Failed to load CNY/KRW rate', error)
            setCnyRateError(true)
        } finally {
            setIsCnyRateLoading(false)
        }
    }, [])

    useEffect(() => {
        try {
            const cached = JSON.parse(window.localStorage.getItem(CNY_RATE_CACHE_KEY) || 'null')
            const cachedCnyRate = Number(cached?.cnyRate ?? cached?.rate)
            const cachedUsdRate = Number(cached?.usdRate)
            if (Number.isFinite(cachedCnyRate) && cachedCnyRate > 0) {
                setCnyKrwRate(cachedCnyRate)
                setCnyRateUpdatedAt(typeof cached?.updatedAt === 'string' ? cached.updatedAt : null)
            }
            if (Number.isFinite(cachedUsdRate) && cachedUsdRate > 0) setUsdKrwRate(cachedUsdRate)
        } catch {
            window.localStorage.removeItem(CNY_RATE_CACHE_KEY)
        }
        void loadCnyRate()
    }, [loadCnyRate])

    useEffect(() => {
        const frame = window.requestAnimationFrame(() => {
            try {
                const saved = window.localStorage.getItem(PRODUCT_TABLE_COLUMNS_STORAGE_KEY)
                setVisibleColumns(normalizeProductTableColumns(saved ? JSON.parse(saved) : null))
            } catch {
                setVisibleColumns([...DEFAULT_PRODUCT_TABLE_COLUMNS])
            } finally {
                setColumnsHydrated(true)
            }
        })
        return () => window.cancelAnimationFrame(frame)
    }, [])

    useEffect(() => {
        if (!columnsHydrated) return
        window.localStorage.setItem(PRODUCT_TABLE_COLUMNS_STORAGE_KEY, JSON.stringify(visibleColumns))
    }, [columnsHydrated, visibleColumns])

    useEffect(() => {
        if (!columnSettingsOpen) return
        const closeOnOutsideClick = (event: MouseEvent) => {
            if (!columnSettingsRef.current?.contains(event.target as Node)) setColumnSettingsOpen(false)
        }
        document.addEventListener('mousedown', closeOnOutsideClick)
        return () => document.removeEventListener('mousedown', closeOnOutsideClick)
    }, [columnSettingsOpen])

    useEffect(() => {
        if (!productContextMenu) return
        const closeMenu = () => setProductContextMenu(null)
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') closeMenu()
        }
        window.addEventListener('pointerdown', closeMenu)
        window.addEventListener('scroll', closeMenu, true)
        window.addEventListener('keydown', closeOnEscape)
        return () => {
            window.removeEventListener('pointerdown', closeMenu)
            window.removeEventListener('scroll', closeMenu, true)
            window.removeEventListener('keydown', closeOnEscape)
        }
    }, [productContextMenu])

    useEffect(() => {
        const frame = window.requestAnimationFrame(() => {
            setProducts(initialProducts)
            setCheckedIds(new Set())
            setModifiedCnyCosts({})
            setModifiedUsdCosts({})
            setModifiedCosts({})
            setModifiedWholesales({})
            setModifiedRetails({})
            setModifiedStocks({})
            setModifiedMoqs({})
            setModifiedOrderUnits({})
            setCollapsedGroupKeys(new Set())
            setSelectedGroupKey(null)
            setDraggingProductId(null)
            setProductContextMenu(null)
        })
        return () => window.cancelAnimationFrame(frame)
    }, [initialProducts])

    const categoryCounts = useMemo(() => {
        const counts = Object.fromEntries(
            PRODUCT_CATALOG_CATEGORIES.map(category => [category, 0]),
        ) as Record<ProductCatalogCategory, number>
        products.forEach(product => {
            counts[classifyProductCatalogCategory(product)] += 1
        })
        return counts
    }, [products])

    const filteredProducts = useMemo(() => {
        const query = productQuery.trim().toLocaleLowerCase('ko-KR')
        return products.filter(product => {
            if (classifyProductCatalogCategory(product) !== activeCategory) return false
            if (query && !getProductSearchText(product).includes(query)) return false
            if (availabilityFilter === 'available' && product.wholesaleAvailable === false) return false
            if (availabilityFilter === 'unavailable' && product.wholesaleAvailable !== false) return false
            if (stockFilter === 'stocked' && getProductStock(product) <= 0) return false
            if (stockFilter === 'empty' && getProductStock(product) > 0) return false
            return true
        })
    }, [activeCategory, availabilityFilter, productQuery, products, stockFilter])

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
                isManuallyUngrouped: product.autoGroupingDisabled === true,
                source,
                products: [product],
            })
        })
        const grouped = Array.from(groups.values())
        return [
            ...grouped.filter(group => !group.isManuallyUngrouped),
            ...grouped.filter(group => group.isManuallyUngrouped),
        ]
    }, [filteredProducts])

    const visibleProductIds = useMemo(() => filteredProducts.map(product => product.id), [filteredProducts])
    const checkedVisibleCount = visibleProductIds.filter(id => checkedIds.has(id)).length
    const namedGroupKeys = useMemo(() => productGroups.filter(group => group.isNamed).map(group => group.key), [productGroups])
    const collapsedNamedGroupCount = namedGroupKeys.filter(key => collapsedGroupKeys.has(key)).length
    const manuallyUngroupedCount = useMemo(
        () => productGroups.reduce((count, group) => count + (group.isManuallyUngrouped ? group.products.length : 0), 0),
        [productGroups],
    )
    const firstManuallyUngroupedIndex = useMemo(
        () => productGroups.findIndex(group => group.isManuallyUngrouped),
        [productGroups],
    )
    const selectedGroup = useMemo(
        () => selectedGroupKey ? productGroups.find(group => group.key === selectedGroupKey) || null : null,
        [productGroups, selectedGroupKey],
    )
    const contextMenuProduct = useMemo(
        () => productContextMenu ? products.find(product => product.id === productContextMenu.productId) || null : null,
        [productContextMenu, products],
    )
    const groupKeyByProductId = useMemo(() => {
        const result = new Map<string, string>()
        productGroups.forEach(group => {
            group.products.forEach(product => result.set(product.id, group.key))
        })
        return result
    }, [productGroups])
    const groupOrderByProductId = useMemo(() => {
        const result = new Map<string, number>()
        productGroups.forEach(group => {
            group.products.forEach((product, index) => result.set(product.id, index + 1))
        })
        return result
    }, [productGroups])
    const visibleColumnOptions = useMemo(
        () => PRODUCT_TABLE_COLUMN_OPTIONS.filter(option => visibleColumns.includes(option.key)),
        [visibleColumns],
    )
    const productTableColumnCount = 5 + visibleColumnOptions.length
    const productTableWidth = Math.max(
        920,
        FIXED_PRODUCT_TABLE_WIDTH + visibleColumnOptions.reduce((sum, option) => sum + option.width, 0),
    )
    const hasActiveFilters = Boolean(productQuery.trim()) || availabilityFilter !== 'all' || stockFilter !== 'all'

    const handleCategoryChange = useCallback((category: ProductCatalogCategory) => {
        setActiveCategory(category)
        setCollapsedGroupKeys(new Set())
        setSelectedGroupKey(null)
        setDraggingProductId(null)
    }, [])

    const saveOrder = useCallback((productIds: string[], startOrder = 0) => {
        const queuedSave = orderSaveQueueRef.current.then(async () => {
            const response = await fetch('/api/products/reorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productIds, startOrder })
            })

            if (!response.ok) {
                const data = await response.json().catch(() => null)
                throw new Error(data?.error || '상품 순서를 저장하지 못했습니다.')
            }
        })

        orderSaveQueueRef.current = queuedSave.catch(error => {
            console.error(error)
            alert(error instanceof Error ? error.message : '상품 순서를 저장하지 못했습니다.')
            router.refresh()
        })

        return orderSaveQueueRef.current
    }, [router])

    const handleGroupOrderChange = useCallback((productId: string, newIndex: number) => {
        const group = productGroups.find(item => item.products.some(product => product.id === productId))
        if (!group || group.products.length < 2) return

        const oldIndex = group.products.findIndex(product => product.id === productId)
        const clampedIndex = Math.max(0, Math.min(newIndex, group.products.length - 1))
        if (oldIndex === clampedIndex) return

        const reorderedGroup = [...group.products]
        const [movedProduct] = reorderedGroup.splice(oldIndex, 1)
        if (!movedProduct) return
        reorderedGroup.splice(clampedIndex, 0, movedProduct)

        const groupIds = new Set(group.products.map(product => product.id))
        let groupCursor = 0
        const newItems = products.map(product => (
            groupIds.has(product.id) ? reorderedGroup[groupCursor++] || product : product
        ))
        const changedIndices = newItems
            .map((product, index) => groupIds.has(product.id) ? index : -1)
            .filter(index => index >= 0)
        const changedRangeStart = Math.min(...changedIndices)
        const changedRangeEnd = Math.max(...changedIndices)

        setProducts(newItems)
        void saveOrder(
            newItems.slice(changedRangeStart, changedRangeEnd + 1).map(product => product.id),
            changedRangeStart,
        )
    }, [productGroups, products, saveOrder])

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
        window.setTimeout(() => {
            document.getElementById(`product-row-${productId}`)?.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            })
        }, 50)
    }, [patchProductGroups])

    const handleRestoreAutoGroup = useCallback((productId: string) => {
        const product = products.find(item => item.id === productId)
        const restoredGroup = product ? inferProductGroup({ ...product, groupName: null, autoGroupingDisabled: false }) : null
        setSelectedGroupKey(restoredGroup?.key || `single:${productId}`)
        void patchProductGroups([{ id: productId, groupName: null, autoGroupingDisabled: false }])
    }, [patchProductGroups, products])

    const handleOpenProductContextMenu = useCallback((productId: string, x: number, y: number) => {
        setProductContextMenu({
            productId,
            x: Math.max(8, Math.min(x, window.innerWidth - 248)),
            y: Math.max(8, Math.min(y, window.innerHeight - 210)),
        })
    }, [])

    const handlePurchaseCurrencyChange = useCallback(async (productId: string, purchaseCurrency: PurchaseCurrency) => {
        const previousProduct = products.find(product => product.id === productId)
        if (!previousProduct || getPurchaseCurrency(previousProduct) === purchaseCurrency) {
            setProductContextMenu(null)
            return
        }

        setProductContextMenu(null)
        setProducts(current => current.map(product => (
            product.id === productId ? { ...product, purchaseCurrency } : product
        )))
        const key = draftKey(activeGrade, productId)
        const foreignValue = purchaseCurrency === 'USD'
            ? modifiedUsdCosts[key] ?? previousProduct.usdPurchasePrice
            : modifiedCnyCosts[key] ?? previousProduct.cnyBuyPrice
        const rate = purchaseCurrency === 'USD' ? usdKrwRate : cnyKrwRate
        if (rate && Number(foreignValue) > 0) {
            setModifiedCosts(current => ({
                ...current,
                [key]: String(Math.round(Number(foreignValue) * rate)),
            }))
            setCheckedIds(current => {
                if (current.has(productId)) return current
                const next = new Set(current)
                next.add(productId)
                return next
            })
        }
        try {
            const response = await fetch(`/api/products/${productId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ purchaseCurrency }),
            })
            if (!response.ok) throw new Error('매입 통화 저장 실패')
        } catch (error) {
            console.error(error)
            setProducts(current => current.map(product => (
                product.id === productId ? previousProduct : product
            )))
            alert('매입 통화를 저장하지 못했습니다.')
        }
    }, [activeGrade, cnyKrwRate, modifiedCnyCosts, modifiedUsdCosts, products, usdKrwRate])

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

    const toggleVisibleColumn = useCallback((column: ProductTableColumnKey) => {
        setVisibleColumns(current => {
            const selected = new Set(current)
            if (selected.has(column)) selected.delete(column)
            else selected.add(column)
            return PRODUCT_TABLE_COLUMN_OPTIONS
                .map(option => option.key)
                .filter(key => selected.has(key))
        })
    }, [])

    const resetVisibleColumns = useCallback(() => {
        setVisibleColumns([...DEFAULT_PRODUCT_TABLE_COLUMNS])
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

    const handleForeignCostChange = useCallback((id: string, currency: PurchaseCurrency, val: string) => {
        const key = draftKey(activeGrade, id)
        if (currency === 'USD') setModifiedUsdCosts(prev => ({ ...prev, [key]: val }))
        else setModifiedCnyCosts(prev => ({ ...prev, [key]: val }))

        const rate = currency === 'USD' ? usdKrwRate : cnyKrwRate
        if (rate) {
            const convertedKrw = val === '' ? '' : String(Math.round(parseNumericDraft(val) * rate))
            setModifiedCosts(prev => ({ ...prev, [key]: convertedKrw }))
        }
        ensureProductChecked(id)
    }, [activeGrade, cnyKrwRate, ensureProductChecked, usdKrwRate])

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
                modifiedCnyCosts[draftKey(grade, id)] !== undefined
                || modifiedUsdCosts[draftKey(grade, id)] !== undefined
                || modifiedCosts[draftKey(grade, id)] !== undefined
                || modifiedWholesales[draftKey(grade, id)] !== undefined
                || modifiedRetails[draftKey(grade, id)] !== undefined
                || modifiedMoqs[draftKey(grade, id)] !== undefined
                || modifiedOrderUnits[draftKey(grade, id)] !== undefined
            ))
        ))
        const changedProductIds = new Set(Array.from(checkedIds).filter(id => (
            modifiedStocks[id] !== undefined
            || changedGrades.some(grade => (
                modifiedCnyCosts[draftKey(grade, id)] !== undefined
                || modifiedUsdCosts[draftKey(grade, id)] !== undefined
                || modifiedCosts[draftKey(grade, id)] !== undefined
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
                    const cnyCost = modifiedCnyCosts[key]
                    const usdCost = modifiedUsdCosts[key]
                    const cost = modifiedCosts[key]
                    const wholesale = modifiedWholesales[key]
                    const retail = modifiedRetails[key]
                    const moq = modifiedMoqs[key]
                    const orderUnit = modifiedOrderUnits[key]
                    if ([cnyCost, usdCost, cost, wholesale, retail, moq, orderUnit].every(value => value === undefined)) return []

                    const product = products.find(item => item.id === id)
                    const purchaseCurrency = product ? getPurchaseCurrency(product) : 'CNY'

                    return [{
                        id,
                        purchaseCurrency,
                        ...(cnyCost !== undefined ? { cnyCost: Math.max(0, parseNumericDraft(cnyCost)) } : {}),
                        ...(usdCost !== undefined ? { usdCost: Math.max(0, parseNumericDraft(usdCost)) } : {}),
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
                    const cnyCostDraft = modifiedCnyCosts[draftKey(grade, product.id)]
                    const usdCostDraft = modifiedUsdCosts[draftKey(grade, product.id)]
                    const costDraft = modifiedCosts[draftKey(grade, product.id)]
                    const wholesaleDraft = modifiedWholesales[draftKey(grade, product.id)]
                    const retailDraft = modifiedRetails[draftKey(grade, product.id)]
                    const moqDraft = modifiedMoqs[draftKey(grade, product.id)]
                    const orderUnitDraft = modifiedOrderUnits[draftKey(grade, product.id)]
                    if (cnyCostDraft !== undefined && grade === 'C') {
                        nextProduct.cnyBuyPrice = Math.max(0, parseNumericDraft(cnyCostDraft))
                    }
                    if (usdCostDraft !== undefined && grade === 'C') {
                        nextProduct.usdPurchasePrice = Math.max(0, parseNumericDraft(usdCostDraft))
                    }
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
            setModifiedCnyCosts({})
            setModifiedUsdCosts({})
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
        <div
            className="ux-panel w-full overflow-hidden"
            style={{ maxWidth: productTableWidth + (selectedGroup ? 310 : 0) }}
        >
            <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur-xl sm:px-6 lg:px-8">
                <div className="flex min-h-14 flex-col gap-2 xl:flex-row xl:items-center">
                    <div className="flex shrink-0 items-center gap-2">
                        <Link href="/admin" className="inline-flex h-9 w-9 items-center justify-center rounded-full text-blue-600 transition hover:bg-blue-50" title="관리자 홈">
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        </Link>
                        <h1 className="whitespace-nowrap text-lg font-black text-slate-950">상품 관리</h1>
                        <span className="whitespace-nowrap rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">전체 {formatInteger(products.length)}개</span>
                        <span className="hidden whitespace-nowrap rounded-full bg-blue-50 px-2 py-1 text-[10px] font-black text-blue-700 2xl:inline">{PRODUCT_CATALOG_CATEGORY_LABELS[activeCategory]} {formatInteger(filteredProducts.length)}개 표시</span>
                    </div>

                    <nav className="grid min-w-0 flex-1 grid-cols-2 gap-1 rounded-lg bg-slate-50 p-1 sm:grid-cols-4 xl:mx-4" aria-label="상품 분류">
                        {PRODUCT_CATALOG_CATEGORIES.map(category => (
                            <button
                                key={category}
                                type="button"
                                onClick={() => handleCategoryChange(category)}
                                className={`flex h-9 min-w-0 items-center justify-center gap-2 rounded-md px-2 text-[11px] font-black transition ${activeCategory === category ? 'bg-blue-700 text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-slate-950'}`}
                            >
                                <span className="truncate">{PRODUCT_CATALOG_CATEGORY_LABELS[category]}</span>
                                <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] tabular-nums ${activeCategory === category ? 'bg-white/20 text-white' : 'bg-white text-slate-500'}`}>{formatInteger(categoryCounts[category])}</span>
                            </button>
                        ))}
                    </nav>

                    <div className="shrink-0 self-end xl:self-auto"><ProductForm /></div>
                </div>
            </header>

            <div className="border-b border-slate-100 bg-white px-3 py-2 sm:px-6">
                <div className="flex flex-col gap-2 2xl:flex-row 2xl:items-center 2xl:justify-between">
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
                        <div
                            className={`flex h-10 items-center gap-2 rounded-xl border px-3 text-[11px] font-black ${cnyRateError ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-red-100 bg-red-50 text-red-800'}`}
                            title={cnyRateUpdatedAt ? `환율 갱신: ${new Date(cnyRateUpdatedAt).toLocaleString('ko-KR')}` : '매입 통화 환율'}
                        >
                            <span className="text-red-600">CN¥ 1</span>
                            <span className="text-slate-400">=</span>
                            <span className="tabular-nums">
                                {cnyKrwRate ? `₩${cnyKrwRate.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}` : isCnyRateLoading ? '불러오는 중' : '조회 실패'}
                            </span>
                            <span className="h-4 border-l border-slate-200" />
                            <span className="text-blue-600">US$ 1</span>
                            <span className="text-slate-400">=</span>
                            <span className="tabular-nums">
                                {usdKrwRate ? `₩${usdKrwRate.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}` : isCnyRateLoading ? '불러오는 중' : '조회 실패'}
                            </span>
                            <button
                                type="button"
                                onClick={() => void loadCnyRate()}
                                disabled={isCnyRateLoading}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-500 transition hover:bg-white hover:text-red-600 disabled:opacity-50"
                                title="환율 새로고침"
                            >
                                <RefreshCw size={13} className={isCnyRateLoading ? 'animate-spin' : ''} />
                            </button>
                        </div>
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
                        <div ref={columnSettingsRef} className="relative">
                            <button
                                type="button"
                                onClick={() => setColumnSettingsOpen(open => !open)}
                                className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[11px] font-black transition ${columnSettingsOpen ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                                aria-expanded={columnSettingsOpen}
                            >
                                <SlidersHorizontal size={14} />
                                표시 열 설정
                            </button>
                            {columnSettingsOpen ? (
                                <div className="absolute left-0 top-11 z-50 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
                                    <div className="border-b border-slate-100 px-4 py-3 text-[12px] font-black text-slate-950">표시할 열</div>
                                    <div className="max-h-[420px] overflow-y-auto p-2">
                                        {['상품번호', '그룹순서', '이미지', '상품명'].map(label => (
                                            <div key={label} className="flex items-center justify-between rounded-md px-2 py-1.5 text-[11px] font-bold text-slate-500">
                                                <label className="flex items-center gap-2"><input type="checkbox" checked readOnly className="accent-blue-600" />{label}</label>
                                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black">고정</span>
                                            </div>
                                        ))}
                                        <div className="my-1 border-t border-slate-100" />
                                        {PRODUCT_TABLE_COLUMN_OPTIONS.map(option => (
                                            <label key={option.key} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50">
                                                <input type="checkbox" checked={visibleColumns.includes(option.key)} onChange={() => toggleVisibleColumn(option.key)} className="accent-blue-600" />
                                                {option.label}
                                            </label>
                                        ))}
                                    </div>
                                    <button type="button" onClick={resetVisibleColumns} className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-3 text-left text-[11px] font-black text-slate-600 hover:bg-slate-50"><RotateCcw size={13} />기본값으로 초기화</button>
                                </div>
                            ) : null}
                        </div>
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
            <div className={`grid min-h-[520px] ${selectedGroup ? 'xl:grid-cols-[minmax(0,1fr)_310px]' : ''}`}>
                <div className="min-w-0">
                    <div className="max-h-[calc(100vh-190px)] w-full overflow-auto pb-2" data-testid="product-table-scroll">
                <table className="table-fixed border-collapse" style={{ width: productTableWidth, minWidth: productTableWidth }}>
                    <colgroup>
                        <col className="w-[40px]" />
                        <col className="w-[68px]" />
                        <col className="w-[78px]" />
                        <col className="w-[72px]" />
                        <col className="w-[360px]" />
                        {visibleColumnOptions.map(option => <col key={option.key} style={{ width: option.width }} />)}
                    </colgroup>
                    <thead className="sticky top-0 z-30 bg-slate-900 text-white shadow-[0_2px_5px_rgba(15,23,42,0.25)]">
                        <tr>
                            <th className="px-2 py-3 text-center text-[12px] font-black whitespace-nowrap w-8">
                                <input
                                    type="checkbox"
                                    onChange={handleToggleAll}
                                    checked={visibleProductIds.length > 0 && checkedVisibleCount === visibleProductIds.length}
                                    className="cursor-pointer"
                                />
                            </th>
                            <th className="px-2 py-3 text-center text-[12px] font-black whitespace-nowrap">번호</th>
                            <th className="px-2 py-3 text-center text-[12px] font-black whitespace-nowrap">순서</th>
                            <th className="px-2 py-3 text-center text-[12px] font-black whitespace-nowrap">이미지</th>
                            <th className="px-3 py-3 text-left text-[12px] font-black whitespace-nowrap">상품명</th>
                            {visibleColumnOptions.map(option => (
                                <th key={option.key} className="px-2 py-3 text-center text-[12px] font-black whitespace-nowrap">{option.label === '재고' ? '현재고' : option.label}</th>
                            ))}
                        </tr>
                    </thead>
                    {filteredProducts.length === 0 ? (
                        <tbody className="divide-y divide-gray-100">
                            <tr>
                                <td colSpan={productTableColumnCount} className="px-6 py-12 text-center text-gray-500">
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
                                    groupOrder={groupOrderByProductId.get(product.id) ?? 1}
                                    activeGrade={activeGrade}
                                    visibleColumns={visibleColumns}
                                    onSelect={() => setSelectedGroupKey(groupKeyByProductId.get(product.id) || null)}
                                    onDragStartProduct={setDraggingProductId}
                                    onDragEndProduct={() => setDraggingProductId(null)}
                                    onGroupOrderChange={handleGroupOrderChange}
                                    onDelete={handleDelete}
                                    onUngroup={handleUngroupProduct}
                                    onRestoreAutoGroup={handleRestoreAutoGroup}
                                    checked={checkedIds.has(product.id)}
                                    onToggleCheck={handleToggleCheck}
                                    modifiedCost={modifiedCosts[draftKey(activeGrade, product.id)]}
                                    onCostChange={handleCostChange}
                                    modifiedCnyCost={modifiedCnyCosts[draftKey(activeGrade, product.id)]}
                                    modifiedUsdCost={modifiedUsdCosts[draftKey(activeGrade, product.id)]}
                                    onForeignCostChange={handleForeignCostChange}
                                    cnyRateAvailable={Boolean(cnyKrwRate)}
                                    usdRateAvailable={Boolean(usdKrwRate)}
                                    onOpenContextMenu={handleOpenProductContextMenu}
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
                        productGroups.map((group, groupIndex) => {
                            const expanded = !group.isNamed || !collapsedGroupKeys.has(group.key)
                            const checkedCount = group.products.filter(product => checkedIds.has(product.id)).length
                            return (
                                <Fragment key={group.key}>
                                    {groupIndex === firstManuallyUngroupedIndex ? (
                                        <tbody>
                                            <tr className="border-y border-amber-200 bg-amber-100/80">
                                                <td colSpan={productTableColumnCount} className="px-4 py-3">
                                                    <div className="flex items-center gap-2 text-left">
                                                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-amber-200 bg-white text-amber-700">
                                                            <Unlink size={14} />
                                                        </span>
                                                        <div>
                                                            <div className="text-[13px] font-black text-amber-950">단일 SKU</div>
                                                            <div className="text-[10px] font-bold text-amber-700">그룹에서 분리한 상품 {formatInteger(manuallyUngroupedCount)}개</div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        </tbody>
                                    ) : null}
                                    {group.isNamed ? (
                                        <tbody>
                                            <ProductGroupHeader
                                                group={group}
                                                expanded={expanded}
                                                checkedCount={checkedCount}
                                                selected={selectedGroup?.key === group.key}
                                                canDrop={Boolean(draggingProductId && !group.products.some(product => product.id === draggingProductId))}
                                                columnCount={productTableColumnCount}
                                                onToggle={() => toggleGroup(group.key)}
                                                onToggleCheck={() => handleToggleGroupCheck(group.products.map(product => product.id))}
                                                onSelect={() => setSelectedGroupKey(group.key)}
                                                onDropProduct={(productId) => handleDropProductToGroup(productId, group)}
                                            />
                                        </tbody>
                                    ) : null}
                                    <tbody className="divide-y divide-gray-100" hidden={group.isNamed && !expanded}>
                                        {group.products.map((product, groupIndex) => (
                                            <ProductRow
                                                key={product.id}
                                                product={product}
                                                displayName={group.isNamed
                                                    ? getGroupedSkuLabel({
                                                        productName: product.name,
                                                        groupName: group.name,
                                                        productCode: product.productCode,
                                                    })
                                                    : product.name}
                                                groupOrder={groupIndex + 1}
                                                activeGrade={activeGrade}
                                                visibleColumns={visibleColumns}
                                                onSelect={() => setSelectedGroupKey(group.key)}
                                                onDragStartProduct={setDraggingProductId}
                                                onDragEndProduct={() => setDraggingProductId(null)}
                                                onGroupOrderChange={handleGroupOrderChange}
                                                onDelete={handleDelete}
                                                onUngroup={handleUngroupProduct}
                                                onRestoreAutoGroup={handleRestoreAutoGroup}
                                                checked={checkedIds.has(product.id)}
                                                onToggleCheck={handleToggleCheck}
                                                modifiedCost={modifiedCosts[draftKey(activeGrade, product.id)]}
                                                onCostChange={handleCostChange}
                                                modifiedCnyCost={modifiedCnyCosts[draftKey(activeGrade, product.id)]}
                                                modifiedUsdCost={modifiedUsdCosts[draftKey(activeGrade, product.id)]}
                                                onForeignCostChange={handleForeignCostChange}
                                                cnyRateAvailable={Boolean(cnyKrwRate)}
                                                usdRateAvailable={Boolean(usdKrwRate)}
                                                onOpenContextMenu={handleOpenProductContextMenu}
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
            </div>
            {selectedGroup ? (
                <ProductSummaryPanel
                    group={selectedGroup}
                    activeGrade={activeGrade}
                    onClose={() => setSelectedGroupKey(null)}
                />
            ) : null}
            </div>
            {productContextMenu && contextMenuProduct ? (
                <div
                    role="menu"
                    aria-label={`${contextMenuProduct.name} 빠른 메뉴`}
                    onPointerDown={(event) => event.stopPropagation()}
                    className="fixed z-[100] w-60 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
                    style={{ left: productContextMenu.x, top: productContextMenu.y }}
                >
                    <div className="border-b border-slate-100 px-3 py-2.5">
                        <div className="truncate text-[12px] font-black text-slate-950">{contextMenuProduct.name}</div>
                        <div className="mt-0.5 text-[10px] font-bold text-slate-500">매입 통화 선택</div>
                    </div>
                    <div className="p-1.5">
                        {(['CNY', 'USD'] as PurchaseCurrency[]).map(currency => {
                            const active = getPurchaseCurrency(contextMenuProduct) === currency
                            return (
                                <button
                                    key={currency}
                                    type="button"
                                    role="menuitemradio"
                                    aria-checked={active}
                                    onClick={() => void handlePurchaseCurrencyChange(contextMenuProduct.id, currency)}
                                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-[12px] font-black transition ${active ? 'bg-blue-50 text-blue-800' : 'text-slate-700 hover:bg-slate-50'}`}
                                >
                                    <span>{currency === 'CNY' ? '중국 위안 (CNY)' : '미국 달러 (USD)'}</span>
                                    {active ? <Check size={15} /> : null}
                                </button>
                            )
                        })}
                    </div>
                    <div className="border-t border-slate-100 p-1.5">
                        <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                                setProductContextMenu(null)
                                if (contextMenuProduct.autoGroupingDisabled) handleRestoreAutoGroup(contextMenuProduct.id)
                                else handleUngroupProduct(contextMenuProduct.id)
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[12px] font-black text-amber-700 transition hover:bg-amber-50"
                        >
                            {contextMenuProduct.autoGroupingDisabled ? <RotateCcw size={15} /> : <Unlink size={15} />}
                            {contextMenuProduct.autoGroupingDisabled ? '자동 그룹으로 복귀' : '그룹 해제 · 단일 SKU'}
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    )
}
