'use client'

import React, { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2, UserRound } from 'lucide-react'
import { createEmployee, deleteEmployee, toggleAttendanceDate, updateEmployee } from './actions'
import { getKoreanHolidayName } from '@/lib/koreanHolidays'
import DashboardCalendarWidget from '@/components/DashboardCalendarWidget'

type AttendanceRecord = {
    id: string
    workDate: string | Date
}

type AttendanceEmployee = {
    id: string
    name: string
    hourlyWage: number
    dailyHours: number
    active: boolean
    records: AttendanceRecord[]
}

type TaskRecord = {
    id: string
    title: string
    description: string | null
    fileUrl: string | null
    completed: boolean
    date: string | Date
    createdAt: string | Date
    updatedAt: string | Date
}

const dateKey = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

const formatMoney = (value: number) => `${Math.round(value).toLocaleString()}원`

export default function TasksClient({
    initialEmployees,
    initialTasks
}: {
    initialEmployees: AttendanceEmployee[]
    initialTasks: TaskRecord[]
}) {
    const router = useRouter()
    const [employees, setEmployees] = useState(initialEmployees)
    const [selectedEmployeeId, setSelectedEmployeeId] = useState(initialEmployees[0]?.id || '')
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [isPending, startTransition] = useTransition()
    const [previousEmployees, setPreviousEmployees] = useState(initialEmployees)
    const [activeView, setActiveView] = useState<'attendance' | 'tasks'>('attendance')

    if (previousEmployees !== initialEmployees) {
        setPreviousEmployees(initialEmployees)
        setEmployees(initialEmployees)
        setSelectedEmployeeId(previous => initialEmployees.some(employee => employee.id === previous) ? previous : initialEmployees[0]?.id || '')
    }

    const selectedEmployee = employees.find(employee => employee.id === selectedEmployeeId) || employees[0] || null
    const selectedWorkDates = useMemo(() => {
        return new Set((selectedEmployee?.records || []).map(record => dateKey(new Date(record.workDate))))
    }, [selectedEmployee])

    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate()
    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay()
    const calendarDays = [
        ...Array.from({ length: firstDay }, () => null),
        ...Array.from({ length: daysInMonth }, (_, index) => new Date(currentMonth.getFullYear(), currentMonth.getMonth(), index + 1))
    ]

    const monthWorkDates = Array.from(selectedWorkDates).filter(key => {
        const [year, month] = key.split('-').map(Number)
        return year === currentMonth.getFullYear() && month === currentMonth.getMonth() + 1
    })
    const monthlyWorkDays = monthWorkDates.length
    const monthlyPayroll = selectedEmployee
        ? selectedEmployee.hourlyWage * selectedEmployee.dailyHours * monthlyWorkDays
        : 0

    const changeMonth = (offset: number) => {
        setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1))
    }

    const handleCreateEmployee = (formData: FormData) => {
        startTransition(async () => {
            const result = await createEmployee(formData)
            if (result.error) {
                alert(result.error)
                return
            }
            if (result.employee) {
                setEmployees(prev => [...prev, result.employee])
                setSelectedEmployeeId(result.employee.id)
            }
            router.refresh()
        })
    }

    const handleUpdateEmployee = (formData: FormData) => {
        if (!selectedEmployee) return
        startTransition(async () => {
            const result = await updateEmployee(selectedEmployee.id, formData)
            if (result.error) {
                alert(result.error)
                return
            }
            const nextName = String(formData.get('name') || '').trim()
            const nextHourlyWage = Number(String(formData.get('hourlyWage') || '').replace(/[^0-9]/g, '')) || 0
            const nextDailyHours = Number(String(formData.get('dailyHours') || '').replace(/[^0-9.]/g, '')) || 0
            setEmployees(prev => prev.map(employee => employee.id === selectedEmployee.id
                ? { ...employee, name: nextName, hourlyWage: nextHourlyWage, dailyHours: nextDailyHours }
                : employee
            ))
            router.refresh()
        })
    }

    const handleDeleteEmployee = () => {
        if (!selectedEmployee) return
        if (!confirm(`${selectedEmployee.name} 직원을 삭제하시겠습니까? 근무일 기록도 함께 삭제됩니다.`)) return

        startTransition(async () => {
            const result = await deleteEmployee(selectedEmployee.id)
            if (result.error) {
                alert(result.error)
                return
            }
            setEmployees(prev => {
                const next = prev.filter(employee => employee.id !== selectedEmployee.id)
                setSelectedEmployeeId(next[0]?.id || '')
                return next
            })
            router.refresh()
        })
    }

    const handleToggleDate = (date: Date) => {
        if (!selectedEmployee) return
        const key = dateKey(date)

        setEmployees(prev => prev.map(employee => {
            if (employee.id !== selectedEmployee.id) return employee
            const exists = employee.records.some(record => dateKey(new Date(record.workDate)) === key)
            return {
                ...employee,
                records: exists
                    ? employee.records.filter(record => dateKey(new Date(record.workDate)) !== key)
                    : [...employee.records, { id: `temp-${key}`, workDate: key }]
            }
        }))

        startTransition(async () => {
            const result = await toggleAttendanceDate(selectedEmployee.id, key)
            if (result.error) {
                alert(result.error)
                router.refresh()
            }
        })
    }

    return (
        <div className="ux-page-stack font-sans">
            <header>
                <h1 className="ux-page-title">근태·업무 관리</h1>
                <p className="mt-2 text-sm text-[var(--muted-foreground)]">근무일과 급여를 확인하거나 업무 일정을 관리하세요.</p>
            </header>
            <div className="ux-tabs" role="tablist" aria-label="관리할 업무">
                <button id="attendance-tab" role="tab" aria-selected={activeView === 'attendance'} aria-controls="attendance-panel" onClick={() => setActiveView('attendance')}>근태·급여</button>
                <button id="tasks-tab" role="tab" aria-selected={activeView === 'tasks'} aria-controls="tasks-panel" onClick={() => setActiveView('tasks')}>업무 일정</button>
            </div>
            <div id="tasks-panel" role="tabpanel" aria-labelledby="tasks-tab" hidden={activeView !== 'tasks'}>
            <section className="space-y-6">
                <div>
                    <h2 className="ux-section-title">업무 일정</h2>
                    <p className="mt-1 text-sm font-medium text-gray-500">업무를 완료하면 경험치가 쌓이고 레벨이 올라갑니다.</p>
                </div>
                <DashboardCalendarWidget tasks={initialTasks} />
            </section>

            </div>
            <section id="attendance-panel" role="tabpanel" aria-labelledby="attendance-tab" hidden={activeView !== 'attendance'} className="space-y-5">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-bold text-gray-900">근태·급여</h2>
                    <p className="mt-1 text-sm font-medium text-gray-500">직원별 근무일을 체크하고 월 지출급여를 계산합니다.</p>
                </div>
                <div className="shrink-0 rounded-xl bg-gray-900 px-4 py-3 text-right text-white shadow-sm">
                    <div className="text-[11px] font-black uppercase tracking-widest text-gray-400">선택 직원 급여</div>
                    <div className="text-2xl font-black">{formatMoney(monthlyPayroll)}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
                <aside className="space-y-4">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="text-sm font-black text-gray-900">직원 선택</h2>
                            <UserRound className="w-4 h-4 text-gray-400" />
                        </div>
                        <div className="p-3 space-y-2">
                            {employees.length > 0 ? employees.map(employee => {
                                const selected = employee.id === selectedEmployee?.id
                                return (
                                    <button
                                        key={employee.id}
                                        type="button"
                                        onClick={() => setSelectedEmployeeId(employee.id)}
                                        className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${selected ? 'border-[#d9361b] bg-red-50' : 'border-gray-100 bg-white hover:bg-gray-50'}`}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="font-black text-gray-900">{employee.name}</div>
                                            <div className="text-xs font-bold text-gray-500">{formatMoney(employee.hourlyWage)}/h</div>
                                        </div>
                                        <div className="mt-1 text-xs font-medium text-gray-400">1일근로시간 {employee.dailyHours}시간</div>
                                    </button>
                                )
                            }) : (
                                <div className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm font-bold text-gray-400">
                                    등록된 직원이 없습니다.
                                </div>
                            )}
                        </div>
                    </div>

                    <details className="ux-panel"><summary className="min-h-12 cursor-pointer px-5 py-3 text-sm font-bold">새 직원 추가</summary><form action={handleCreateEmployee} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                        <div className="flex items-center gap-2">
                            <Plus className="w-4 h-4 text-[#d9361b]" />
                            <h2 className="text-sm font-black text-gray-900">직원 추가</h2>
                        </div>
                        <AttendanceInputs />
                        <button disabled={isPending} className="w-full rounded-xl bg-[#d9361b] py-3 text-sm font-black text-white hover:bg-red-600 disabled:opacity-50">
                            직원 추가
                        </button>
                    </form></details>

                    {selectedEmployee && (
                        <details key={selectedEmployee.id} className="ux-panel"><summary className="min-h-12 cursor-pointer px-5 py-3 text-sm font-bold">{selectedEmployee.name} 근로 조건 수정</summary><form action={handleUpdateEmployee} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                            <h2 className="text-sm font-black text-gray-900">직원 설정</h2>
                            <AttendanceInputs employee={selectedEmployee} />
                            <div className="flex gap-2">
                                <button disabled={isPending} className="flex-1 rounded-xl bg-gray-900 py-3 text-sm font-black text-white hover:bg-black disabled:opacity-50">
                                    설정 저장
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDeleteEmployee}
                                    disabled={isPending}
                                    className="rounded-xl border border-red-100 px-4 text-red-600 hover:bg-red-50 disabled:opacity-50"
                                    title="직원 삭제"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </form></details>
                    )}
                </aside>

                <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <CalendarDays className="w-5 h-5 text-[#d9361b]" />
                            <div>
                                <h2 className="text-xl font-black text-gray-900">{currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월</h2>
                                <p className="text-xs font-bold text-gray-400">{selectedEmployee ? `${selectedEmployee.name} · 날짜를 누르면 근무일이 즉시 저장됩니다.` : '직원을 먼저 선택하세요.'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button type="button" onClick={() => changeMonth(-1)} aria-label="이전 달" className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-100 p-2 hover:bg-gray-50">
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button type="button" onClick={() => setCurrentMonth(new Date())} className="rounded-xl border border-gray-100 px-4 py-2 text-xs font-black text-gray-600 hover:bg-gray-50">
                                이번 달
                            </button>
                            <button type="button" onClick={() => changeMonth(1)} aria-label="다음 달" className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-100 p-2 hover:bg-gray-50">
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
                        {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
                            <div key={day} className={`py-3 text-center text-xs font-black ${idx === 0 ? 'text-red-500' : idx === 6 ? 'text-blue-500' : 'text-gray-400'}`}>
                                {day}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7">
                        {calendarDays.map((date, index) => {
                            if (!date) return <div key={`blank-${index}`} className="min-h-[88px] sm:min-h-[112px] border-r border-b border-gray-100 bg-gray-50/40" />

                            const key = dateKey(date)
                            const checked = selectedWorkDates.has(key)
                            const holidayName = getKoreanHolidayName(key)
                            const isSunday = date.getDay() === 0
                            const isSaturday = date.getDay() === 6
                            const isWeekend = isSunday || isSaturday
                            const dayTextClass = holidayName || isSunday
                                ? 'text-red-600'
                                : isSaturday
                                    ? 'text-blue-500'
                                    : checked
                                        ? 'text-[#d9361b]'
                                        : 'text-gray-700'

                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => handleToggleDate(date)}
                                    disabled={!selectedEmployee || isPending}
                                    aria-pressed={checked}
                                    aria-label={`${date.getMonth() + 1}월 ${date.getDate()}일${holidayName ? ` ${holidayName}` : ''}, ${checked ? '근무일' : '미등록'}`}
                                    className={`min-h-[88px] sm:min-h-[112px] border-r border-b p-1.5 sm:p-3 text-left transition-all disabled:cursor-not-allowed ${
                                        checked
                                            ? 'border-blue-200 bg-blue-50 hover:bg-blue-100'
                                            : holidayName
                                                ? 'border-red-100 bg-red-50/50 hover:bg-red-50'
                                                : isWeekend
                                                    ? 'border-gray-100 bg-gray-50/70 hover:bg-gray-100'
                                                    : 'border-gray-100 bg-white hover:bg-gray-50'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <span className={`text-sm font-black ${dayTextClass}`}>{date.getDate()}</span>
                                        <span className={`h-5 w-5 rounded-full border flex items-center justify-center ${checked ? 'border-blue-600 bg-blue-600' : 'border-gray-200 bg-white'}`}>
                                            {checked && <span className="text-[11px] font-black text-white">✓</span>}
                                        </span>
                                    </div>
                                    {(holidayName || isWeekend) && (
                                        <div
                                            className={`mt-2 inline-flex max-w-full rounded-md px-2 py-1 text-[10px] font-black leading-none ${
                                                holidayName
                                                    ? 'bg-red-100 text-red-700'
                                                    : isSunday
                                                        ? 'bg-red-50 text-red-500'
                                                        : 'bg-blue-50 text-blue-500'
                                            }`}
                                        >
                                            <span className="truncate">{holidayName || (isSunday ? '일요일' : '토요일')}</span>
                                        </div>
                                    )}
                                    {checked && selectedEmployee && (
                                        <div className="mt-3 rounded-lg bg-white/80 px-1 py-1 text-[10px] font-bold text-blue-700 sm:px-2 sm:text-[11px]">
                                            {selectedEmployee.dailyHours}h · {formatMoney(selectedEmployee.hourlyWage * selectedEmployee.dailyHours)}
                                        </div>
                                    )}
                                </button>
                            )
                        })}
                    </div>

                    <div className="px-6 py-5 bg-gray-50 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm font-bold text-gray-500">
                            {selectedEmployee ? `${selectedEmployee.name} · ${monthlyWorkDays}일 근무 · ${selectedEmployee.dailyHours}시간/일` : '직원을 추가하거나 선택해 주세요.'}
                        </div>
                        <div className="text-right">
                            <div className="text-xs font-black text-gray-400 uppercase tracking-widest">선택 직원 급여</div>
                            <div className="text-3xl font-black text-[#d9361b]">{formatMoney(monthlyPayroll)}</div>
                        </div>
                    </div>
                </section>
            </div>
            </section>
        </div>
    )
}

function AttendanceInputs({ employee }: { employee?: AttendanceEmployee }) {
    return (
        <div className="space-y-3">
            <label className="block">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">직원명</span>
                <input
                    name="name"
                    required
                    defaultValue={employee?.name || ''}
                    placeholder="직원 이름"
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-900 outline-none focus:border-[#d9361b] focus:ring-2 focus:ring-[#d9361b]/10"
                />
            </label>
            <div className="grid grid-cols-2 gap-3">
                <label className="block">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">시급</span>
                    <input
                        name="hourlyWage"
                        required
                        inputMode="numeric"
                        defaultValue={employee?.hourlyWage || ''}
                        placeholder="10000"
                        className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-900 outline-none focus:border-[#d9361b] focus:ring-2 focus:ring-[#d9361b]/10"
                    />
                </label>
                <label className="block">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">1일근로시간</span>
                    <input
                        name="dailyHours"
                        required
                        inputMode="decimal"
                        defaultValue={employee?.dailyHours || ''}
                        placeholder="8"
                        className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-900 outline-none focus:border-[#d9361b] focus:ring-2 focus:ring-[#d9361b]/10"
                    />
                </label>
            </div>
        </div>
    )
}
