'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, Minus, GripHorizontal, X, CheckCircle2, LayoutGrid, Wand2, MousePointer2, Type, Lock, Unlock } from 'lucide-react'

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

// Group Metadata (name, etc.)
interface GroupData {
    id: string
    name: string
}

const GRID_SIZE = 80

const COLORS = [
    '#FFB7B2', '#FFDAC1', '#E2F0CB', '#B5EAD7', '#C7CEEA',
    '#F2D7EE', '#D3E0EA', '#F6F6EB', '#FDFFB6', '#E5E5E5'
]

export default function MindBoardClient() {
    // State
    const [items, setItems] = useState<BoardItem[]>([])
    // Manage group metadata separately or derive? Let's use a simple map stored in state.
    // However, syncing complex state in one file is tricky. 
    // Let's store group names in a separate state, persisted.
    const [groups, setGroups] = useState<GroupData[]>([])

    const [scale, setScale] = useState(0.5) // Start zoomed out a bit
    const [pan, setPan] = useState({ x: 0, y: 0 }) // Start at 0,0
    const [isPanning, setIsPanning] = useState(false)

    // Selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [selectionBox, setSelectionBox] = useState<{ startX: number, startY: number, currentX: number, currentY: number } | null>(null)

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
    const lastEnterTime = useRef(0) // For double enter detection
    const hasMoved = useRef(false)
    const minimapTimeout = useRef<NodeJS.Timeout | null>(null)
    const [showMinimap, setShowMinimap] = useState(false)
    const [isSpacePressed, setIsSpacePressed] = useState(false)
    const [isMinimapDragging, setIsMinimapDragging] = useState(false)
    const minimapDragState = useRef<{ startX: number, startY: number, startPan: { x: number, y: number }, worldWidth: number, worldHeight: number } | null>(null)

    // --- Persistence ---
    useEffect(() => {
        const savedItems = localStorage.getItem('mindboard-items')
        const savedGroups = localStorage.getItem('mindboard-groups')
        if (savedItems) {
            try {
                const parsed = JSON.parse(savedItems)
                setItems(parsed)
                const maxZ = parsed.reduce((max: number, item: any) => Math.max(max, item.zIndex || 1), 1)
                setMaxZIndex(maxZ)
            } catch (e) {
                console.error("Failed to load items", e)
            }
        }
        if (savedGroups) {
            try {
                setGroups(JSON.parse(savedGroups))
            } catch (e) { console.error(e) }
        }
    }, [])

    useEffect(() => {
        if (items.length > 0) localStorage.setItem('mindboard-items', JSON.stringify(items))
        localStorage.setItem('mindboard-groups', JSON.stringify(groups))
    }, [items, groups])

    // --- Helpers ---
    const getBoundaries = useCallback((currentScale: number) => {
        const container = containerRef.current
        if (!container) return { minX: 0, maxX: 0, minY: 0, maxY: 0 }

        // Allow panning freely within the world bounds, plus some padding
        // World is 0 to WORLD_SIZE.
        // Viewport sees [ -pan.x / scale, (-pan.x + width) / scale ]
        // We want -pan.x / scale to be >= -PADDING and <= WORLD_SIZE
        // We want -pan.x / scale to be >= -PADDING and <= WORLD_SIZE

        // Let's implement a looser clamp roughly keeping content in view is preferred, 
        // but user asked to reach "ends".
        // If content is at 7000, and screen shows 1000px, we need pan.x to reach -7000*scale roughly.

        return {
            minX: -Infinity,
            maxX: Infinity,
            minY: -Infinity,
            maxY: Infinity
        }
    }, [])

    const clampPan = useCallback((x: number, y: number, currentScale: number) => {
        // For now, let's DISABLE strict clamping to solve "cannot move to left/right end"
        // User likely feels constrained.
        // Or implement very loose clamping.
        // const { minX, maxX, minY, maxY } = getBoundaries(currentScale)
        // return {
        //    x: Math.max(minX, Math.min(maxX, x)),
        //    y: Math.max(minY, Math.min(maxY, y))
        // }
        // Simple unclamped for freedom (or very large bounds)
        return { x, y }
    }, [])

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
        // Recursive collision resolution for ALL items? Expensive.
        // Simplified: Move 'movingId' out of others.
        const movingItem = newItems.find(i => i.id === movingId)
        if (!movingItem) return newItems

        let changed = false
        const updated = newItems.map(item => {
            if (item.id === movingId) return item

            // Ignore if in same group
            if (movingItem.groupId && movingItem.groupId === item.groupId) return item

            if (isColliding(movingItem, item)) {
                changed = true
                const dx = (item.x + item.w / 2) - (movingItem.x + movingItem.w / 2)
                const dy = (item.y + item.h / 2) - (movingItem.y + movingItem.h / 2)

                let nx = item.x
                let ny = item.y

                if (Math.abs(dx) > Math.abs(dy)) {
                    nx = dx > 0 ? movingItem.x + movingItem.w + 20 : movingItem.x - item.w - 20
                } else {
                    ny = dy > 0 ? movingItem.y + movingItem.h + 20 : movingItem.y - item.h - 20
                }

                return { ...item, x: Math.round(nx / GRID_SIZE) * GRID_SIZE, y: Math.round(ny / GRID_SIZE) * GRID_SIZE }
            }
            return item
        })

        return changed ? resolveCollision(movingId, updated) : updated
    }, [])

    const createMemo = useCallback((x: number, y: number, shouldEdit: boolean = false) => {


        const snappedX = Math.round((x - 120) / GRID_SIZE) * GRID_SIZE
        const snappedY = Math.round((y - 80) / GRID_SIZE) * GRID_SIZE

        const newItem: BoardItem = {
            id: Date.now().toString(),
            x: snappedX,
            y: snappedY,
            w: 160,
            h: 160,
            content: '',
            color: '#FFFFFF',
            zIndex: maxZIndex + 1,
            completed: false,
            // groupId: Date.now().toString() // Standalone items have NO group initially
        }

        setMaxZIndex((prev: number) => prev + 1)
        setItems((prev: BoardItem[]) => resolveCollision(newItem.id, [...prev, newItem]))

        if (shouldEdit) {
            setEditingId(newItem.id)
        }
    }, [maxZIndex, resolveCollision])

    // --- Actions ---
    const handleZoom = useCallback((delta: number, pivotX: number, pivotY: number) => {
        const container = containerRef.current
        if (!container) return

        const rect = container.getBoundingClientRect()
        const mouseX = pivotX - rect.left
        const mouseY = pivotY - rect.top

        const minScale = 0.1
        const newScale = Math.min(Math.max(minScale, scale * (1 + delta)), 3)

        if (newScale === scale) return

        const xWorld = (mouseX - pan.x) / scale
        const yWorld = (mouseY - pan.y) / scale

        const newPanX = mouseX - xWorld * newScale
        const newPanY = mouseY - yWorld * newScale

        setScale(newScale)
        setPan({ x: newPanX, y: newPanY })

        // Show minimap
        setShowMinimap(true)
        if (minimapTimeout.current) clearTimeout(minimapTimeout.current)
        minimapTimeout.current = setTimeout(() => setShowMinimap(false), 2000)
    }, [pan, scale])

    const handleWheel = (e: React.WheelEvent) => {
        // e.preventDefault() // React SyntheticEvent doesn't support passive preventDefault well in some versions, but let's try
        // Actually, for wheel zoom, we might not need preventDefault if we just handle zoom.
        // But to stop page scroll, we need it. 
        // Note: Passive event listeners are default in some browsers for wheel.
        const zoomSensitivity = -0.001
        handleZoom(e.deltaY * zoomSensitivity, e.clientX, e.clientY)
    }

    const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
        const clientX = 'touches' in e ? (e as any).touches[0].clientX : (e as any).clientX
        const clientY = 'touches' in e ? (e as any).touches[0].clientY : (e as any).clientY
        const { x, y } = getWorldCoords(clientX, clientY)
        createMemo(x, y)
    }

    const startPan = (clientX: number, clientY: number) => {
        setIsPanning(true)
        lastPos.current = { x: clientX, y: clientY }
    }

    const bringToFront = (id: string, groupIds: string[] = []) => {
        setMaxZIndex((prev: number) => prev + 1)
        setItems((prev: BoardItem[]) => prev.map((item: BoardItem) => {
            if (item.id === id || groupIds.includes(item.groupId || '')) {
                return { ...item, zIndex: maxZIndex + 1 }
            }
            return item
        }))
    }

    const startDrag = (clientX: number, clientY: number, id: string, shiftKey: boolean, isGroupDrag: boolean = false) => {
        // Selection Logic
        let newSelection = new Set(selectedIds)

        if (isGroupDrag) {
            // If group drag, we select ALL members of the group
            const groupMembers = items.filter(i => i.groupId === id)
            const memberIds = groupMembers.map(i => i.id)
            // Clear previous selection if not shift? Or just add?
            // "Group drag" usually implies moving the group.
            if (!shiftKey) newSelection.clear()
            memberIds.forEach(mid => newSelection.add(mid))
            setSelectedIds(newSelection)
        } else {
            // Item Drag
            const item = items.find((i: BoardItem) => i.id === id)
            if (!item) return

            if (shiftKey) {
                if (newSelection.has(id)) newSelection.delete(id)
                else newSelection.add(id)
                setSelectedIds(newSelection)
            } else {
                // If dragging something NOT in selection, clear selection and select IT
                if (!newSelection.has(id)) {
                    newSelection = new Set([id])
                    setSelectedIds(newSelection)
                }
                // If dragging something IN selection, keep selection
            }
        }

        // Determine all items to drag
        const itemsToDragIds = new Set<string>()

        // 1. Add all selected items
        newSelection.forEach(sid => itemsToDragIds.add(sid))

        // 2. Add all group members --> REMOVED for Item Drag
        // Only if isGroupDrag is true, we already selected them.
        // If I drag a single item in a group, it should move ALONE now.
        // So we DON'T auto-expand to group members unless they are selected.

        // However, if we move a group header (isGroupDrag), we selected all members, so they are in itemsToDragIds.

        if (isGroupDrag) {
            // Ensure all group members are dragged
            // (Already handled by selection above)
        }

        if (!isGroupDrag) {
            bringToFront(id)
        }

        const newMap = new Map()
        itemsToDragIds.forEach(dragId => {
            const member = items.find(i => i.id === dragId)
            if (member) {
                newMap.set(member.id, {
                    startX: clientX,
                    startY: clientY,
                    initialX: member.x,
                    initialY: member.y
                })
            }
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

    const packGroup = (members: BoardItem[]) => {
        if (members.length <= 1) return members;
        const sortedInGroup = [...members].sort((a, b) => a.y - b.y || a.x - b.x);
        let curX = 0;
        let curY = 0;
        let maxH = 0;
        return sortedInGroup.map((m, idx) => {
            const newItem = { ...m, x: curX, y: curY };
            curX += m.w + 20;
            maxH = Math.max(maxH, m.h);
            if (idx % 2 === 1) { curX = 0; curY += maxH + 40; maxH = 0; }
            return newItem;
        });
    }

    const autoArrange = () => {
        const container = containerRef.current
        if (!container || items.length === 0) return
        const gap = 20

        // Arrange GROUPS and Singles
        // Detect groups
        const handledIds = new Set<string>()
        const layoutObjects: { x: number, y: number, w: number, h: number, items: BoardItem[] }[] = []

        // Helper to get group bounds
        const getGroupBounds = (groupId: string) => {
            const members = items.filter(i => i.groupId === groupId)
            const minX = Math.min(...members.map(i => i.x))
            const minY = Math.min(...members.map(i => i.y))
            const maxX = Math.max(...members.map(i => i.x + i.w))
            const maxY = Math.max(...members.map(i => i.y + i.h))
            return { x: minX, y: minY, w: maxX - minX, h: maxY - minY, items: members }
        }

        items.forEach(item => {
            if (handledIds.has(item.id)) return
            if (item.groupId) {
                const group = getGroupBounds(item.groupId)
                layoutObjects.push(group)
                group.items.forEach(i => handledIds.add(i.id))
            } else {
                layoutObjects.push({ x: item.x, y: item.y, w: item.w, h: item.h, items: [item] })
                handledIds.add(item.id)
            }
        })

        // Sort layout objects
        layoutObjects.sort((a, b) => {
            const rowDiff = a.y - b.y
            if (Math.abs(rowDiff) > 100) return rowDiff
            return a.x - b.x
        })

        let currentX = 100
        let currentY = 100
        let maxHeightInRow = 0
        let newItems: BoardItem[] = []

        layoutObjects.forEach(obj => {
            // Calculate offset to move object to currentX, currentY
            const dx = currentX - obj.x
            const dy = currentY - obj.y

            // Move all items in this object
            obj.items.forEach(i => {
                newItems.push({
                    ...i,
                    x: i.x + dx,
                    y: i.y + dy
                })
            })

            // Update cursor
            currentX += obj.w + gap
            maxHeightInRow = Math.max(maxHeightInRow, obj.h)

            if (currentX > 2000) { // Wrap width
                currentX = 100
                currentY += maxHeightInRow + gap
                maxHeightInRow = 0
            }
        })

        setItems(newItems)
        setPan({ x: -100, y: -100 }) // Reset view
    }

    const unGroup = (groupId: string) => {
        if (!confirm('그룹을 해제하시겠습니까?')) return
        setItems(prev => prev.map(item => item.groupId === groupId ? { ...item, groupId: undefined } : item))
        setGroups(prev => prev.filter(g => g.id !== groupId))
    }

    const arrangeGroup = (groupId: string) => {
        setItems(prev => {
            const members = prev.filter(i => i.groupId === groupId)
            const otherItems = prev.filter(i => i.groupId !== groupId)
            if (members.length === 0) return prev

            // Find top-left of group
            const minX = Math.min(...members.map(i => i.x))
            const minY = Math.min(...members.map(i => i.y))

            const packed = packGroup(members)

            const updatedMembers = members.map(m => {
                const p = packed.find(p => p.id === m.id)
                if (p) return { ...m, x: minX + p.x, y: minY + p.y }
                return m
            })

            return [...otherItems, ...updatedMembers]
        })
    }

    const optimizeGroup = (groupId: string) => {
        setItems(prev => {
            const members = prev.filter(i => i.groupId === groupId)
            const otherItems = prev.filter(i => i.groupId !== groupId)
            if (members.length === 0) return prev

            // 1. Resize members
            const resisedMembers = members.map(item => {
                const lines = item.content.split('\n').length
                const length = item.content.length
                let targetW = 240
                let targetH = 160
                if (length < 20 && lines <= 2) {
                    targetW = 160
                    targetH = 160
                } else if (length > 100 || lines > 5) {
                    targetW = 320
                    targetH = Math.max(160, Math.ceil((lines * 24 + 60) / GRID_SIZE) * GRID_SIZE)
                }
                return { ...item, w: targetW, h: targetH }
            })

            // 2. Arrange
            // Find top-left of group
            const minX = Math.min(...resisedMembers.map(i => i.x))
            const minY = Math.min(...resisedMembers.map(i => i.y))

            const packed = packGroup(resisedMembers)
            const updatedMembers = resisedMembers.map(m => {
                const p = packed.find(p => p.id === m.id)
                if (p) return { ...m, x: minX + p.x, y: minY + p.y }
                return m
            })

            return [...otherItems, ...updatedMembers]
        })
    }

    const optimizeSize = () => {
        setItems(prev => {
            const nextItems = prev.map(item => {
                const lines = item.content.split('\\n').length
                const length = item.content.length
                let targetW = 240
                let targetH = 160
                if (length < 20 && lines <= 2) {
                    targetW = 160
                    targetH = 160
                } else if (length > 100 || lines > 5) {
                    targetW = 320
                    targetH = Math.max(160, Math.ceil((lines * 24 + 60) / GRID_SIZE) * GRID_SIZE)
                }
                return { ...item, w: targetW, h: targetH }
            })

            // Pull group members together
            const handledGroups = new Set<string>()
            nextItems.forEach(item => {
                if (item.groupId && !handledGroups.has(item.groupId)) {
                    const members = nextItems.filter(i => i.groupId === item.groupId)
                    const packed = packGroup(members)
                    // Apply packed coords
                    packed.forEach(p => {
                        const idx = nextItems.findIndex(ni => ni.id === p.id)
                        if (idx > -1) {
                            nextItems[idx].x = item.x + p.x
                            nextItems[idx].y = item.y + p.y
                        }
                    })
                    handledGroups.add(item.groupId)
                }
            })
            return nextItems
        })
    }

    const handleDoubleTap = (id: string) => {
        setColorPaletteId(id)
    }

    const renameGroup = (groupId: string) => {
        const group = groups.find(g => g.id === groupId)
        const newName = prompt("Enter Group Name", group?.name || "New Group")
        if (newName) {
            setGroups(prev => {
                const existing = prev.find(g => g.id === groupId)
                if (existing) return prev.map(g => g.id === groupId ? { ...g, name: newName } : g)
                return [...prev, { id: groupId, name: newName }]
            })
        }
    }

    const onTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            const touch = e.touches[0]
            const target = e.target as HTMLElement
            if (!target.closest('.cursor-nwse-resize') && !target.closest('.cursor-grab') && !target.closest('button')) {
                // if (e.cancelable) e.preventDefault() 
                startPan(touch.clientX, touch.clientY)

                const now = Date.now()
                if (now - lastClickTime.current < 300) {
                    handleCanvasClick(e)
                }
                lastClickTime.current = now
            }
        } else if (e.touches.length === 2) {
            if (e.cancelable) e.preventDefault()
            const dx = e.touches[0].clientX - e.touches[1].clientX
            const dy = e.touches[0].clientY - e.touches[1].clientY
            lastTouchDistance.current = Math.sqrt(dx * dx + dy * dy)
        }
    }

    // --- Interaction Loop ---
    const handleMove = useCallback((clientX: number, clientY: number) => {
        if (isPanning) {
            const dx = clientX - lastPos.current.x
            const dy = clientY - lastPos.current.y
            setPan(p => ({ x: p.x + dx, y: p.y + dy })) // Unclamped for now
            lastPos.current = { x: clientX, y: clientY }
            hasMoved.current = true

            // Show minimap
            setShowMinimap(true)
            if (minimapTimeout.current) clearTimeout(minimapTimeout.current)
            minimapTimeout.current = setTimeout(() => setShowMinimap(false), 2000)
        } else if (isMinimapDragging && minimapDragState.current) {
            const state = minimapDragState.current
            const dx = clientX - state.startX
            const dy = clientY - state.startY

            // Minimap width is fixed at 192px (w-48 = 12rem = 192px)
            // Minimap height is fixed at 144px (h-36 = 9rem = 144px)
            const minimapW = 192
            const minimapH = 144

            // Delta World = (Delta Pixel / Minimap Size) * World Size
            const dWorldX = (dx / minimapW) * state.worldWidth
            const dWorldY = (dy / minimapH) * state.worldHeight

            // Pan = -World * Scale
            // New Pan = StartPan - (dWorld * Scale)

            setPan({
                x: state.startPan.x - dWorldX * scale,
                y: state.startPan.y - dWorldY * scale
            })

            setShowMinimap(true) // Keep showing
        } else if (dragItems.size > 0) {
            const firstEntry = dragItems.values().next()
            if (firstEntry.done) return
            const first = firstEntry.value
            const dx = (clientX - first.startX) / scale
            const dy = (clientY - first.startY) / scale
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) hasMoved.current = true

            // Correct Grid Snapping: Snap the DELTA, not individual items, to keep relative positions
            const snapDx = Math.round(dx / GRID_SIZE) * GRID_SIZE
            const snapDy = Math.round(dy / GRID_SIZE) * GRID_SIZE

            setItems(prev => prev.map(item => {
                const state = dragItems.get(item.id)
                if (state) {
                    return {
                        ...item,
                        x: state.initialX + snapDx,
                        y: state.initialY + snapDy
                    }
                }
                return item
            }))
        } else if (resizeItem) {
            const dx = (clientX - resizeItem.startX) / scale
            const dy = (clientY - resizeItem.startY) / scale
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) hasMoved.current = true
            setItems(prev => prev.map(item => item.id === resizeItem.id ? {
                ...item,
                w: Math.max(160, Math.round((resizeItem.initialW + dx) / GRID_SIZE) * GRID_SIZE),
                h: Math.max(160, Math.round((resizeItem.initialH + dy) / GRID_SIZE) * GRID_SIZE)
            } : item))
        } else if (selectionBox) {
            const rect = containerRef.current?.getBoundingClientRect()
            if (rect) {
                setSelectionBox(prev => prev ? ({ ...prev, currentX: clientX - rect.left, currentY: clientY - rect.top }) : null)
            }
        }
    }, [isPanning, dragItems, resizeItem, selectionBox, scale])

    const finalizeInteraction = useCallback(() => {
        // Grouping Logic on Drop
        if (dragItems.size > 0 && !selectionBox) { // Don't group if it was a selection drag? or yes? Yes.
            setItems(currentItems => {
                let newItems = [...currentItems]
                const draggedIds = Array.from(dragItems.keys())

                // We only want to process grouping if we dragged a single item or a single group?
                // If we dragged multiple disjoint items, grouping logic is ambiguous.
                // Let's simplify: Check if the *primary* dragged item (first one) creates a merge.

                const primaryId = draggedIds[0]
                const primaryItem = newItems.find(i => i.id === primaryId)

                if (primaryItem) {
                    // Check collision with non-dragged items
                    const target = newItems.find(i =>
                        !draggedIds.includes(i.id) &&
                        // Ignore collision with items in same group as dragged items (already handled by drag set)
                        !(primaryItem.groupId && i.groupId === primaryItem.groupId) &&
                        isColliding({ ...primaryItem, w: primaryItem.w * 0.8, h: primaryItem.h * 0.8, x: primaryItem.x + primaryItem.w * 0.1, y: primaryItem.y + primaryItem.h * 0.1 }, i)
                    )

                    if (target) {
                        // FOUND TARGET
                        const isTargetGroup = !!target.groupId
                        const isPrimaryGroup = !!primaryItem.groupId

                        let finalGroupId = target.groupId || target.id
                        if (isPrimaryGroup && !isTargetGroup) {
                            finalGroupId = primaryItem.groupId!
                        } else if (!isTargetGroup && !isPrimaryGroup) {
                            // New Group ID
                            finalGroupId = Date.now().toString()
                        }

                        // Determine the group ID to use
                        // If target is already in a group, use that.
                        // If not, and primary is a group, use that.
                        // If neither, create new.
                        // Actually, logic:
                        // "Drag A onto B" -> A joins B's group (or new).
                        // If A is group -> Merge A's group into B's group?
                        // User: "New board overlaps -> enters group -> re-sorts"

                        // Let's settle on: Merge all dragged items + target (+ target's group members) into ONE group.
                        const targetGroupId = target.groupId
                        const primaryGroupId = primaryItem.groupId

                        // If both have groups and they are different -> Merge groups
                        // If one has group -> Add other to it
                        // If neither -> Create new group

                        let destinationGroupId = targetGroupId
                        if (!destinationGroupId) {
                            if (primaryGroupId) destinationGroupId = primaryGroupId
                            else destinationGroupId = Date.now().toString()
                        }

                        // If merging two groups, keep one ID (destinationGroupId)

                        // 1. Identify all items involved in the new group
                        const currentMembersOfDestination = destinationGroupId ? newItems.filter(i => i.groupId === destinationGroupId) : (targetGroupId ? [] : [target])
                        // If target was single, it wasn't in "currentMembersOfDestination" if we detected by groupId, so add it if needed
                        if (!targetGroupId && !currentMembersOfDestination.find(x => x.id === target.id)) currentMembersOfDestination.push(target)

                        // 2. Identify incoming items
                        // draggedIds are the ones moving.
                        // Also include any members of primaryGroupId if we are merging that whole group in, 
                        // but Drag Logic already selected all group members if shift not pressed? 
                        // Our startDrag logic selects all group members. So draggedIds contains all of them.

                        // 3. Update groupId for all dragged items
                        const updatedItems = newItems.map(i => {
                            if (draggedIds.includes(i.id)) return { ...i, groupId: destinationGroupId }
                            if (!targetGroupId && i.id === target.id) return { ...i, groupId: destinationGroupId } // Promote target to group
                            // If we are merging a target GROUP (and we aren't using its ID for some reason), update them too?
                            // Logic above picked targetGroupId as first choice, so target's group is already the destination.
                            return i
                        })

                        // 4. Re-pack (Auto-arrange) the ENTIRE destination group
                        const allMembers = updatedItems.filter(i => i.groupId === destinationGroupId)

                        // Determine Top-Left of the group to keep it roughly in place?
                        // Or just sort and pack.
                        // Use Top-Left of the TARGET as the anchor? Or the average/min?
                        // Let's use the Minimum X,Y of the combined group as the start point.
                        const minX = Math.min(...allMembers.map(i => i.x))
                        const minY = Math.min(...allMembers.map(i => i.y))

                        const packed = packGroup(allMembers)

                        // Apply packed positions relative to minX, minY
                        packed.forEach(p => {
                            const idx = updatedItems.findIndex(x => x.id === p.id)
                            if (idx > -1) {
                                updatedItems[idx].x = minX + p.x
                                updatedItems[idx].y = minY + p.y
                            }
                        })

                        // 5. Update Items
                        newItems = updatedItems
                    }
                }
                return newItems
            })
        }

        // Selection Box Finalize
        if (selectionBox) {
            const container = containerRef.current
            if (container) {
                // Calc intersection
                const rect = container.getBoundingClientRect()
                // Convert selection box to world coords
                const sbX = (selectionBox.startX - pan.x) / scale // World X start ?? No.
                // selectionBox stores client relative to container
                // We need world coords of the box
                const x1 = Math.min(selectionBox.startX, selectionBox.currentX)
                const x2 = Math.max(selectionBox.startX, selectionBox.currentX)
                const y1 = Math.min(selectionBox.startY, selectionBox.currentY)
                const y2 = Math.max(selectionBox.startY, selectionBox.currentY)

                // World bounds
                const wx1 = x1 / scale - pan.x / scale
                const wx2 = x2 / scale - pan.x / scale
                const wy1 = y1 / scale - pan.y / scale
                const wy2 = y2 / scale - pan.y / scale

                const newSelected = new Set(selectedIds)
                items.forEach(item => {
                    // Check intersection
                    if (item.x < wx2 && item.x + item.w > wx1 && item.y < wy2 && item.y + item.h > wy1) {
                        newSelected.add(item.id)
                    }
                })
                setSelectedIds(newSelected)
            }
        }

        setIsPanning(false)
        setDragItems(new Map())
        setResizeItem(null)
        setSelectionBox(null)
        lastTouchDistance.current = null
        setTimeout(() => { hasMoved.current = false }, 50)
    }, [dragItems, selectionBox, items, pan, scale, selectedIds])

    // --- Events Sync ---
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY)
        // Global mouse up to catch drops outside
        const handleMouseUp = () => {
            finalizeInteraction()
            setIsMinimapDragging(false)
            minimapDragState.current = null
        }

        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)

        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
        }
    }, [handleMove, finalizeInteraction])

    // Detect Double Enter
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' && !e.repeat) {
                const target = e.target as HTMLElement
                if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
                    // e.preventDefault() // prevent scroll?
                    setIsSpacePressed(true)
                }
            }
            if ((e.metaKey || e.ctrlKey) && e.key === '0') {
                e.preventDefault()
                // Reset View
                // Calculate bounds to fit? Or just reset to 0,0?
                // Plan: Reset to 0,0 and scale 1?
                // Better: Auto-arrange view to fit content?
                // Let's just reset to origin for now as per "Ctrl+0" standard, or fit content if possible.
                // Simple: scale 1, pan 0,0
                setPan({ x: 0, y: 0 })
                setScale(1)
            }

            if (e.key === 'Enter') {
                const target = e.target as HTMLElement
                // Ignore if typing in an input or textarea
                if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

                const now = Date.now()
                if (now - lastEnterTime.current < 300) {
                    e.preventDefault()
                    // Create memo at center of screen
                    const container = containerRef.current
                    if (container) {
                        const centerX = container.clientWidth / 2
                        const centerY = container.clientHeight / 2
                        const { x, y } = getWorldCoords(centerX, centerY)
                        createMemo(x, y, true)
                    }
                    lastEnterTime.current = 0
                } else {
                    lastEnterTime.current = now
                }
            }
        }
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                setIsSpacePressed(false)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('keyup', handleKeyUp)
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('keyup', handleKeyUp)
        }
    }, [createMemo, getWorldCoords])

    const scrollToGroup = (groupId: string) => {
        const members = items.filter(i => i.groupId === groupId)
        if (members.length === 0) return
        const minX = Math.min(...members.map(i => i.x))
        const minY = Math.min(...members.map(i => i.y))
        const maxX = Math.max(...members.map(i => i.x + i.w))
        const maxY = Math.max(...members.map(i => i.y + i.h))

        const container = containerRef.current
        if (!container) return

        const centerX = (minX + maxX) / 2
        const centerY = (minY + maxY) / 2

        setPan({
            x: -centerX * scale + container.clientWidth / 2,
            y: -centerY * scale + container.clientHeight / 2
        })
    }

    // Render Group Outlines/Names
    const renderGroups = () => {
        const groupBounds = new Map<string, { minX: number, minY: number, maxX: number, maxY: number }>()
        items.forEach(i => {
            if (i.groupId) {
                const b = groupBounds.get(i.groupId) || { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
                groupBounds.set(i.groupId, {
                    minX: Math.min(b.minX, i.x),
                    minY: Math.min(b.minY, i.y),
                    maxX: Math.max(b.maxX, i.x + i.w),
                    maxY: Math.max(b.maxY, i.y + i.h)
                })
            }
        })

        return Array.from(groupBounds.entries()).map(([gid, bounds]) => {
            if (items.filter(i => i.groupId === gid).length < 2) return null

            const groupName = groups.find(g => g.id === gid)?.name || "Group"
            return (
                <div key={gid}
                    className="absolute border-2 border-dashed border-sky-300 rounded-2xl pointer-events-none transition-all"
                    style={{
                        left: bounds.minX - 20,
                        top: bounds.minY - 40,
                        width: bounds.maxX - bounds.minX + 40,
                        height: bounds.maxY - bounds.minY + 60,
                        zIndex: 0
                    }}
                >
                    <div
                        className="absolute -top-3 left-4 bg-white px-2 py-0.5 text-[10px] font-bold text-gray-500 cursor-grab active:cursor-grabbing hover:text-blue-600 hover:bg-blue-50 border border-gray-100 rounded shadow-sm select-none flex items-center gap-1.5 pointer-events-auto"
                        onMouseDown={e => { e.stopPropagation(); startDrag(e.clientX, e.clientY, gid, e.shiftKey, true) }}
                    >
                        <button
                            onClick={(e) => { e.stopPropagation(); unGroup(gid); }}
                            className="p-0.5 hover:bg-red-50 hover:text-red-500 rounded transition-colors"
                            title="Ungroup"
                            onMouseDown={e => e.stopPropagation()}
                        >
                            <Unlock size={10} />
                        </button>
                        <span className="border-l border-gray-200 pl-1.5 pr-1.5"
                            onDoubleClick={(e) => { e.stopPropagation(); renameGroup(gid) }}
                        >{groupName}</span>
                        <div className="flex gap-0.5 border-l border-gray-200 pl-1.5">
                            <button onClick={(e) => { e.stopPropagation(); optimizeGroup(gid) }} className="p-0.5 hover:bg-sky-100 rounded text-sky-500" title="Optimize" onMouseDown={e => e.stopPropagation()}>
                                <Wand2 size={10} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); arrangeGroup(gid) }} className="p-0.5 hover:bg-sky-100 rounded text-sky-500" title="Arrange" onMouseDown={e => e.stopPropagation()}>
                                <LayoutGrid size={10} />
                            </button>
                        </div>
                    </div>
                </div>
            )
        })
    }

    return (
        <div className="w-full h-[calc(100vh-60px)] relative overflow-hidden bg-gray-100 select-none touch-none">
            {/* minimap */}
            <div className={`absolute bottom-4 right-4 z-50 w-48 h-48 bg-white/80 backdrop-blur-md rounded-xl shadow-2xl border border-gray-200 overflow-hidden md:block hidden transition-opacity duration-300 ${showMinimap ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <div className="relative w-full h-full">
                    <div className="absolute inset-0 bg-gray-50 opacity-50" />
                    {(() => {
                        // Dynamic Minimap calculation
                        // 1. Calculate bounding box of all items
                        if (items.length === 0) return null

                        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
                        items.forEach(i => {
                            minX = Math.min(minX, i.x)
                            minY = Math.min(minY, i.y)
                            maxX = Math.max(maxX, i.x + i.w)
                            maxY = Math.max(maxY, i.y + i.h)
                        })

                        // Include current view in bounds?
                        if (containerRef.current) {
                            const container = containerRef.current
                            // Viewport in world coords:
                            // xWorld = (0 - pan.x) / scale
                            const viewX = -pan.x / scale
                            const viewY = -pan.y / scale
                            const viewW = container.clientWidth / scale
                            const viewH = container.clientHeight / scale

                            minX = Math.min(minX, viewX)
                            minY = Math.min(minY, viewY)
                            maxX = Math.max(maxX, viewX + viewW)
                            maxY = Math.max(maxY, viewY + viewH)
                        }

                        // Add padding
                        const padding = 2000
                        minX -= padding
                        minY -= padding
                        maxX += padding
                        maxY += padding

                        const width = maxX - minX
                        const height = maxY - minY

                        // Protect against 0 size
                        if (width <= 0 || height <= 0) return null

                        return (
                            <>
                                {items.map((item) => (
                                    <div key={`mini-${item.id}`} className="absolute rounded-sm border border-black/10"
                                        style={{
                                            left: `${((item.x - minX) / width) * 100}%`,
                                            top: `${((item.y - minY) / height) * 100}%`,
                                            width: `${(item.w / width) * 100}%`,
                                            height: `${(item.h / height) * 100}%`,
                                            backgroundColor: item.color
                                        }}
                                    />
                                ))}
                                {containerRef.current && (
                                    <div className="absolute border-2 border-blue-500 bg-blue-500/10 cursor-move pointer-events-auto"
                                        onMouseDown={(e: React.MouseEvent) => {
                                            e.stopPropagation()
                                            setIsMinimapDragging(true)
                                            minimapDragState.current = {
                                                startX: e.clientX,
                                                startY: e.clientY,
                                                startPan: { ...pan },
                                                worldWidth: width,
                                                worldHeight: height
                                            }
                                        }}
                                        style={{
                                            left: `${((-pan.x / scale - minX) / width) * 100}%`,
                                            top: `${((-pan.y / scale - minY) / height) * 100}%`,
                                            width: `${(containerRef.current.clientWidth / scale / width) * 100}%`,
                                            height: `${(containerRef.current.clientHeight / scale / height) * 100}%`
                                        }}
                                    />
                                )}
                            </>
                        )
                    })()}
                </div>
            </div>

            {/* Toolbar & Group Nav */}


            {/* Vertical Toolbar (Left) */}
            <div className="absolute left-4 top-20 z-50 flex flex-col gap-4 max-h-[calc(100vh-100px)]">
                {/* Group Navigator */}
                {groups.length > 0 && (
                    <div className="flex flex-col gap-1 overflow-y-auto no-scrollbar pb-1 pointer-events-auto bg-white/50 backdrop-blur-sm p-1 rounded-lg">
                        {groups.map(g => (
                            <div key={g.id} className="flex shrink-0">
                                <button
                                    onClick={() => scrollToGroup(g.id)}
                                    onDoubleClick={() => unGroup(g.id)}
                                    className="w-full text-left px-3 py-1.5 bg-white border border-gray-200 rounded-md text-[10px] font-bold text-gray-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm flex items-center gap-2 group"
                                >
                                    <LayoutGrid size={10} className="group-hover:text-white" />
                                    <span className="truncate max-w-[100px]">{g.name}</span>
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-1.5 flex flex-col items-center gap-2 pointer-events-auto">
                    <button onClick={autoArrange} className="p-2 hover:bg-gray-100 rounded-md text-gray-600" title="Auto Arrange">
                        <LayoutGrid size={20} />
                    </button>
                    <button onClick={optimizeSize} className="p-2 hover:bg-gray-100 rounded-md text-gray-600" title="Optimize Size">
                        <Wand2 size={20} />
                    </button>
                    <div className="w-4 h-[1px] bg-gray-200 my-0.5"></div>
                    <button onClick={() => {
                        const container = containerRef.current
                        if (container) handleZoom(0.1, container.clientWidth / 2, container.clientHeight / 2)
                    }} className="p-2 hover:bg-gray-100 rounded-md text-gray-600" title="Zoom In">
                        <Plus size={20} />
                    </button>
                    <span className="text-xs font-bold font-mono py-1">{Math.round(scale * 100)}%</span>
                    <button onClick={() => {
                        const container = containerRef.current
                        if (container) handleZoom(-0.1, container.clientWidth / 2, container.clientHeight / 2)
                    }} className="p-2 hover:bg-gray-100 rounded-md text-gray-600" title="Zoom Out">
                        <Minus size={20} />
                    </button>
                    <button onClick={() => setPan({ x: -2000, y: -2000 })} className="p-2 hover:bg-gray-100 rounded-md text-gray-600" title="Reset View">
                        <MousePointer2 size={20} />
                    </button>
                </div>
                <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-1.5 flex flex-col items-center gap-2 pointer-events-auto">
                    <div className="flex flex-col gap-1 p-1">
                        {COLORS.map((c) => (
                            <button key={c}
                                onClick={() => {
                                    if (selectedIds.size > 0) {
                                        setItems(prev => prev.map(i => selectedIds.has(i.id) ? { ...i, color: c } : i))
                                    }
                                }}
                                className={`w-4 h-4 rounded-full border border-black/10 transition-transform hover:scale-125 ${selectedIds.size > 0 && items.find(i => selectedIds.has(i.id))?.color === c ? 'ring-1 ring-offset-1 ring-black/20' : ''}`}
                                style={{ backgroundColor: c }} />
                        ))}
                    </div>
                </div>
            </div>


            <div
                ref={containerRef}
                id="mind-board-bg"
                className="w-full h-screen cursor-grab active:cursor-grabbing relative bg-white overflow-hidden"
                onTouchStart={onTouchStart}
                onMouseDown={(e: React.MouseEvent) => {
                    if (isSpacePressed || e.shiftKey || e.button === 1) { // Middle click or Space
                        if (e.shiftKey && !isSpacePressed) {
                            // Start selection box
                            const rect = containerRef.current?.getBoundingClientRect()
                            if (rect) {
                                setSelectionBox({ startX: e.clientX - rect.left, startY: e.clientY - rect.top, currentX: e.clientX - rect.left, currentY: e.clientY - rect.top })
                            }
                        } else {
                            startPan(e.clientX, e.clientY)
                        }
                    } else {
                        startPan(e.clientX, e.clientY)
                    }
                }}
                onDoubleClick={(e) => {
                    handleCanvasClick(e)
                }}
                onWheel={handleWheel}
                style={{ cursor: isSpacePressed ? 'grab' : 'default' }}
            >
                {/* Infinite Background Layer */}
                <div className="absolute inset-0 pointer-events-none z-0"
                    style={{
                        backgroundImage: `linear-gradient(to right, #f0f0f0 1px, transparent 1px), linear-gradient(to bottom, #f0f0f0 1px, transparent 1px)`,
                        backgroundSize: `${GRID_SIZE * scale}px ${GRID_SIZE * scale}px`,
                        backgroundPosition: `${pan.x}px ${pan.y}px`,
                        backgroundColor: '#fdfdfd'
                    }}
                />

                <div
                    className="absolute shadow-inner"
                    style={{
                        width: 0,
                        height: 0, // Zero size container that just holds the transforms
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                        transformOrigin: '0 0',
                    }}
                >
                    {renderGroups()}

                    {items.map((item) => (
                        <div
                            key={item.id}
                            className={`absolute rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex flex-col group border transition-all overflow-hidden pointer-events-auto
                                    ${item.completed ? 'opacity-60 scale-[0.98]' : ''} 
                                    ${selectedIds.has(item.id) ? 'ring-2 ring-blue-500 shadow-xl' : 'border-black/5 hover:border-black/10 hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)]'}`}
                            style={{
                                left: item.x,
                                top: item.y,
                                width: item.w,
                                height: item.h,
                                zIndex: item.zIndex,
                                backgroundColor: item.completed ? '#f3f4f6' : item.color
                            }}
                            onMouseDown={(e) => {
                                if (isSpacePressed) return // Allow bubble to container for panning
                                e.stopPropagation()
                                if (editingId !== item.id) startDrag(e.clientX, e.clientY, item.id, e.shiftKey)
                            }}
                        >
                            <div className="h-8 bg-black/5 flex items-center justify-between px-2 cursor-grab active:cursor-grabbing hover:bg-black/10 transition-colors"
                                onDoubleClick={(e) => { e.stopPropagation(); handleDoubleTap(item.id) }}
                            >
                                <div className="flex items-center gap-2">
                                    {/* <div className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: item.color === '#FFFFFF' ? '#e5e5e5' : item.color }}></div> */}
                                    {/* <GripHorizontal size={14} className="text-gray-400" /> */}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={(e) => { e.stopPropagation(); toggleComplete(item.id) }} className={`p-1 rounded transition-colors ${item.completed ? 'text-green-600 bg-green-100' : 'text-gray-400 hover:bg-green-50 hover:text-green-500'}`}>
                                        <CheckCircle2 size={14} />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); deleteItem(item.id) }} className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-800">
                                        <X size={14} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 p-3 overflow-hidden relative" onDoubleClick={e => e.stopPropagation()}>
                                {editingId === item.id ? (
                                    <textarea autoFocus className="w-full h-full bg-transparent resize-none outline-none text-sm font-medium text-gray-800 leading-relaxed p-0"
                                        value={item.content}
                                        onChange={(e) => setItems(prev => prev.map(i => i.id === item.id ? { ...i, content: e.target.value } : i))}
                                        onBlur={() => {
                                            setEditingId(null)
                                            if (!item.content.trim()) {
                                                setItems(prev => prev.filter(i => i.id !== item.id))
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                setEditingId(null)
                                                if (!item.content.trim()) {
                                                    setItems(prev => prev.filter(i => i.id !== item.id))
                                                }
                                            }
                                        }}
                                        onMouseDown={e => e.stopPropagation()}
                                    />
                                ) : (
                                    <div className={`w-full h-full text-sm font-medium whitespace-pre-wrap leading-relaxed cursor-text transition-all ${item.completed ? 'text-gray-400 line-through' : 'text-gray-800'}`}
                                        onClick={() => { if (!hasMoved.current && !item.completed) setEditingId(item.id) }}>
                                        {item.content || <span className="text-gray-300 italic">{item.completed ? '완료된 작업' : '클릭하여 내용 입력...'}</span>}
                                    </div>
                                )}
                            </div>

                            <div className="absolute bottom-0 right-0 w-8 h-8 cursor-nwse-resize flex items-end justify-end p-1 hover:bg-black/5 rounded-br-xl"
                                onMouseDown={(e) => { e.stopPropagation(); startResize(e.clientX, e.clientY, item.id) }}>
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-20 text-gray-500"><path d="M12 12H0L12 0V12Z" fill="currentColor" /></svg>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Selection Box Overlay */}
                {selectionBox && (
                    <div className="absolute border border-blue-500 bg-blue-500/10 pointer-events-none z-[100]"
                        style={{
                            left: Math.min(selectionBox.startX, selectionBox.currentX),
                            top: Math.min(selectionBox.startY, selectionBox.currentY),
                            width: Math.abs(selectionBox.currentX - selectionBox.startX),
                            height: Math.abs(selectionBox.currentY - selectionBox.startY)
                        }}
                    />
                )}
            </div>
        </div>
    )
}
