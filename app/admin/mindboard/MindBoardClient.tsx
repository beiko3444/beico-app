'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, Minus, GripHorizontal, X, CheckCircle2, LayoutGrid, Wand2, MousePointer2, Type, Lock, Unlock, AlertCircle, Undo2, Redo2, Calendar } from 'lucide-react'

// Add styles/keyframes for the gradient border
const styles = `
@keyframes gradient-border {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

@keyframes burning {
  0% { box-shadow: 0 0 5px rgba(255, 69, 0, 0.5); }
  50% { box-shadow: 0 0 20px rgba(255, 140, 0, 0.8); }
  100% { box-shadow: 0 0 5px rgba(255, 69, 0, 0.5); }
}
`



// Types
interface BoardItem {
    id: string
    x: number
    y: number
    w: number
    h: number
    content: string
    color?: string
    zIndex?: number
    completed?: boolean
    isUrgent?: boolean
    groupId?: string
    taskId?: string
    dueDate?: string
}

// Group Metadata (name, etc.)
// Group Metadata (name, etc.)
interface GroupData {
    id: string
    name: string
    color?: string
    // Geometry
    x?: number
    y?: number
    w?: number
    h?: number
    zIndex?: number
}

interface BoardData {
    id: string
    title: string
    updatedAt: string
}

const GRID_SIZE = 80

const COLORS = [
    '#FFB7B2', '#FFDAC1', '#E2F0CB', '#B5EAD7', '#C7CEEA',
    '#F2D7EE', '#D3E0EA', '#F6F6EB', '#FDFFB6', '#E5E5E5', '#FFFFFF'
]

