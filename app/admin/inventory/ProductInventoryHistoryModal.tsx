'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BarChart3, CalendarDays, Clock3, Loader2, PackageSearch, X } from 'lucide-react'
import type { SmartInventoryMasterRow } from '@/lib/smartInventoryClient'

type HistoryPoint = {
  date: string
  label: string
  naver: number
  coupang: number
  total: number
}

type HourPoint = {
  hour: number
  label: string
  naver: number
  coupang: number
  total: number
}

type HistoryPayload = {
  product: {
    id: number
    name: string
    imageUrl: string | null
    totalStock: number | null
    naverStock: number | null
    coupangStock: number | null
  }
  range: {
    days: number
    startDate: string
    endDate: string
    selectedDate: string
  }
  linked: Array<{
    channel: 'naver' | 'coupang'
    name: string
    multiplier: number
  }>
  daily: HistoryPoint[]
  hourly: HourPoint[]
  summary: {
    periodTotal: number
    selectedDayTotal: number
    peakDate: HistoryPoint | null
    peakHour: HourPoint | null
  }
}

const rangeOptions = [
  { days: 7, label: '7일' },
  { days: 30, label: '30일' },
  { days: 90, label: '90일' },
]

function todayInKorea() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return '-'
  return value.toLocaleString('ko-KR')
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; color?: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="min-w-[130px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] shadow-xl">
      <div className="mb-1.5 font-black text-slate-950">{label}</div>
      {payload.map((item) => (
        <div key={item.name} className="flex items-center justify-between gap-4 py-0.5 font-bold text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
            {item.name}
          </span>
          <span className="text-slate-950">{formatNumber(item.value)}개</span>
        </div>
      ))}
    </div>
  )
}

function ProductThumb({ src, name }: { src: string | null; name: string }) {
  if (!src) {
    return (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-300">
        <PackageSearch size={22} />
      </div>
    )
  }
  return <img src={src} alt={name} className="h-14 w-14 shrink-0 rounded-xl border border-slate-200 bg-white object-cover" />
}

function Metric({
  label,
  value,
  description,
}: {
  label: string
  value: string
  description: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-[11px] font-black text-slate-500">{label}</div>
      <div className="mt-1 text-[20px] font-black tracking-tight text-slate-950">{value}</div>
      <div className="mt-1 truncate text-[10px] font-bold text-slate-400" title={description}>{description}</div>
    </div>
  )
}

