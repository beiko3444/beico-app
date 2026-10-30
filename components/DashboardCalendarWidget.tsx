'use client'

import { buttonClass } from '@/components/ui/buttonClass'
import EmptyState from '@/components/ui/EmptyState'
import ModalCloseButton from '@/components/ui/ModalCloseButton'
import { fieldClass, labelClass } from '@/components/ui/field'
import Modal from '@/components/Modal'
import { useState, useTransition, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Circle, Plus, Trash2, Trophy } from 'lucide-react'
import { createTask, updateTask, toggleTask, deleteTask } from '@/app/admin/tasks/actions'
import { getKoreanHolidayName } from '@/lib/koreanHolidays'
import { createPortal } from 'react-dom'

type Task = {
    id: string
    title: string
    description?: string | null
    fileUrl?: string | null
    completed: boolean
    date: Date
}

const XP_PER_COMPLETED_TASK = 20
const XP_PER_LEVEL = 100

export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

/** Saturday and Sunday are always shown red, the same as public holidays. */
export const isWeekendDay = (day: number) => day === 0 || day === 6

const localDateKey = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

/** The one month navigation used by every calendar on the 근태 관리 page. */
export function CalendarMonthNav({ onPrev, onToday, onNext }: { onPrev: () => void; onToday: () => void; onNext: () => void }) {
    const segment = 'flex items-center justify-center text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-orange/40'
    return (
        <div className="inline-flex h-10 shrink-0 divide-x divide-slate-200 overflow-hidden rounded-[10px] border border-slate-200 bg-white">
            <button type="button" onClick={onPrev} aria-label="이전 달" className={`${segment} w-10`}>
                <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" onClick={onToday} className={`${segment} px-3 text-xs font-bold`}>
                이번 달
            </button>
            <button type="button" onClick={onNext} aria-label="다음 달" className={`${segment} w-10`}>
                <ChevronRight className="h-4 w-4" />
            </button>
        </div>
    )
}

function getTaskLevelState(tasks: Pick<Task, 'completed'>[]) {
    const completedCount = tasks.filter(task => task.completed).length
    const totalXp = completedCount * XP_PER_COMPLETED_TASK
    const level = Math.floor(totalXp / XP_PER_LEVEL) + 1
    const progressXp = totalXp % XP_PER_LEVEL
    const progressPercent = (progressXp / XP_PER_LEVEL) * 100
    const nextLevelXp = XP_PER_LEVEL - progressXp

    return {
        completedCount,
        totalXp,
        level,
        progressXp,
        progressPercent,
        nextLevelXp: progressXp === 0 && totalXp > 0 ? XP_PER_LEVEL : nextLevelXp
    }
}

