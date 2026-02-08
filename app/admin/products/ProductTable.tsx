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
}

function SortableProductRow({ product, index, onSortOrderChange, onDelete }: ProductRowProps) {
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
            className={`text-[11px] border-b border-gray-100 hover:bg-gray-50 transition-colors group ${isDragging ? 'bg-blue-50' : ''}`}
        >
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
            <td className="px-2 py-1.5 border-r border-gray-100 last:border-0 text-center text-gray-500 font-mono text-[10px] whitespace-nowrap">{product.productCode || '-'}</td>
            <td className="px-2 py-1.5 border-r border-gray-100 last:border-0 text-center text-gray-400 font-mono text-[10px] whitespace-nowrap">
                <BarcodeDisplay value={product.barcode} />
            </td>
            <td className="px-2 py-1.5 border-r border-gray-100 last:border-0 text-center tabular-nums text-gray-500 whitespace-nowrap">{(product.buyPrice || 0).toLocaleString()}</td>
            <td className="px-2 py-1.5 border-r border-gray-100 last:border-0 text-center tabular-nums font-bold text-[var(--color-brand-blue)] whitespace-nowrap">{(product.sellPrice || 0).toLocaleString()}</td>
            <td className="px-2 py-1.5 border-r border-gray-100 last:border-0 text-center tabular-nums font-bold text-gray-700 whitespace-nowrap">{(product.onlinePrice || 0).toLocaleString()}</td>
            <td className="px-2 py-1.5 border-r border-gray-100 last:border-0 text-center tabular-nums font-semibold whitespace-nowrap">
                <span className={(product.stock || 0) <= 0 ? 'text-red-500 font-bold' : 'text-gray-900'}>
                    {(product.stock || 0).toLocaleString()}
                </span>
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

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <table className="w-full table-auto min-w-max border-collapse">
                <thead className="bg-[var(--color-brand-blue)] text-white">
                    <tr>
                        <th className="px-2 py-1.5 text-center font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap w-8">순서</th>
                        <th className="px-2 py-1.5 text-center font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap w-8">No</th>
                        <th className="px-2 py-1.5 text-center font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap">이미지</th>
                        <th className="px-2 py-1.5 text-center font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap">상품명</th>
                        <th className="px-2 py-1.5 text-center font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap">상품코드</th>
                        <th className="px-2 py-1.5 text-center font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap">바코드</th>
                        <th className="px-2 py-1.5 text-center font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap">매입가</th>
                        <th className="px-2 py-1.5 text-right font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap">도매가</th>
                        <th className="px-2 py-1.5 text-right font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap">판매가</th>
                        <th className="px-2 py-1.5 text-center font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap">재고</th>
                        <th className="px-2 py-1.5 text-center font-bold text-[11px] border-r border-white/20 last:border-0 whitespace-nowrap">마진(도매/소매)</th>
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
                                <td colSpan={12} className="px-6 py-12 text-center text-gray-500">
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
                                />
                            ))
                        )}
                    </SortableContext>
                </tbody>
            </table>
        </DndContext>
    )
}
