'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Plus, Minus, Trash2, Edit2, GripHorizontal, MousePointer2 } from 'lucide-react'

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
    '#ffcfcf', // Red-ish
    '#cfffe1', // Green-ish
    '#cfebff', // Blue-ish
    '#fff4cf', // Yellow-ish
    '#ead1ff', // Purple-ish
    '#ffd6a5', // Orange-ish
]

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

    // Refs for tracking mouse movement without excessive re-renders logic if needed, 
    // but for simplicity we'll use state first.
    const containerRef = useRef<HTMLDivElement>(null)
    const lastMousePos = useRef({ x: 0, y: 0 })

    // --- Actions ---

    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            const zoomSensitivity = 0.001
            const newScale = Math.min(Math.max(0.1, scale - e.deltaY * zoomSensitivity), 3)
            setScale(newScale)
        } else {
            // Pan with scroll
            setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }))
        }
    }

    const startPan = (e: React.MouseEvent) => {
        // Only pan if clicking on background (target is the container itself or grid)
        if ((e.target as HTMLElement).id === 'mind-board-bg') {
            setIsPanning(true)
            lastMousePos.current = { x: e.clientX, y: e.clientY }
        }
    }

    const handleCreateItem = (e: React.MouseEvent) => {
        // Only create if we strictly clicked (mouse up) on background and didn't drag/pan
        // This logic is tricky with panning. 
        // Better pattern: Double click to create? Or distinct tool mode.
        // User said: "Click on the screen to create"
        // Let's implement creating on click if not panning/dragging.
    }

    // --- Item Interaction ---

    const bringToFront = (id: string) => {
        setMaxZIndex(prev => prev + 1)
        setItems(prev => prev.map(item => item.id === id ? { ...item, zIndex: maxZIndex + 1 } : item))
    }

    const startDrag = (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        const item = items.find(i => i.id === id)
        if (!item) return

        bringToFront(id)
        setDragItem({
            id,
            startX: e.clientX,
            startY: e.clientY,
            initialX: item.x,
            initialY: item.y
        })
    }

    const startResize = (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        const item = items.find(i => i.id === id)
        if (!item) return

        bringToFront(id)
        setResizeItem({
            id,
            startX: e.clientX,
            startY: e.clientY,
            initialW: item.w,
            initialH: item.h
        })
    }

    const deleteItem = (id: string) => {
        if (confirm('정말 삭제하시겠습니까?')) {
            setItems(prev => prev.filter(i => i.id !== id))
        }
    }

    // --- Global Mouse Move / Up ---

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isPanning) {
                const dx = e.clientX - lastMousePos.current.x
                const dy = e.clientY - lastMousePos.current.y
                setPan(p => ({ x: p.x + dx, y: p.y + dy }))
                lastMousePos.current = { x: e.clientX, y: e.clientY }
            } else if (dragItem) {
                const dx = (e.clientX - dragItem.startX) / scale
                const dy = (e.clientY - dragItem.startY) / scale

                // Snap to grid
                let newX = Math.round((dragItem.initialX + dx) / GRID_SIZE) * GRID_SIZE
                let newY = Math.round((dragItem.initialY + dy) / GRID_SIZE) * GRID_SIZE

                setItems(prev => prev.map(item =>
                    item.id === dragItem.id ? { ...item, x: newX, y: newY } : item
                ))
            } else if (resizeItem) {
                const dx = (e.clientX - resizeItem.startX) / scale
                const dy = (e.clientY - resizeItem.startY) / scale

                // Snap to grid
                let newW = Math.max(GRID_SIZE * 4, Math.round((resizeItem.initialW + dx) / GRID_SIZE) * GRID_SIZE)
                let newH = Math.max(GRID_SIZE * 2, Math.round((resizeItem.initialH + dy) / GRID_SIZE) * GRID_SIZE)

                setItems(prev => prev.map(item =>
                    item.id === resizeItem.id ? { ...item, w: newW, h: newH } : item
                ))
            }
        }

        const handleMouseUp = () => {
            setIsPanning(false)
            setDragItem(null)
            setResizeItem(null)
        }

        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)

        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isPanning, dragItem, resizeItem, scale])


    // --- Double Click to Create ---
    const handleDoubleClick = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).id === 'mind-board-bg') {
            const rect = containerRef.current?.getBoundingClientRect()
            if (!rect) return

            // Calculate position relative to container, accounting for pan and zoom
            // x_screen = x_world * scale + pan_x + rect.left
            // x_world = (x_screen - rect.left - pan_x) / scale

            const xWorld = (e.clientX - rect.left - pan.x) / scale
            const yWorld = (e.clientY - rect.top - pan.y) / scale

            // Snap to grid
            const snappedX = Math.round((xWorld - 150) / GRID_SIZE) * GRID_SIZE // Center horizontally (width 300 / 2)
            const snappedY = Math.round((yWorld - 50) / GRID_SIZE) * GRID_SIZE // Center vertically (height 100 / 2)

            const newItem: BoardItem = {
                id: Date.now().toString(),
                x: snappedX,
                y: snappedY,
                w: 320, // Initial Width (multiple of 40)
                h: 120,  // Initial Height (multiple of 40)
                content: '새로운 아이디어',
                color: COLORS[Math.floor(Math.random() * COLORS.length)],
                zIndex: maxZIndex + 1
            }

            setMaxZIndex(prev => prev + 1)
            setItems(prev => [...prev, newItem])
        }
    }


    return (
        <div className="w-full h-[calc(100vh-60px)] relative overflow-hidden bg-gray-50 select-none">
            {/* Toolbar / Controls */}
            <div className="absolute top-4 left-4 z-50 flex gap-2">
                <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-1 flex items-center gap-1">
                    <button onClick={() => setScale(s => Math.min(s + 0.1, 3))} className="p-2 hover:bg-gray-100 rounded-md">
                        <Plus size={18} />
                    </button>
                    <span className="w-12 text-center text-xs font-bold font-mono">{Math.round(scale * 100)}%</span>
                    <button onClick={() => setScale(s => Math.max(s - 0.1, 0.1))} className="p-2 hover:bg-gray-100 rounded-md">
                        <Minus size={18} />
                    </button>
                </div>
                <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-lg shadow-lg border border-gray-200 text-xs font-bold text-gray-500">
                    Background Double-click: Create Board | Drag: Pan | Wheel: Pan/Zoom
                </div>
            </div>

            {/* Canvas Container */}
            <div
                ref={containerRef}
                id="mind-board-bg"
                className="w-full h-full cursor-grab active:cursor-grabbing relative"
                onMouseDown={startPan}
                onDoubleClick={handleDoubleClick}
                onWheel={handleWheel}
                style={{
                    backgroundImage: `
                        linear-gradient(to right, #ddd 1px, transparent 1px),
                        linear-gradient(to bottom, #ddd 1px, transparent 1px)
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
                    {items.map(item => (
                        <div
                            key={item.id}
                            className="absolute rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex flex-col group border border-black/5 hover:border-black/10 transition-shadow hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)]"
                            style={{
                                left: item.x,
                                top: item.y,
                                width: item.w,
                                height: item.h,
                                backgroundColor: item.color,
                                zIndex: item.zIndex
                            }}
                            onMouseDown={(e) => e.stopPropagation()} // Prevent pan start when clicking item
                        >
                            {/* Header / Drag Handle */}
                            <div
                                className="h-8 flex items-center justify-between px-2 cursor-grab active:cursor-grabbing hover:bg-black/5 rounded-t-xl transition-colors"
                                onMouseDown={(e) => startDrag(e, item.id)}
                            >
                                <GripHorizontal size={14} className="text-black/20" />
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => setEditingId(item.id)}
                                        className="p-1 hover:bg-white/50 rounded text-black/40 hover:text-black"
                                    >
                                        <Edit2 size={12} />
                                    </button>
                                    <button
                                        onClick={() => deleteItem(item.id)}
                                        className="p-1 hover:bg-red-100 rounded text-red-400 hover:text-red-600"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 p-3 pt-0 overflow-hidden relative">
                                {editingId === item.id ? (
                                    <textarea
                                        autoFocus
                                        className="w-full h-full bg-transparent resize-none outline-none text-sm font-medium text-gray-800 leading-relaxed"
                                        value={item.content}
                                        onChange={(e) => setItems(prev => prev.map(i => i.id === item.id ? { ...i, content: e.target.value } : i))}
                                        onBlur={() => setEditingId(null)}
                                        onKeyDown={(e) => {
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
                                        {item.content || <span className="text-black/20 italic">내용을 입력하세요...</span>}
                                    </div>
                                )}
                            </div>

                            {/* Resize Handle */}
                            <div
                                className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-end justify-end p-1 hover:bg-black/5 rounded-br-xl"
                                onMouseDown={(e) => startResize(e, item.id)}
                            >
                                <svg width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-30">
                                    <path d="M8 8H0L8 0V8Z" fill="currentColor" />
                                </svg>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
