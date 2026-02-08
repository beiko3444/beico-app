'use client'

import React, { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createTask, updateTask, toggleTask, deleteTask, updateTaskDate } from './actions'
import { CheckCircle2, Circle, Trash2, Plus, ChevronUp, ChevronDown, X, FileText, Paperclip } from 'lucide-react'
import { createPortal } from 'react-dom'
import { DndContext, useDraggable, useDroppable, DragEndEvent, PointerSensor, useSensor, useSensors, DragOverlay, DragStartEvent } from '@dnd-kit/core'

type Task = {
    id: string
    title: string
    description?: string | null
    fileUrl?: string | null
    completed: boolean
    date: Date
}

export default function TasksClient({ initialTasks }: { initialTasks: any[] }) {
    const router = useRouter()
    const [tasks, setTasks] = useState<Task[]>(initialTasks.map(t => ({ ...t, date: new Date(t.date) })))
    const [selectedDate, setSelectedDate] = useState(new Date())
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [isPending, startTransition] = useTransition()

    // Sync state with props when data is re-fetched
    useEffect(() => {
        setTasks(initialTasks.map(t => ({ ...t, date: new Date(t.date) })))
    }, [initialTasks])

    // Modal & Hover states
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingTask, setEditingTask] = useState<Task | null>(null)
    const [hoverTask, setHoverTask] = useState<{ task: Task, x: number, y: number } | null>(null)
    const [mounted, setMounted] = useState(false)
    const [activeId, setActiveId] = useState<string | null>(null)
    const [fileUrl, setFileUrl] = useState<string | null>(null)

    useEffect(() => { setMounted(true) }, [])

    // Calendar Helper Functions
    const getDaysInMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
    }

    const getFirstDayOfMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
    }

    const changeMonth = (offset: number) => {
        const newDate = new Date(currentMonth)
        newDate.setMonth(newDate.getMonth() + offset)
        setCurrentMonth(newDate)
    }

    const changeYear = (offset: number) => {
        const newDate = new Date(currentMonth)
        newDate.setFullYear(newDate.getFullYear() + offset)
        setCurrentMonth(newDate)
    }

    const isSameDay = (d1: Date, d2: Date) => {
        return d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate()
    }

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    )

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string)
    }

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event
        setActiveId(null)
        if (!over) return

        const taskId = active.id as string
        const newDateStr = over.id as string
        const task = tasks.find(t => t.id === taskId)

        if (task && task.date.toISOString() !== newDateStr) {
            // Optimistic update
            const newDate = new Date(newDateStr)
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, date: newDate } : t))

            startTransition(async () => {
                const res = await updateTaskDate(taskId, newDateStr)
                if (res.error) {
                    alert(res.error)
                    // Rollback if failed
                    router.refresh()
                }
            })
        }
    }

    // Task Actions
    const handleSaveTask = async (formData: FormData) => {
        startTransition(async () => {
            if (editingTask?.id) {
                // Update
                const res = await updateTask(editingTask.id, formData)
                if (res.error) alert(res.error)
            } else {
                // Create
                const res = await createTask(formData)
                if (res.error) alert(res.error)
            }
            setIsModalOpen(false)
            setEditingTask(null)
            router.refresh()
        })
    }

    const handleToggleTask = (id: string, completed: boolean) => {
        startTransition(async () => {
            setTasks(prev => prev.map(t => t.id === id ? { ...t, completed } : t))
            await toggleTask(id, completed)
        })
    }

    const handleDeleteTask = (id: string) => {
        if (!confirm('정말 삭제하시겠습니까?')) return
        startTransition(async () => {
            setTasks(prev => prev.filter(t => t.id !== id))
            await deleteTask(id)
        })
    }

    // Calendar Grid Generation
    const daysInMonth = getDaysInMonth(currentMonth)
    const firstDay = getFirstDayOfMonth(currentMonth)
    const calendarDays = []

    // Previous month filler
    const prevMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 0)
    const daysInPrevMonth = prevMonth.getDate()
    for (let i = firstDay - 1; i >= 0; i--) {
        calendarDays.push({ date: new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, daysInPrevMonth - i), current: false })
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
        calendarDays.push({ date: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i), current: true })
    }

    // Next month filler
    const totalCells = Math.ceil((daysInMonth + firstDay) / 7) * 7
    const nextDays = totalCells - calendarDays.length
    for (let i = 1; i <= nextDays; i++) {
        calendarDays.push({ date: new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, i), current: false })
    }

    return (
        <div className="flex flex-col gap-6 font-sans">
            {/* Calendar Main View (Horizontally Long) */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Header */}
                <div className="bg-white text-gray-900 p-6 flex justify-between items-center border-b border-gray-100">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col items-center">
                                <button onClick={() => changeYear(1)} className="hover:text-blue-500 transition-colors"><ChevronUp className="w-4 h-4" /></button>
                                <span className="text-2xl font-black tracking-tighter leading-none">{currentMonth.getFullYear()}</span>
                                <button onClick={() => changeYear(-1)} className="hover:text-blue-500 transition-colors"><ChevronDown className="w-4 h-4" /></button>
                            </div>
                            <div className="w-px h-8 bg-gray-200"></div>
                            <div className="flex flex-col items-center">
                                <button onClick={() => changeMonth(1)} className="hover:text-blue-500 transition-colors"><ChevronUp className="w-4 h-4" /></button>
                                <span className="text-2xl font-black tracking-tighter leading-none">{currentMonth.getMonth() + 1}</span>
                                <button onClick={() => changeMonth(-1)} className="hover:text-blue-500 transition-colors"><ChevronDown className="w-4 h-4" /></button>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button onClick={() => { setCurrentMonth(new Date()); setSelectedDate(new Date()); }} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Today</button>
                        <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-widest text-gray-400">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> 완료
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-[#d9361b]"></span> 대기
                            </div>
                        </div>
                    </div>
                </div>

                {/* Weekdays */}
                <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/50">
                    {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
                        <div key={day} className={`py-4 text-center text-sm font-black tracking-widest ${idx === 0 ? 'text-red-500' : idx === 6 ? 'text-blue-500' : 'text-gray-400'}`}>
                            {day}
                        </div>
                    ))}
                </div>

                {/* Grid */}
                <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                    <div className="grid grid-cols-7 auto-rows-fr">
                        {calendarDays.map((cell, idx) => (
                            <CalendarDayCell
                                key={`${idx}-${cell.date.toISOString()}`}
                                cell={cell}
                                isSameDay={isSameDay}
                                selectedDate={selectedDate}
                                setSelectedDate={setSelectedDate}
                                setEditingTask={(task: any) => {
                                    setEditingTask(task)
                                    setFileUrl(task ? task.fileUrl : null)
                                }}
                                setIsModalOpen={setIsModalOpen}
                                setHoverTask={setHoverTask}
                                tasks={tasks}
                                isDraggingAnything={!!activeId}
                            />
                        ))}
                    </div>
                    <DragOverlay dropAnimation={null}>
                        {activeId ? (
                            <div className="opacity-80">
                                <TaskItem
                                    task={tasks.find(t => t.id === activeId)!}
                                    isOverlay
                                />
                            </div>
                        ) : null}
                    </DragOverlay>
                </DndContext>
            </div>

            {/* Bottom: Focused Day Task List & Quick Add */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-1">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-black text-white rounded-2xl flex items-center justify-center text-xl font-black shadow-lg">
                            {selectedDate.getDate()}
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-gray-900 tracking-tighter">
                                {selectedDate.getFullYear()}. {selectedDate.getMonth() + 1}
                            </h3>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest italic">
                                {['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'][selectedDate.getDay()]}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => { setEditingTask(null); setFileUrl(null); setIsModalOpen(true); }}
                        className="w-full py-4 bg-black text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-800 transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> 새 업무 등록
                    </button>
                </div>

                <div className="lg:col-span-2 space-y-3 max-h-[400px] overflow-y-auto pr-4 scrollbar-hide">
                    {tasks.filter(t => isSameDay(t.date, selectedDate)).length > 0 ? (
                        tasks.filter(t => isSameDay(t.date, selectedDate)).map((task) => (
                            <div
                                key={task.id}
                                className={`group flex items-center gap-4 p-4 rounded-2xl transition-all border
                                    ${task.completed ? 'bg-gray-50/50 border-gray-100 opacity-60' : 'bg-white border-gray-100 hover:border-black hover:shadow-xl hover:-translate-y-1'}
                                `}
                            >
                                <button
                                    onClick={() => handleToggleTask(task.id, !task.completed)}
                                    className={`transition-all active:scale-90 ${task.completed ? 'text-emerald-500' : 'text-gray-200 hover:text-gray-400'}`}
                                >
                                    {task.completed ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                                </button>
                                <div className="flex-1 min-w-0 flex items-center gap-6" onClick={() => { setEditingTask(task); setFileUrl(task.fileUrl || null); setIsModalOpen(true); }}>
                                    <h4 className={`text-sm font-black truncate max-w-[200px] ${task.completed ? 'text-gray-300 line-through' : 'text-gray-900'}`}>{task.title}</h4>
                                    {task.description && <p className="text-xs text-gray-400 truncate font-medium flex-1 pt-0.5">{task.description}</p>}
                                </div>
                                <div className="flex items-center gap-3">
                                    {task.fileUrl && <Paperclip className="w-4 h-4 text-blue-500" />}
                                    <button
                                        onClick={() => { setEditingTask(task); setFileUrl(task.fileUrl || null); setIsModalOpen(true); }}
                                        className="bg-gray-100 hover:bg-black hover:text-white px-4 py-2 rounded-xl text-[10px] font-black transition-all shadow-sm"
                                    >
                                        수정
                                    </button>
                                    <button
                                        onClick={() => handleDeleteTask(task.id)}
                                        className="bg-red-50 hover:bg-red-500 hover:text-white px-4 py-2 rounded-xl text-[10px] font-black text-red-500 transition-all shadow-sm"
                                    >
                                        삭제
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="py-20 text-center bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-100">
                            <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">No events scheduled</p>
                        </div>
                    )}
                </div>
            </div>



            {/* Task Modal (Add/Edit) */}
            {isModalOpen && mounted && createPortal(
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100000] flex items-center justify-center p-4" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                        <div className="bg-gray-50 p-8 border-b border-gray-100 flex justify-between items-start">
                            <div>
                                <h3 className="text-2xl font-black text-gray-900 tracking-tighter">{editingTask ? '업무 수정' : '새 업무 등록'}</h3>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
                                    {selectedDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
                                </p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-all text-gray-400"><X className="w-6 h-6" /></button>
                        </div>

                        <form action={handleSaveTask} className="p-8 space-y-6">
                            <input type="hidden" name="date" value={selectedDate.toISOString()} />
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">업무 제목</label>
                                <input
                                    name="title"
                                    type="text"
                                    required
                                    defaultValue={editingTask?.title || ''}
                                    placeholder="무엇을 해야 하나요?"
                                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-sm font-black focus:ring-2 focus:ring-black focus:bg-white outline-none transition-all placeholder:text-gray-300"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">상세 내용</label>
                                <textarea
                                    name="description"
                                    defaultValue={editingTask?.description || ''}
                                    placeholder="업무에 대한 상세 내용을 입력하세요..."
                                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-sm font-medium focus:ring-2 focus:ring-black focus:bg-white outline-none transition-all placeholder:text-gray-300 min-h-[120px] resize-none"
                                />
                            </div>

                            <div className="flex gap-4">
                                {editingTask && (
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteTask(editingTask.id)}
                                        className="flex-1 py-5 bg-red-50 text-red-600 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-lg active:scale-95"
                                    >
                                        일정 삭제하기
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    disabled={isPending}
                                    className={`${editingTask ? 'flex-[2]' : 'w-full'} py-5 bg-black text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-gray-800 transition-all shadow-xl active:scale-95 disabled:opacity-50`}
                                >
                                    {isPending ? '저장 중...' : editingTask ? '일정 수정하기' : '일정 등록하기'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            <style jsx global>{`
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    )
}

function CalendarDayCell({ cell, isSameDay, selectedDate, setSelectedDate, setEditingTask, setIsModalOpen, setHoverTask, tasks, isDraggingAnything }: any) {
    const { date, current } = cell
    const { isOver, setNodeRef } = useDroppable({
        id: date.toISOString(),
        disabled: isDraggingAnything === false // Only enable when dragging is active for performance if needed, but usually isOver needs it
    })

    const isSelected = isSameDay(date, selectedDate)
    const isToday = isSameDay(date, new Date())
    const dayTasks = tasks.filter((t: any) => isSameDay(t.date, date))

    const isWeekend = date.getDay() === 0 || date.getDay() === 6

    return (
        <div
            ref={setNodeRef}
            onDoubleClick={() => {
                setSelectedDate(date)
                setEditingTask(null)
                setIsModalOpen(true)
            }}
            onClick={() => setSelectedDate(date)}
            className={`min-h-[140px] p-2 border-r border-b border-gray-100 transition-all flex flex-col group relative
                ${current ? (isToday ? 'bg-yellow-200' : isWeekend ? 'bg-gray-50' : 'bg-white') : 'bg-gray-50/20 text-gray-300'}
                ${isSelected ? 'bg-emerald-50' : 'hover:bg-gray-50'}
                ${isOver ? 'bg-blue-100/50 ring-2 ring-blue-400 ring-inset z-10' : ''}
            `}
        >
            <div className="flex justify-between items-start mb-2 relative z-10">
                <span className={`text-sm font-black transition-all ${isToday ? 'bg-[#d9361b] text-white w-6 h-6 flex items-center justify-center rounded-lg shadow-md' : isSelected ? 'text-emerald-600' : ''}`}>
                    {date.getDate()}
                </span>
                {dayTasks.length > 0 && <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">{dayTasks.length} tasks</span>}
            </div>

            <div className="flex flex-col gap-1 overflow-hidden h-full relative z-10">
                {dayTasks.slice(0, 5).map((t: any) => (
                    <DraggableTaskItem
                        key={t.id}
                        task={t}
                        setHoverTask={setHoverTask}
                        setEditingTask={setEditingTask}
                        setIsModalOpen={setIsModalOpen}
                        isDraggingAnything={isDraggingAnything}
                        isExpanded={false}
                    />
                ))}
                {dayTasks.length > 5 && (
                    <div className="text-[9px] font-black text-gray-300 px-2 uppercase tracking-widest mt-auto">+ {dayTasks.length - 5} more</div>
                )}
            </div>
        </div>
    )
}

function DraggableTaskItem({ task, setHoverTask, setEditingTask, setIsModalOpen, isDraggingAnything, isExpanded }: any) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: task.id,
    })

    return (
        <TaskItem
            ref={setNodeRef}
            task={task}
            isDragging={isDragging}
            attributes={attributes}
            listeners={listeners}
            isExpanded={isExpanded}
            onMouseEnter={(e: any) => {
                if (isDraggingAnything) return
                // Hover tooltip functionality removed as per user request
            }}
            onMouseLeave={() => setHoverTask(null)}
            onClick={(e: any) => {
                e.stopPropagation()
                setEditingTask(task)
                setIsModalOpen(true)
            }}
        />
    )
}

const TaskItem = React.forwardRef(({ task, isDragging, isOverlay, attributes, listeners, onMouseEnter, onMouseLeave, onClick, isExpanded }: any, ref: any) => {
    return (
        <div
            ref={ref}
            {...listeners}
            {...attributes}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onClick={onClick}
            className={`text-[10px] px-2 py-1.5 rounded-xl font-black tracking-tight cursor-grab active:cursor-grabbing transition-all border
                ${task.completed ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}
                ${isDragging ? 'opacity-0' : 'hover:scale-[1.02]'}
                ${isOverlay ? 'shadow-2xl scale-105 opacity-100 w-[140px]' : ''}
                ${isExpanded ? 'whitespace-normal break-all' : 'truncate'}
            `}
        >
            <div className="flex items-center gap-1.5">
                <span className={`w-1 h-1 rounded-full shrink-0 ${task.completed ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                <span>{task.title}</span>
            </div>
            {isExpanded && task.description && (
                <p className="mt-1 text-[9px] text-gray-400 font-medium leading-tight opacity-70 px-2.5">{task.description}</p>
            )}
        </div>
    )
})

TaskItem.displayName = 'TaskItem'
