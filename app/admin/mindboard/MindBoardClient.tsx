'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, Minus, Trash2, GripHorizontal } from 'lucide-react'

// Types
interface BoardItem {
    id: string
    x: number
    y: number
    w: number
    h: number
    content: string
    color: string
    zIndex: number
}

const GRID_SIZE = 40 // Grid snap size
const COLORS = [
    '#FFADAD', '#FFD6A5', '#FDFFB6', '#CAFFBF', '#9BF6FF',
    '#A0C4FF', '#BDB2FF', '#FFC6FF', '#FFFFFC', '#E5E5E5'
] // 10 Pastel Colors

export default function MindBoardClient() {
    // State
    const [items, setItems] = useState<BoardItem[]>([])
    const [scale, setScale] = useState(1)
    const [pan, setPan] = useState({ x: 0, y: 0 })
    const [isPanning, setIsPanning] = useState(false)
    const [dragItem, setDragItem] = useState<{ id: string, startX: number, startY: number, initialX: number, initialY: number } | null>(null)
    const [resizeItem, setResizeItem] = useState<{ id: string, startX: number, startY: number, initialW: number, initialH: number } | null>(null)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [maxZIndex, setMaxZIndex] = useState(1)
    const [colorPaletteId, setColorPaletteId] = useState<string | null>(null)

    // Refs
    const containerRef = useRef<HTMLDivElement>(null)
    const lastPos = useRef({ x: 0, y: 0 })
    const lastTouchDistance = useRef<number | null>(null)
    const lastClickTime = useRef(0)

    // --- Persistence ---
    useEffect(() => {
        const saved = localStorage.getItem('mindboard-items')
        if (saved) {
            try {
                const parsed = JSON.parse(saved)
                setItems(parsed)
                const maxZ = parsed.reduce((max: number, item: any) => Math.max(max, item.zIndex || 1), 1)
                setMaxZIndex(maxZ)
            } catch (e) {
                console.error("Failed to load mindboard items", e)
            }
        }
    }, [])

    useEffect(() => {
        if (items.length > 0) {
            localStorage.setItem('mindboard-items', JSON.stringify(items))
        }
    }, [items])

    // --- Helpers ---
    const getWorldCoords = useCallback((clientX: number, clientY: number) => {
        const rect = containerRef.current?.getBoundingClientRect()
        if (!rect) return { x: 0, y: 0 }

        const xWorld = (clientX - rect.left - pan.x) / scale
        const yWorld = (clientY - rect.top - pan.y) / scale
        return { x: xWorld, y: yWorld }
    }, [pan, scale])

    const createMemo = useCallback((x: number, y: number) => {
        const snappedX = Math.round((x - 160) / GRID_SIZE) * GRID_SIZE
        const snappedY = Math.round((y - 60) / GRID_SIZE) * GRID_SIZE

        const newItem: BoardItem = {
            id: Date.now().toString(),
            x: snappedX,
            y: snappedY,
            w: 320,
            h: 120,
            content: '',
            color: COLORS[0],
            zIndex: maxZIndex + 1
        }

        setMaxZIndex((prev: number) => prev + 1)
        setItems((prev: BoardItem[]) => [...prev, newItem])
    }, [maxZIndex])

    // --- Actions ---
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault()
        const zoomSensitivity = 0.001
        const newScale = Math.min(Math.max(0.1, scale - e.deltaY * zoomSensitivity), 3)
        setScale(newScale)
    }

    const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
        const now = Date.now()
        if (now - lastClickTime.current < 300) {
            // Double click/tap detected
            const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX
            const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY
            const { x, y } = getWorldCoords(clientX, clientY)
            createMemo(x, y)
            lastClickTime.current = 0 // Reset
        } else {
            lastClickTime.current = now
        }
    }

    const startPan = (clientX: number, clientY: number) => {
        setIsPanning(true)
        lastPos.current = { x: clientX, y: clientY }
    }

    const bringToFront = (id: string) => {
        setMaxZIndex((prev: number) => prev + 1)
        setItems((prev: BoardItem[]) => prev.map((item: BoardItem) => item.id === id ? { ...item, zIndex: maxZIndex + 1 } : item))
    }

    const startDrag = (clientX: number, clientY: number, id: string) => {
        const item = items.find((i: BoardItem) => i.id === id)
        if (!item) return
        bringToFront(id)
        setDragItem({ id, startX: clientX, startY: clientY, initialX: item.x, initialY: item.y })
    }

    const startResize = (clientX: number, clientY: number, id: string) => {
        const item = items.find((i: BoardItem) => i.id === id)
        if (!item) return
        bringToFront(id)
        setResizeItem({ id, startX: clientX, startY: clientY, initialW: item.w, initialH: item.h })
    }

    const deleteItem = (id: string) => {
        if (confirm('정말 삭제하시겠습니까?')) {
            setItems((prev: BoardItem[]) => prev.filter((i: BoardItem) => i.id !== id))
        }
    }

    const toggleColorPalette = (id: string) => {
        const now = Date.now()
        if (now - lastClickTime.current < 300) {
            setColorPaletteId((prev: string | null) => prev === id ? null : id)
            lastClickTime.current = 0
        } else {
            lastClickTime.current = now
        }
    }

    // --- Touch Handlers ---
    const onTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            const touch = e.touches[0]
            const target = touch.target as HTMLElement
            if (target.id === 'mind-board-bg') {
                startPan(touch.clientX, touch.clientY)
                handleCanvasClick(e)
            }
        } else if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX
            const dy = e.touches[0].clientY - e.touches[1].clientY
            lastTouchDistance.current = Math.sqrt(dx * dx + dy * dy)
        }
    }

    const onTouchMove = (e: TouchEvent) => {
        if (e.touches.length === 1) {
            const touch = e.touches[0]
            if (isPanning) {
                const dx = touch.clientX - lastPos.current.x
                const dy = touch.clientY - lastPos.current.y
                setPan((p: { x: number, y: number }) => ({ x: p.x + dx, y: p.y + dy }))
                lastPos.current = { x: touch.clientX, y: touch.clientY }
            } else if (dragItem) {
                const dx = (touch.clientX - dragItem.startX) / scale
                const dy = (touch.clientY - dragItem.startY) / scale
                setItems((prev: BoardItem[]) => prev.map((item: BoardItem) => item.id === dragItem.id ? {
                    ...item,
                    x: Math.round((dragItem.initialX + dx) / GRID_SIZE) * GRID_SIZE,
                    y: Math.round((dragItem.initialY + dy) / GRID_SIZE) * GRID_SIZE
                } : item))
            } else if (resizeItem) {
                const dx = (touch.clientX - resizeItem.startX) / scale
                const dy = (touch.clientY - resizeItem.startY) / scale
                setItems((prev: BoardItem[]) => prev.map((item: BoardItem) => item.id === resizeItem.id ? {
                    ...item,
                    w: Math.max(GRID_SIZE * 4, Math.round((resizeItem.initialW + dx) / GRID_SIZE) * GRID_SIZE),
                    h: Math.max(GRID_SIZE * 2, Math.round((resizeItem.initialH + dy) / GRID_SIZE) * GRID_SIZE)
                } : item))
            }
        } else if (e.touches.length === 2 && lastTouchDistance.current !== null) {
            const dx = e.touches[0].clientX - e.touches[1].clientX
            const dy = e.touches[0].clientY - e.touches[1].clientY
            const distance = Math.sqrt(dx * dx + dy * dy)
            const delta = (distance - lastTouchDistance.current) * 0.01
            setScale((s: number) => Math.min(Math.max(0.1, s + delta), 3))
            lastTouchDistance.current = distance
        }
    }

    const onTouchEnd = () => {
        setIsPanning(false)
        setDragItem(null)
        setResizeItem(null)
        lastTouchDistance.current = null
    }

    // --- Global Mouse Move / Up ---
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isPanning) {
                const dx = e.clientX - lastPos.current.x
                const dy = e.clientY - lastPos.current.y
                setPan((p: { x: number, y: number }) => ({ x: p.x + dx, y: p.y + dy }))
                lastPos.current = { x: e.clientX, y: e.clientY }
            } else if (dragItem) {
                const dx = (e.clientX - dragItem.startX) / scale
                const dy = (e.clientY - dragItem.startY) / scale
                setItems((prev: BoardItem[]) => prev.map((item: BoardItem) => item.id === dragItem.id ? {
                    ...item,
                    x: Math.round((dragItem.initialX + dx) / GRID_SIZE) * GRID_SIZE,
                    y: Math.round((dragItem.initialY + dy) / GRID_SIZE) * GRID_SIZE
                } : item))
            } else if (resizeItem) {
                const dx = (e.clientX - resizeItem.startX) / scale
                const dy = (e.clientY - resizeItem.startY) / scale
                setItems((prev: BoardItem[]) => prev.map((item: BoardItem) => item.id === resizeItem.id ? {
                    ...item,
                    w: Math.max(GRID_SIZE * 4, Math.round((resizeItem.initialW + dx) / GRID_SIZE) * GRID_SIZE),
                    h: Math.max(GRID_SIZE * 2, Math.round((resizeItem.initialH + dy) / GRID_SIZE) * GRID_SIZE)
                } : item))
            }
        }

        const handleMouseUp = () => {
            setIsPanning(false)
            setDragItem(null)
            setResizeItem(null)
        }

        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)
        window.addEventListener('touchmove', onTouchMove, { passive: false })
        window.addEventListener('touchend', onTouchEnd)

        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
            window.removeEventListener('touchmove', onTouchMove)
            window.removeEventListener('touchend', onTouchEnd)
        }
    }, [isPanning, dragItem, resizeItem, scale, onTouchMove, onTouchEnd])

    return (
        <div className="w-full h-[calc(100vh-60px)] relative overflow-hidden bg-gray-50 select-none">
            {/* Toolbar / Controls */}
            <div className="absolute top-4 left-4 z-50 flex gap-4 items-start">
                <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-1 flex items-center gap-1">
                    <button onClick={() => setScale((s: number) => Math.min(s + 0.1, 3))} className="p-2 hover:bg-gray-100 rounded-md">
                        <Plus size={18} />
                    </button>
                    <span className="w-12 text-center text-xs font-bold font-mono">{Math.round(scale * 100)}%</span>
                    <button onClick={() => setScale((s: number) => Math.max(s - 0.1, 0.1))} className="p-2 hover:bg-gray-100 rounded-md">
                        <Minus size={18} />
                    </button>
                </div>
            </div>

            {/* Canvas Container */}
            <div
                ref={containerRef}
                id="mind-board-bg"
                className="w-full h-full cursor-grab active:cursor-grabbing relative"
                onMouseDown={(e: React.MouseEvent) => {
                    if ((e.target as HTMLElement).id === 'mind-board-bg') {
                        startPan(e.clientX, e.clientY)
                        handleCanvasClick(e)
                    }
                }}
                onTouchStart={onTouchStart}
                onWheel={handleWheel}
                style={{
                    backgroundImage: `
                        linear-gradient(to right, #e5e7eb 1px, transparent 1px),
                        linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
                    `,
                    backgroundSize: `${GRID_SIZE * scale}px ${GRID_SIZE * scale}px`,
                    backgroundPosition: `${pan.x}px ${pan.y}px`
                }}
            >
                {/* World Transform Layer */}
                <div
                    className="absolute top-0 left-0 w-0 h-0"
                    style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                        transformOrigin: '0 0'
                    }}
                >
                    {items.map((item: BoardItem) => (
                        <div
                            key={item.id}
                            className="absolute rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex flex-col group border border-black/5 hover:border-black/10 transition-shadow hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] bg-white overflow-hidden"
                            style={{
                                left: item.x,
                                top: item.y,
                                width: item.w,
                                height: item.h,
                                zIndex: item.zIndex
                            }}
                            onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
                        >
                            {/* Color Palette Popover */}
                            {colorPaletteId === item.id && (
                                <div className="absolute top-0 left-0 w-full z-[100] p-2 bg-white/90 backdrop-blur-sm border-b border-gray-100 flex flex-wrap gap-1 items-center justify-center animate-in slide-in-from-top-full duration-200">
                                    {COLORS.map((c: string) => (
                                        <button
                                            key={c}
                                            onClick={() => {
                                                setItems((prev: BoardItem[]) => prev.map((i: BoardItem) => i.id === item.id ? { ...i, color: c } : i))
                                                setColorPaletteId(null)
                                            }}
                                            className="w-5 h-5 rounded-full border border-black/10 transition-transform hover:scale-125"
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Header / Drag Handle */}
                            <div
                                className="h-8 bg-gray-50 border-b border-gray-100 flex items-center justify-between px-2 cursor-grab active:cursor-grabbing hover:bg-gray-100 transition-colors"
                                onMouseDown={(e: React.MouseEvent) => startDrag(e.clientX, e.clientY, item.id)}
                                onTouchStart={(e: React.TouchEvent) => {
                                    e.stopPropagation()
                                    const touch = e.touches[0]
                                    startDrag(touch.clientX, touch.clientY, item.id)
                                    toggleColorPalette(item.id)
                                }}
                                onDoubleClick={(e: React.MouseEvent) => {
                                    e.stopPropagation()
                                    setColorPaletteId((prev: string | null) => prev === item.id ? null : item.id)
                                }}
                            >
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: item.color }}></div>
                                    <GripHorizontal size={14} className="text-gray-300" />
                                </div>
                                <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); deleteItem(item.id) }}
                                        className="p-1 hover:bg-red-100 rounded text-red-400 hover:text-red-600"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 p-3 overflow-hidden relative bg-white">
                                {editingId === item.id ? (
                                    <textarea
                                        autoFocus
                                        className="w-full h-full bg-transparent resize-none outline-none text-sm font-medium text-gray-800 leading-relaxed p-0"
                                        value={item.content}
                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setItems((prev: BoardItem[]) => prev.map((i: BoardItem) => i.id === item.id ? { ...i, content: e.target.value } : i))}
                                        onBlur={() => setEditingId(null)}
                                        onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault()
                                                setEditingId(null)
                                            }
                                        }}
                                    />
                                ) : (
                                    <div
                                        className="w-full h-full text-sm font-medium text-gray-800 whitespace-pre-wrap leading-relaxed cursor-text"
                                        onClick={() => setEditingId(item.id)}
                                    >
                                        {item.content || <span className="text-gray-300 italic">내용을 입력하세요...</span>}
                                    </div>
                                )}
                            </div>

                            {/* Resize Handle */}
                            <div
                                className="absolute bottom-0 right-0 w-8 h-8 cursor-nwse-resize flex items-end justify-end p-1 hover:bg-black/5 rounded-br-xl"
                                onMouseDown={(e: React.MouseEvent) => startResize(e.clientX, e.clientY, item.id)}
                                onTouchStart={(e: React.TouchEvent) => {
                                    e.stopPropagation()
                                    const touch = e.touches[0]
                                    startResize(touch.clientX, touch.clientY, item.id)
                                }}
                            >
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-20 text-gray-500">
                                    <path d="M12 12H0L12 0V12Z" fill="currentColor" />
                                </svg>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