export default function MindBoardClient() {
    // State
    const [items, setItems] = useState<BoardItem[]>([])
    // Manage group metadata separately or derive? Let's use a simple map stored in state.
    // However, syncing complex state in one file is tricky. 
    // Let's store group names in a separate state, persisted.
    const [groups, setGroups] = useState<GroupData[]>([])

    // History State
    const [past, setPast] = useState<{ items: BoardItem[], groups: GroupData[] }[]>([])
    const [future, setFuture] = useState<{ items: BoardItem[], groups: GroupData[] }[]>([])

    const saveHistory = useCallback(() => {
        setPast((prev: { items: BoardItem[], groups: GroupData[] }[]) => {
            const newPast = [...prev, { items, groups }]
            if (newPast.length > 50) newPast.shift() // Limit history
            return newPast
        })
        setFuture([])
    }, [items, groups])

    const undo = useCallback(() => {
        setPast((prev: { items: BoardItem[], groups: GroupData[] }[]) => {
            if (prev.length === 0) return prev
            const previous = prev[prev.length - 1]
            const newPast = prev.slice(0, -1)

            setFuture(f => [{ items, groups }, ...f])
            setItems(previous.items)
            setGroups(previous.groups)

            return newPast
        })
    }, [items, groups])

    const redo = useCallback(() => {
        setFuture((prev: { items: BoardItem[], groups: GroupData[] }[]) => {
            if (prev.length === 0) return prev
            const next = prev[0]
            const newFuture = prev.slice(1)

            setPast(p => [...p, { items, groups }])
            setItems(next.items)
            setGroups(next.groups)

            return newFuture
        })
    }, [items, groups])

    const [scale, setScale] = useState(0.5) // Start zoomed out a bit
    const [pan, setPan] = useState({ x: 0, y: 0 }) // Start at 0,0
    const [isPanning, setIsPanning] = useState(false)

    // Selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [selectionBox, setSelectionBox] = useState<{ startX: number, startY: number, currentX: number, currentY: number } | null>(null)

    // key: itemId, value: initial state when drag started
    const [dragItems, setDragItems] = useState<Map<string, { startX: number, startY: number, initialX: number, initialY: number }>>(new Map())
    const [draggingGroup, setDraggingGroup] = useState<{ id: string, startX: number, startY: number, initialX: number, initialY: number, membersSnapshot: { id: string, initialX: number, initialY: number }[] } | null>(null)
    const [resizeItem, setResizeItem] = useState<{ id: string, startX: number, startY: number, initialW: number, initialH: number } | null>(null)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [maxZIndex, setMaxZIndex] = useState(1)
    const [colorPaletteId, setColorPaletteId] = useState<string | null>(null)
    const [activeColumnDropdown, setActiveColumnDropdown] = useState<string | null>(null)

    // Refs
    const containerRef = useRef<HTMLDivElement>(null)
    const lastPos = useRef({ x: 0, y: 0 })
    const lastTouchDistance = useRef<number | null>(null)
    const lastClickTime = useRef(0)
    const lastEnterTime = useRef(0) // For double enter detection
    const hasMoved = useRef(false)
    const minimapTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [showMinimap, setShowMinimap] = useState(false)
    const [isSpacePressed, setIsSpacePressed] = useState(false)
    const [isMinimapDragging, setIsMinimapDragging] = useState(false)

    // Panning Ref for immediate response
    const isPanningRef = useRef(false)

    const minimapDragState = useRef<{ startX: number, startY: number, startPan: { x: number, y: number }, worldWidth: number, worldHeight: number } | null>(null)
    const autoPanVelocity = useRef({ x: 0, y: 0 })
    const autoPanFrame = useRef<number>(0)
    const [isLoaded, setIsLoaded] = useState(false)

    // Boards State
    const [boards, setBoards] = useState<BoardData[]>([])
    const [currentBoardId, setCurrentBoardId] = useState<string | null>(null)
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
    const [resizeGroup, setResizeGroup] = useState<{ id: string, startX: number, startY: number, initialW: number, initialH: number, groupX: number, groupY: number } | null>(null)
    const dateInputRef = useRef<HTMLInputElement>(null)
    const [targetDateItemId, setTargetDateItemId] = useState<string | null>(null)

    // Valid items Access for callbacks
    const itemsRef = useRef(items)
    itemsRef.current = items

    // --- Sync Group Bounds Helper ---
    // Moved up to be available for finalizeInteraction
    const syncGroupBounds = useCallback(() => {
        setGroups(prevGroups => {
            let changed = false
            const currentItems = itemsRef.current
            const nextGroups = prevGroups.map(g => {
                const members = currentItems.filter(i => i.groupId === g.id)
                if (members.length === 0) return g

                const minX = Math.min(...members.map(i => i.x))
                const minY = Math.min(...members.map(i => i.y))

                const targetX = minX - 20
                const targetY = minY - 50

                // Fix potential undefined x/y
                const currentX = g.x ?? 0
                const currentY = g.y ?? 0

                if (Math.abs(currentX - targetX) > 1 || Math.abs(currentY - targetY) > 1) {
                    changed = true
                    return { ...g, x: targetX, y: targetY }
                }
                return g
            })
            return changed ? nextGroups : prevGroups
        })
    }, [])

    // --- Persistence ---
    // 1. Load Boards List
    useEffect(() => {
        const loadBoards = async () => {
            try {
                const res = await fetch('/api/mindboard')
                if (res.ok) {
                    const data = await res.json()
                    setBoards(data)

                    if (data.length > 0) {
                        const lastId = localStorage.getItem('lastBoardId')
                        const targetId = data.find((b: BoardData) => b.id === lastId) ? lastId : data[0].id
                        setCurrentBoardId(targetId)
                    } else {
                        // Create default board
                        createBoard("New Board")
                    }
                }
            } catch (e) { console.error("Failed to load boards", e) }
        }
        loadBoards()
    }, [])

    // 2. Load Board Data when ID changes
    useEffect(() => {
        if (!currentBoardId) return
        setIsLoaded(false)

        const loadBoardData = async () => {
            try {
                const res = await fetch(`/api/mindboard/${currentBoardId}`)
                if (res.ok) {
                    const data = await res.json()
                    // Handle migration or default empty
                    const loadedItems = data.items || []
                    const loadedGroups = data.groups || []

                    // Migration: if groups have no geometry, calculate it?
                    // Or let layout engine handle it.

                    setItems(loadedItems)
                    setGroups(loadedGroups)

                    // LocalStorage fallback only for very first migration if DB is empty
                    // But we already switched to DB.

                    const maxZ = loadedItems.reduce((max: number, item: any) => Math.max(max, item.zIndex || 1), 1)
                    setMaxZIndex(maxZ)

                    localStorage.setItem('lastBoardId', currentBoardId)
                }
            } catch (e) { console.error("Failed to load board data", e) }
            finally { setIsLoaded(true) }
        }
        loadBoardData()
    }, [currentBoardId])

    // 3. Save Board Data
    useEffect(() => {
        if (!isLoaded || !currentBoardId) return
        const save = async () => {
            try {
                await fetch(`/api/mindboard/${currentBoardId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items, groups })
                })

                // Update timestamp in boards list locally
                setBoards(prev => prev.map(b => b.id === currentBoardId ? { ...b, updatedAt: new Date().toISOString() } : b))
            } catch (e) { console.error("Failed to save mindboard", e) }
        }
        const timeout = setTimeout(save, 2000)
        return () => clearTimeout(timeout)
    }, [items, groups, currentBoardId, isLoaded])

    const createBoard = async (title: string) => {
        try {
            const res = await fetch('/api/mindboard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title })
            })
            if (res.ok) {
                const newBoard = await res.json()
                setBoards(prev => [newBoard, ...prev])
                setCurrentBoardId(newBoard.id)
            }
        } catch (e) { console.error(e) }
    }

    const deleteBoard = async (id: string) => {
        if (!confirm("Are you sure you want to delete this board?")) return
        try {
            await fetch(`/api/mindboard/${id}`, { method: 'DELETE' })
            setBoards(prev => prev.filter(b => b.id !== id))
            if (currentBoardId === id) {
                setCurrentBoardId(boards.length > 1 ? boards.find(b => b.id !== id)?.id || null : null)
                if (boards.length <= 1) setItems([]) // Clear view if no boards
            }
        } catch (e) { console.error(e) }
    }

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
        saveHistory()


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
        // Close dropdown if clicked outside
        if (activeColumnDropdown) {
            setActiveColumnDropdown(null)
            return
        }

        const clientX = 'touches' in e ? (e as any).touches[0].clientX : (e as any).clientX
        const clientY = 'touches' in e ? (e as any).touches[0].clientY : (e as any).clientY
        const { x, y } = getWorldCoords(clientX, clientY)
        createMemo(x, y, true) // Enable editing immediately
    }

    const startPan = (clientX: number, clientY: number) => {
        setIsPanning(true)
        isPanningRef.current = true
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
        saveHistory() // Save state before dragging starts
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
        saveHistory() // Save before resize
        const item = items.find((i: BoardItem) => i.id === id)
        if (!item) return
        bringToFront(id)
        setResizeItem({ id, startX: clientX, startY: clientY, initialW: item.w, initialH: item.h })
    }

    const startGroupResize = (clientX: number, clientY: number, groupId: string) => {
        saveHistory()
        const group = groups.find(g => g.id === groupId)
        if (!group) return

        const groupItems = items.filter(i => i.groupId === groupId)
        let minX = group.x
        let minY = group.y

        if (minX === undefined && groupItems.length > 0) minX = Math.min(...groupItems.map(i => i.x))
        if (minY === undefined && groupItems.length > 0) minY = Math.min(...groupItems.map(i => i.y))

        // If still undefined (empty group), infer from client or keep current
        if (minX === undefined) minX = items.length > 0 ? 0 : 0
        if (minY === undefined) minY = items.length > 0 ? 0 : 0

        setResizeGroup({
            id: groupId,
            startX: clientX,
            startY: clientY,
            initialW: group.w || 360,
            initialH: group.h || 200,
            groupX: minX,
            groupY: minY
        })
    }

    const handleDateSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const date = e.target.value
        if (targetDateItemId && date) {
            const item = items.find(i => i.id === targetDateItemId)
            if (item) {
                try {
                    // Create Task logic
                    // If item already has taskId, maybe update it? 
                    // For now, create new task or update existing?
                    // Let's create for simplicity or update if taskId exists.
                    let task
                    if (item.taskId) {
                        const res = await fetch(`/api/tasks/${item.taskId}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ date })
                        })
                        if (res.ok) task = await res.json()
                    } else {
                        const res = await fetch('/api/tasks', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ title: item.content || "Untitled Memo", date })
                        })
                        if (res.ok) task = await res.json()
                    }

                    if (task) {
                        setItems(prev => prev.map(i => i.id === targetDateItemId ? { ...i, taskId: task.id, dueDate: date } : i))
                    }
                } catch (err) {
                    console.error("Failed to sync task", err)
                }
            }
        }
        setTargetDateItemId(null)
        if (e.target) e.target.value = ""
    }

    const deleteItem = async (id: string) => {
        if (confirm('정말 삭제하시겠습니까?')) {
            const item = items.find(i => i.id === id)
            if (item && item.taskId) {
                try {
                    await fetch(`/api/tasks/${item.taskId}`, { method: 'DELETE' })
                } catch (e) {
                    console.error("Failed to delete task", e)
                }
            }
            saveHistory()
            setItems((prev: BoardItem[]) => prev.filter((i: BoardItem) => i.id !== id))
        }
    }

    const toggleComplete = async (id: string) => {
        const item = items.find(i => i.id === id)
        if (!item) return

        const newCompleted = !item.completed

        if (item.taskId) {
            try {
                await fetch(`/api/tasks/${item.taskId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ completed: newCompleted })
                })
            } catch (e) { console.error(e) }
        }

        saveHistory()
        setItems((prev: BoardItem[]) => prev.map((item: BoardItem) =>
            item.id === id ? { ...item, completed: newCompleted } : item
        ))
    }

    const toggleUrgent = (id: string) => {
        saveHistory()
        setItems((prev: BoardItem[]) => prev.map((item: BoardItem) =>
            item.id === id ? { ...item, isUrgent: !item.isUrgent } : item
        ))
    }

    // Masonry / First-Fit Layout Algorithm
    const layoutGroupItemsMasonry = (members: BoardItem[], containerWidth: number = 360) => {
        if (members.length === 0) return members

        // Grid unit size
        const COL_WIDTH = 180 // 160 + 20 gap
        // Calculate columns based on container width
        // Ensure at least 1 column
        const columns = Math.max(1, Math.floor((containerWidth + 20) / COL_WIDTH))

        const ROW_HEIGHT = 20 // Fine grained rows

        // Track occupied slots
        const occupied = new Set<string>()

        const checkFit = (col: number, yIdx: number, wSlots: number, hSlots: number) => {
            if (col + wSlots > columns) return false // Out of bounds
            for (let c = 0; c < wSlots; c++) {
                for (let r = 0; r < hSlots; r++) {
                    if (occupied.has(`${col + c},${yIdx + r}`)) return false
                }
            }
            return true
        }

        const markOccupied = (col: number, yIdx: number, wSlots: number, hSlots: number) => {
            for (let c = 0; c < wSlots; c++) {
                for (let r = 0; r < hSlots; r++) {
                    occupied.add(`${col + c},${yIdx + r}`)
                }
            }
        }

        // Sort by visual order (maintain relative order somewhat?)
        // Or strictly by Order/ID?
        // Let's keep input order to allow some user preference if they manually ordered (dragged)
        // But drag usually just updates position.

        return members.map(item => {
            // Calculate item size in slots
            const wSlots = Math.ceil((item.w + 10) / COL_WIDTH)
            const rowSpan = Math.ceil((item.h + 20) / ROW_HEIGHT)

            // Find first position
            let foundCol = 0
            let foundY = 0
            let placed = false

            // Limit Y search
            for (let y = 0; y < 1000; y++) {
                for (let x = 0; x <= columns - wSlots; x++) {
                    if (checkFit(x, y, wSlots, rowSpan)) {
                        foundCol = x
                        foundY = y
                        placed = true
                        break
                    }
                }
                if (placed) break
            }

            markOccupied(foundCol, foundY, wSlots, rowSpan)

            return {
                ...item,
                x: foundCol * COL_WIDTH,
                y: foundY * ROW_HEIGHT
            }
        })
    }

    const packGroup = (members: BoardItem[], groupId?: string) => {
        // Find group to get width
        const group = groups.find((g: GroupData) => g.id === groupId)
        const width = group?.w || 360 // Default 2 cols (180*2)
        return layoutGroupItemsMasonry(members, width)
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

            const maxW = containerRef.current ? Math.max(2000, containerRef.current.clientWidth - 200) : 2000

            if (currentX > maxW) { // Dynamic Wrap width
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
        saveHistory()
        setItems(prev => prev.map(item => item.groupId === groupId ? { ...item, groupId: undefined } : item))
        setGroups(prev => prev.filter(g => g.id !== groupId))
    }

    const arrangeGroup = useCallback((groupId: string) => {
        setItems(prev => {
            const group = groups.find((g: GroupData) => g.id === groupId)
            const width = group?.w || 360

            const members = prev.filter(i => i.groupId === groupId)
            const otherItems = prev.filter(i => i.groupId !== groupId)
            if (members.length === 0) return prev

            // Find top-left of group
            const minX = Math.min(...members.map(i => i.x))
            const minY = Math.min(...members.map(i => i.y))

            // Keep relative order by sorting by Y then X
            members.sort((a, b) => (a.y - b.y) || (a.x - b.x))

            // Layout based on Masonry
            const updatedMembers = layoutGroupItemsMasonry(members, width)

            // Shift back to position
            return [...otherItems, ...updatedMembers.map(m => ({ ...m, x: minX + m.x, y: minY + m.y }))]
        })
    }, [groups])

    const optimizeGroup = (groupId: string) => {
        setItems(prev => {
            const members = prev.filter(i => i.groupId === groupId)
            const otherItems = prev.filter(i => i.groupId !== groupId)
            if (members.length === 0) return prev

            // 1. Resize members
            const resisedMembers = members.map((item: BoardItem) => {
                // Optimization: If Undo triggers this, we don't want to saveHistory inside? 
                // optimizeGroup is called manually.
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
            const minX = Math.min(...resisedMembers.map((i: BoardItem) => i.x))
            const minY = Math.min(...resisedMembers.map((i: BoardItem) => i.y))

            const packed = packGroup(resisedMembers)
            const updatedMembers = resisedMembers.map((m: BoardItem) => {
                const p = packed.find(p => p.id === m.id)
                if (p) return { ...m, x: minX + p.x, y: minY + p.y }
                return m
            })

            return [...otherItems, ...updatedMembers]
        })
    }

    const groupSelectedItems = () => {
        if (selectedIds.size < 2) return
        saveHistory()
        const newGroupId = Date.now().toString()
        const members = items.filter(i => selectedIds.has(i.id))

        // Calculate bounds
        const minX = Math.min(...members.map(i => i.x))
        const minY = Math.min(...members.map(i => i.y))
        const maxX = Math.max(...members.map(i => i.x + i.w))
        const maxY = Math.max(...members.map(i => i.y + i.h))

        const padding = 20
        const headerHeight = 60

        const groupX = minX - padding
        const groupY = minY - headerHeight
        const width = maxX - minX + (padding * 2)
        const height = maxY - minY + headerHeight + padding

        setItems((prev: BoardItem[]) => prev.map((i: BoardItem) => selectedIds.has(i.id) ? { ...i, groupId: newGroupId } : i))
        setGroups(prev => [...prev, { id: newGroupId, name: "New Group", x: groupX, y: groupY, w: width, h: height }])
    }

    const optimizeSize = () => {
        setItems(prev => {
            const nextItems = prev.map((item: BoardItem) => {
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
            nextItems.forEach((item: BoardItem) => {
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
            saveHistory()
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
    const handleMove = useCallback((e: MouseEvent | React.MouseEvent | TouchEvent | React.TouchEvent) => {
        let clientX, clientY
        if ('touches' in e) {
            clientX = e.touches[0].clientX
            clientY = e.touches[0].clientY
        } else {
            clientX = (e as MouseEvent).clientX
            clientY = (e as MouseEvent).clientY
        }

        // Handle Group Drag
        if (draggingGroup) {
            const dx = (clientX - draggingGroup.startX) / scale
            const dy = (clientY - draggingGroup.startY) / scale

            const newGroupX = draggingGroup.initialX + dx
            const newGroupY = draggingGroup.initialY + dy

            setGroups(prev => prev.map(g => g.id === draggingGroup.id ? { ...g, x: newGroupX, y: newGroupY } : g))

            // Move Items relative to their initial snapshot positions
            setItems(prev => prev.map(item => {
                const snapshot = draggingGroup.membersSnapshot.find(m => m.id === item.id)
                if (snapshot) {
                    return { ...item, x: snapshot.initialX + dx, y: snapshot.initialY + dy }
                }
                return item
            }))
            return
        }

        if (isPanning || isPanningRef.current) {
            const dx = clientX - lastPos.current.x
            const dy = clientY - lastPos.current.y

            // Jump Guard: If delta is huge, it means lastPos is stale (e.g. startPan didn't fire or race condition).
            // Sync lastPos and skip this frame to prevent "weird place" jump.
            if (Math.abs(dx) > 50 || Math.abs(dy) > 50) {
                // console.log("Jump Guard Activated", { dx, dy, last: lastPos.current, curr: { x: clientX, y: clientY } })
                lastPos.current = { x: clientX, y: clientY }
                return
            }

            setPan(p => ({ x: p.x + dx, y: p.y + dy })) // Unclamped for now
            lastPos.current = { x: clientX, y: clientY }

            hasMoved.current = true

            // Stop auto-pan if manual panning
            autoPanVelocity.current = { x: 0, y: 0 }

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

            // Smooth Drag Items
            // Smooth Drag Items & Live Reordering (Water & Oil)
            setItems(prev => {
                // 1. Update Dragged Items Position First (Follow Mouse) & Clamp to Group
                const movedItems = prev.map(item => {
                    const state = dragItems.get(item.id)
                    if (state) {
                        let newX = state.initialX + dx
                        let newY = state.initialY + dy

                        // Strict Group Containment
                        if (item.groupId) {
                            const group = groups.find(g => g.id === item.groupId)
                            if (group) {
                                // Define Bounds
                                const padding = 20
                                const headerHeight = 60
                                // If group has explicit x/y/w/h (it should now)
                                const gX = group.x ?? 0
                                const gY = group.y ?? 0
                                const gW = group.w || 360
                                const gH = group.h || 200

                                // Clamp X
                                const minX = gX + padding
                                const maxX = gX + gW - item.w - padding
                                newX = Math.max(minX, Math.min(newX, maxX))

                                // Clamp Y
                                const minY = gY + headerHeight
                                const maxY = gY + gH - item.h - padding
                                newY = Math.max(minY, Math.min(newY, maxY))
                            }
                        } else {
                            // Global Repulsion (Items NOT in Group)
                            // Check overlap with other non-group items
                            // We need access to *all* items to check collision.
                            // 'prev' is the list of all items.

                            // Simple Iterative Solver:
                            // If we overlap, we don't move *us* (since we are dragged), 
                            // we move *them*? 
                            // actually, 'setItems' maps over all items.
                            // We are inside the map for the *dragged* item.
                            // We can't affect others *here*.

                            // Wait, 'movedItems' is constructed by mapping 'prev'.
                            // We need to run a "Simulation" pass *after* moving dragged items?
                            // Yes.
                        }

                        return {
                            ...item,
                            x: newX,
                            y: newY
                        }
                    }
                    return item
                })

                // 2. Global Repulsion Pass (Water & Oil for Non-Group Items)
                // We iterate and push items apart if they overlap.
                // Focus on pushing *other* items away from the *dragged* item.

                // 2. Global Repulsion Pass (Water & Oil for Non-Group Items) - Rigid Body
                const draggedIds = Array.from(dragItems.keys())
                if (draggedIds.length > 0) {
                    const draggingItem = movedItems.find(i => draggedIds.includes(i.id))
                    if (draggingItem && !draggingItem.groupId) {
                        return movedItems.map(other => {
                            if (other.id === draggingItem.id) return other
                            if (other.groupId) return other // Don't push grouped items

                            // Check collision with Margin
                            const margin = 10
                            const b1 = {
                                x: draggingItem.x - margin,
                                y: draggingItem.y - margin,
                                w: draggingItem.w + margin * 2,
                                h: draggingItem.h + margin * 2
                            }
                            const b2 = { x: other.x, y: other.y, w: other.w, h: other.h }

                            if (
                                b1.x < b2.x + b2.w &&
                                b1.x + b1.w > b2.x &&
                                b1.y < b2.y + b2.h &&
                                b1.y + b1.h > b2.y
                            ) {
                                // Calculate Minimum Translation Vector (MTV)
                                const overlapX1 = (b1.x + b1.w) - b2.x
                                const overlapX2 = (b2.x + b2.w) - b1.x
                                const overlapY1 = (b1.y + b1.h) - b2.y
                                const overlapY2 = (b2.y + b2.h) - b1.y

                                const minOverlapX = overlapX1 < overlapX2 ? -overlapX1 : overlapX2
                                const minOverlapY = overlapY1 < overlapY2 ? -overlapY1 : overlapY2

                                // Choose the smallest axis to push
                                let pushX = 0
                                let pushY = 0

                                // Correct Push Direction based on Centers
                                const center1X = b1.x + b1.w / 2
                                const center1Y = b1.y + b1.h / 2
                                const center2X = b2.x + b2.w / 2
                                const center2Y = b2.y + b2.h / 2

                                if (Math.abs(minOverlapX) < Math.abs(minOverlapY)) {
                                    // Push X
                                    pushX = center2X > center1X ? Math.abs(minOverlapX) : -Math.abs(minOverlapX)
                                } else {
                                    // Push Y
                                    pushY = center2Y > center1Y ? Math.abs(minOverlapY) : -Math.abs(minOverlapY)
                                }

                                // Apply Push
                                return {
                                    ...other,
                                    x: other.x + pushX,
                                    y: other.y + pushY
                                }
                            }
                            return other
                        })
                    }
                }

                return movedItems

                // 2. Check for Single Item Group Reordering
                if (dragItems.size === 1) {
                    const draggedId = Array.from(dragItems.keys())[0]
                    const draggingState = dragItems.get(draggedId)
                    const draggedItem = items.find(i => i.id === draggedId)

                    if (draggedItem?.groupId && draggingState) {
                        const groupId = draggedItem!.groupId
                        const groupConf = groups.find(g => g.id === groupId)!

                        if (groupConf) {
                            // Only trigger reorder if we are inside the group bounds?
                            // Or just always if part of group.
                            // Let's assume always if part of group.

                            const groupMembers = movedItems.filter(i => i.groupId === groupId)
                            // Sort members by visual position (except dragged one, we use its current mouse pos)
                            // But wait, we want to FIND the new index for the dragged item.

                            // Remove dragged item from list to find slots
                            const otherMembers = groupMembers.filter(i => i.id !== draggedId)
                            otherMembers.sort((a, b) => (a.y - b.y) || (a.x - b.x))

                            // Calculate Target Index
                            const groupW = groupConf.w || 360
                            const COL_WIDTH = 180
                            const cols = Math.max(1, Math.floor(groupW / COL_WIDTH))
                            const ROW_HEIGHT = 160 + 40 // Approx cell height

                            // Group Origin
                            const groupX = groupConf.x ?? 0
                            const groupY = groupConf.y ?? 0

                            // Relative Pos of Dragged Item Center
                            const relX = (draggedItem!.x + draggedItem!.w / 2) - groupX
                            const relY = (draggedItem!.y + draggedItem!.h / 2) - groupY // +50 for header offset? No `groupY` includes header usually? 
                            // `group.y` is top-left of border. Header is inside/above?
                            // In `renderGroups`, Items are `group.x + 20`, `group.y + 50`.
                            // So Origin for grid is `group.x + 20`, `group.y + 50`.

                            const gridOriginX = groupX + 20
                            const gridOriginY = groupY + 50

                            const gridRelX = (draggedItem!.x + draggedItem!.w / 2) - gridOriginX
                            const gridRelY = (draggedItem!.y + draggedItem!.h / 2) - gridOriginY

                            const col = Math.max(0, Math.min(cols - 1, Math.floor(gridRelX / COL_WIDTH)))
                            const row = Math.max(0, Math.floor(gridRelY / ROW_HEIGHT))
                            const targetIndex = row * cols + col

                            // Safety clamp
                            const safeIndex = Math.min(targetIndex, groupMembers.length - 1)

                            // Reconstruct List with Dragged Item at New Index
                            const reorderedMembers = [...otherMembers]
                            reorderedMembers.splice(safeIndex, 0, draggedItem!)

                            // Run Layout
                            const newGroupMembers = layoutGroupItemsMasonry(reorderedMembers, groupW)

                            // Apply Layout to OTHER members (dragged item keeps free float)
                            // We need to map back to the main items array
                            return movedItems.map(item => {
                                // If this item is part of the reordered group
                                const layoutItem = newGroupMembers.find((m: BoardItem) => m.id === item.id)
                                if (layoutItem) {
                                    // Dragged Item follows mouse (movedItems has it), others follow layout
                                    if (item.id === draggedId) return item

                                    return {
                                        ...item,
                                        x: (groupConf!.x || 0) + 20 + layoutItem.x,
                                        y: (groupConf!.y || 0) + 50 + layoutItem.y
                                    }
                                }
                                return item
                            })
                        }
                    }
                }

                return movedItems
            })

            // Group Sync Logic
            // We want to update group position if we are dragging a whole group
            // We can check if we dragged all members of a group.

            // Note: updating 'groups' state here on every frame might be expensive/jittery.
            // But let's try.

            // We use itemsRef to get current items (including those not dragged?)
            // No, strictly we need to check if dragged items constitute a whole group.
            // We can use 'dragItems' to find which groups are affected.

            // Optimization: Only update if we moved enough?
            // Actually, we can just defer group update to finalizeInteraction.
            // But user wants "Group border moves".

            // Let's postpone complex group sync to finalizeInteraction for stability, 
            // OR use a ref to store "Moving Groups" and update them via direct DOM or separate state if critical.
            // Given "Parsing error" priorities, let's keep it simple and clean first.
            // I will REMOVE the complex group sync logic from handleMove to fix the error, 
            // and rely on finalizeInteraction to snap the group border.

            // Auto-pan detection
            const edgeThreshold = 50
            const container = containerRef.current
            if (container) {
                const rect = container.getBoundingClientRect()
                let vx = 0, vy = 0
                if (clientX < rect.left + edgeThreshold) vx = 5
                else if (clientX > rect.right - edgeThreshold) vx = -5
                if (clientY < rect.top + edgeThreshold) vy = 5
                else if (clientY > rect.bottom - edgeThreshold) vy = -5

                autoPanVelocity.current = { x: vx, y: vy }
                if (vx !== 0 || vy !== 0 && !autoPanFrame.current) {
                    autoPanFrame.current = requestAnimationFrame(updateAutoPan)
                }
            }

        } else if (resizeItem) {
            const dx = (clientX - resizeItem.startX) / scale
            const dy = (clientY - resizeItem.startY) / scale
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) hasMoved.current = true
            setItems(prev => prev.map(item => {
                if (item.id === resizeItem.id) {
                    let newW = Math.max(160, Math.round((resizeItem.initialW + dx) / GRID_SIZE) * GRID_SIZE)
                    let newH = Math.max(160, Math.round((resizeItem.initialH + dy) / GRID_SIZE) * GRID_SIZE)

                    // Constrain to Group Bounds
                    if (item.groupId) {
                        const group = groups.find(g => g.id === item.groupId)
                        if (group) {
                            const padding = 20
                            const groupRight = (group.x ?? 0) + (group.w || 360)
                            const groupBottom = (group.y ?? 0) + (group.h || 200)

                            // Max dimension = Distance to group edge - padding
                            const maxW = groupRight - item.x - padding
                            const maxH = groupBottom - item.y - padding

                            if (maxW >= 160) newW = Math.min(newW, maxW)
                            if (maxH >= 160) newH = Math.min(newH, maxH)
                        }
                    }

                    return { ...item, w: newW, h: newH }
                }
                return item
            }))
        } else if (resizeGroup) {
            const dx = (clientX - resizeGroup.startX) / scale
            const dy = (clientY - resizeGroup.startY) / scale

            const members = items.filter(i => i.groupId === resizeGroup.id)
            let minReqW = 360
            let minReqH = 200

            if (members.length > 0) {
                const maxX = Math.max(...members.map(i => i.x + i.w))
                const maxY = Math.max(...members.map(i => i.y + i.h))
                // The group's x/y are fixed during resize (resizing from nwse / bottom-right)
                // So min width is (furthest item right edge) - (group left edge) + padding
                minReqW = (maxX - resizeGroup.groupX) + 20
                minReqH = (maxY - resizeGroup.groupY) + 20
            }

            const newW = Math.max(minReqW, resizeGroup.initialW + dx)
            const newH = Math.max(minReqH, resizeGroup.initialH + dy)

            setGroups(prev => prev.map(g => g.id === resizeGroup.id ? { ...g, w: newW, h: newH, x: resizeGroup.groupX, y: resizeGroup.groupY } : g))

            // Real-time layout
            setItems(prev => {
                const members = prev.filter(i => i.groupId === resizeGroup.id)
                // Sort by current visual order
                members.sort((a, b) => (a.y - b.y) || (a.x - b.x))

                const updatedMembers = layoutGroupItemsMasonry(members, newW)

                return prev.map(item => {
                    const m = updatedMembers.find(um => um.id === item.id)
                    if (m) {
                        return { ...item, x: resizeGroup.groupX + m.x, y: resizeGroup.groupY + m.y }
                    }
                    return item
                })
            })
        } else if (isMinimapDragging && minimapDragState.current) {
            const state = minimapDragState.current
            const dx = clientX - state.startX
            const dy = clientY - state.startY

            // Revert to approximate old logic (assuming updated ratio logic was the "fix", we revert to simpler or generic)
            // The bug was "not responding", so old logic likely failed to calculate delta correctly or didn't use correct refs.
            // We will attempt to use a standard ref-based logic without the specific ID.
            if (containerRef.current) {
                // Simplistic fallback or keep logic but remove the ID dependency which was the fix
                // To strictly "revert", we should use logic that might not work perfectly?
                // But for safety, I will implement standard logic using containerRef
                const rect = containerRef.current.parentElement?.querySelector('.bg-white\\/80')?.getBoundingClientRect()
                if (rect) {
                    const mw = rect.width
                    const mh = rect.height
                    const ww = state.worldWidth
                    const wh = state.worldHeight

                    const ratioX = ww / mw
                    const ratioY = wh / mh

                    const worldDx = dx * ratioX
                    const worldDy = dy * ratioY

                    setPan({
                        x: state.startPan.x - worldDx * scale,
                        y: state.startPan.y - worldDy * scale
                    })
                }
            }
        } else if (selectionBox) {
            const rect = containerRef.current?.getBoundingClientRect()
            if (rect) {
                setSelectionBox(prev => prev ? ({ ...prev, currentX: clientX - rect.left, currentY: clientY - rect.top }) : null)
            }
        }
    }, [isPanning, dragItems, resizeItem, resizeGroup, selectionBox, scale, isMinimapDragging, draggingGroup, groups, items, pan])

    const updateAutoPan = useCallback(() => {
        if (autoPanVelocity.current.x === 0 && autoPanVelocity.current.y === 0) {
            if (autoPanFrame.current) {
                cancelAnimationFrame(autoPanFrame.current)
                autoPanFrame.current = 0
            }
            return
        }

        setPan(prev => ({
            x: prev.x + autoPanVelocity.current.x,
            y: prev.y + autoPanVelocity.current.y
        }))

        autoPanFrame.current = requestAnimationFrame(updateAutoPan)
    }, [])

    useEffect(() => {
        if (autoPanVelocity.current.x !== 0 || autoPanVelocity.current.y !== 0) {
            if (!autoPanFrame.current) {
                autoPanFrame.current = requestAnimationFrame(updateAutoPan)
            }
        }
    }, [updateAutoPan])

    // Auto-pan logic in handleMove
    useEffect(() => {
        // We need to hook into the existing handleMove or just add a side-effect?
        // handleMove is a callback, complex to inject.
        // Let's modify handleMove directly in the next chunk.
    }, [])

    const finalizeInteraction = useCallback(() => {
        if (dragItems.size > 0 || resizeItem) {
            // Snap to Grid on Drop
            setItems(prev => prev.map(item => {
                if (dragItems.has(item.id) || (resizeItem && resizeItem.id === item.id)) {
                    return {
                        ...item,
                        x: Math.round(item.x / GRID_SIZE) * GRID_SIZE,
                        y: Math.round(item.y / GRID_SIZE) * GRID_SIZE,
                        w: Math.round(item.w / GRID_SIZE) * GRID_SIZE,
                        h: Math.round(item.h / GRID_SIZE) * GRID_SIZE
                    }
                }
                return item
            }))
        }

        // Grouping Logic on Drop
        if (dragItems.size > 0 && !selectionBox) {
            setItems(currentItems => {
                let newItems = [...currentItems]
                const draggedIds = Array.from(dragItems.keys())

                // Get the primary moved item (to determine drop target)
                const primaryId = draggedIds[0]
                const primaryItem = newItems.find(i => i.id === primaryId)

                if (!primaryItem) return newItems

                // 1. Determine if we are dropping INTO a group or ONTO an item (merge)
                // Or just moving WITHIN a group.

                let targetGroupId: string | undefined = undefined
                let isMerge = false

                // Check collision/overlap with other items/groups
                const center = {
                    x: primaryItem.x + primaryItem.w / 2,
                    y: primaryItem.y + primaryItem.h / 2
                }

                // Find "Drop Target" -> The group we are hovering, or item we are hovering
                // Prioritize Group Containment over Item Collision

                // Check if center is inside an existing group bounds
                // We need to calculate bounds of all groups... expensive?
                // Or just check if we overlap with any item in a group.

                const hitItem = newItems.find(i =>
                    !draggedIds.includes(i.id) &&
                    i.x < center.x && i.x + i.w > center.x &&
                    i.y < center.y && i.y + i.h > center.y
                )

                if (hitItem) {
                    if (hitItem.groupId) {
                        targetGroupId = hitItem.groupId
                    } else {
                        // Merging with a single item -> Create New Group
                        isMerge = true
                    }
                } else if (primaryItem.groupId) {
                    // Staying in group
                    targetGroupId = primaryItem.groupId
                }

                // DISABLE MERGE for Group Drags (Water & Oil)
                // If we are dragging a whole group, forbid merging into another group.
                const isGroupDrag = draggedIds.every(id => {
                    const item = currentItems.find((i: BoardItem) => i.id === id)
                    return item?.groupId === primaryItem.groupId
                }) && draggedIds.length > 1 // Heuristic: dragging multiple items from same group

                if (draggedIds.length === 1 && !isMerge && targetGroupId && targetGroupId !== primaryItem.groupId) {
                    // Single item dragged into another group -> ALLOW
                } else if (isGroupDrag || (draggedIds.length > 1)) {
                    // Multiple items or Group Drag -> DISABLE MERGE into other group
                    // Only allow reorder within SAME group
                    if (targetGroupId && targetGroupId !== primaryItem.groupId) {
                        return newItems // Cancel merge
                    }
                }

                // If no target group and no merge, we are just moving freely on canvas.
                if (!targetGroupId && !isMerge) return newItems

                // 3. Setup Destination
                let destinationGroupId = targetGroupId
                if (isMerge && hitItem) {
                    // DISABLE MERGE
                    destinationGroupId = undefined
                }

                // 3. Collect Members
                const currentGroupMembers = destinationGroupId
                    ? newItems.filter(i => i.groupId === destinationGroupId && !draggedIds.includes(i.id))
                    : (hitItem ? [hitItem] : [])

                const movingItems = newItems.filter(i => draggedIds.includes(i.id))

                if (isMerge && hitItem) {
                    // Update hitItem to new group
                    // DISABLE MERGE (Auto-Create Group) as per user request
                    // const hitIdx = newItems.findIndex(i => i.id === hitItem.id)
                    // if (hitIdx > -1) newItems[hitIdx] = { ...newItems[hitIdx], groupId: destinationGroupId }
                }

                // 4. Calculate Insert Index
                // We need the layout config (width -> columns)
                const groupConfig = groups.find((g: GroupData) => g.id === destinationGroupId)
                const groupW = groupConfig?.w || 360
                const COL_WIDTH = 180 // Must match layoutGroupItemsMasonry constant
                const cols = Math.max(1, Math.floor(groupW / COL_WIDTH))

                // Calculate "Group Origin" (Top-Left of the *existing* members + *target* location)
                // Actually, strict grid reflow implies the group's "Box" is defined by its members.
                // We want to find where the *Mouse/Center* is relative to the *Sorted Grid*.

                const allMembersForBounds = [...currentGroupMembers, ...movingItems]
                const minX = Math.min(...allMembersForBounds.map(i => i.x))
                const minY = Math.min(...allMembersForBounds.map(i => i.y))

                // Helper to get index from coords
                const getIndex = (x: number, y: number) => {
                    const relX = x - minX
                    const relY = y - minY
                    // Assuming standard size 160x160 + 20 gap + 40 title gap?
                    // Let's use standard grid cell size:
                    const cellW = 160 + 20
                    const cellH = 160 + 40

                    const col = Math.max(0, Math.min(cols - 1, Math.round(relX / cellW)))
                    const row = Math.max(0, Math.round(relY / cellH))
                    return row * cols + col
                }

                // If we are merging, default append?
                // If reordering, use primaryItem's position.
                const targetIndex = getIndex(primaryItem.x, primaryItem.y)

                // 5. Construct New Order
                // Remove moving items from the "old" list (currentGroupMembers is already filtered)
                // Sort currentGroupMembers by their *current* visual position to ensure stability
                currentGroupMembers.sort((a, b) => (a.y - b.y) || (a.x - b.x))

                // Insert moving items at targetIndex
                const finalMembers = [...currentGroupMembers]
                // Clamp index
                const safeIndex = Math.min(targetIndex, finalMembers.length)
                finalMembers.splice(safeIndex, 0, ...movingItems)

                // 6. Apply Reflow (Masonry)
                const groupX = groupConfig?.x ?? (minX - 20) // Use existing group X or derived
                const groupY = groupConfig?.y ?? (minY - 50)
                const currentGroupW = groupConfig?.w || 360

                const layoutedMembers = layoutGroupItemsMasonry(finalMembers, currentGroupW)

                // Update items with absolute coordinates relative to Group Origin
                layoutedMembers.forEach(m => {
                    const matchIdx = newItems.findIndex(ni => ni.id === m.id)
                    if (matchIdx > -1) {
                        newItems[matchIdx] = {
                            ...newItems[matchIdx],
                            x: groupX + 20 + m.x, // Offset from border
                            y: groupY + 50 + m.y, // Offset from header
                            groupId: destinationGroupId
                        }
                    }
                })

                // Update Group Position/Size if needed (e.g. height auto-expand?)
                // For now, fixed width, auto height?
                // The prompt says "Group border is resizable". So we respect W/H.
                // But if items overflow?
                // Let's just layout.

                // Sync Group Logic: If we moved items, we need to ensure the Group Object (in 'groups' state)
                // has the correct X/Y if we want the border to follow.
                // But here we set items relative to `groupX`. 
                // If `groupConfig` existed, `groupX` is its `x`. So items snap to Group.
                // If `groupConfig` didn't exist (New Group), we derived `groupX`.

                return newItems
            })
        }

        if (dragItems.size > 0) {
            const movedGroups = new Set<string>()
            dragItems.forEach((_, id) => {
                const item = items.find(i => i.id === id)
                if (item?.groupId) movedGroups.add(item.groupId)
            })

            if (movedGroups.size > 0) {
                // Calculate new bounds for affected groups
                // We need to access the NEW items state. 
                // We can't access it synchronously here after setItems.
                // But we know the delta? Or we can use functional update.
                // Functional update on `setGroups`?
                // But we need `items` from `setItems` result.
                // This is tricky.

                // Alternative: Run a separate useEffect or timeout?
                // Let's use setTimeout to allow state to settle, then sync groups.

                setTimeout(() => {
                    setGroups(prevGroups => prevGroups.map(g => {
                        if (movedGroups.has(g.id)) {
                            // Find current items for this group (from REF or by reading state if updated?)
                            // State might not be updated yet in this closure?
                            // But inside setTimeout/setGroups functional update, we can't access *new* items easily.
                            // Actually, let's use the `items` Ref if we had one.

                            // Better: In `setItems` above, we calculated everything.
                            // We just need to know the bounds.
                        }
                        return g
                    }))

                    // Force re-sync of all groups bounds based on items
                    setGroups(currentGroups => currentGroups.map(g => {
                        // This relies on `items` potentially being stale in this closure?
                        // No, we need fresh items.

                        // We can't easily get fresh items here.
                        // Let's trigger a re-sync via a flag?
                        return g
                    }))
                }, 0)

                // Revised approach:
                // We just rely on the existing "Auto-Create/Update" logic? 
                // Or we manually calculate delta and apply to group.

                const firstId = Array.from(dragItems.keys())[0]
                const firstItem = items.find(i => i.id === firstId)
                const draggingState = dragItems.get(firstId)

                if (firstItem && draggingState && firstItem.groupId) {
                    const dx = (lastPos.current.x - draggingState.startX) / scale // Approximate? No.
                    // We don't have accurate total delta here easily except via Item comparison.
                }
            }
        }

        // Final Fix:
        // We will add a `useEffect` that updates Group Bounds whenever Items change?
        // But we don't want to loop/jitter.
        // Only if we detect a discrepancy?
        // Let's add a "Sync Groups" function that we call here.
        setTimeout(syncGroupBounds, 50)

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
                items.forEach((item: BoardItem) => {
                    // Check intersection
                    if (item.x < wx2 && item.x + item.w > wx1 && item.y < wy2 && item.y + item.h > wy1) {
                        newSelected.add(item.id)
                    }
                })
                setSelectedIds(newSelected)
            }
        }

        setIsPanning(false)
        isPanningRef.current = false
        setDragItems(new Map())
        setDraggingGroup(null) // Reset dragging group state
        setResizeItem(null)
        setSelectionBox(null)
        lastTouchDistance.current = null
        setTimeout(() => { hasMoved.current = false }, 50)
        if (autoPanFrame.current) {
            cancelAnimationFrame(autoPanFrame.current)
            autoPanFrame.current = 0
        }
        autoPanVelocity.current = { x: 0, y: 0 }
    }, [dragItems, selectionBox, items, pan, scale, selectedIds, updateAutoPan, draggingGroup])

    // --- Events Sync ---
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => handleMove(e)
        const handleTouchMove = (e: TouchEvent) => handleMove(e)
        // Global mouse up to catch drops outside
        const handleMouseUp = () => {
            finalizeInteraction()
            setIsMinimapDragging(false)
            minimapDragState.current = null
            setResizeGroup(null) // End group resize
        }
        const handleTouchEnd = () => {
            finalizeInteraction()
            setIsMinimapDragging(false)
            minimapDragState.current = null
            setResizeGroup(null) // End group resize
        }

        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)
        window.addEventListener('touchmove', handleTouchMove)
        window.addEventListener('touchend', handleTouchEnd)

        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
            window.removeEventListener('touchmove', handleTouchMove)
            window.removeEventListener('touchend', handleTouchEnd)
        }
    }, [handleMove, finalizeInteraction])

    // --- Auto-Create Groups for Orphaned Items ---
    useEffect(() => {
        const existingGroupIds = new Set(groups.map(g => g.id))
        const itemsWithGroups = items.filter(i => i.groupId)

        const newGroups: GroupData[] = []
        const handledNewIds = new Set<string>()

        itemsWithGroups.forEach(item => {
            if (item.groupId && !existingGroupIds.has(item.groupId) && !handledNewIds.has(item.groupId)) {
                handledNewIds.add(item.groupId)
                newGroups.push({
                    id: item.groupId,
                    name: "New Group",
                    x: item.x - 20,
                    y: item.y - 60,
                    w: 400,
                    h: 300,
                    color: '#f0f0f0'
                })
            }
        })

        // Check sync
    }, [items])





    // Also, when we migrated to "Fixed Coords", we need to init them.
    useEffect(() => {
        // Init logic for legacy groups without x/y
        setGroups(prev => prev.map(g => {
            if (g.x === undefined || g.y === undefined) {
                const members = items.filter(i => i.groupId === g.id)
                if (members.length > 0) {
                    const minX = Math.min(...members.map(i => i.x))
                    const minY = Math.min(...members.map(i => i.y))
                    return { ...g, x: minX - 20, y: minY - 50 }
                }
            }
            return g
        }))
    }, []) // Run once


    // Undo/Redo Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
                e.preventDefault()
                // Stop propagation to prevent browser undo if focused in textarea?
                // Actually, if in textarea, standard undo might be desired for text.
                // But user wants app-level undo.
                // If editingId is set, maybe let browser handle text undo?
                if (!editingId) {
                    undo()
                }
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
                e.preventDefault()
                if (!editingId) {
                    redo()
                }
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [undo, redo, editingId])

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
                        saveHistory() // Save before creation
                        createMemo(x, y, true)
                    }
                    lastEnterTime.current = 0
                } else {
                    lastEnterTime.current = now
                }
            }

            if (e.key === 'Escape') {
                if (editingId) {
                    // Check if empty, delete if so? User requested to keeping it.
                    // setItems((prev: BoardItem[]) => prev.filter((i: BoardItem) => {
                    //     if (i.id === editingId && !i.content.trim()) return false
                    //     return true
                    // }))
                    // If we deleted empty item, we should have history before creation.
                    // If we just cancelled edit, no change.
                    setEditingId(null)
                } else if (selectedIds.size > 0) {
                    // Deselect
                    setSelectedIds(new Set())
                }
            }

            if (e.key === 'Delete') {
                const target = e.target as HTMLElement
                if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

                if (selectedIds.size > 0) {
                    if (confirm(`선택한 ${selectedIds.size}개의 항목을 삭제하시겠습니까?`)) {
                        saveHistory() // Save before delete
                        setItems((prev: BoardItem[]) => prev.filter((i: BoardItem) => !selectedIds.has(i.id)))
                        setSelectedIds(new Set())
                    }
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
    }, [createMemo, getWorldCoords, editingId, selectedIds, items, groups, arrangeGroup, undo, redo])

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

    // --- Render Helpers ---
    const renderGroups = () => {
        return groups.map(group => {
            const groupItems = items.filter(i => i.groupId === group.id)
            if (groupItems.length === 0) return null

            const minX = Math.min(...groupItems.map(i => i.x))
            const minY = Math.min(...groupItems.map(i => i.y))

            const isSelected = selectedGroupId === group.id
            const borderColor = group.color || '#e2e8f0'
            const borderWidth = isSelected ? '3px' : '2px'
            const borderStyle = isSelected ? 'solid' : 'dashed'

            // Use fixed group coordinates or fallback to calculated (for legacy/transition)
            // But we want to enforce fixed. If group.x is undefined, we should probably set it?
            // For now, let's use group.x/y if present, otherwise calculate and maybe save later?
            // Plan says: "Group uses fixed x, y properties".

            const safeX = group.x ?? minX // Fallback if migrating
            const safeY = group.y ?? minY

            return (
                <div
                    key={group.id}
                    className="absolute rounded-3xl transition-all duration-75" // Faster transition for resize
                    style={{
                        left: (group.x ?? 0),
                        top: (group.y ?? 0),
                        width: (group.w || 360),
                        height: (group.h || 200),
                        backgroundColor: 'rgba(240, 240, 240, 0.3)', // Very faint bg
                        border: selectedGroupId === group.id ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                        pointerEvents: 'auto', // Enable pointer events for group border/container
                        zIndex: group.zIndex || 0 // Ensure zIndex is respected (behind items usually)
                    }}
                    onMouseDown={(e) => {
                        e.preventDefault() // Prevent text selection
                        e.stopPropagation() // Prevent canvas panning

                        // Select Group
                        setSelectedGroupId(group.id)
                        setSelectedIds(new Set())

                        // Start Group Drag on Border Click
                        // Capture initial positions
                        const members = items.filter(i => i.groupId === group.id)
                        const membersSnapshot = members.map(m => ({ id: m.id, initialX: m.x, initialY: m.y }))

                        setDraggingGroup({
                            id: group.id,
                            startX: e.clientX,
                            startY: e.clientY,
                            initialX: group.x ?? 0,
                            initialY: group.y ?? 0,
                            membersSnapshot
                        })

                        setIsPanning(false)
                        isPanningRef.current = false
                    }}
                >
                    {/* Header Area */}
                    <div
                        className="absolute top-0 left-0 right-0 h-10 flex items-center px-4 cursor-grab pointer-events-auto bg-white/50 rounded-t-3xl border-b border-gray-100"
                        onMouseDown={(e) => {
                            e.stopPropagation()
                            setSelectedGroupId(group.id)
                            setSelectedIds(new Set())

                            // Group Header Drag
                            const members = items.filter(i => i.groupId === group.id)
                            const membersSnapshot = members.map(m => ({ id: m.id, initialX: m.x, initialY: m.y }))

                            setDraggingGroup({
                                id: group.id,
                                startX: e.clientX,
                                startY: e.clientY,
                                initialX: group.x ?? 0,
                                initialY: group.y ?? 0,
                                membersSnapshot
                            })

                            setIsPanning(false)
                            isPanningRef.current = false
                        }}
                    >
                        <span
                            className="font-bold text-slate-600 truncate flex-1 hover:text-blue-500 transition-colors"
                            onDoubleClick={(e) => {
                                e.stopPropagation()
                                renameGroup(group.id)
                            }}
                        >
                            {group.name}
                        </span>

                        {isSelected && (
                            <div className="flex items-center gap-1 mr-2 animate-in fade-in zoom-in duration-200">
                                {COLORS.slice(0, 5).map(c => (
                                    <button
                                        key={c}
                                        className="w-4 h-4 rounded-full border border-gray-200 hover:scale-110 transition-transform"
                                        style={{ backgroundColor: c }}
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setGroups(prev => prev.map(g => g.id === group.id ? { ...g, color: c } : g))
                                        }}
                                    />
                                ))}
                            </div>
                        )}

                        <div className="flex gap-1">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    saveHistory()
                                    optimizeGroup(group.id)
                                }}
                                className="p-1 hover:bg-sky-100 rounded text-sky-500 transition-colors"
                            >
                                <Wand2 size={14} />
                            </button>
                            <button
                                className="p-1 hover:bg-red-100 text-red-400 rounded transition-colors"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    unGroup(group.id)
                                }}
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Resize Handle */}
                    <div
                        className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize pointer-events-auto flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        onMouseDown={(e) => {
                            e.stopPropagation()
                            startGroupResize(e.clientX, e.clientY, group.id)
                        }}
                    >
                        <div className="w-3 h-3 border-r-2 border-b-2 border-slate-400"></div>
                    </div>
                </div>
            )
        })
    }

    return (
        <div className="fixed left-0 right-0 bottom-0 top-[60px] z-10 bg-gray-100 select-none touch-none overflow-hidden">
            <style dangerouslySetInnerHTML={{ __html: styles }} />
            {/* minimap */}
            <div className={`absolute bottom-4 right-4 z-50 w-48 h-48 bg-white/80 backdrop-blur-md rounded-xl shadow-2xl border border-gray-200 overflow-hidden md:block hidden transition-opacity duration-300 ${items.length > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <div className="relative w-full h-full">
                    <div className="absolute inset-0 bg-gray-50 opacity-50" />
                    {(() => {
                        if (items.length === 0) return null

                        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
                        items.forEach((i: BoardItem) => {
                            minX = Math.min(minX, i.x)
                            minY = Math.min(minY, i.y)
                            maxX = Math.max(maxX, i.x + i.w)
                            maxY = Math.max(maxY, i.y + i.h)
                        })

                        if (containerRef.current) {
                            const container = containerRef.current
                            const viewX = -pan.x / scale
                            const viewY = -pan.y / scale
                            const viewW = container.clientWidth / scale
                            const viewH = container.clientHeight / scale

                            minX = Math.min(minX, viewX)
                            minY = Math.min(minY, viewY)
                            maxX = Math.max(maxX, viewX + viewW)
                            maxY = Math.max(maxY, viewY + viewH)
                        }

                        const padding = 2000
                        minX -= padding
                        minY -= padding
                        maxX += padding
                        maxY += padding

                        const width = maxX - minX
                        const height = maxY - minY

                        if (width <= 0 || height <= 0) return null

                        return (
                            <>
                                {items.map((item: BoardItem) => (
                                    <div key={`mini-${item.id}`} className="absolute rounded-sm border border-black/10"
                                        style={{
                                            left: `${((item.x - minX) / width) * 100}%`,
                                            top: `${((item.y - minY) / height) * 100}%`,
                                            width: `${(item.w / width) * 100}%`,
                                            height: `${(item.h / height) * 100}%`,
                                            backgroundColor: item.completed ? '#f3f4f6' : item.color,
                                            ...(item.isUrgent ? {
                                                boxShadow: '0 0 10px rgba(255, 69, 0, 0.4)',
                                                border: '2px solid #ff4500'
                                            } : {})
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
                                            width: `${((containerRef.current.clientWidth / scale) / width) * 100}%`,
                                            height: `${((containerRef.current.clientHeight / scale) / height) * 100}%`
                                        }}
                                    />
                                )}
                            </>
                        )
                    })()}
                </div>
            </div>


            {/* Toolbar & Group Nav */}


            {/* Left Toolbar */}
            <div className="absolute left-4 top-4 z-50 flex flex-col gap-2 pointer-events-auto">
                <div className="bg-white/90 backdrop-blur p-2 rounded-xl shadow-lg border border-white/20 flex flex-col gap-2 w-52">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="New Board Name"
                            className="flex-1 bg-white/50 border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:border-blue-500"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const title = e.currentTarget.value
                                    if (title) {
                                        createBoard(title)
                                        e.currentTarget.value = ''
                                    }
                                }
                            }}
                        />
                        <button
                            onClick={(e) => {
                                const input = e.currentTarget.previousElementSibling as HTMLInputElement
                                if (input.value) {
                                    createBoard(input.value)
                                    input.value = ''
                                }
                            }}
                            className="bg-blue-500 hover:bg-blue-600 text-white rounded p-1.5 transition-colors"
                        >
                            <Plus size={14} />
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-1 flex flex-col items-center gap-1 pointer-events-auto">
                    <button
                        onClick={autoArrange}
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-600"
                        title="Auto Arrange"
                    >
                        <LayoutGrid size={18} />
                    </button>
                    <div className="w-3 h-[1px] bg-gray-200 my-0.5"></div>
                    <button onClick={() => {
                        const container = containerRef.current
                        if (container) handleZoom(0.1, container.clientWidth / 2, container.clientHeight / 2)
                    }} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title="Zoom In">
                        <Plus size={18} />
                    </button>
                    <span className="text-[10px] font-bold font-mono py-0.5">{Math.round(scale * 100)}%</span>
                    <button onClick={() => {
                        const container = containerRef.current
                        if (container) handleZoom(-0.1, container.clientWidth / 2, container.clientHeight / 2)
                    }} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title="Zoom Out">
                        <Minus size={18} />
                    </button>
                    <div className="w-3 h-[1px] bg-gray-200 my-0.5"></div>
                    <button onClick={undo} disabled={past.length === 0} className={`p-1.5 rounded transition-colors ${past.length === 0 ? 'text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`} title="Undo (Ctrl+Z)">
                        <Undo2 size={18} />
                    </button>
                    <button onClick={redo} disabled={future.length === 0} className={`p-1.5 rounded transition-colors ${future.length === 0 ? 'text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`} title="Redo (Ctrl+Y)">
                        <Redo2 size={18} />
                    </button>
                </div>
                <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-1 flex flex-col items-center gap-1 pointer-events-auto">
                    <div className="flex flex-col gap-1 p-0.5">
                        {COLORS.map((c) => (
                            <button key={c}
                                onClick={() => {
                                    if (selectedGroupId) {
                                        saveHistory()
                                        setGroups(prev => prev.map(g => g.id === selectedGroupId ? { ...g, color: c } : g))
                                    } else if (selectedIds.size > 0) {
                                        saveHistory()
                                        setItems(prev => prev.map(i => selectedIds.has(i.id) ? { ...i, color: c } : i))
                                    }
                                }}
                                className={`w-3.5 h-3.5 rounded-full border border-black/10 transition-transform hover:scale-125 ${(selectedGroupId && groups.find(g => g.id === selectedGroupId)?.color === c) ||
                                    (!selectedGroupId && selectedIds.size > 0 && items.find(i => selectedIds.has(i.id))?.color === c)
                                    ? 'ring-1 ring-offset-1 ring-black/20' : ''}`}
                                style={{ backgroundColor: c }} />
                        ))}
                    </div>
                </div>
            </div>
            {/* Right Toolbar - Board List */}
            <div className="absolute right-4 top-4 z-50 flex flex-col gap-2 pointer-events-auto h-[calc(100vh-100px)] pointer-events-none">
                <div className="pointer-events-auto bg-white/90 backdrop-blur p-3 rounded-xl shadow-lg border border-white/20 flex flex-col gap-1 w-64 max-h-full overflow-y-auto">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1 flex justify-between items-center">
                        Your Boards
                        <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{boards.length}</span>
                    </h3>
                    {boards.map(board => (
                        <div
                            key={board.id}
                            className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${currentBoardId === board.id ? 'bg-blue-50 border-blue-200 border shadow-sm' : 'hover:bg-white border border-transparent hover:shadow-sm'}`}
                            onClick={() => setCurrentBoardId(board.id)}
                        >
                            <span className={`text-sm font-medium truncate ${currentBoardId === board.id ? 'text-blue-700' : 'text-slate-700'}`}>
                                {board.title || "Untitled"}
                            </span>
                            {boards.length > 1 && (
                                <button
                                    className="p-1 hover:bg-red-100 text-slate-300 hover:text-red-500 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => { e.stopPropagation(); deleteBoard(board.id) }}
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                    ))}
                    {boards.length === 0 && (
                        <div className="text-xs text-slate-400 text-center py-4">No boards yet</div>
                    )}
                </div>
            </div>

            <div
                ref={containerRef}
                id="mind-board-bg"
                className="w-full h-screen cursor-grab active:cursor-grabbing relative bg-white overflow-hidden"
                onTouchStart={onTouchStart}
                onMouseDown={(e: React.MouseEvent) => {
                    // Background Deselect
                    if (e.target === e.currentTarget && !isSpacePressed && !e.shiftKey) {
                        setSelectedIds(new Set())
                    }

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

                    {items.map(item => (
                        <div
                            key={item.id}
                            className={`absolute flex flex-col transition-shadow duration-200 group
                                ${dragItems.has(item.id) ? 'z-[100] shadow-xl' : 'hover:shadow-lg'}
                                ${selectedIds.has(item.id) ? 'ring-2 ring-blue-500 shadow-xl z-[50]' : ''}
                                ${isSpacePressed ? 'pointer-events-none' : ''}
                            `}
                            style={{
                                transform: `translate(${item.x}px, ${item.y}px)`,
                                width: item.w,
                                height: item.h,
                                backgroundColor: item.color,
                                borderRadius: '8px', // rounded-md approx
                                zIndex: item.zIndex || 1,
                                border: item.isUrgent ? '2px solid #ff4500' : '1px solid #94a3b8', // Darker gray border (slate-400)
                                ...(item.isUrgent ? {
                                    boxShadow: '0 0 10px rgba(255, 69, 0, 0.4)',
                                } : {})
                            }}
                            onMouseDown={(e) => {
                                e.stopPropagation();
                                isPanningRef.current = false; // Force disable panning
                                if (isSpacePressed) return
                                startDrag(e.clientX, e.clientY, item.id, e.shiftKey)
                            }}
                        >
                            {/* Calendar Icon - Top Left - REMOVED */}


                            <div className="h-10 px-4 border-b border-black/5 flex items-center justify-between bg-black/5 rounded-t-2xl">
                                <div className="flex gap-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setTargetDateItemId(item.id);
                                            setTimeout(() => dateInputRef.current?.showPicker(), 0)
                                        }}
                                        className={`p-1 rounded transition-colors ${item.dueDate ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:bg-blue-50 hover:text-blue-500'}`}
                                        title={item.dueDate ? `Due: ${item.dueDate}` : "Set Date"}
                                    >
                                        <Calendar size={14} />
                                    </button>
                                    <button onClick={(e: React.MouseEvent) => { e.stopPropagation(); saveHistory(); toggleUrgent(item.id) }}
                                        className={`p-1 rounded transition-colors ${item.isUrgent ? 'text-amber-500 bg-amber-100' : 'text-gray-300 hover:bg-amber-50 hover:text-amber-500'}`}
                                        title="긴급/집중">
                                        <AlertCircle size={14} fill={item.isUrgent ? "currentColor" : "none"} />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); saveHistory(); toggleComplete(item.id) }} className={`p-1 rounded transition-colors ${item.completed ? 'text-green-600 bg-green-100' : 'text-gray-400 hover:bg-green-50 hover:text-green-500'}`}>
                                        <CheckCircle2 size={14} />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); saveHistory(); deleteItem(item.id) }} className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-800">
                                        <X size={14} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 p-5 flex flex-col overflow-hidden relative" onClick={(e) => {
                                e.stopPropagation();
                                if (!hasMoved.current) {
                                    setEditingId(item.id)
                                }
                            }}>
                                {editingId === item.id ? (
                                    <textarea
                                        autoFocus
                                        className="w-full h-full bg-transparent resize-none outline-none text-slate-800 font-medium text-lg leading-relaxed placeholder-slate-400"
                                        value={item.content}
                                        onChange={(e) => {
                                            const val = e.target.value
                                            setItems(prev => prev.map(i => i.id === item.id ? { ...i, content: val } : i))
                                        }}
                                        onBlur={() => setEditingId(null)}
                                        onKeyDown={(e) => e.stopPropagation()}
                                        placeholder="Type something..."
                                    />
                                ) : (
                                    <div className="whitespace-pre-wrap text-slate-800 font-medium text-lg leading-relaxed break-words select-none">
                                        {item.content || <span className="text-slate-400 italic">Empty note...</span>}
                                        {item.completed && <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[1px] rounded-xl"><CheckCircle2 className="text-green-500 w-12 h-12" /></div>}
                                    </div>
                                )}
                            </div>

                            {/* Color Palette Popover */}
                            {colorPaletteId === item.id && (
                                <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 p-2 grid grid-cols-5 gap-1.5 z-[100] w-[180px]" onMouseDown={e => e.stopPropagation()}>
                                    {COLORS.map(c => (
                                        <button
                                            key={c}
                                            className="w-7 h-7 rounded-full border border-slate-200 hover:scale-110 transition-transform"
                                            style={{ backgroundColor: c }}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                saveHistory()
                                                setItems(prev => prev.map(i => i.id === item.id ? { ...i, color: c } : i))
                                                setColorPaletteId(null)
                                            }}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Resize Handle */}
                            <div
                                className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize hover:bg-black/10 rounded-tl-lg"
                                onMouseDown={(e) => {
                                    e.stopPropagation()
                                    startResize(e.clientX, e.clientY, item.id)
                                }}
                            />
                        </div>
                    ))}
                </div>

                {/* Selection Box Overlay */}
                {
                    selectionBox && (
                        <div className="absolute border border-blue-500 bg-blue-500/10 pointer-events-none z-[100]"
                            style={{
                                left: Math.min(selectionBox.startX, selectionBox.currentX),
                                top: Math.min(selectionBox.startY, selectionBox.currentY),
                                width: Math.abs(selectionBox.currentX - selectionBox.startX),
                                height: Math.abs(selectionBox.currentY - selectionBox.startY)
                            }}
                        />
                    )
                }
            </div >

            {/* Floating Group Button */}
            {
                selectedIds.size > 1 && !Array.from(selectedIds).every(id => items.find((i: BoardItem) => i.id === id)?.groupId) && (
                    <div className="absolute z-[200] pointer-events-none"
                        style={{
                            left: (() => {
                                const selectedItems = items.filter(i => selectedIds.has(i.id))
                                if (selectedItems.length === 0) return 0
                                const minX = Math.min(...selectedItems.map((i: BoardItem) => i.x))
                                const maxX = Math.max(...selectedItems.map((i: BoardItem) => i.x + i.w))
                                const centerX = (minX + maxX) / 2
                                return centerX * scale + pan.x
                            })(),
                            top: (() => {
                                const selectedItems = items.filter(i => selectedIds.has(i.id))
                                if (selectedItems.length === 0) return 0
                                const minY = Math.min(...selectedItems.map((i: BoardItem) => i.y))
                                return minY * scale + pan.y - 50
                            })()
                        }}
                    >
                        <button
                            onClick={(e: React.MouseEvent) => { e.stopPropagation(); groupSelectedItems() }}
                            className="bg-blue-600 text-white px-3 py-1.5 rounded-full shadow-lg font-bold text-sm hover:bg-blue-700 hover:scale-105 transition-all flex items-center gap-1.5 pointer-events-auto -translate-x-1/2"
                            onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
                        >
                            <LayoutGrid size={14} />
                            Group
                        </button>
                    </div>
                )
            }
            {/* Hidden Date Input */}
            <input type="date" ref={dateInputRef} className="absolute top-0 left-0 w-0 h-0 opacity-0 pointer-events-none" onChange={handleDateSelect} />
        </div >
    )
}