export default function DashboardCalendarWidget({ tasks }: { tasks: any[] }) {
    const router = useRouter()
    const [parsedTasks, setParsedTasks] = useState<Task[]>(tasks.map(t => ({ ...t, date: new Date(t.date) })))
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [selectedDate, setSelectedDate] = useState(new Date())
    const [isPending, startTransition] = useTransition()
    const [levelFeedback, setLevelFeedback] = useState<'xp' | 'level' | null>(null)

    // Sync state with props when data is re-fetched
    useEffect(() => {
        setParsedTasks(tasks.map(t => ({ ...t, date: new Date(t.date) })))
    }, [tasks])

    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingTask, setEditingTask] = useState<Task | null>(null)
    const [hoverTask, setHoverTask] = useState<{ task: Task, x: number, y: number } | null>(null)
    const [mounted, setMounted] = useState(false)

    useEffect(() => { setMounted(true) }, [])

    useEffect(() => {
        if (!levelFeedback) return
        const timer = window.setTimeout(() => setLevelFeedback(null), 1400)
        return () => window.clearTimeout(timer)
    }, [levelFeedback])

    const taskLevel = useMemo(() => getTaskLevelState(parsedTasks), [parsedTasks])

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

    // Anchor on the 1st so moving from the 31st never skips a shorter month.
    const changeMonth = (offset: number) => {
        setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1))
    }

    const openNewTask = () => {
        setEditingTask(null)
        setIsModalOpen(true)
    }

    const closeModal = () => setIsModalOpen(false)

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
        const previousLevel = getTaskLevelState(parsedTasks).level
        const nextTasks = parsedTasks.map(task => task.id === id ? { ...task, completed } : task)
        const nextLevel = getTaskLevelState(nextTasks).level

        setParsedTasks(nextTasks)
        if (completed) {
            setLevelFeedback(nextLevel > previousLevel ? 'level' : 'xp')
        }

        startTransition(async () => {
            const result = await toggleTask(id, completed)
            if (result?.error) alert(result.error)
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

    const selectedDayTasks = parsedTasks.filter(t => isSameDay(t.date, selectedDate))
    const selectedDateLabel = `${selectedDate.getMonth() + 1}월 ${selectedDate.getDate()}일`

    return (
        <div className="flex flex-col gap-4 font-sans">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                            <Trophy className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-black">업무 레벨 {taskLevel.level}</h2>
                                {levelFeedback && (
                                    <span className={`rounded-full px-2 py-1 text-[11px] font-black leading-none ${levelFeedback === 'level' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>
                                        {levelFeedback === 'level' ? '레벨 업' : `+${XP_PER_COMPLETED_TASK} 경험치`}
                                    </span>
                                )}
                            </div>
                            <p className="mt-0.5 break-keep text-xs font-medium text-slate-500">업무 1건을 완료하면 {XP_PER_COMPLETED_TASK} 경험치가 쌓이고, {XP_PER_LEVEL} 경험치마다 레벨이 오릅니다.</p>
                        </div>
                    </div>
                    <span className="text-xs font-bold tabular-nums text-slate-600">
                        {taskLevel.progressXp}/{XP_PER_LEVEL} 경험치 · 다음 레벨까지 {taskLevel.nextLevelXp}
                    </span>
                </div>
                <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${taskLevel.progressPercent}%` }}
                    />
                </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
                    <div className="flex min-w-0 items-center gap-3">
                        <CalendarDays className="h-5 w-5 shrink-0 text-slate-400" />
                        <div className="min-w-0">
                            <h2 className="text-xl font-black text-slate-900">{currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월</h2>
                            <p className="break-keep text-xs font-medium text-slate-500">날짜를 고른 뒤 업무를 등록하세요. 날짜를 두 번 눌러도 등록됩니다.</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <CalendarMonthNav
                            onPrev={() => changeMonth(-1)}
                            onToday={() => { setCurrentMonth(new Date()); setSelectedDate(new Date()) }}
                            onNext={() => changeMonth(1)}
                        />
                        <button type="button" onClick={openNewTask} className={buttonClass('primary', 'md')}>
                            <Plus className="h-4 w-4" />
                            새 업무 등록
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
                    {WEEKDAY_LABELS.map((day, idx) => (
                        <div key={day} className={`py-2.5 text-center text-xs font-bold ${isWeekendDay(idx) ? 'text-red-600' : 'text-slate-500'}`}>
                            {day}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 auto-rows-fr">
                    {calendarDays.map((cell, idx) => {
                        const { date, current } = cell
                        const isSelected = isSameDay(date, selectedDate)
                        const isToday = isSameDay(date, new Date())
                        const dayTasks = parsedTasks.filter(t => isSameDay(t.date, date))
                        const isWeekend = isWeekendDay(date.getDay())
                        const isRedDay = isWeekend || Boolean(getKoreanHolidayName(localDateKey(date)))
                        const dateTextClass = isToday
                            ? 'bg-slate-900 text-white'
                            : !current
                                ? isRedDay ? 'text-red-300' : 'text-slate-300'
                                : isRedDay ? 'text-red-600' : 'text-slate-700'

                        return (
                            <div
                                key={idx}
                                onDoubleClick={() => {
                                    setSelectedDate(date)
                                    openNewTask()
                                }}
                                onClick={() => setSelectedDate(date)}
                                className={`group relative flex min-h-[100px] flex-col border-b border-r border-slate-100 p-1.5 transition-colors sm:p-2
                                    ${current ? (isWeekend ? 'bg-slate-50/70' : 'bg-white') : 'bg-slate-50/40'}
                                    ${isSelected ? 'ring-2 ring-inset ring-slate-900/15' : 'hover:bg-slate-50'}
                                `}
                            >
                                <div className="mb-1 flex items-start justify-between">
                                    <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1 text-sm font-black tabular-nums ${dateTextClass}`}>
                                        {date.getDate()}
                                    </span>
                                </div>

                                <div className="flex h-full flex-col gap-0.5 overflow-hidden">
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
                                            className={`cursor-pointer truncate rounded px-1.5 py-0.5 text-[11px] font-bold transition-colors
                                                ${t.completed ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}
                                            `}
                                        >
                                            {t.title}
                                        </div>
                                    ))}
                                    {dayTasks.length > 3 && (
                                        <div className="px-1 text-[11px] font-bold text-slate-400">+ {dayTasks.length - 3}</div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-lg font-black tabular-nums text-slate-900">{selectedDate.getDate()}</div>
                    <div>
                        <h3 className="text-sm font-black text-slate-900">{selectedDateLabel} 업무</h3>
                        <p className="mt-0.5 text-xs font-medium text-slate-500">달력에서 고른 날짜의 업무입니다.</p>
                    </div>
                </div>

                <div className="max-h-[250px] space-y-2 overflow-y-auto pr-2 scrollbar-hide">
                    {selectedDayTasks.length > 0 ? (
                        selectedDayTasks.map((task) => (
                            <div key={task.id} className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 transition-colors hover:border-slate-300">
                                <button
                                    type="button"
                                    onClick={() => handleToggleTask(task.id, !task.completed)}
                                    aria-label={task.completed ? '완료 취소' : '완료로 표시'}
                                    className={task.completed ? 'text-emerald-600' : 'text-slate-300 hover:text-slate-500'}
                                >
                                    {task.completed ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                                </button>
                                <span className={`flex-1 truncate text-sm font-bold ${task.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{task.title}</span>
                                <button
                                    type="button"
                                    onClick={() => handleDeleteTask(task.id)}
                                    aria-label="업무 삭제"
                                    title="업무 삭제"
                                    className={buttonClass('dangerGhost', 'icon', 'transition-opacity focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100')}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        ))
                    ) : (
                        <EmptyState bare compact title={`${selectedDateLabel}에 등록된 업무가 없습니다`} description="위의 [새 업무 등록]으로 추가하세요." />
                    )}
                </div>
            </div>

            {/* Hover Tooltip - Minimal */}
            {hoverTask && mounted && createPortal(
                <div
                    className="fixed z-[99999] pointer-events-none"
                    style={{ left: hoverTask.x, top: hoverTask.y - 5, transform: 'translateY(-100%)' }}
                >
                    <div className="w-48 rounded-xl border border-white/10 bg-slate-900 p-3 text-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <h4 className="mb-1 text-xs font-black">{hoverTask.task.title}</h4>
                        {hoverTask.task.description && (
                            <p className="truncate text-[11px] leading-snug text-slate-300">{hoverTask.task.description}</p>
                        )}
                    </div>
                </div>,
                document.body
            )}

            {isModalOpen && (
                <Modal labelledBy="task-modal-title" onClose={closeModal} className="bg-slate-950/50">
                    <div className="flex h-full items-end justify-center sm:items-center sm:p-4" onMouseDown={e => { if (e.target === e.currentTarget) closeModal() }}>
                        <div className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
                            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                                <div>
                                    <h3 id="task-modal-title" className="text-[18px] font-extrabold text-slate-900">{editingTask ? '업무 수정' : '새 업무 등록'}</h3>
                                    {!editingTask && <p className="mt-0.5 text-xs font-medium text-slate-500">{selectedDate.getFullYear()}년 {selectedDateLabel}</p>}
                                </div>
                                <ModalCloseButton onClick={closeModal} className="-mr-2 -mt-1" />
                            </div>
                            <form action={handleSaveTask} className="flex min-h-0 flex-1 flex-col">
                                <div className="space-y-4 overflow-y-auto p-5">
                                    <input type="hidden" name="date" value={selectedDate.toISOString()} />
                                    <label className="block">
                                        <span className={labelClass}>업무 제목</span>
                                        <input name="title" required autoFocus defaultValue={editingTask?.title || ''} placeholder="무엇을 해야 하나요?" className={fieldClass()} />
                                    </label>
                                    <label className="block">
                                        <span className={labelClass}>상세 내용</span>
                                        <textarea name="description" defaultValue={editingTask?.description || ''} placeholder="업무에 대한 상세 내용을 입력하세요" className={fieldClass('h-auto min-h-[100px] resize-none py-2.5')} />
                                    </label>
                                </div>
                                <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
                                    <button type="button" onClick={closeModal} className={buttonClass('secondary', 'md')}>취소</button>
                                    <button type="submit" disabled={isPending} className={buttonClass('primary', 'md')}>
                                        {isPending ? '저장 중...' : editingTask ? '변경 저장' : '업무 저장'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </Modal>
            )}

            <style jsx global>{`
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    )
}
