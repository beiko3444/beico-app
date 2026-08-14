'use client'

import { useState, useEffect } from 'react'
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
    modifiedMoq: string | undefined
    onMoqChange: (id: string, val: string) => void
    modifiedOrderUnit: string | undefined
    onOrderUnitChange: (id: string, val: string) => void
    onToggleOrderAvailability: (id: string) => void
}

function SortableProductRow({ product, index, activeGrade, onSortOrderChange, onDelete, checked, onToggleCheck, modifiedCost, onCostChange, modifiedWholesale, onWholesaleChange, modifiedRetail, onRetailChange, modifiedMoq, onMoqChange, modifiedOrderUnit, onOrderUnitChange, onToggleOrderAvailability }: ProductRowProps) {
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
    const costNumber = Number(costValue) || 0
    const wholesaleNumber = Number(wholesaleValue) || 0
    const retailNumber = Number(retailValue) || 0
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
            <td className="px-2 py-1.5 border-r border-gray-100 last:border-0 whitespace-nowrap min-w-[200px]">
                <ProductForm
                    initialData={product}
                    trigger={
                        <div className="cursor-pointer text-left">
                            <div className="font-bold text-gray-900 group-hover:text-[var(--color-brand-blue)] truncate">{product.name}</div>
                            {product.nameJP && (
                                <div className="text-[10px] text-gray-400 truncate">{product.nameJP}</div>
                            )}
                        </div>
                    }
                />
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
                    type="number"
                    min="1"
                    value={modifiedMoq !== undefined
                        ? modifiedMoq
                        : readProductGradeOrderValue(product.regionalPrices, activeGrade, 'moq', product.minOrderQuantity || 1)}
                    onChange={(e) => onMoqChange(product.id, e.target.value)}
                    className="w-12 text-center border border-gray-200 rounded py-0.5 text-[11px] focus:border-[var(--color-brand-blue)] outline-none font-bold bg-white transition-colors"
                />
            </td>
            <td className="px-2 py-1.5 border-r border-gray-100 last:border-0 text-center text-gray-800 font-bold whitespace-nowrap">
                <input
                    type="number"
                    min="1"
                    value={modifiedOrderUnit !== undefined
                        ? modifiedOrderUnit
                        : readProductGradeOrderValue(product.regionalPrices, activeGrade, 'orderUnit', product.orderUnit || 1)}
                    onChange={(e) => onOrderUnitChange(product.id, e.target.value)}
                    className="w-12 text-center border border-gray-200 rounded py-0.5 text-[11px] focus:border-[var(--color-brand-blue)] outline-none font-bold bg-white transition-colors"
                />
            </td>
            <td className="px-2 py-1.5 border-r border-gray-100 last:border-0 text-center tabular-nums text-gray-500 whitespace-nowrap">
                <input
                    type="number"
                    min="0"
                    step="any"
                    value={costValue}
                    onChange={(event) => onCostChange(product.id, event.target.value)}
                    className="w-20 rounded border border-gray-200 bg-white px-1 py-0.5 text-right text-[11px] outline-none transition-colors focus:border-blue-500"
                />
            </td>
            <td className="px-2 py-1.5 border-r border-gray-100 last:border-0 text-center tabular-nums font-bold text-[var(--color-brand-blue)] whitespace-nowrap">
                <input
                    type="number"
                    min="0"
                    step="any"
                    value={wholesaleValue}
                    onChange={(event) => onWholesaleChange(product.id, event.target.value)}
                    className="w-20 rounded border border-blue-200 bg-blue-50/40 px-1 py-0.5 text-right text-[11px] font-bold text-blue-700 outline-none transition-colors focus:border-blue-500"
                />
            </td>
            <td className="px-2 py-1.5 border-r border-gray-100 last:border-0 text-center tabular-nums font-bold text-gray-700 whitespace-nowrap">
                <input
                    type="number"
                    min="0"
                    step="any"
                    value={retailValue}
                    onChange={(event) => onRetailChange(product.id, event.target.value)}
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

export default function ProductTable({ initialProducts }: { initialProducts: ProductTableProduct[] }) {
    const [products, setProducts] = useState(initialProducts)
    const [activeGrade, setActiveGrade] = useState<ProductGrade>('C')
    const [modifiedCosts, setModifiedCosts] = useState<Record<string, string>>({})
    const [modifiedWholesales, setModifiedWholesales] = useState<Record<string, string>>({})
    const [modifiedRetails, setModifiedRetails] = useState<Record<string, string>>({})
    const [modifiedMoqs, setModifiedMoqs] = useState<Record<string, string>>({})
    const [modifiedOrderUnits, setModifiedOrderUnits] = useState<Record<string, string>>({})
    const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
    const [isSaving, setIsSaving] = useState(false)
    const router = useRouter()

    useEffect(() => {
        setProducts(initialProducts)
    }, [initialProducts])

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
            changedGrades.some(grade => (
                modifiedCosts[draftKey(grade, id)] !== undefined
                || modifiedWholesales[draftKey(grade, id)] !== undefined
                || modifiedRetails[draftKey(grade, id)] !== undefined
                || modifiedMoqs[draftKey(grade, id)] !== undefined
                || modifiedOrderUnits[draftKey(grade, id)] !== undefined
            ))
        )))

        if (changedGrades.length === 0) {
            alert('수정된 등급별 값이 없습니다.')
            return
        }
        if (!confirm(`${changedProductIds.size}개 상품의 ${changedGrades.join(', ')} 등급 수정사항을 저장하시겠습니까?`)) return

        setIsSaving(true)
        try {
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
                        ...(cost !== undefined ? { cost: Math.max(0, Number(cost) || 0) } : {}),
                        ...(wholesale !== undefined ? { wholesale: Math.max(0, Number(wholesale) || 0) } : {}),
                        ...(retail !== undefined ? { retail: Math.max(0, Number(retail) || 0) } : {}),
                        ...(moq !== undefined ? { moq: Math.max(1, parseInt(moq) || 1) } : {}),
                        ...(orderUnit !== undefined ? { orderUnit: Math.max(1, parseInt(orderUnit) || 1) } : {}),
                    }]
                })
                await postBulkUpdate('/api/products/bulk/grade-pricing', { grade, updates })
            }

            setProducts(currentProducts => currentProducts.map(product => {
                if (!changedProductIds.has(product.id)) return product
                let regionalPrices = product.regionalPrices
                let nextProduct = { ...product }

                for (const grade of changedGrades) {
                    const costDraft = modifiedCosts[draftKey(grade, product.id)]
                    const wholesaleDraft = modifiedWholesales[draftKey(grade, product.id)]
                    const retailDraft = modifiedRetails[draftKey(grade, product.id)]
                    const moqDraft = modifiedMoqs[draftKey(grade, product.id)]
                    const orderUnitDraft = modifiedOrderUnits[draftKey(grade, product.id)]
                    if (costDraft !== undefined) {
                        const cost = Math.max(0, Number(costDraft) || 0)
                        regionalPrices = setProductGradePriceValue(regionalPrices, grade, 'cost', cost)
                        if (grade === 'C') nextProduct.buyPrice = cost
                    }
                    if (wholesaleDraft !== undefined) {
                        const wholesale = Math.max(0, Number(wholesaleDraft) || 0)
                        regionalPrices = setProductGradePriceValue(regionalPrices, grade, 'wholesale', wholesale)
                        nextProduct = { ...nextProduct, [`price${grade}`]: wholesale }
                        if (grade === 'C') nextProduct.sellPrice = wholesale
                    }
                    if (retailDraft !== undefined) {
                        const retail = Math.max(0, Number(retailDraft) || 0)
                        regionalPrices = setProductGradePriceValue(regionalPrices, grade, 'retail', retail)
                        if (grade === 'C') nextProduct.onlinePrice = retail
                    }
                    if (moqDraft !== undefined) {
                        regionalPrices = setProductGradeOrderValue(regionalPrices, grade, 'moq', parseInt(moqDraft))
                        if (grade === 'C') nextProduct.minOrderQuantity = Math.max(1, parseInt(moqDraft) || 1)
                    }
                    if (orderUnitDraft !== undefined) {
                        regionalPrices = setProductGradeOrderValue(regionalPrices, grade, 'orderUnit', parseInt(orderUnitDraft))
                        if (grade === 'C') nextProduct.orderUnit = Math.max(1, parseInt(orderUnitDraft) || 1)
                    }
                }

                return { ...nextProduct, regionalPrices }
            }))
            alert('저장되었습니다.')
            setCheckedIds(new Set())
            setModifiedCosts({})
            setModifiedWholesales({})
            setModifiedRetails({})
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
                        등급을 선택한 뒤 KR 단가·최소수량·주문단위를 수정하세요. 다른 등급 값은 변경되지 않습니다.
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
            <div className="overflow-x-auto w-full pb-2">
                <table className="w-full table-auto min-w-max border-collapse">
                    <thead className="bg-[var(--color-brand-blue)] text-white">
                        <tr>
                            <th className="px-2 py-1.5 text-center font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap w-8">
                                <input type="checkbox" onChange={handleToggleAll} checked={products.length > 0 && checkedIds.size === products.length} className="cursor-pointer" />
                            </th>
                            <th className="px-2 py-1.5 text-center font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap w-8">순서</th>
                            <th className="px-2 py-1.5 text-center font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap w-8">No</th>
                            <th className="px-2 py-1.5 text-center font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap">이미지</th>
                            <th className="px-2 py-1.5 text-center font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap">상품명</th>
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
                            items={products.map(p => p.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            {products.length === 0 ? (
                                <tr>
                                    <td colSpan={17} className="px-6 py-12 text-center text-gray-500">
                                        등록된 상품이 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                products.map((product, index) => (
                                    <SortableProductRow
                                        key={product.id}
                                        product={product}
                                        index={index}
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
                                        modifiedMoq={modifiedMoqs[draftKey(activeGrade, product.id)]}
                                        onMoqChange={handleMoqChange}
                                        modifiedOrderUnit={modifiedOrderUnits[draftKey(activeGrade, product.id)]}
                                        onOrderUnitChange={handleOrderUnitChange}
                                        onToggleOrderAvailability={handleToggleOrderAvailability}
                                    />
                                ))
                            )}
                        </SortableContext>
                    </tbody>
                </table>
            </div>
        </DndContext>
    )
}
