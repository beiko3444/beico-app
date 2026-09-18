'use client'

import React, { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2, UserRound } from 'lucide-react'
import { createEmployee, deleteEmployee, toggleAttendanceDate, updateEmployee } from './actions'
import { getKoreanHolidayName } from '@/lib/koreanHolidays'
import DashboardCalendarWidget from '@/components/DashboardCalendarWidget'
import Button from '@/components/ui/Button'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'

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

    useEffect(() => {
        setEmployees(initialEmployees)
        setSelectedEmployeeId(prev => prev || initialEmployees[0]?.id || '')
    }, [initialEmployees])

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
        <div className="min-w-0 space-y-8 font-sans">
            <PageHeader
                title="근태관리"
                description="업무 일정과 직원별 근무일, 월 지출급여를 한곳에서 관리합니다."
            />

            <section className="min-w-0 space-y-4">
                <div>
                    <h2 className="text-lg font-black tracking-tight text-slate-900 break-keep">업무관리</h2>
                    <p className="mt-1 text-[13px] text-slate-500">업무를 완료하면 경험치가 쌓이고 레벨이 올라갑니다.</p>
                </div>
                <DashboardCalendarWidget tasks={initialTasks} />
            </section>

            <section className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                    <h2 className="text-lg font-black tracking-tight text-slate-900 break-keep">근태 체크</h2>
                    <p className="mt-1 text-[13px] text-slate-500">직원별 근무일을 체크하고 월 지출급여를 계산합니다.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-right shadow-sm">
                    <div className="text-[11px] font-black text-slate-500">총 지출급여</div>
                    <div className="text-2xl font-black text-slate-900">{formatMoney(monthlyPayroll)}</div>
                </div>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                <aside className="min-w-0 space-y-4">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-sm font-black text-gray-900">직원 선택</h3>
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
                                        className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${selected ? 'border-brand-orange bg-brand-orange-soft' : 'border-gray-100 bg-white hover:bg-gray-50'}`}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="font-black text-gray-900">{employee.name}</div>
                                            <div className="text-xs font-bold text-gray-500">{formatMoney(employee.hourlyWage)}/h</div>
                                        </div>
                                        <div className="mt-1 text-xs font-medium text-slate-500">1일근로시간 {employee.dailyHours}시간</div>
                                    </button>
                                )
                            }) : (
                                <EmptyState compact icon={<UserRound size={18} />} title="등록된 직원이 없습니다." description="아래에서 직원을 추가해 주세요." />
                            )}
                        </div>
                    </div>

                    <form action={handleCreateEmployee} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                        <div className="flex items-center gap-2">
                            <Plus className="w-4 h-4 text-brand-orange" />
                            <h3 className="text-sm font-black text-gray-900">직원 추가</h3>
                        </div>
                        <AttendanceInputs />
                        <Button type="submit" variant="primary" disabled={isPending} className="w-full">
                            직원 추가
                        </Button>
                    </form>

                    {selectedEmployee && (
                        <form action={handleUpdateEmployee} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                            <h3 className="text-sm font-black text-gray-900">직원 설정</h3>
                            <AttendanceInputs employee={selectedEmployee} />
                            <div className="flex gap-2">
                                <Button type="submit" variant="secondary" disabled={isPending} className="flex-1">
                                    설정 저장
                                </Button>
                                <Button
                                    type="button"
                                    variant="danger"
                                    onClick={handleDeleteEmployee}
                                    disabled={isPending}
                                    title="직원 삭제"
                                    aria-label="직원 삭제"
                                    icon={<Trash2 className="w-4 h-4" />}
                                />
                            </div>
                        </form>
                    )}
                </aside>

                <section className="min-w-0 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <CalendarDays className="w-5 h-5 text-brand-orange" />
                            <div>
                                <h3 className="text-xl font-black text-gray-900">{currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월</h3>
                                <p className="text-xs font-bold text-slate-500">근로한 날짜를 달력에서 체크하세요.</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button type="button" variant="secondary" size="sm" onClick={() => changeMonth(-1)} aria-label="이전 달" icon={<ChevronLeft className="w-4 h-4" />} />
                            <Button type="button" variant="secondary" size="sm" onClick={() => setCurrentMonth(new Date())}>
                                이번 달
                            </Button>
                            <Button type="button" variant="secondary" size="sm" onClick={() => changeMonth(1)} aria-label="다음 달" icon={<ChevronRight className="w-4 h-4" />} />
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
                            if (!date) return <div key={`blank-${index}`} className="min-h-[112px] border-r border-b border-gray-100 bg-gray-50/40" />

                            const key = dateKey(date)
                            const checked = selectedWorkDates.has(key)
                            const holidayName = getKoreanHolidayName(key)
                            const isToday = key === dateKey(new Date())
                            const isSunday = date.getDay() === 0
                            const isSaturday = date.getDay() === 6
                            const isWeekend = isSunday || isSaturday
                            const dayTextClass = holidayName || isSunday
                                ? 'text-red-600'
                                : isSaturday
                                    ? 'text-blue-500'
                                    : checked
                                        ? 'text-brand-orange'
                                        : 'text-gray-700'

                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => handleToggleDate(date)}
                                    disabled={!selectedEmployee || isPending}
                                    className={`min-h-[112px] border-r border-b p-3 text-left transition-all disabled:cursor-not-allowed ${
                                        checked
                                            ? 'border-brand-orange/20 bg-brand-orange-soft hover:bg-[#ffe9e2]'
                                            : isToday
                                                ? 'border-gray-100 bg-brand-orange-soft/70 hover:bg-brand-orange-soft'
                                                : holidayName
                                                    ? 'border-red-100 bg-red-50/50 hover:bg-red-50'
                                                    : isWeekend
                                                        ? 'border-gray-100 bg-gray-50/70 hover:bg-gray-100'
                                                        : 'border-gray-100 bg-white hover:bg-gray-50'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-sm font-black ${dayTextClass} ${isToday ? 'ring-1 ring-brand-orange' : ''}`}>{date.getDate()}</span>
                                        <span className={`h-5 w-5 rounded-full border flex items-center justify-center ${checked ? 'border-brand-orange bg-brand-orange' : 'border-gray-200 bg-white'}`}>
                                            {checked && <span className="h-2 w-2 rounded-full bg-white" />}
                                        </span>
                                    </div>
                                    {(holidayName || isWeekend) && (
                                        <div
                                            className={`mt-2 inline-flex max-w-full rounded-md px-2 py-1 text-[11px] font-black leading-none ${
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
                                        <div className="mt-5 rounded-lg bg-white/80 px-2 py-1.5 text-[11px] font-bold text-brand-orange">
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
                            <div className="text-[11px] font-black text-slate-500">총 지출급여</div>
                            <div className="text-3xl font-black text-slate-900">{formatMoney(monthlyPayroll)}</div>
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
                <span className="text-[11px] font-black text-slate-500">직원명</span>
                <input
                    name="name"
                    required
                    defaultValue={employee?.name || ''}
                    placeholder="직원 이름"
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-900 outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/10"
                />
            </label>
            <div className="grid grid-cols-2 gap-3">
                <label className="block">
                    <span className="text-[11px] font-black text-slate-500">시급</span>
                    <input
                        name="hourlyWage"
                        required
                        inputMode="numeric"
                        defaultValue={employee?.hourlyWage || ''}
                        placeholder="10000"
                        className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-900 outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/10"
                    />
                </label>
                <label className="block">
                    <span className="text-[11px] font-black text-slate-500">1일근로시간</span>
                    <input
                        name="dailyHours"
                        required
                        inputMode="decimal"
                        defaultValue={employee?.dailyHours || ''}
                        placeholder="8"
                        className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-900 outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/10"
                    />
                </label>
            </div>
        </div>
    )
}
