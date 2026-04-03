'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Circle, Trash2, Plus, ChevronUp, ChevronDown, X, FileText, Paperclip } from 'lucide-react'
import { createTask, updateTask, toggleTask, deleteTask } from '@/app/admin/tasks/actions'
import { createPortal } from 'react-dom'

type Task = {
    id: string
    title: string
    description?: string | null
    fileUrl?: string | null
    completed: boolean
    date: Date
}

export default function DashboardCalendarWidget({ tasks }: { tasks: any[] }) {
    const router = useRouter()
    const [parsedTasks, setParsedTasks] = useState<Task[]>(tasks.map(t => ({ ...t, date: new Date(t.date) })))
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [selectedDate, setSelectedDate] = useState(new Date())
    const [isPending, startTransition] = useTransition()

    // Sync state with props when data is re-fetched
    useEffect(() => {
        setParsedTasks(tasks.map(t => ({ ...t, date: new Date(t.date) })))
    }, [tasks])

    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingTask, setEditingTask] = useState<Task | null>(null)
    const [hoverTask, setHoverTask] = useState<{ task: Task, x: number, y: number } | null>(null)
    const [mounted, setMounted] = useState(false)

    useEffect(() => { setMounted(true) }, [])

    const getDaysInMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
    }

    const getFirstDayOfMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
    }

    const isSameDay = (d1: Date, d2: Date) => {
        return d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate()
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

    const handleSaveTask = async (formData: FormData) => {
        startTransition(async () => {
            if (editingTask?.id) {
                const res = await updateTask(editingTask.id, formData)
                if (res.error) alert(res.error)
            } else {
                const res = await createTask(formData)
                if (res.error) alert(res.error)
            }
            setIsModalOpen(false)
            setEditingTask(null)
            router.refresh()
        })
    }

    const handleToggleTask = async (id: string, completed: boolean) => {
        startTransition(async () => {
            await toggleTask(id, completed)
            router.refresh()
        })
    }

    const handleDeleteTask = async (id: string) => {
        if (!confirm('정말 삭제하시겠습니까?')) return
        startTransition(async () => {
            await deleteTask(id)
            router.refresh()
        })
    }

    const daysInMonth = getDaysInMonth(currentMonth)
    const firstDay = getFirstDayOfMonth(currentMonth)
    const calendarDays = []

    // Previous month filler
    const prevMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 0)
    const daysInPrevMonth = prevMonth.getDate()
    for (let i = firstDay - 1; i >= 0; i--) {
        calendarDays.push({ date: new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, daysInPrevMonth - i), current: false })
    }

    for (let i = 1; i <= daysInMonth; i++) {
        calendarDays.push({ date: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i), current: true })
    }

    const totalCells = Math.ceil((daysInMonth + firstDay) / 7) * 7
    const nextDays = totalCells - calendarDays.length
    for (let i = 1; i <= nextDays; i++) {
        calendarDays.push({ date: new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, i), current: false })
    }

    return (
        <div className="flex flex-col gap-6 font-sans">
            <div className="bg-white dark:bg-[#1e1e1e] rounded-3xl shadow-sm dark:shadow-none border border-gray-100 dark:border-[#2a2a2a] overflow-hidden">
                {/* Header */}
                <div className="bg-white dark:bg-[#1e1e1e] text-gray-900 dark:text-white p-5 flex justify-between items-center border-b border-gray-100 dark:border-[#2a2a2a]">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3">
                            <div className="flex flex-col items-center">
                                <button onClick={() => changeYear(1)} className="hover:text-blue-500 transition-colors"><ChevronUp className="w-3 h-3" /></button>
                                <span className="text-xl font-black tracking-tighter leading-none">{currentMonth.getFullYear()}</span>
                                <button onClick={() => changeYear(-1)} className="hover:text-blue-500 transition-colors"><ChevronDown className="w-3 h-3" /></button>
                            </div>
                            <div className="w-px h-6 bg-gray-200 dark:bg-[#2a2a2a]"></div>
                            <div className="flex flex-col items-center">
                                <button onClick={() => changeMonth(1)} className="hover:text-blue-500 transition-colors"><ChevronUp className="w-3 h-3" /></button>
                                <span className="text-xl font-black tracking-tighter leading-none">{currentMonth.getMonth() + 1}</span>
                                <button onClick={() => changeMonth(-1)} className="hover:text-blue-500 transition-colors"><ChevronDown className="w-3 h-3" /></button>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => { setCurrentMonth(new Date()); setSelectedDate(new Date()); }} className="px-3 py-1.5 bg-gray-100 dark:bg-[#2a2a2a] hover:bg-gray-200 dark:hover:bg-[#252525] rounded-lg text-[9px] font-black uppercase tracking-widest transition-all">Today</button>
                    </div>
                </div>

                {/* Weekdays */}
                <div className="grid grid-cols-7 border-b border-gray-100 dark:border-[#2a2a2a] bg-gray-50/50 dark:bg-[#1a1a1a]">
                    {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
                        <div key={day} className={`py-3 text-center text-[10px] font-black tracking-widest ${idx === 0 ? 'text-red-500' : idx === 6 ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500'}`}>
                            {day}
                        </div>
                    ))}
                </div>

                {/* Grid */}
                <div className="grid grid-cols-7 auto-rows-fr">
                    {calendarDays.map((cell, idx) => {
                        const { date, current } = cell
                        const isSelected = isSameDay(date, selectedDate)
                        const isToday = isSameDay(date, new Date())
                        const dayTasks = parsedTasks.filter(t => isSameDay(t.date, date))
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6

                        return (
                            <div
                                key={idx}
                                onDoubleClick={() => {
                                    setSelectedDate(date)
                                    setEditingTask(null)
                                    setIsModalOpen(true)
                                }}
                                onClick={() => setSelectedDate(date)}
                                className={`min-h-[100px] p-1.5 border-r border-b border-gray-100 dark:border-[#2a2a2a] transition-all flex flex-col group relative
                                    ${current ? (isToday ? 'bg-yellow-200 dark:bg-yellow-900/30' : isWeekend ? 'bg-gray-50 dark:bg-[#1a1a1a]' : 'bg-white dark:bg-[#1e1e1e]') : 'bg-gray-50/20 dark:bg-[#1a1a1a]/50 text-gray-300 dark:text-gray-500'}
                                    ${isSelected ? 'bg-indigo-50/30 dark:bg-indigo-900/20' : 'hover:bg-gray-800 hover:text-white dark:hover:bg-[#252525]'}
                                `}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className={`text-[11px] font-black ${isToday ? 'bg-[#d9361b] text-white w-5 h-5 flex items-center justify-center rounded-md shadow-sm' : isSelected ? 'text-indigo-600' : ''}`}>
                                        {date.getDate()}
                                    </span>
                                </div>

                                <div className="flex flex-col gap-0.5 overflow-hidden h-full">
                                    {dayTasks.slice(0, 3).map((t) => (
                                        <div
                                            key={t.id}
                                            onMouseEnter={(e) => {
                                                const rect = e.currentTarget.getBoundingClientRect()
                                                setHoverTask({ task: t, x: rect.left, y: rect.top })
                                            }}
                                            onMouseLeave={() => setHoverTask(null)}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setEditingTask(t)
                                                setIsModalOpen(true)
                                            }}
                                            className={`text-[9px] px-1.5 py-0.5 rounded-[4px] truncate font-bold tracking-tight cursor-pointer transition-all
                                                ${t.completed ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}
                                            `}
                                        >
                                            {t.title}
                                        </div>
                                    ))}
                                    {dayTasks.length > 3 && (
                                        <div className="text-[8px] font-bold text-gray-300 dark:text-gray-500 px-1">+ {dayTasks.length - 3}</div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Quick Summary Section */}
            <div className="bg-white dark:bg-[#1e1e1e] rounded-3xl p-6 shadow-sm dark:shadow-none border border-gray-100 dark:border-[#2a2a2a] flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center text-lg font-black">{selectedDate.getDate()}</div>
                        <div>
                            <h3 className="text-sm font-black text-gray-900 dark:text-white leading-none">{selectedDate.getMonth() + 1}월 일정</h3>
                            <p className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1">Agenda</p>
                        </div>
                    </div>
                    <button onClick={() => router.push('/admin/tasks')} className="text-[10px] font-black text-indigo-500 hover:underline">상세보기</button>
                </div>

                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 scrollbar-hide">
                    {parsedTasks.filter(t => isSameDay(t.date, selectedDate)).length > 0 ? (
                        parsedTasks.filter(t => isSameDay(t.date, selectedDate)).map((task) => (
                            <div key={task.id} className="flex items-center gap-3 p-3 bg-gray-50/50 dark:bg-[#1a1a1a] rounded-xl border border-gray-50 dark:border-[#2a2a2a] group hover:border-black dark:hover:border-gray-500 transition-all">
                                <button onClick={() => handleToggleTask(task.id, !task.completed)} className={task.completed ? 'text-emerald-500' : 'text-gray-300 dark:text-gray-500'}>
                                    {task.completed ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                                </button>
                                <span className={`text-[11px] font-bold flex-1 truncate ${task.completed ? 'text-gray-300 dark:text-gray-500 line-through' : 'text-gray-700 dark:text-gray-400'}`}>{task.title}</span>
                                <button onClick={() => handleDeleteTask(task.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 dark:text-gray-500 hover:text-red-500 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                        ))
                    ) : (
                        <div className="py-8 text-center text-[10px] font-black text-gray-300 dark:text-gray-500 uppercase tracking-widest">일정이 없습니다</div>
                    )}
                </div>

                <button
                    onClick={() => { setEditingTask(null); setIsModalOpen(true); }}
                    className="w-full py-3 bg-gray-900 hover:bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md"
                >
                    + 새 업무 등록
                </button>
            </div>

            {/* Hover Tooltip - Minimal */}
            {hoverTask && mounted && createPortal(
                <div
                    className="fixed z-[99999] pointer-events-none"
                    style={{ left: hoverTask.x, top: hoverTask.y - 5, transform: 'translateY(-100%)' }}
                >
                    <div className="bg-gray-900 text-white p-3 rounded-xl shadow-2xl border border-white/10 w-48 animate-in fade-in zoom-in-95 duration-200">
                        <h4 className="text-[11px] font-black mb-1">{hoverTask.task.title}</h4>
                        {hoverTask.task.description && (
                            <p className="text-[9px] text-gray-400 leading-snug truncate">{hoverTask.task.description}</p>
                        )}
                    </div>
                </div>,
                document.body
            )}

            {/* Modal - Consistent with TasksClient */}
            {isModalOpen && mounted && createPortal(
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100000] flex items-center justify-center p-4" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-white dark:bg-[#1e1e1e] rounded-[2rem] w-full max-w-md overflow-hidden flex flex-col shadow-2xl dark:shadow-none" onClick={e => e.stopPropagation()}>
                        <div className="bg-gray-50 dark:bg-[#1a1a1a] p-6 border-b border-gray-100 dark:border-[#2a2a2a] flex justify-between items-center">
                            <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tighter">{editingTask ? '업무 수정' : '새 업무 등록'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 dark:text-gray-500"><X className="w-5 h-5" /></button>
                        </div>
                        <form action={handleSaveTask} className="p-6 space-y-4">
                            <input type="hidden" name="date" value={selectedDate.toISOString()} />
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">업무 제목</label>
                                <input name="title" required defaultValue={editingTask?.title || ''} placeholder="무엇을 해야 하나요?" className="w-full bg-gray-50 dark:bg-[#1a1a1a] border border-gray-100 dark:border-[#2a2a2a] rounded-xl px-4 py-3 text-sm font-black text-gray-900 dark:text-white focus:ring-2 focus:ring-black outline-none transition-all" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">상세 내용</label>
                                <textarea name="description" defaultValue={editingTask?.description || ''} placeholder="업무에 대한 상세 내용을 입력하세요..." className="w-full bg-gray-50 dark:bg-[#1a1a1a] border border-gray-100 dark:border-[#2a2a2a] rounded-xl px-4 py-3 text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-black outline-none transition-all min-h-[100px] resize-none" />
                            </div>
                            <button type="submit" disabled={isPending} className="w-full py-4 bg-black text-white rounded-xl font-black text-xs uppercase tracking-widest">
                                {isPending ? '저장 중...' : '일정 저장하기'}
                            </button>
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
