'use client'

import { Fragment, useMemo, useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Layers } from 'lucide-react'
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    type Modifier
} from '@dnd-kit/core'
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ProductForm, { type Product as ProductTableProduct } from "./product-form"
import ProductStockHistoryModal from './ProductStockHistoryModal'
import BarcodeDisplay from "@/components/BarcodeDisplay"
import { useRouter } from 'next/navigation'
import {
    PRODUCT_GRADES,
    readProductGradeOrderValue,
    readProductGradePriceValue,
    setProductGradeOrderValue,
    setProductGradePriceValue,
    type ProductGrade,
} from '@/lib/productGradePricing'

const restrictToVerticalDrag: Modifier = ({ transform }) => ({
    ...transform,
    x: 0,
})

const draftKey = (grade: ProductGrade, productId: string) => `${grade}:${productId}`
const PRODUCT_TABLE_WIDTH = 1920
const PRODUCT_TABLE_COLS = 18

const normalizeGroupName = (value?: string | null) => String(value || '').trim()
const normalizeGroupKey = (value: string) => value.toLocaleLowerCase('ko-KR').replace(/\s+/g, ' ').trim()
const normalizeProductCode = (value?: string | null) => String(value || '').trim().toUpperCase()
const inferProductGroup = (product: ProductTableProduct) => {
    const manualName = normalizeGroupName(product.groupName)
    if (manualName) {
        return { key: `manual:${normalizeGroupKey(manualName)}`, name: manualName, source: '직접 그룹' as const }
    }

    const productName = normalizeGroupName(product.name)
    const colonBase = productName.split(/\s*[:：]\s*/)[0]?.trim()
    if (colonBase && colonBase !== productName && colonBase.length >= 4) {
        return { key: `name:${normalizeGroupKey(colonBase)}`, name: colonBase, source: '자동 그룹' as const }
    }

    const seriesMatch = productName.match(/^(.+?시리즈\s*\d+)/i)
    if (seriesMatch?.[1]) {
        const name = seriesMatch[1].trim()
        return { key: `name:${normalizeGroupKey(name)}`, name, source: '자동 그룹' as const }
    }

    const versionMatch = productName.match(/^(.+?V\s*\d+)/i)
    if (versionMatch?.[1]) {
        const name = versionMatch[1].replace(/\s+V\s*/i, 'V').trim()
        return { key: `name:${normalizeGroupKey(name)}`, name, source: '자동 그룹' as const }
    }

    const productCode = normalizeProductCode(product.productCode)
    const codeParts = productCode.split('-').filter(Boolean)
    if (codeParts.length >= 3 && /^\d+[A-Z]*$/i.test(codeParts[codeParts.length - 1] || '')) {
        const name = codeParts.slice(0, -1).join('-')
        return { key: `code:${name}`, name, source: '자동 그룹' as const }
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
    index: number
    activeGrade: ProductGrade
    onSortOrderChange: (productId: string, newOrder: number) => void
    onDelete: (productId: string) => void
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

function SortableProductRow({ product, index, activeGrade, onSortOrderChange, onDelete, checked, onToggleCheck, modifiedCost, onCostChange, modifiedWholesale, onWholesaleChange, modifiedRetail, onRetailChange, modifiedStock, onStockChange, modifiedMoq, onMoqChange, modifiedOrderUnit, onOrderUnitChange, onToggleOrderAvailability }: ProductRowProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: product.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        opacity: isDragging ? 0.5 : 1,
    }
    const dragHandleStyle = {
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
    } as const

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
            ref={setNodeRef}
            style={style}
            className={`text-[11px] border-b border-gray-100 hover:bg-gray-50 transition-colors group ${isDragging ? 'bg-blue-50' : ''} ${checked ? 'bg-blue-50/30' : ''}`}
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
                <div
                    {...attributes}
                    {...listeners}
                    style={dragHandleStyle}
                    className="cursor-grab active:cursor-grabbing p-1 text-gray-300 hover:text-gray-600"
                >
                    ⠿
                </div>
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
                                <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
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
                            {product.groupName && (
                                <div className="mt-0.5 truncate text-[10px] font-bold text-indigo-500">그룹: {product.groupName}</div>
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
                <BarcodeDisplay value={product.barcode} />
            </td>
            <td className="px-2 py-1.5 text-center whitespace-nowrap">
                <div className="flex items-center justify-center gap-1">
                    <ProductForm
                        initialData={product}
                        trigger={
                            <button className="bg-gray-50 text-gray-500 hover:bg-[var(--color-brand-blue)] hover:text-white px-2 py-1 rounded text-[10px] font-bold transition-all border border-gray-200 hover:border-transparent">수정</button>
                        }
                    />
                    <ProductForm
                        initialData={product}
                        isCopy={true}
                        trigger={
                            <button className="bg-gray-50 text-blue-600 hover:bg-blue-600 hover:text-white px-2 py-1 rounded text-[10px] font-bold transition-all border border-blue-100 hover:border-transparent">복사</button>
                        }
                    />
                    <button
                        onClick={() => onDelete(product.id)}
                        className="bg-gray-50 text-red-500 hover:bg-red-500 hover:text-white px-2 py-1 rounded text-[10px] font-bold transition-all border border-red-100 hover:border-transparent"
                    >
                        삭제
                    </button>
                </div>
            </td>
        </tr>
    )
}

type ProductGroupView = {
    key: string
    name: string
    isNamed: boolean
    source: '직접 그룹' | '자동 그룹' | '단일 상품'
    products: ProductTableProduct[]
}

function ProductGroupHeader({
    group,
    expanded,
    checkedCount,
    onToggle,
    onToggleCheck,
}: {
    group: ProductGroupView
    expanded: boolean
    checkedCount: number
    onToggle: () => void
    onToggleCheck: () => void
}) {
    const totalStock = group.products.reduce((sum, product) => sum + Math.max(0, Number(product.stock) || 0), 0)
    const representative = group.products[0]

    return (
        <tr className="border-b border-indigo-100 bg-indigo-50/70">
            <td colSpan={PRODUCT_TABLE_COLS} className="px-3 py-2">
                <div className="flex min-w-0 items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                        <input
                            type="checkbox"
                            checked={checkedCount === group.products.length}
                            onChange={onToggleCheck}
                            className="cursor-pointer"
                            title="그룹 SKU 전체 선택"
                        />
                        <button
                            type="button"
                            onClick={onToggle}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-indigo-200 bg-white text-indigo-700 transition hover:bg-indigo-100"
                            title={expanded ? '그룹 접기' : '그룹 펼치기'}
                        >
                            {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        </button>
                        {representative?.imageUrl ? (
                            <img src={representative.imageUrl} alt={group.name} className="h-8 w-8 rounded border border-indigo-100 bg-white object-cover" />
                        ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded border border-indigo-100 bg-white text-indigo-300">
                                <Layers size={15} />
                            </div>
                        )}
                        <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                                <span className="truncate text-[12px] font-black text-indigo-950">상품 그룹 · {group.name}</span>
                                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-indigo-600">{group.products.length} SKU</span>
                                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-black text-indigo-500">{group.source}</span>
                            </div>
                            <div className="mt-0.5 text-[10px] font-bold text-indigo-500">
                                그룹을 누르면 SKU 목록을 접고 펼칩니다.
                            </div>
                        </div>
                    </div>
                    <div className="shrink-0 rounded-lg border border-emerald-200 bg-white px-3 py-1 text-right">
                        <div className="text-[9px] font-black text-emerald-600">관리용 재고 합계</div>
                        <div className="text-[13px] font-black tabular-nums text-emerald-700">{formatInteger(totalStock)}</div>
                    </div>
                </div>
            </td>
        </tr>
    )
}

export default function ProductTable({ initialProducts }: { initialProducts: ProductTableProduct[] }) {
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
    const [isSaving, setIsSaving] = useState(false)
    const router = useRouter()

    useEffect(() => {
        setProducts(initialProducts)
    }, [initialProducts])

    const productGroups = useMemo<ProductGroupView[]>(() => {
        const inferred = products.map(product => ({ product, candidate: inferProductGroup(product) }))
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
    }, [products])

    const visibleProducts = useMemo(
        () => productGroups.flatMap(group => (group.isNamed && collapsedGroupKeys.has(group.key)) ? [] : group.products),
        [productGroups, collapsedGroupKeys],
    )
    const productIndexById = useMemo(
        () => new Map(products.map((product, index) => [product.id, index])),
        [products],
    )

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event

        if (over && active.id !== over.id) {
            setProducts((items) => {
                const oldIndex = items.findIndex((i) => i.id === active.id)
                const newIndex = items.findIndex((i) => i.id === over.id)
                const newItems = arrayMove(items, oldIndex, newIndex)

                // Call API to save order
                saveOrder(newItems.map(item => item.id))

                return newItems
            })
        }
    }

    const saveOrder = async (productIds: string[]) => {
        try {
            await fetch('/api/products/reorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productIds })
            })
            // router.refresh() // Optional: Refresh to sync server state
        } catch (e) {
            console.error(e)
            alert("Failed to save product order")
        }
    }

    const onSortOrderChange = async (productId: string, newIndex: number) => {
        // ... (existing code)
        const clampedIndex = Math.max(0, Math.min(newIndex, products.length - 1))
        const oldIndex = products.findIndex(p => p.id === productId)
        if (oldIndex === clampedIndex) return
        const newItems = arrayMove(products, oldIndex, clampedIndex)
        setProducts(newItems)
        saveOrder(newItems.map(item => item.id))
    }

    const handleDelete = async (id: string) => {
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
    }

    const handleToggleCheck = (id: string) => {
        const next = new Set(checkedIds)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setCheckedIds(next)
    }

    const handleToggleAll = () => {
        if (checkedIds.size === products.length) setCheckedIds(new Set())
        else setCheckedIds(new Set(products.map(p => p.id)))
    }

    const handleToggleGroupCheck = (ids: string[]) => {
        setCheckedIds(current => {
            const allChecked = ids.every(id => current.has(id))
            const next = new Set(current)
            ids.forEach(id => {
                if (allChecked) next.delete(id)
                else next.add(id)
            })
            return next
        })
    }

    const toggleGroup = (key: string) => {
        setCollapsedGroupKeys(current => {
            const next = new Set(current)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }

    const ensureProductChecked = (id: string) => {
        setCheckedIds(current => {
            if (current.has(id)) return current
            const next = new Set(current)
            next.add(id)
            return next
        })
    }

    const handleCostChange = (id: string, val: string) => {
        setModifiedCosts(prev => ({ ...prev, [draftKey(activeGrade, id)]: val }))
        ensureProductChecked(id)
    }

    const handleWholesaleChange = (id: string, val: string) => {
        setModifiedWholesales(prev => ({ ...prev, [draftKey(activeGrade, id)]: val }))
        ensureProductChecked(id)
    }

    const handleRetailChange = (id: string, val: string) => {
        setModifiedRetails(prev => ({ ...prev, [draftKey(activeGrade, id)]: val }))
        ensureProductChecked(id)
    }

    const handleStockChange = (id: string, val: string) => {
        setModifiedStocks(prev => ({ ...prev, [id]: val }))
        ensureProductChecked(id)
    }

    const handleMoqChange = (id: string, val: string) => {
        setModifiedMoqs(prev => ({ ...prev, [draftKey(activeGrade, id)]: val }))
        ensureProductChecked(id)
    }

    const handleOrderUnitChange = (id: string, val: string) => {
        setModifiedOrderUnits(prev => ({ ...prev, [draftKey(activeGrade, id)]: val }))
        ensureProductChecked(id)
    }

    const handleToggleOrderAvailability = async (id: string) => {
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
    }

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
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalDrag]}
            onDragEnd={handleDragEnd}
        >
            <div className="flex flex-col gap-3 border-b border-blue-100 bg-blue-50/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="text-xs font-black text-blue-950">등급별 발주 조건 일괄 수정</div>
                    <div className="mt-1 text-[11px] font-medium text-blue-700">
                        등급을 선택한 뒤 KR 단가·최소수량·주문단위를 수정하세요. 관리용 재고는 도매 발주와 별도로 저장됩니다.
                    </div>
                </div>
                <div className="flex items-center gap-1 rounded-xl border border-blue-200 bg-white p-1 shadow-sm">
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
                                className={`relative min-w-16 rounded-lg px-3 py-2 text-xs font-black transition ${
                                    activeGrade === grade
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'text-slate-500 hover:bg-blue-50 hover:text-blue-700'
                                }`}
                            >
                                {grade} 등급
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
            {checkedIds.size > 0 && (
                <div className="flex justify-between items-center p-2.5 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800 rounded-t-lg">
                    <span className="text-xs font-bold text-blue-800 dark:text-blue-300">{checkedIds.size}개 상품 선택됨</span>
                    <button
                        onClick={handleSaveChanges}
                        disabled={isSaving}
                        className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-sm hover:bg-blue-700 transition disabled:opacity-50"
                    >
                        {isSaving ? '저장 중...' : '수정사항 저장하기'}
                    </button>
                </div>
            )}
            <div className="w-full overflow-x-auto pb-2">
                <table className="table-fixed border-collapse" style={{ width: PRODUCT_TABLE_WIDTH, minWidth: PRODUCT_TABLE_WIDTH }}>
                    <colgroup>
                        <col className="w-[34px]" />
                        <col className="w-[34px]" />
                        <col className="w-[44px]" />
                        <col className="w-[56px]" />
                        <col className="w-[292px]" />
                        <col className="w-[92px]" />
                        <col className="w-[90px]" />
                        <col className="w-[104px]" />
                        <col className="w-[104px]" />
                        <col className="w-[104px]" />
                        <col className="w-[104px]" />
                        <col className="w-[104px]" />
                        <col className="w-[110px]" />
                        <col className="w-[126px]" />
                        <col className="w-[112px]" />
                        <col className="w-[104px]" />
                        <col className="w-[180px]" />
                        <col className="w-[126px]" />
                    </colgroup>
                    <thead className="bg-[var(--color-brand-blue)] text-white">
                        <tr>
                            <th className="px-2 py-1.5 text-center font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap w-8">
                                <input type="checkbox" onChange={handleToggleAll} checked={products.length > 0 && checkedIds.size === products.length} className="cursor-pointer" />
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
                    <tbody className="divide-y divide-gray-100">
                        <SortableContext
                            items={visibleProducts.map(p => p.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            {products.length === 0 ? (
                                <tr>
                                    <td colSpan={PRODUCT_TABLE_COLS} className="px-6 py-12 text-center text-gray-500">
                                        등록된 상품이 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                productGroups.map((group) => {
                                    const expanded = !group.isNamed || !collapsedGroupKeys.has(group.key)
                                    const checkedCount = group.products.filter(product => checkedIds.has(product.id)).length
                                    return (
                                        <Fragment key={group.key}>
                                            {group.isNamed ? (
                                                <ProductGroupHeader
                                                    group={group}
                                                    expanded={expanded}
                                                    checkedCount={checkedCount}
                                                    onToggle={() => toggleGroup(group.key)}
                                                    onToggleCheck={() => handleToggleGroupCheck(group.products.map(product => product.id))}
                                                />
                                            ) : null}
                                            {expanded ? group.products.map((product) => (
                                                <SortableProductRow
                                                    key={product.id}
                                                    product={product}
                                                    index={productIndexById.get(product.id) ?? 0}
                                                    activeGrade={activeGrade}
                                                    onSortOrderChange={onSortOrderChange}
                                                    onDelete={handleDelete}
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
                                            )) : null}
                                        </Fragment>
                                    )
                                })
                            )}
                        </SortableContext>
                    </tbody>
                </table>
            </div>
        </DndContext>
    )
}
