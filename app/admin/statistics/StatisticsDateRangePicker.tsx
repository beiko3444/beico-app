'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'

const QUERY_PROGRESS_KEY = 'beiko-statistics-query-progress'
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

type CalendarDay = {
  date: Date
  ymd: string
  day: number
  inMonth: boolean
}

export default function StatisticsDateRangePicker({
  startText,
  endText,
}: {
  startText: string
  endText: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [start, setStart] = useState(startText)
  const [end, setEnd] = useState(endText)
  const [viewMonth, setViewMonth] = useState(() => monthStart(endText || startText))
  const [quickYear, setQuickYear] = useState(() => monthStart(endText || startText).getFullYear())
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [monthPanelOpen, setMonthPanelOpen] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const progressTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (window.sessionStorage.getItem(QUERY_PROGRESS_KEY) === '1') {
      window.sessionStorage.removeItem(QUERY_PROGRESS_KEY)
      const completeId = window.setTimeout(() => {
        setProgress(100)
        setStatus('조회완료')
      }, 0)
      const timeoutId = window.setTimeout(() => {
        setProgress(0)
        setStatus('')
      }, 1800)
      return () => {
        window.clearTimeout(completeId)
        window.clearTimeout(timeoutId)
      }
    }
  }, [])

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) window.clearInterval(progressTimerRef.current)
    }
  }, [])

  const days = useMemo(() => buildCalendarDays(viewMonth), [viewMonth])
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from(new Set([currentYear - 1, currentYear, currentYear + 1, quickYear])).sort((a, b) => a - b)
  }, [quickYear])
  const rangeValid = Boolean(start && end)
  const selectedDaysText = rangeValid ? `${start} ~ ${end}` : start ? `${start} ~ 종료일 선택` : '기간 선택'

  const handleDateClick = (ymd: string) => {
    if (!start || (start && end)) {
      setStart(ymd)
      setEnd('')
      setProgress(0)
      setStatus('')
      setMonthPanelOpen(false)
      setCalendarOpen(true)
      return
    }

    if (ymd < start) {
      setEnd(start)
      setStart(ymd)
      setCalendarOpen(false)
      return
    }

    setEnd(ymd)
    setCalendarOpen(false)
  }

  const moveMonth = (delta: number) => {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + delta, 1))
  }

  const applyQuickRange = (daysBack: number) => {
    const rangeEnd = parseYmd(endText) || new Date()
    const rangeStart = new Date(rangeEnd)
    rangeStart.setDate(rangeStart.getDate() - daysBack + 1)
    const nextStart = formatYmd(rangeStart)
    const nextEnd = formatYmd(rangeEnd)
    setStart(nextStart)
    setEnd(nextEnd)
    setViewMonth(monthStart(nextEnd))
    setProgress(0)
    setStatus('')
    setMonthPanelOpen(false)
    setCalendarOpen(false)
  }

  const applyMonthRange = (year: number, monthIndex: number) => {
    const firstDay = new Date(year, monthIndex, 1)
    const today = new Date()
    const monthEnd = new Date(year, monthIndex + 1, 0)
    const lastDay = year === today.getFullYear() && monthIndex === today.getMonth() ? today : monthEnd
    const nextStart = formatYmd(firstDay)
    const nextEnd = formatYmd(lastDay)
    setStart(nextStart)
    setEnd(nextEnd)
    setViewMonth(new Date(year, monthIndex, 1))
    setProgress(0)
    setStatus('')
    setMonthPanelOpen(false)
    setCalendarOpen(false)
  }

  const submit = () => {
    if (!rangeValid || isPending) return

    if (progressTimerRef.current) window.clearInterval(progressTimerRef.current)
    setProgress(8)
    setStatus('조회중')
    progressTimerRef.current = window.setInterval(() => {
      setProgress((current) => Math.min(92, current + 7))
    }, 140)
    window.sessionStorage.setItem(QUERY_PROGRESS_KEY, '1')

    const nextQuery = new URLSearchParams({
      start,
      end,
      refresh: '1',
      t: String(Date.now()),
    })
    const nextUrl = `/admin/statistics?${nextQuery.toString()}`
    const currentUrl = `${window.location.pathname}${window.location.search}`

    startTransition(() => {
      if (currentUrl === nextUrl) {
        router.refresh()
        window.setTimeout(() => {
          if (progressTimerRef.current) window.clearInterval(progressTimerRef.current)
          window.sessionStorage.removeItem(QUERY_PROGRESS_KEY)
          setProgress(100)
          setStatus('조회완료')
        }, 650)
        return
      }

      router.push(nextUrl)
    })
  }

  return (
    <section className="border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-[220px]">
          <div className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">조회 기간</div>
          <div className="mt-1 text-[13px] font-black text-slate-950">{selectedDaysText}</div>
        </div>

        <div className="flex flex-1 flex-wrap items-center gap-2">
          {[7, 30, 90].map((daysBack) => (
            <button
              key={daysBack}
              type="button"
              onClick={() => applyQuickRange(daysBack)}
              className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-3 text-[12px] font-black text-slate-600 transition hover:border-blue-200 hover:text-blue-700"
            >
              최근 {daysBack}일
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setMonthPanelOpen((open) => !open)
              setCalendarOpen(false)
            }}
            aria-expanded={monthPanelOpen}
            className={`h-8 rounded-lg border px-3 text-[12px] font-black transition ${
              monthPanelOpen
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-200 hover:text-blue-700'
            }`}
          >
            월별 선택
          </button>
          <button
            type="button"
            onClick={() => {
              setCalendarOpen((open) => !open)
              setMonthPanelOpen(false)
            }}
            aria-expanded={calendarOpen}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[12px] font-black transition ${
              calendarOpen
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-200 hover:text-blue-700'
            }`}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            날짜 선택
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!rangeValid || isPending}
            className="ml-auto inline-flex h-9 min-w-[88px] items-center justify-center rounded-xl bg-blue-600 px-4 text-[13px] font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-45"
          >
            조회
          </button>
        </div>
      </div>

      {monthPanelOpen ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">월별 바로조회</div>
            <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
              {yearOptions.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => {
                    setQuickYear(year)
                    setViewMonth(new Date(year, viewMonth.getMonth(), 1))
                  }}
                  className={`h-7 rounded-md px-2 text-[11px] font-black transition ${
                    quickYear === year ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 xl:grid-cols-12">
            {Array.from({ length: 12 }, (_, index) => {
              const selectedMonth = start === formatYmd(new Date(quickYear, index, 1)) && end === formatYmd(new Date(quickYear, index + 1, 0))
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => applyMonthRange(quickYear, index)}
                  className={`h-9 rounded-lg border text-[12px] font-black transition ${
                    selectedMonth
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >
                  {index + 1}월
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {calendarOpen ? (
        <div className="mt-3 max-w-[460px] rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => moveMonth(-1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50"
              aria-label="이전 달"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-[14px] font-black text-slate-950">
              {viewMonth.getFullYear()}년 {viewMonth.getMonth() + 1}월
            </div>
            <button
              type="button"
              onClick={() => moveMonth(1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50"
              aria-label="다음 달"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {DAY_LABELS.map((label) => (
              <div key={label} className="py-1 text-[10px] font-black text-slate-400">
                {label}
              </div>
            ))}
            {days.map((day) => {
              const selectedStart = day.ymd === start
              const selectedEnd = day.ymd === end
              const inRange = start && end && day.ymd > start && day.ymd < end
              return (
                <button
                  key={day.ymd}
                  type="button"
                  onClick={() => handleDateClick(day.ymd)}
                  className={`h-9 rounded-lg text-[12px] font-black transition ${
                    selectedStart || selectedEnd
                      ? 'bg-blue-600 text-white shadow-sm'
                      : inRange
                        ? 'bg-blue-50 text-blue-700'
                        : day.inMonth
                          ? 'text-slate-700 hover:bg-slate-50'
                          : 'text-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {day.day}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {(progress > 0 || status) && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[11px] font-black text-slate-500">
            <span>{status || '대기'}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-blue-600 transition-all duration-200" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
    </section>
  )
}

function buildCalendarDays(viewMonth: Date): CalendarDay[] {
  const year = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const first = new Date(year, month, 1)
  const start = new Date(year, month, 1 - first.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return {
      date,
      ymd: formatYmd(date),
      day: date.getDate(),
      inMonth: date.getMonth() === month,
    }
  })
}

function monthStart(ymd: string) {
  const date = parseYmd(ymd) || new Date()
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function parseYmd(ymd: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null
  const date = new Date(`${ymd}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatYmd(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