export default function ProductInventoryHistoryModal({
  product,
  onClose,
}: {
  product: SmartInventoryMasterRow
  onClose: () => void
}) {
  const [days, setDays] = useState(30)
  const [selectedDate, setSelectedDate] = useState(todayInKorea)
  const [data, setData] = useState<HistoryPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({
      masterId: String(product.id),
      days: String(days),
    })
    if (selectedDate) params.set('date', selectedDate)

    setLoading(true)
    setError('')
    setData(null)
    fetch(`/api/admin/inventory/history?${params.toString()}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null)
        if (!response.ok) throw new Error(payload?.error || '재고차감 이력을 불러오지 못했습니다.')
        return payload as HistoryPayload
      })
      .then((payload) => {
        setData(payload)
        if (selectedDate !== payload.range.selectedDate) {
          setSelectedDate(payload.range.selectedDate)
        }
      })
      .catch((loadError) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return
        setError(loadError instanceof Error ? loadError.message : '재고차감 이력을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [days, product.id, selectedDate])

  const dailyHasData = useMemo(() => Boolean(data?.daily.some((point) => point.total > 0)), [data?.daily])
  const hourlyHasData = useMemo(() => Boolean(data?.hourly.some((point) => point.total > 0)), [data?.hourly])

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose()
      }}
    >
      <div className="max-h-[94vh] w-full max-w-[1280px] overflow-y-auto rounded-2xl border border-white/60 bg-[#F6F8FB] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <ProductThumb src={product.imageUrl} name={product.name} />
            <div className="min-w-0">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#EF3B2D]">Inventory History</div>
              <h2 className="mt-1 truncate text-[21px] font-black tracking-tight text-slate-950" title={product.name}>
                {product.name}
              </h2>
              <div className="mt-1 text-[11px] font-bold text-slate-500">
                현재 총재고 {formatNumber(product.totalStock)}개 · 연결상품 {product.linkCount}개
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-950"
            aria-label="상품 재고차감 그래프 닫기"
          >
            <X size={19} />
          </button>
        </div>

        <div className="space-y-5 p-4 sm:p-6">
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {rangeOptions.map((option) => (
                <button
                  key={option.days}
                  type="button"
                  onClick={() => setDays(option.days)}
                  className={`h-9 rounded-lg border px-4 text-[12px] font-black transition ${
                    days === option.days
                      ? 'border-[#07122F] bg-[#07122F] text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays size={16} className="text-slate-400" />
              <span className="text-[12px] font-black text-slate-500">하루 그래프 날짜</span>
              <input
                type="date"
                value={selectedDate || data?.range.selectedDate || ''}
                min={data?.range.startDate}
                max={data?.range.endDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-black text-slate-800 outline-none focus:border-[#EF3B2D]"
              />
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-bold text-red-700">{error}</div>
          ) : null}

          {loading && !data ? (
            <div className="flex h-[360px] items-center justify-center rounded-xl border border-slate-200 bg-white text-[13px] font-black text-slate-500">
              <Loader2 size={20} className="mr-2 animate-spin text-[#EF3B2D]" />
              상품 재고차감 이력을 계산하는 중입니다.
            </div>
          ) : data ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label={`${data.range.days}일 차감`} value={`${formatNumber(data.summary.periodTotal)}개`} description={`${data.range.startDate} ~ ${data.range.endDate}`} />
                <Metric label="선택일 차감" value={`${formatNumber(data.summary.selectedDayTotal)}개`} description={data.range.selectedDate} />
                <Metric
                  label="최대 차감일"
                  value={data.summary.peakDate ? `${formatNumber(data.summary.peakDate.total)}개` : '-'}
                  description={data.summary.peakDate?.date || '차감 기록 없음'}
                />
                <Metric
                  label="최대 시간대"
                  value={data.summary.peakHour ? `${formatNumber(data.summary.peakHour.total)}개` : '-'}
                  description={data.summary.peakHour ? `${data.range.selectedDate} ${data.summary.peakHour.label}` : '차감 기록 없음'}
                />
              </div>

              <div className="grid gap-5 xl:grid-cols-2">
                <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#EF3B2D]">
                      <BarChart3 size={20} />
                    </span>
                    <div>
                      <h3 className="text-[17px] font-black text-slate-950">일자별 재고차감</h3>
                      <p className="mt-1 text-[11px] font-bold text-slate-500">연결상품 배수를 반영한 네이버·쿠팡 일별 차감량입니다.</p>
                    </div>
                  </div>
                  <div className="relative mt-5 h-[330px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={data.daily} margin={{ top: 12, right: 8, bottom: 0, left: -18 }}>
                        <CartesianGrid stroke="#E2E8F0" strokeDasharray="4 4" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 700, fill: '#64748B' }} minTickGap={22} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748B' }} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11, fontWeight: 800 }} />
                        <Bar dataKey="naver" name="네이버" stackId="daily" fill="#10B981" radius={[0, 0, 0, 0]} maxBarSize={32} />
                        <Bar dataKey="coupang" name="쿠팡" stackId="daily" fill="#EF4444" radius={[6, 6, 0, 0]} maxBarSize={32} />
                        <Line dataKey="total" name="합계" type="monotone" stroke="#07122F" strokeWidth={2.5} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                    {!dailyHasData ? (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[12px] font-black text-slate-400">
                        선택 기간의 재고차감 기록이 없습니다.
                      </div>
                    ) : null}
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                      <Clock3 size={20} />
                    </span>
                    <div>
                      <h3 className="text-[17px] font-black text-slate-950">하루 시간대별 재고차감</h3>
                      <p className="mt-1 text-[11px] font-bold text-slate-500">{data.range.selectedDate}의 0시부터 23시까지 차감량입니다.</p>
                    </div>
                  </div>
                  <div className="relative mt-5 h-[330px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={data.hourly} margin={{ top: 12, right: 8, bottom: 0, left: -18 }}>
                        <CartesianGrid stroke="#E2E8F0" strokeDasharray="4 4" vertical={false} />
                        <XAxis
                          dataKey="label"
                          interval={2}
                          tick={{ fontSize: 10, fontWeight: 700, fill: '#64748B' }}
                        />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748B' }} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11, fontWeight: 800 }} />
                        <Bar dataKey="naver" name="네이버" stackId="hour" fill="#10B981" radius={[0, 0, 0, 0]} maxBarSize={28} />
                        <Bar dataKey="coupang" name="쿠팡" stackId="hour" fill="#EF4444" radius={[5, 5, 0, 0]} maxBarSize={28} />
                        <Line dataKey="total" name="합계" type="monotone" stroke="#0284C7" strokeWidth={2.5} dot={{ r: 2 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                    {!hourlyHasData ? (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[12px] font-black text-slate-400">
                        선택한 날짜의 재고차감 기록이 없습니다.
                      </div>
                    ) : null}
                  </div>
                </section>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-[11px] font-bold text-slate-500">
                <span className="font-black text-slate-700">연결 기준</span>
                <span className="ml-2">
                  {data.linked.length
                    ? data.linked.map((link) => `${link.channel === 'naver' ? '네이버' : '쿠팡'} ${link.name}${link.multiplier > 1 ? ` ×${link.multiplier}` : ''}`).join(' · ')
                    : '연결상품 없음'}
                </span>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
