'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, Minus, GripHorizontal, X, CheckCircle2, LayoutGrid, Wand2 } from 'lucide-react'

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
    completed?: boolean
    groupId?: string
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

    // key: itemId, value: initial state when drag started
    const [dragItems, setDragItems] = useState<Map<string, { startX: number, startY: number, initialX: number, initialY: number }>>(new Map())

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
    const hasMoved = useRef(false) // Used to distinguish between click and drag

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
            // Don't collide with self
            if (item.id === movingId) return item

            // Should collision logic apply to group members? 
            // If they are in the same group, they should move together, checking collision against OUTSIDERS.
            // But here we are just resolving collision for a single moving item 'movingId' against 'item'.
            // If both are in same group, ignore collision.
            if (movingItem.groupId && movingItem.groupId === item.groupId) return item

            if (isColliding(movingItem, item)) {
                changed = true
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

        return changed ? resolveCollision(movingId, updated) : updated
    }, [])

    const createMemo = useCallback((x: number, y: number) => {
        const snappedX = Math.round((x - 160) / GRID_SIZE) * GRID_SIZE
        const snappedY = Math.round((y - 60) / GRID_SIZE) * GRID_SIZE

        const newItem: BoardItem = {
            id: Date.now().toString(),
            x: snappedX,
            y: snappedY,
            w: 240, // 3x Grid (80 * 3)
            h: 160, // 2x Grid (80 * 2)
            content: '',
            color: '#FFFFFF',
            zIndex: maxZIndex + 1,
            completed: false,
            groupId: Date.now().toString() // Initially its own group
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
        if (now - lastClickTime.current < 400) {
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

        // Find all items in same group
        const groupMembers = item.groupId ? items.filter(i => i.groupId === item.groupId) : [item]
        const newMap = new Map()
        groupMembers.forEach(member => {
            newMap.set(member.id, {
                startX: clientX,
                startY: clientY,
                initialX: member.x,
                initialY: member.y
            })
        })
        setDragItems(newMap)
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

    const toggleComplete = (id: string) => {
        setItems((prev: BoardItem[]) => prev.map((item: BoardItem) =>
            item.id === id ? { ...item, completed: !item.completed } : item
        ))
    }

    const autoArrange = () => {
        const container = containerRef.current
        if (!container || items.length === 0) return

        const gap = 20

        // Sort by current position
        const sorted = [...items].sort((a, b) => {
            const rowDiff = a.y - b.y
            if (Math.abs(rowDiff) > 100) return rowDiff
            return a.x - b.x
        })

        let currentX = 100
        let currentY = 100
        let maxHeightInRow = 0

        const arranged = sorted.map((item) => {
            const newItem = {
                ...item,
                x: Math.round(currentX / GRID_SIZE) * GRID_SIZE,
                y: Math.round(currentY / GRID_SIZE) * GRID_SIZE
            }

            // Update for next item
            currentX += newItem.w + gap
            maxHeightInRow = Math.max(maxHeightInRow, newItem.h)

            if (currentX > 100 + (newItem.w + gap) * 4) { // Max 4 columns roughly
                currentX = 100
                currentY += maxHeightInRow + gap
                maxHeightInRow = 0
            }

            return newItem
        })

        setItems(arranged)
        setPan(prev => ({ x: 0, y: 0 }))
    }

    const optimizeSize = () => {
        setItems(prev => prev.map(item => {
            const lines = item.content.split('\n').length
            const length = item.content.length

            // Simple heuristic
            let targetW = 240 // 3x
            let targetH = 160 // 2x

            if (length < 20 && lines <= 2) {
                targetW = 160 // 2x
                targetH = 160 // 2x
            } else if (length > 100 || lines > 5) {
                targetW = 320 // 4x
                targetH = Math.max(160, Math.ceil((lines * 24 + 60) / GRID_SIZE) * GRID_SIZE)
            }

            return { ...item, w: targetW, h: targetH }
        }))
    }

    const handleDoubleTap = (id: string) => {
        setColorPaletteId(id)
    }

    // --- Touch Handlers ---
    const onTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            const touch = e.touches[0]
            const target = e.target as HTMLElement
            // Prevent panning if touching specific elements
            if (!target.closest('.cursor-nwse-resize') && !target.closest('.cursor-grab') && !target.closest('button')) {
                if (e.cancelable) e.preventDefault()
                startPan(touch.clientX, touch.clientY)
                handleCanvasClick(e)
            }
        } else if (e.touches.length === 2) {
            if (e.cancelable) e.preventDefault()
            const dx = e.touches[0].clientX - e.touches[1].clientX
            const dy = e.touches[0].clientY - e.touches[1].clientY
            lastTouchDistance.current = Math.sqrt(dx * dx + dy * dy)
        }
    }

    const handleMove = useCallback((clientX: number, clientY: number) => {
        if (isPanning) {
            const dx = clientX - lastPos.current.x
            const dy = clientY - lastPos.current.y
            setPan((p: { x: number, y: number }) => clampPan(p.x + dx, p.y + dy, scale))
            lastPos.current = { x: clientX, y: clientY }
            hasMoved.current = true
        } else if (dragItems.size > 0) {
            const firstEntry = dragItems.values().next()
            if (firstEntry.done) return
            const first = firstEntry.value

            const dx = (clientX - first.startX) / scale
            const dy = (clientY - first.startY) / scale
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) hasMoved.current = true

            setItems((prev: BoardItem[]) => {
                let nextItems = [...prev]
                dragItems.forEach((state, id) => {
                    // Just move, no collision resolution during group drag for performance/stability
                    nextItems = nextItems.map(item => item.id === id ? {
                        ...item,
                        x: Math.round((state.initialX + dx) / GRID_SIZE) * GRID_SIZE,
                        y: Math.round((state.initialY + dy) / GRID_SIZE) * GRID_SIZE
                    } : item)
                })
                return nextItems
            })
        } else if (resizeItem) {
            const dx = (clientX - resizeItem.startX) / scale
            const dy = (clientY - resizeItem.startY) / scale
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) hasMoved.current = true
            setItems((prev: BoardItem[]) => prev.map((item: BoardItem) => item.id === resizeItem.id ? {
                ...item,
                w: Math.max(160, Math.round((resizeItem.initialW + dx) / GRID_SIZE) * GRID_SIZE),
                h: Math.max(160, Math.round((resizeItem.initialH + dy) / GRID_SIZE) * GRID_SIZE)
            } : item))
        }
    }, [isPanning, dragItems, resizeItem, scale, clampPan])

    const onTouchMove = useCallback((e: TouchEvent) => {
        if (e.touches.length === 1) {
            const touch = e.touches[0]
            if (isPanning || dragItems.size > 0 || resizeItem) {
                if (e.cancelable) e.preventDefault()
                handleMove(touch.clientX, touch.clientY)
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
    }, [handleMove, isPanning, dragItems, resizeItem, handleZoom])

    const finalizeInteraction = useCallback(() => {
        // Grouping Logic on Drop
        if (dragItems.size > 0) {
            setItems(currentItems => {
                let newItems = [...currentItems]
                const draggedIds = Array.from(dragItems.keys())

                draggedIds.forEach(dragId => {
                    const dragItem = newItems.find(i => i.id === dragId)
                    if (!dragItem) return

                    // Check collision with any OTHER item NOT in the drag set
                    // Use a smaller hitbox (center point + margin) to detect "dropped on top"
                    const target = newItems.find(i =>
                        !draggedIds.includes(i.id) &&
                        i.id !== dragId &&
                        isColliding({ ...dragItem, w: dragItem.w * 0.5, h: dragItem.h * 0.5, x: dragItem.x + dragItem.w * 0.25, y: dragItem.y + dragItem.h * 0.25 }, i)
                    )

                    if (target) {
                        const targetGroupId = target.groupId || target.id

                        // Assign all currently dragged items to the target group
                        newItems = newItems.map(i => {
                            if (draggedIds.includes(i.id)) {
                                return { ...i, groupId: targetGroupId }
                            }
                            // Ensure target has group ID too
                            if (i.id === target.id && !i.groupId) {
                                return { ...i, groupId: targetGroupId }
                            }
                            return i
                        })
                    }
                })
                return newItems
            })
        }

        setIsPanning(false)
        setDragItems(new Map())
        setResizeItem(null)
        lastTouchDistance.current = null
        setTimeout(() => { hasMoved.current = false }, 50)
    }, [dragItems])

    const onTouchEnd = useCallback(() => {
        finalizeInteraction()
    }, [finalizeInteraction])

    // --- Global Mouse Move / Up ---
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            handleMove(e.clientX, e.clientY)
        }

        const handleMouseUp = () => {
            finalizeInteraction()
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
    }, [handleMove, onTouchMove, onTouchEnd, finalizeInteraction])

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
                    <button onClick={autoArrange} className="p-2 hover:bg-gray-100 rounded-md text-gray-600" title="Auto Arrange">
                        <LayoutGrid size={18} />
                    </button>
                    <div className="w-[1px] h-4 bg-gray-200 mx-1"></div>
                    <button onClick={optimizeSize} className="p-2 hover:bg-gray-100 rounded-md text-gray-600" title="Optimize Size">
                        <Wand2 size={18} />
                    </button>
                    <div className="w-[1px] h-4 bg-gray-200 mx-1"></div>
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

            {/* Right Side Color Palette Indicator */}
            {colorPaletteId && (
                <div className="absolute top-1/2 right-4 -translate-y-1/2 z-50 flex flex-col gap-2 bg-white/90 backdrop-blur p-3 rounded-2xl shadow-xl border border-gray-100 animate-in slide-in-from-right-10 overflow-hidden">
                    <div className="text-[10px] font-bold text-center text-gray-400 mb-1">COLOR</div>
                    {COLORS.map((c) => (
                        <button
                            key={c}
                            onClick={() => {
                                setItems((prev: BoardItem[]) => prev.map(i => i.id === colorPaletteId ? { ...i, color: c } : i))
                            }}
                            className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${items.find(i => i.id === colorPaletteId)?.color === c ? 'border-black scale-110 shadow-md' : 'border-transparent'}`}
                            style={{ backgroundColor: c }}
                        />
                    ))}
                    <button
                        onClick={() => setColorPaletteId(null)}
                        className="mt-2 p-1 text-gray-400 hover:text-gray-600 text-[10px] font-bold text-center"
                    >
                        CLOSE
                    </button>
                </div>
            )}

            <div
                ref={containerRef}
                id="mind-board-bg"
                className="w-full h-full cursor-grab active:cursor-grabbing relative bg-white"
                onMouseDown={(e: React.MouseEvent) => {
                    // Only start pan if clicking directly on bg
                    if ((e.target as HTMLElement).id === 'mind-board-bg') {
                        startPan(e.clientX, e.clientY)
                    }
                    if ((e.target as HTMLElement).id === 'mind-board-bg') {
                        handleCanvasClick(e)
                    }
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
                            className={`absolute rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex flex-col group border border-black/5 hover:border-black/10 transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] overflow-hidden ${item.completed ? 'opacity-60 scale-[0.98]' : ''}`}
                            style={{
                                left: item.x,
                                top: item.y,
                                width: item.w,
                                height: item.h,
                                zIndex: item.zIndex,
                                backgroundColor: item.completed ? '#f3f4f6' : item.color
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
                            {/* Header / Top Handle */}
                            <div className="h-8 bg-black/5 flex items-center justify-between px-2 cursor-grab active:cursor-grabbing hover:bg-black/10 transition-colors"
                                onDoubleClick={(e) => {
                                    e.stopPropagation()
                                    handleDoubleTap(item.id)
                                }}
                                onTouchEnd={(e) => {
                                    const now = Date.now()
                                    if (now - lastClickTime.current < 300) {
                                        handleDoubleTap(item.id)
                                    }
                                    lastClickTime.current = now
                                }}
                            >
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: item.color === '#FFFFFF' ? '#e5e5e5' : item.color }}></div>
                                    <GripHorizontal size={14} className="text-gray-400" />
                                </div>
                                <div className="flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); toggleComplete(item.id) }}
                                        onTouchStart={(e: React.TouchEvent) => e.stopPropagation()}
                                        className={`p-1 rounded transition-colors ${item.completed ? 'text-green-600 bg-green-100' : 'text-gray-400 hover:bg-green-50 hover:text-green-500'}`}
                                    >
                                        <CheckCircle2 size={14} />
                                    </button>
                                    <button
                                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); deleteItem(item.id) }}
                                        onTouchStart={(e: React.TouchEvent) => e.stopPropagation()}
                                        className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-800"
                                    >
                                        <X size={14} />
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
                                        className={`w-full h-full text-sm font-medium whitespace-pre-wrap leading-relaxed cursor-text transition-all ${item.completed ? 'text-gray-400 line-through' : 'text-gray-800'}`}
                                        onClick={() => {
                                            if (!hasMoved.current && !item.completed) {
                                                setEditingId(item.id)
                                            }
                                        }}
                                    >
                                        {item.content || <span className="text-gray-300 italic">{item.completed ? '완료된 작업' : '클릭하여 내용 입력...'}</span>}
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
