'use client'

import React, { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Check, Pencil, Plus, Trash2, UserRound } from 'lucide-react'
import { createEmployee, deleteEmployee, toggleAttendanceDate, updateEmployee } from './actions'
import { getKoreanHolidayName } from '@/lib/koreanHolidays'
import DashboardCalendarWidget, { CalendarMonthNav, WEEKDAY_LABELS, isWeekendDay } from '@/components/DashboardCalendarWidget'
import PageHeader from '@/components/ui/PageHeader'
import Tabs from '@/components/ui/Tabs'
import EmptyState from '@/components/ui/EmptyState'
import { buttonClass } from '@/components/ui/buttonClass'

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
    const [employeeForm, setEmployeeForm] = useState<'create' | 'edit' | null>(null)

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
            setEmployeeForm(null)
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
            setEmployeeForm(null)
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
            setEmployeeForm(null)
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

    const toggleEmployeeForm = (form: 'create' | 'edit') => {
        setEmployeeForm(previous => previous === form ? null : form)
    }

    const inputClass = 'mt-1 h-10 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 transition-colors focus:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/15'

    return (
        <div className="font-sans">
            <PageHeader
                title="근태 관리"
                description="직원별 근무일과 월 급여를 확인하고, 업무 일정을 관리합니다."
            />
            <Tabs
                aria-label="관리할 업무"
                items={[{ key: 'attendance', label: '근태·급여' }, { key: 'tasks', label: '업무 일정' }]}
                value={activeView}
                onChange={setActiveView}
            />

            <div role="tabpanel" aria-label="업무 일정" hidden={activeView !== 'tasks'} className="mt-4">
                <DashboardCalendarWidget tasks={initialTasks} />
            </div>

            <div role="tabpanel" aria-label="근태·급여" hidden={activeView !== 'attendance'} className="mt-4">
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)] xl:items-start xl:gap-6">
                    {/* On phones the calendar is the main task, so employees become a chip row above it. */}
                    {employees.length > 0 && (
                        <div role="group" aria-label="직원 선택" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 xl:hidden">
                            {employees.map(employee => {
                                const selected = employee.id === selectedEmployee?.id
                                return (
                                    <button
                                        key={employee.id}
                                        type="button"
                                        aria-pressed={selected}
                                        onClick={() => setSelectedEmployeeId(employee.id)}
                                        className={`inline-flex h-9 shrink-0 items-center rounded-full border px-4 text-sm font-bold transition-colors ${selected ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}
                                    >
                                        {employee.name}
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    <aside className={employees.length > 0 ? 'order-last xl:order-none' : ''}>
                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
                                <h2 className="flex items-center gap-2 text-sm font-black text-slate-900">
                                    직원
                                    <span className="text-xs font-bold tabular-nums text-slate-400">{employees.length}</span>
                                </h2>
                                <div className="flex items-center gap-1">
                                    {selectedEmployee && (
                                        <button
                                            type="button"
                                            onClick={() => toggleEmployeeForm('edit')}
                                            aria-expanded={employeeForm === 'edit'}
                                            className={buttonClass('ghost', 'sm', 'xl:hidden')}
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                            {selectedEmployee.name} 수정
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => toggleEmployeeForm('create')}
                                        aria-expanded={employeeForm === 'create'}
                                        className={buttonClass('ghost', 'sm')}
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        추가
                                    </button>
                                </div>
                            </div>

                            <div className={`space-y-2 p-3 ${employees.length > 0 ? 'hidden xl:block' : ''}`}>
                                {employees.length > 0 ? employees.map(employee => {
                                    const selected = employee.id === selectedEmployee?.id
                                    const editing = selected && employeeForm === 'edit'
                                    return (
                                        <div
                                            key={employee.id}
                                            className={`flex items-center rounded-xl border transition-colors ${selected ? 'border-slate-900 bg-slate-50' : 'border-slate-100 bg-white hover:bg-slate-50'}`}
                                        >
                                            <button
                                                type="button"
                                                aria-pressed={selected}
                                                onClick={() => setSelectedEmployeeId(employee.id)}
                                                className="min-w-0 flex-1 px-4 py-3 text-left"
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="truncate font-black text-slate-900">{employee.name}</span>
                                                    <span className="shrink-0 text-xs font-bold tabular-nums text-slate-500">{formatMoney(employee.hourlyWage)}/h</span>
                                                </div>
                                                <div className="mt-1 text-xs font-medium text-slate-500">1일 {employee.dailyHours}시간</div>
                                            </button>
                                            <button
                                                type="button"
                                                aria-label={`${employee.name} 근로 조건 수정`}
                                                title="근로 조건 수정"
                                                aria-expanded={editing}
                                                onClick={() => {
                                                    setSelectedEmployeeId(employee.id)
                                                    setEmployeeForm(editing ? null : 'edit')
                                                }}
                                                className={`mr-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-white hover:text-slate-900 ${editing ? 'bg-white text-slate-900' : 'text-slate-400'}`}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                        </div>
                                    )
                                }) : (
                                    <EmptyState bare compact icon={<UserRound size={20} />} title="등록된 직원이 없습니다" description="[추가]를 눌러 첫 직원을 등록하세요." />
                                )}
                            </div>

                            {employeeForm === 'create' && (
                                <form action={handleCreateEmployee} className="space-y-4 border-t border-slate-100 p-5">
                                    <p className="text-xs font-bold text-slate-500">새 직원</p>
                                    <AttendanceInputs inputClass={inputClass} />
                                    <div className="flex gap-2">
                                        <button disabled={isPending} className={buttonClass('primary', 'md', 'flex-1')}>직원 추가</button>
                                        <button type="button" onClick={() => setEmployeeForm(null)} className={buttonClass('secondary', 'md')}>취소</button>
                                    </div>
                                </form>
                            )}

                            {employeeForm === 'edit' && selectedEmployee && (
                                <form key={selectedEmployee.id} action={handleUpdateEmployee} className="space-y-4 border-t border-slate-100 p-5">
                                    <p className="text-xs font-bold text-slate-500">{selectedEmployee.name} 근로 조건</p>
                                    <AttendanceInputs employee={selectedEmployee} inputClass={inputClass} />
                                    <div className="flex gap-2">
                                        <button disabled={isPending} className={buttonClass('primary', 'md', 'flex-1')}>설정 저장</button>
                                        <button
                                            type="button"
                                            onClick={handleDeleteEmployee}
                                            disabled={isPending}
                                            className={buttonClass('danger', 'md', 'w-10 px-0')}
                                            aria-label="직원 삭제"
                                            title="직원 삭제"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </aside>

                    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
                            <div className="flex min-w-0 items-center gap-3">
                                <CalendarDays className="h-5 w-5 shrink-0 text-slate-400" />
                                <div className="min-w-0">
                                    <h2 className="text-xl font-black text-slate-900">{currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월</h2>
                                    <p className="break-keep text-xs font-medium text-slate-500">{selectedEmployee ? `${selectedEmployee.name} · 날짜를 누르면 근무일이 바로 저장됩니다.` : '직원을 먼저 추가하세요.'}</p>
                                </div>
                            </div>
                            <CalendarMonthNav onPrev={() => changeMonth(-1)} onToday={() => setCurrentMonth(new Date())} onNext={() => changeMonth(1)} />
                        </div>

                        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
                            {WEEKDAY_LABELS.map((day, idx) => (
                                <div key={day} className={`py-2.5 text-center text-xs font-bold ${isWeekendDay(idx) ? 'text-red-500' : 'text-slate-500'}`}>
                                    {day}
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-7">
                            {calendarDays.map((date, index) => {
                                if (!date) return <div key={`blank-${index}`} className="min-h-[72px] border-b border-r border-slate-100 bg-slate-50/40 sm:min-h-[112px]" />

                                const key = dateKey(date)
                                const checked = selectedWorkDates.has(key)
                                const holidayName = getKoreanHolidayName(key)
                                const isWeekend = isWeekendDay(date.getDay())

                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => handleToggleDate(date)}
                                        disabled={!selectedEmployee || isPending}
                                        aria-pressed={checked}
                                        aria-label={`${date.getMonth() + 1}월 ${date.getDate()}일${holidayName ? ` ${holidayName}` : ''}, ${checked ? '근무일' : '미등록'}`}
                                        className={`min-h-[72px] border-b border-r p-1.5 text-left transition-colors disabled:cursor-not-allowed sm:min-h-[112px] sm:p-3 ${
                                            checked
                                                ? 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
                                                : holidayName
                                                    ? 'border-slate-100 bg-red-50/50 hover:bg-red-50'
                                                    : isWeekend
                                                        ? 'border-slate-100 bg-slate-50/70 hover:bg-slate-100'
                                                        : 'border-slate-100 bg-white hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className="flex flex-col items-start gap-1 sm:flex-row sm:justify-between sm:gap-2">
                                            <span className={`text-sm font-black tabular-nums ${holidayName || isWeekend ? 'text-red-600' : 'text-slate-700'}`}>{date.getDate()}</span>
                                            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border sm:h-5 sm:w-5 ${checked ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white'}`}>
                                                {checked && <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3" strokeWidth={3.5} />}
                                            </span>
                                        </div>
                                        {holidayName && (
                                            <>
                                                <span aria-hidden="true" className="mt-1.5 block h-1.5 w-1.5 rounded-full bg-red-500 sm:hidden" />
                                                <span className="mt-2 hidden max-w-full rounded-md bg-red-100 px-2 py-1 text-[11px] font-bold leading-none text-red-700 sm:inline-flex">
                                                    <span className="truncate">{holidayName}</span>
                                                </span>
                                            </>
                                        )}
                                        {checked && selectedEmployee && (
                                            <div className="mt-2 hidden rounded-lg bg-white/80 px-2 py-1 text-[11px] font-bold tabular-nums text-emerald-700 sm:block">
                                                {selectedEmployee.dailyHours}h · {formatMoney(selectedEmployee.hourlyWage * selectedEmployee.dailyHours)}
                                            </div>
                                        )}
                                    </button>
                                )
                            })}
                        </div>

                        <div className="flex flex-wrap items-end justify-between gap-3 bg-slate-50 px-4 py-4 sm:px-6">
                            <div className="text-sm font-bold text-slate-500">
                                {selectedEmployee ? `${selectedEmployee.name} · ${monthlyWorkDays}일 근무 · ${selectedEmployee.dailyHours}시간/일` : '직원을 추가하거나 선택해 주세요.'}
                            </div>
                            <div className="text-right">
                                <div className="text-xs font-bold text-slate-500">{currentMonth.getMonth() + 1}월 급여</div>
                                <div className="text-2xl font-black tabular-nums text-slate-900">{formatMoney(monthlyPayroll)}</div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    )
}

function AttendanceInputs({ employee, inputClass }: { employee?: AttendanceEmployee; inputClass: string }) {
    return (
        <div className="space-y-3">
            <label className="block">
                <span className="text-xs font-bold text-slate-500">직원명</span>
                <input
                    name="name"
                    required
                    defaultValue={employee?.name || ''}
                    placeholder="직원 이름"
                    className={inputClass}
                />
            </label>
            <div className="grid grid-cols-2 gap-3">
                <label className="block">
                    <span className="text-xs font-bold text-slate-500">시급(원)</span>
                    <input
                        name="hourlyWage"
                        required
                        inputMode="numeric"
                        defaultValue={employee?.hourlyWage || ''}
                        placeholder="10000"
                        className={`${inputClass} text-right tabular-nums`}
                    />
                </label>
                <label className="block">
                    <span className="text-xs font-bold text-slate-500">1일 근로시간</span>
                    <input
                        name="dailyHours"
                        required
                        inputMode="decimal"
                        defaultValue={employee?.dailyHours || ''}
                        placeholder="8"
                        className={`${inputClass} text-right tabular-nums`}
                    />
                </label>
            </div>
        </div>
    )
}
