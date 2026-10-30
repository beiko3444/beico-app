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
import { fieldClass, labelClass } from '@/components/ui/field'

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

    // A handful of employees fits in a chip row above the calendar, so the calendar can take the full width.
    const useEmployeeList = employees.length > 4
    const monthHolidays = calendarDays.flatMap(date => {
        const name = date ? getKoreanHolidayName(dateKey(date)) : null
        return date && name ? [`${date.getDate()}일 ${name}`] : []
    })

    const employeeFormPanel = employeeForm === 'create' ? (
        <form action={handleCreateEmployee} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-black text-slate-900">새 직원</p>
            <AttendanceInputs />
            <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEmployeeForm(null)} className={buttonClass('secondary', 'md')}>취소</button>
                <button disabled={isPending} className={buttonClass('primary', 'md')}>직원 추가</button>
            </div>
        </form>
    ) : employeeForm === 'edit' && selectedEmployee ? (
        <form key={selectedEmployee.id} action={handleUpdateEmployee} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-black text-slate-900">{selectedEmployee.name} 근로 조건</p>
            <AttendanceInputs employee={selectedEmployee} />
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={handleDeleteEmployee}
                    disabled={isPending}
                    className={buttonClass('dangerGhost', 'md', 'mr-auto px-3')}
                >
                    <Trash2 className="h-4 w-4" />
                    직원 삭제
                </button>
                <button type="button" onClick={() => setEmployeeForm(null)} className={buttonClass('secondary', 'md')}>취소</button>
                <button disabled={isPending} className={buttonClass('primary', 'md')}>설정 저장</button>
            </div>
        </form>
    ) : null

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
                <div className={`grid grid-cols-1 gap-4 ${useEmployeeList ? 'xl:grid-cols-[320px_minmax(0,1fr)] xl:items-start xl:gap-6' : ''}`}>
                    <div className="flex min-w-0 flex-col gap-3">
                        {/* The selected employee, its edit button and "add" sit together; the form opens right below. */}
                        <div role="group" aria-label="직원 선택" className={`-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 ${useEmployeeList ? 'xl:hidden' : ''}`}>
                            {employees.map(employee => {
                                const selected = employee.id === selectedEmployee?.id
                                return (
                                    <React.Fragment key={employee.id}>
                                        <button
                                            type="button"
                                            aria-pressed={selected}
                                            onClick={() => setSelectedEmployeeId(employee.id)}
                                            className={`inline-flex h-9 shrink-0 items-center rounded-full border px-4 text-sm font-bold transition-colors ${selected ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}
                                        >
                                            {employee.name}
                                        </button>
                                        {selected && (
                                            <button
                                                type="button"
                                                onClick={() => toggleEmployeeForm('edit')}
                                                aria-expanded={employeeForm === 'edit'}
                                                aria-label={`${employee.name} 근로 조건 수정`}
                                                title="근로 조건 수정"
                                                className={buttonClass('secondary', 'iconMd', `rounded-full ${employeeForm === 'edit' ? 'border-slate-900 text-slate-900' : ''}`)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                        )}
                                    </React.Fragment>
                                )
                            })}
                            <button
                                type="button"
                                onClick={() => toggleEmployeeForm('create')}
                                aria-expanded={employeeForm === 'create'}
                                className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full border border-dashed border-slate-300 bg-white px-3.5 text-sm font-bold text-slate-600 transition-colors hover:border-slate-500 hover:text-slate-900"
                            >
                                <Plus className="h-4 w-4" />
                                직원 추가
                            </button>
                        </div>

                        {useEmployeeList && (
                            <aside className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:block">
                                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
                                    <h2 className="flex items-center gap-2 text-sm font-black text-slate-900">
                                        직원
                                        <span className="text-xs font-bold tabular-nums text-slate-500">{employees.length}</span>
                                    </h2>
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
                                <div className="space-y-1 p-2">
                                    {employees.map(employee => {
                                        const selected = employee.id === selectedEmployee?.id
                                        const editing = selected && employeeForm === 'edit'
                                        return (
                                            <div
                                                key={employee.id}
                                                className={`flex items-center rounded-lg transition-colors ${selected ? 'bg-brand-orange-soft shadow-[inset_2px_0_0_var(--color-brand-orange)]' : 'hover:bg-slate-50'}`}
                                            >
                                                <button
                                                    type="button"
                                                    aria-pressed={selected}
                                                    onClick={() => setSelectedEmployeeId(employee.id)}
                                                    className="min-w-0 flex-1 px-4 py-3 text-left"
                                                >
                                                    <div className="flex items-center justify-between gap-3">
                                                        <span className={`truncate font-black ${selected ? 'text-brand-orange-strong' : 'text-slate-900'}`}>{employee.name}</span>
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
                                                    className={buttonClass('ghost', 'iconMd', `mr-2 ${editing ? 'bg-white text-slate-900' : 'text-slate-500 hover:bg-white hover:text-slate-900'}`)}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                            </aside>
                        )}

                        {employeeFormPanel}

                        {employees.length === 0 && !employeeForm && (
                            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                                <EmptyState bare compact icon={<UserRound size={20} />} title="등록된 직원이 없습니다" description="[직원 추가]를 눌러 첫 직원을 등록하세요." />
                            </div>
                        )}
                    </div>

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
                                <div key={day} className={`py-2.5 text-center text-xs font-bold ${isWeekendDay(idx) ? 'text-red-600' : 'text-slate-500'}`}>
                                    {day}
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-7">
                            {calendarDays.map((date, index) => {
                                if (!date) return <div key={`blank-${index}`} className="min-h-[72px] border-b border-r border-slate-100 bg-slate-50/40 sm:min-h-[100px]" />

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
                                        className={`flex min-h-[72px] flex-col items-stretch justify-start gap-1.5 border-b border-r p-1.5 text-left transition-colors disabled:cursor-not-allowed sm:min-h-[100px] sm:p-2 ${
                                            checked
                                                ? 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
                                                : holidayName
                                                    ? 'border-slate-100 bg-red-50/50 hover:bg-red-50'
                                                    : isWeekend
                                                        ? 'border-slate-100 bg-slate-50/70 hover:bg-slate-100'
                                                        : 'border-slate-100 bg-white hover:bg-slate-50'
                                        }`}
                                    >
                                        {/* Number and check stay pinned to the top; extra lines never shift them. */}
                                        <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                                            <span className={`inline-flex h-6 min-w-6 items-center justify-center px-1 text-sm font-black tabular-nums ${holidayName || isWeekend ? 'text-red-600' : 'text-slate-700'}`}>{date.getDate()}</span>
                                            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border sm:h-5 sm:w-5 ${checked ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 bg-white'}`}>
                                                {checked && <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3" strokeWidth={3.5} />}
                                            </span>
                                        </div>
                                        {holidayName && (
                                            <>
                                                <span aria-hidden="true" className="block h-1.5 w-1.5 rounded-full bg-red-500 sm:hidden" />
                                                <span className="hidden max-w-full self-start rounded-md bg-red-100 px-2 py-1 text-[11px] font-bold leading-none text-red-700 sm:inline-flex">
                                                    <span className="truncate">{holidayName}</span>
                                                </span>
                                            </>
                                        )}
                                        {checked && selectedEmployee && (
                                            <div className="mt-auto hidden rounded-lg bg-white/80 px-2 py-1 text-[11px] font-bold tabular-nums text-emerald-700 sm:block">
                                                {selectedEmployee.dailyHours}h · {formatMoney(selectedEmployee.hourlyWage * selectedEmployee.dailyHours)}
                                            </div>
                                        )}
                                    </button>
                                )
                            })}
                        </div>

                        {monthHolidays.length > 0 && (
                            <p className="break-keep border-b border-slate-100 px-4 py-2 text-xs text-slate-500 sm:hidden">
                                <span className="font-bold text-red-600">공휴일</span> {monthHolidays.join(' · ')}
                            </p>
                        )}
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

function AttendanceInputs({ employee }: { employee?: AttendanceEmployee }) {
    return (
        <div className="space-y-3">
            <label className="block">
                <span className={labelClass}>직원명</span>
                <input
                    name="name"
                    required
                    defaultValue={employee?.name || ''}
                    placeholder="직원 이름"
                    className={fieldClass()}
                />
            </label>
            <div className="grid grid-cols-2 gap-3">
                <label className="block">
                    <span className={labelClass}>시급(원)</span>
                    <input
                        name="hourlyWage"
                        required
                        inputMode="numeric"
                        defaultValue={employee?.hourlyWage || ''}
                        placeholder="10000"
                        className={fieldClass('text-right tabular-nums')}
                    />
                </label>
                <label className="block">
                    <span className={labelClass}>1일 근로시간</span>
                    <input
                        name="dailyHours"
                        required
                        inputMode="decimal"
                        defaultValue={employee?.dailyHours || ''}
                        placeholder="8"
                        className={fieldClass('text-right tabular-nums')}
                    />
                </label>
            </div>
        </div>
    )
}
