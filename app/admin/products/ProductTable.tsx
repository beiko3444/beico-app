'use client'

import { useState, useCallback, useEffect } from 'react'
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core'
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ProductForm from "./product-form"
import BarcodeDisplay from "@/components/BarcodeDisplay"
import { useRouter } from 'next/navigation'

interface ProductRowProps {
    product: any
    index: number
    onSortOrderChange: (productId: string, newOrder: number) => void
    onDelete: (productId: string) => void
    checked: boolean
    onToggleCheck: (id: string) => void
    modifiedMoq: string | undefined
    onMoqChange: (id: string, val: string) => void
    modifiedStock: string | undefined
    onStockChange: (id: string, val: string) => void
    onToggleWholesale: (id: string) => void
}

function SortableProductRow({ product, index, onSortOrderChange, onDelete, checked, onToggleCheck, modifiedMoq, onMoqChange, modifiedStock, onStockChange, onToggleWholesale }: ProductRowProps) {
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

    const margin = (product.sellPrice || 0) - (product.buyPrice || 0);
    const marginPercent = (product.sellPrice ? ((margin / product.sellPrice) * 100) : 0).toFixed(1);

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
                    onClick={() => onToggleWholesale(product.id)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all border ${
                        product.wholesaleAvailable !== false
                            ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                            : 'bg-red-50 text-red-500 border-red-200 hover:bg-red-100'
                    }`}
                >
                    {product.wholesaleAvailable !== false ? '도매가능' : '도매불가'}
                </button>
            </td>
            <td className="px-2 py-1.5 border-r border-gray-100 last:border-0 text-center text-gray-800 font-bold whitespace-nowrap">
                <input
                    type="number"
                    min="1"
                    value={modifiedMoq !== undefined ? modifiedMoq : (product.regionalPrices?.C?.KR?.moq || product.minOrderQuantity || 1)}
                    onChange={(e) => onMoqChange(product.id, e.target.value)}
                    className="w-12 text-center border border-gray-200 rounded py-0.5 text-[11px] focus:border-[var(--color-brand-blue)] outline-none font-bold bg-white transition-colors"
                />
            </td>
            <td className="px-2 py-1.5 border-r border-gray-100 last:border-0 text-center tabular-nums text-gray-500 whitespace-nowrap">{(product.buyPrice || 0).toLocaleString()}</td>
            <td className="px-2 py-1.5 border-r border-gray-100 last:border-0 text-center tabular-nums font-bold text-[var(--color-brand-blue)] whitespace-nowrap">{(product.sellPrice || 0).toLocaleString()}</td>
            <td className="px-2 py-1.5 border-r border-gray-100 last:border-0 text-center tabular-nums font-bold text-gray-700 whitespace-nowrap">{(product.onlinePrice || 0).toLocaleString()}</td>
            <td className="px-2 py-1.5 border-r border-gray-100 last:border-0 text-center tabular-nums font-semibold whitespace-nowrap">
                <input
                    type="number"
                    min="0"
                    value={modifiedStock !== undefined ? modifiedStock : (product.stock || 0)}
                    onChange={(e) => onStockChange(product.id, e.target.value)}
                    className={`w-16 text-center border border-gray-200 rounded py-0.5 text-[11px] focus:border-[var(--color-brand-blue)] outline-none font-bold transition-colors ${
                        modifiedStock !== undefined && String(modifiedStock) !== String(product.stock || 0)
                            ? 'bg-yellow-50 border-yellow-300'
                            : 'bg-white'
                    }`}
                />
            </td>
            <td className="px-2 py-1.5 border-r border-gray-100 last:border-0 text-center tabular-nums whitespace-nowrap">
                <div className="flex flex-col items-center justify-center gap-0.5">
                    <div className="flex items-center gap-1">
                        <span className="text-[10px] text-blue-500 font-bold">W:</span>
                        <span className={`text-[10px] font-bold px-1 rounded ${Number((product.sellPrice ? (((product.sellPrice - product.buyPrice) / product.sellPrice) * 100) : 0).toFixed(1)) > 30 ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-500'}`}>
                            {(product.sellPrice ? (((product.sellPrice - product.buyPrice) / product.sellPrice) * 100) : 0).toFixed(1)}%
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-500 font-bold">R:</span>
                        <span className={`text-[10px] font-bold px-1 rounded ${Number((product.onlinePrice ? (((product.onlinePrice - product.buyPrice) / product.onlinePrice) * 100) : 0).toFixed(1)) > 30 ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-500'}`}>
                            {(product.onlinePrice ? (((product.onlinePrice - product.buyPrice) / product.onlinePrice) * 100) : 0).toFixed(1)}%
                        </span>
                    </div>
                </div>
            </td>
            <td className="px-2 py-1.5 border-r border-gray-100 last:border-0 text-center text-gray-500 font-mono text-[10px] whitespace-nowrap">{product.productCode ? String(product.productCode).toUpperCase() : '-'}</td>
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

export default function ProductTable({ initialProducts }: { initialProducts: any[] }) {
    const [products, setProducts] = useState(initialProducts)
    const [modifiedMoqs, setModifiedMoqs] = useState<Record<string, string>>({})
    const [modifiedStocks, setModifiedStocks] = useState<Record<string, string>>({})
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

    const handleMoqChange = (id: string, val: string) => {
        setModifiedMoqs(prev => ({ ...prev, [id]: val }))
        if (!checkedIds.has(id)) {
            const next = new Set(checkedIds)
            next.add(id)
            setCheckedIds(next)
        }
    }

    const handleStockChange = (id: string, val: string) => {
        setModifiedStocks(prev => ({ ...prev, [id]: val }))
        if (!checkedIds.has(id)) {
            const next = new Set(checkedIds)
            next.add(id)
            setCheckedIds(next)
        }
    }

    const handleToggleWholesale = async (id: string) => {
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
        if (!confirm(`선택된 ${checkedIds.size}개 상품의 수정사항을 저장하시겠습니까?`)) return

        setIsSaving(true)
        try {
            const hasMoqChanges = Array.from(checkedIds).some(id => modifiedMoqs[id] !== undefined)
            const hasStockChanges = Array.from(checkedIds).some(id => modifiedStocks[id] !== undefined)

            if (hasMoqChanges) {
                const moqUpdates = Array.from(checkedIds).map(id => {
                    const product = products.find(p => p.id === id)
                    const currentMoqValue = modifiedMoqs[id] !== undefined ? modifiedMoqs[id] : (product?.regionalPrices?.C?.KR?.moq || product?.minOrderQuantity || 1)
                    const num = parseInt(String(currentMoqValue))
                    return { id, moq: isNaN(num) || num < 1 ? 1 : num }
                })
                await fetch('/api/products/bulk/moq', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ updates: moqUpdates })
                })
            }

            if (hasStockChanges) {
                const stockUpdates = Array.from(checkedIds)
                    .filter(id => modifiedStocks[id] !== undefined)
                    .map(id => {
                        const num = parseInt(modifiedStocks[id])
                        return { id, stock: isNaN(num) || num < 0 ? 0 : num }
                    })
                if (stockUpdates.length > 0) {
                    await fetch('/api/products/bulk/stock', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ updates: stockUpdates })
                    })
                }
            }

            alert('저장되었습니다.')
            setCheckedIds(new Set())
            setModifiedMoqs({})
            setModifiedStocks({})
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
            onDragEnd={handleDragEnd}
        >
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
                            <th className="px-2 py-1.5 text-center font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap">도매</th>
                            <th className="px-2 py-1.5 text-center font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap">KR 최소수량</th>
                            <th className="px-2 py-1.5 text-center font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap">매입가</th>
                            <th className="px-2 py-1.5 text-right font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap">도매가</th>
                            <th className="px-2 py-1.5 text-right font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap">판매가</th>
                            <th className="px-2 py-1.5 text-center font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap">재고</th>
                            <th className="px-2 py-1.5 text-center font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap">마진(도매/소매)</th>
                            <th className="px-2 py-1.5 text-center font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap">상품코드</th>
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
                                    <td colSpan={15} className="px-6 py-12 text-center text-gray-500">
                                        등록된 상품이 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                products.map((product: any, index: number) => (
                                    <SortableProductRow
                                        key={product.id}
                                        product={product}
                                        index={index}
                                        onSortOrderChange={onSortOrderChange}
                                        onDelete={handleDelete}
                                        checked={checkedIds.has(product.id)}
                                        onToggleCheck={handleToggleCheck}
                                        modifiedMoq={modifiedMoqs[product.id]}
                                        onMoqChange={handleMoqChange}
                                        modifiedStock={modifiedStocks[product.id]}
                                        onStockChange={handleStockChange}
                                        onToggleWholesale={handleToggleWholesale}
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
