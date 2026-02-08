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

const GRID_SIZE = 80
const WORLD_SIZE = 4000 // Total canvas size
const COLORS = [
    '#FFFFFF', // White as default first
    '#FFADAD', '#FFD6A5', '#FDFFB6', '#CAFFBF', '#9BF6FF',
    '#A0C4FF', '#BDB2FF', '#FFC6FF', '#E5E5E5'
]

export default function MindBoardClient() {
    // State
    const [items, setItems] = useState<BoardItem[]>([])
    const [scale, setScale] = useState(0.5) // Start zoomed out a bit
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
    const longPressTimer = useRef<any>(null)

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
    const getBoundaries = useCallback((currentScale: number) => {
        const container = containerRef.current
        if (!container) return { minX: 0, maxX: 0, minY: 0, maxY: 0 }

        const minX = container.clientWidth - WORLD_SIZE * currentScale
        const minY = container.clientHeight - WORLD_SIZE * currentScale

        return {
            minX: Math.min(0, minX),
            maxX: 0,
            minY: Math.min(0, minY),
            maxY: 0
        }
    }, [])

    const clampPan = useCallback((x: number, y: number, currentScale: number) => {
        const { minX, maxX, minY, maxY } = getBoundaries(currentScale)
        return {
            x: Math.max(minX, Math.min(maxX, x)),
            y: Math.max(minY, Math.min(maxY, y))
        }
    }, [getBoundaries])

    const getWorldCoords = useCallback((clientX: number, clientY: number) => {
        const rect = containerRef.current?.getBoundingClientRect()
        if (!rect) return { x: 0, y: 0 }
        const xWorld = (clientX - rect.left - pan.x) / scale
        const yWorld = (clientY - rect.top - pan.y) / scale
        return { x: xWorld, y: yWorld }
    }, [pan, scale])

    const isColliding = (a: { x: number, y: number, w: number, h: number }, b: { x: number, y: number, w: number, h: number }) => {
        return (
            a.x < b.x + b.w &&
            a.x + a.w > b.x &&
            a.y < b.y + b.h &&
            a.y + a.h > b.y
        )
    }

    const resolveCollision = useCallback((movingId: string, newItems: BoardItem[]): BoardItem[] => {
        const movingItem = newItems.find(i => i.id === movingId)
        if (!movingItem) return newItems

        let changed = false
        const updated = newItems.map(item => {
            if (item.id === movingId) return item
            if (isColliding(movingItem, item)) {
                changed = true
                // Push logic: move 'item' away from 'movingItem'
                // Simplest push: move in the direction of the overlap
                const dx = (item.x + item.w / 2) - (movingItem.x + movingItem.w / 2)
                const dy = (item.y + item.h / 2) - (movingItem.y + movingItem.h / 2)

                let nx = item.x
                let ny = item.y

                if (Math.abs(dx) > Math.abs(dy)) {
                    nx = dx > 0 ? movingItem.x + movingItem.w + 10 : movingItem.x - item.w - 10
                } else {
                    ny = dy > 0 ? movingItem.y + movingItem.h + 10 : movingItem.y - item.h - 10
                }

                return { ...item, x: Math.round(nx / GRID_SIZE) * GRID_SIZE, y: Math.round(ny / GRID_SIZE) * GRID_SIZE }
            }
            return item
        })

        return changed ? resolveCollision(movingId, updated) : updated // Recursive to handle chain collisions
    }, [])

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
            color: '#FFFFFF',
            zIndex: maxZIndex + 1
        }

        setMaxZIndex((prev: number) => prev + 1)
        setItems((prev: BoardItem[]) => resolveCollision(newItem.id, [...prev, newItem]))
    }, [maxZIndex, resolveCollision])

    // --- Actions ---
    const handleZoom = useCallback((delta: number, pivotX: number, pivotY: number) => {
        const container = containerRef.current
        if (!container) return

        const rect = container.getBoundingClientRect()
        const mouseX = pivotX - rect.left
        const mouseY = pivotY - rect.top

        const minScale = container.clientWidth / WORLD_SIZE
        const newScale = Math.min(Math.max(minScale, scale * (1 + delta)), 3)

        if (newScale === scale) return

        const xWorld = (mouseX - pan.x) / scale
        const yWorld = (mouseY - pan.y) / scale

        const newPanX = mouseX - xWorld * newScale
        const newPanY = mouseY - yWorld * newScale

        const clamped = clampPan(newPanX, newPanY, newScale)
        setScale(newScale)
        setPan(clamped)
    }, [pan, scale, clampPan])

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault()
        const zoomSensitivity = -0.001
        handleZoom(e.deltaY * zoomSensitivity, e.clientX, e.clientY)
    }

    const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
        const now = Date.now()
        if (now - lastClickTime.current < 400) { // Increased to 400ms for better mobile feel
            const clientX = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX
            const clientY = 'touches' in e ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY
            const { x, y } = getWorldCoords(clientX, clientY)
            createMemo(x, y)
            lastClickTime.current = 0
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

    // --- Touch Handlers ---
    const onTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            const touch = e.touches[0]
            if (e.cancelable) e.preventDefault()
            startPan(touch.clientX, touch.clientY)
            handleCanvasClick(e)
        } else if (e.touches.length === 2) {
            if (e.cancelable) e.preventDefault()
            const dx = e.touches[0].clientX - e.touches[1].clientX
            const dy = e.touches[0].clientY - e.touches[1].clientY
            lastTouchDistance.current = Math.sqrt(dx * dx + dy * dy)
        }
    }

    const onTouchMove = useCallback((e: TouchEvent) => {
        if (e.touches.length === 1) {
            const touch = e.touches[0]
            if (isPanning) {
                if (e.cancelable) e.preventDefault()
                const dx = touch.clientX - lastPos.current.x
                const dy = touch.clientY - lastPos.current.y
                setPan((p: { x: number, y: number }) => clampPan(p.x + dx, p.y + dy, scale))
                lastPos.current = { x: touch.clientX, y: touch.clientY }
            } else if (dragItem) {
                if (e.cancelable) e.preventDefault()
                const dx = (touch.clientX - dragItem.startX) / scale
                const dy = (touch.clientY - dragItem.startY) / scale
                setItems((prev: BoardItem[]) => {
                    const next = prev.map((item: BoardItem) => item.id === dragItem.id ? {
                        ...item,
                        x: Math.round((dragItem.initialX + dx) / GRID_SIZE) * GRID_SIZE,
                        y: Math.round((dragItem.initialY + dy) / GRID_SIZE) * GRID_SIZE
                    } : item)
                    return resolveCollision(dragItem.id, next)
                })
            } else if (resizeItem) {
                if (e.cancelable) e.preventDefault()
                const dx = (touch.clientX - resizeItem.startX) / scale
                const dy = (touch.clientY - resizeItem.startY) / scale
                setItems((prev: BoardItem[]) => prev.map((item: BoardItem) => item.id === resizeItem.id ? {
                    ...item,
                    w: Math.max(GRID_SIZE * 4, Math.round((resizeItem.initialW + dx) / GRID_SIZE) * GRID_SIZE),
                    h: Math.max(GRID_SIZE * 2, Math.round((resizeItem.initialH + dy) / GRID_SIZE) * GRID_SIZE)
                } : item))
            }
        } else if (e.touches.length === 2) {
            if (e.cancelable) e.preventDefault()
            const dx = e.touches[0].clientX - e.touches[1].clientX
            const dy = e.touches[0].clientY - e.touches[1].clientY
            const distance = Math.sqrt(dx * dx + dy * dy)

            if (lastTouchDistance.current !== null) {
                const delta = (distance - lastTouchDistance.current) * 0.005
                const midpointX = (e.touches[0].clientX + e.touches[1].clientX) / 2
                const midpointY = (e.touches[0].clientY + e.touches[1].clientY) / 2
                handleZoom(delta, midpointX, midpointY)
                lastTouchDistance.current = distance
            }
        }
    }, [isPanning, dragItem, resizeItem, scale, resolveCollision, clampPan, handleZoom])

    const onTouchEnd = useCallback(() => {
        setIsPanning(false)
        setDragItem(null)
        setResizeItem(null)
        lastTouchDistance.current = null
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current)
            longPressTimer.current = null
        }
    }, [])

    // --- Global Mouse Move / Up ---
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isPanning) {
                const dx = e.clientX - lastPos.current.x
                const dy = e.clientY - lastPos.current.y
                setPan((p: { x: number, y: number }) => clampPan(p.x + dx, p.y + dy, scale))
                lastPos.current = { x: e.clientX, y: e.clientY }
            } else if (dragItem) {
                const dx = (e.clientX - dragItem.startX) / scale
                const dy = (e.clientY - dragItem.startY) / scale
                setItems((prev: BoardItem[]) => {
                    const next = prev.map((item: BoardItem) => item.id === dragItem.id ? {
                        ...item,
                        x: Math.round((dragItem.initialX + dx) / GRID_SIZE) * GRID_SIZE,
                        y: Math.round((dragItem.initialY + dy) / GRID_SIZE) * GRID_SIZE
                    } : item)
                    return resolveCollision(dragItem.id, next)
                })
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
    }, [isPanning, dragItem, resizeItem, scale, onTouchMove, onTouchEnd, resolveCollision, clampPan])

    const startLongPress = (id: string) => {
        longPressTimer.current = setTimeout(() => {
            setColorPaletteId(id)
        }, 500)
    }

    return (
        <div className="w-full h-[calc(100vh-60px)] relative overflow-hidden bg-gray-100 select-none touch-none">
            {/* minimap */}
            <div className="absolute bottom-4 right-4 z-50 w-48 h-48 bg-white/80 backdrop-blur-md rounded-xl shadow-2xl border border-gray-200 overflow-hidden md:block hidden">
                <div className="relative w-full h-full">
                    {/* World Background */}
                    <div className="absolute inset-0 bg-gray-50 opacity-50" />
                    {/* Items on Minimap */}
                    {items.map((item: BoardItem) => (
                        <div
                            key={`mini-${item.id}`}
                            className="absolute rounded-sm border border-black/10"
                            style={{
                                left: `${(item.x / WORLD_SIZE) * 100}%`,
                                top: `${(item.y / WORLD_SIZE) * 100}%`,
                                width: `${(item.w / WORLD_SIZE) * 100}%`,
                                height: `${(item.h / WORLD_SIZE) * 100}%`,
                                backgroundColor: item.color
                            }}
                        />
                    ))}
                    {/* Viewport Indicator */}
                    {containerRef.current && (
                        <div
                            className="absolute border-2 border-blue-500 bg-blue-500/10 pointer-events-none"
                            style={{
                                left: `${(-pan.x / scale / WORLD_SIZE) * 100}%`,
                                top: `${(-pan.y / scale / WORLD_SIZE) * 100}%`,
                                width: `${(containerRef.current.clientWidth / scale / WORLD_SIZE) * 100}%`,
                                height: `${(containerRef.current.clientHeight / scale / WORLD_SIZE) * 100}%`
                            }}
                        />
                    )}
                </div>
            </div>

            {/* Toolbar */}
            <div className="absolute top-4 left-4 z-50 flex gap-4 items-start">
                <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-1 flex items-center gap-1">
                    <button onClick={() => {
                        const container = containerRef.current
                        if (container) handleZoom(0.1, container.clientWidth / 2, container.clientHeight / 2)
                    }} className="p-2 hover:bg-gray-100 rounded-md">
                        <Plus size={18} />
                    </button>
                    <span className="w-12 text-center text-xs font-bold font-mono">{Math.round(scale * 100)}%</span>
                    <button onClick={() => {
                        const container = containerRef.current
                        if (container) handleZoom(-0.1, container.clientWidth / 2, container.clientHeight / 2)
                    }} className="p-2 hover:bg-gray-100 rounded-md">
                        <Minus size={18} />
                    </button>
                </div>
            </div>

            <div
                ref={containerRef}
                id="mind-board-bg"
                className="w-full h-full cursor-grab active:cursor-grabbing relative bg-white"
                onMouseDown={(e: React.MouseEvent) => {
                    startPan(e.clientX, e.clientY)
                    handleCanvasClick(e)
                }}
                onTouchStart={onTouchStart}
                onWheel={handleWheel}
            >
                <div
                    className="absolute shadow-inner"
                    style={{
                        width: WORLD_SIZE,
                        height: WORLD_SIZE,
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                        transformOrigin: '0 0',
                        backgroundImage: `
                            linear-gradient(to right, #f0f0f0 1px, transparent 1px),
                            linear-gradient(to bottom, #f0f0f0 1px, transparent 1px)
                        `,
                        backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
                        backgroundColor: '#fdfdfd'
                    }}
                >
                    {items.map((item: BoardItem) => (
                        <div
                            key={item.id}
                            className="absolute rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex flex-col group border border-black/5 hover:border-black/10 transition-shadow hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] overflow-hidden"
                            style={{
                                left: item.x,
                                top: item.y,
                                width: item.w,
                                height: item.h,
                                zIndex: item.zIndex,
                                backgroundColor: item.color
                            }}
                            onMouseDown={(e: React.MouseEvent) => {
                                e.stopPropagation()
                                if (editingId !== item.id) {
                                    startDrag(e.clientX, e.clientY, item.id)
                                }
                            }}
                            onTouchStart={(e: React.TouchEvent) => {
                                e.stopPropagation()
                                if (e.touches.length === 1) {
                                    const touch = e.touches[0]
                                    startDrag(touch.clientX, touch.clientY, item.id)
                                }
                            }}
                        >
                            {/* Color Palette Popover */}
                            {colorPaletteId === item.id && (
                                <div className="absolute top-0 left-0 w-full z-[100] p-2 bg-white/90 backdrop-blur-sm border-b border-gray-100 flex flex-wrap gap-1 items-center justify-center animate-in slide-in-from-top-full duration-200">
                                    {COLORS.map((c: string) => (
                                        <button
                                            key={c}
                                            onClick={(e: React.MouseEvent) => {
                                                e.stopPropagation()
                                                setItems((prev: BoardItem[]) => prev.map((i: BoardItem) => i.id === item.id ? { ...i, color: c } : i))
                                                setColorPaletteId(null)
                                            }}
                                            className="w-5 h-5 rounded-full border border-black/10 transition-transform hover:scale-125"
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Header / Top Handle */}
                            <div className="h-8 bg-black/5 flex items-center justify-between px-2 cursor-grab active:cursor-grabbing hover:bg-black/10 transition-colors"
                                onTouchStart={(e: React.TouchEvent) => {
                                    // Header specific long press
                                    if (e.touches.length === 1) {
                                        startLongPress(item.id)
                                    }
                                }}
                            >
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: item.color === '#FFFFFF' ? '#e5e5e5' : item.color }}></div>
                                    <GripHorizontal size={14} className="text-gray-400" />
                                </div>
                                <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); deleteItem(item.id) }}
                                        onTouchStart={(e: React.TouchEvent) => e.stopPropagation()}
                                        className="p-1 hover:bg-red-100 rounded text-red-400 hover:text-red-600"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 p-3 overflow-hidden relative">
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
                                        onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
                                        onTouchStart={(e: React.TouchEvent) => e.stopPropagation()}
                                    />
                                ) : (
                                    <div
                                        className="w-full h-full text-sm font-medium text-gray-800 whitespace-pre-wrap leading-relaxed cursor-text"
                                        onDoubleClick={() => setEditingId(item.id)}
                                        onClick={(e: React.MouseEvent) => {
                                            if (e.detail === 1) {
                                                // Single tap on mobile
                                            }
                                        }}
                                    >
                                        {item.content || <span className="text-gray-300 italic">더블클릭하여 내용 입력...</span>}
                                    </div>
                                )}
                            </div>

                            {/* Resize Handle */}
                            <div
                                className="absolute bottom-0 right-0 w-8 h-8 cursor-nwse-resize flex items-end justify-end p-1 hover:bg-black/5 rounded-br-xl"
                                onMouseDown={(e: React.MouseEvent) => {
                                    e.stopPropagation()
                                    startResize(e.clientX, e.clientY, item.id)
                                }}
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
