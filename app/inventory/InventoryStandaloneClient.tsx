'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Boxes,
  CalendarDays,
  Check,
  PackagePlus,
  RefreshCw,
  Search,
  Trash2,
  X,
  Delete,
} from 'lucide-react'

type InboundItem = {
  id: string
  inboundDate: string
  masterId: number | null
  warehouseItemId: string | null
  productName: string
  productImageUrl: string | null
  quantity: number
  createdAt: string
  createdBy?: {
    name?: string | null
    username?: string | null
  } | null
}

type InboundPayload = {
  date: string
  items: InboundItem[]
  totalQuantity: number
  calendar?: Array<{
    date: string
    totalQuantity: number
    count: number
  }>
  quickProducts?: ProductCandidate[]
}

type ProductCandidate = {
  id: number
  sourceId: string
  name: string
  nameJP?: string | null
  productCode?: string | null
  imageUrl: string | null
  stock?: number | null
}

const REFRESH_MS = 5000
const KOREAN_PUBLIC_HOLIDAYS: Record<string, string> = {
  '2026-01-01': '신정',
  '2026-02-16': '설날',
  '2026-02-17': '설날',
  '2026-02-18': '설날',
  '2026-03-01': '삼일절',
  '2026-03-02': '대체공휴일',
  '2026-05-01': '근로자의날',
  '2026-05-05': '어린이날',
  '2026-05-24': '부처님오신날',
  '2026-05-25': '대체공휴일',
  '2026-06-03': '지방선거',
  '2026-06-06': '현충일',
  '2026-07-17': '제헌절',
  '2026-08-15': '광복절',
  '2026-08-17': '대체공휴일',
  '2026-09-24': '추석',
  '2026-09-25': '추석',
  '2026-09-26': '추석',
  '2026-10-03': '개천절',
  '2026-10-05': '대체공휴일',
  '2026-10-09': '한글날',
  '2026-12-25': '성탄절',
  '2027-01-01': '신정',
  '2027-02-06': '설날',
  '2027-02-07': '설날',
  '2027-02-08': '설날',
  '2027-02-09': '대체공휴일',
  '2027-03-01': '삼일절',
  '2027-05-05': '어린이날',
  '2027-05-13': '부처님오신날',
  '2027-06-06': '현충일',
  '2027-08-15': '광복절',
  '2027-08-16': '대체공휴일',
  '2027-09-14': '추석',
  '2027-09-15': '추석',
  '2027-09-16': '추석',
  '2027-10-03': '개천절',
  '2027-10-04': '대체공휴일',
  '2027-10-09': '한글날',
  '2027-10-11': '대체공휴일',
  '2027-12-25': '성탄절',
}

function todayYmd() {
  const now = new Date()
  const koreaDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const year = koreaDate.getFullYear()
  const month = String(koreaDate.getMonth() + 1).padStart(2, '0')
  const day = String(koreaDate.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('ko-KR').format(value)
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function ymdToDate(value: string) {
  const parsed = new Date(`${value}T00:00:00+09:00`)
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

function formatYmd(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getHolidayName(dateText: string) {
  return KOREAN_PUBLIC_HOLIDAYS[dateText] || null
}

function stockTone(value: number | null | undefined) {
  if (value === null || value === undefined) return 'text-slate-400'
  if (value <= 0) return 'text-red-600'
  if (value <= 5) return 'text-amber-700'
  return 'text-slate-950'
}

function ProductImage({ src, alt, size = 'md' }: { src: string | null | undefined; alt: string; size?: 'sm' | 'md' | 'lg' }) {
  const [failed, setFailed] = useState(false)
  const sizeClass = size === 'lg' ? 'h-28 w-full' : size === 'sm' ? 'h-12 w-14' : 'h-16 w-20'

  if (!src || failed) {
    return (
        <div className={`${sizeClass} flex shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-300`}>
        <Boxes size={size === 'lg' ? 28 : 20} />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`${sizeClass} shrink-0 rounded-md border border-slate-200 bg-white object-contain p-1`}
      onError={() => setFailed(true)}
    />
  )
}

export default function InventoryStandaloneClient() {
  const [inbounds, setInbounds] = useState<InboundPayload>({ date: todayYmd(), items: [], totalQuantity: 0 })
  const [selectedDate, setSelectedDate] = useState(todayYmd())
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<ProductCandidate | null>(null)
  const [keypadValue, setKeypadValue] = useState('')
  const selectedRef = useRef<ProductCandidate | null>(null)

  useEffect(() => {
    selectedRef.current = selectedProduct
  }, [selectedProduct])

  async function loadInbounds(date = selectedDate, showLoader = false) {
    if (showLoader) setLoading(true)
    try {
      const response = await fetch(`/api/admin/inventory/inbounds?date=${date}`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error || '입고 목록을 불러오지 못했습니다.')
      setInbounds(payload)
      setLastLoadedAt(new Date())
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '입고 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadInbounds(selectedDate, true)
    const timer = window.setInterval(() => {
      if (!selectedRef.current) {
        void loadInbounds(selectedDate)
      }
    }, REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [selectedDate])

  const rows = useMemo(() => inbounds.quickProducts || [], [inbounds.quickProducts])
  const warehouseStockTotal = useMemo(() => rows.reduce((sum, row) => sum + (row.stock || 0), 0), [rows])

  const filteredInboundRows = useMemo(() => {
    const text = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (!text) return true
      return [row.name, row.nameJP || '', row.productCode || ''].join(' ').toLowerCase().includes(text)
    })
  }, [rows, query])

  function openKeypad(row: ProductCandidate) {
    setSelectedProduct(row)
    setKeypadValue('')
  }

  function closeKeypad() {
    setSelectedProduct(null)
    setKeypadValue('')
  }

  function pressKey(value: string) {
    setKeypadValue((current) => {
      if (value === 'back') return current.slice(0, -1)
      if (value === 'clear') return ''
      if (current.length >= 5) return current
      if (current === '0') return value
      return current + value
    })
  }

  async function saveInbound() {
    if (!selectedProduct) return
    const quantity = Number(keypadValue)
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError('입고 수량을 입력하세요.')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/admin/inventory/inbounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inboundDate: selectedDate,
          warehouseItemId: selectedProduct.sourceId,
          productName: selectedProduct.name,
          productImageUrl: selectedProduct.imageUrl,
          quantity,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || '입고 저장에 실패했습니다.')
      closeKeypad()
      await loadInbounds(selectedDate)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '입고 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteInbound(id: string) {
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/inventory/inbounds/${id}`, { method: 'DELETE' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || '입고 삭제에 실패했습니다.')
      await loadInbounds(selectedDate)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '입고 삭제에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#111827] text-white">
                <PackagePlus size={22} />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-black tracking-normal text-slate-950 sm:text-2xl">재고관리</h1>
                <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold text-slate-500">
                  <span>창고재고 {formatNumber(warehouseStockTotal)}</span>
                  <span>오늘입고 {formatNumber(inbounds.totalQuantity)}</span>
                  {lastLoadedAt && <span>갱신 {lastLoadedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void loadInbounds(selectedDate, true)
                }}
                className="flex h-11 w-11 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 shadow-sm"
                aria-label="새로고침"
              >
                <RefreshCw size={19} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex h-12 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3">
              <Search size={20} className="shrink-0 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="상품명 검색"
                className="h-full min-w-0 flex-1 bg-transparent text-base font-bold text-slate-900 outline-none placeholder:text-slate-400"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} className="text-slate-400" aria-label="검색 지우기">
                  <X size={20} />
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
              <AlertTriangle size={18} />
              {error}
            </div>
          )}
        </div>
      </header>

      <InboundTab
        loading={loading}
        rows={filteredInboundRows}
        inbounds={inbounds}
        selectedDate={selectedDate}
        saving={saving}
        onSelectDate={(date) => setSelectedDate(date)}
        onOpenKeypad={openKeypad}
        onDeleteInbound={(id) => void deleteInbound(id)}
      />

      {selectedProduct && (
        <KeypadModal
          product={selectedProduct}
          value={keypadValue}
          saving={saving}
          onPress={pressKey}
          onClose={closeKeypad}
          onSubmit={() => void saveInbound()}
        />
      )}
    </main>
  )
}

function InboundTab({
  loading,
  rows,
  inbounds,
  selectedDate,
  saving,
  onSelectDate,
  onOpenKeypad,
  onDeleteInbound,
}: {
  loading: boolean
  rows: ProductCandidate[]
  inbounds: InboundPayload
  selectedDate: string
  saving: boolean
  onSelectDate: (date: string) => void
  onOpenKeypad: (row: ProductCandidate) => void
  onDeleteInbound: (id: string) => void
}) {
  return (
    <section className="mx-auto grid max-w-[1600px] gap-4 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0">
        {loading && rows.length === 0 ? (
          <LoadingBlock label="입고 상품 불러오는 중" />
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {rows.map((row) => (
              <button
                key={`${row.sourceId || row.id}`}
                type="button"
                onClick={() => onOpenKeypad(row)}
                className="rounded-lg border border-slate-200 bg-white p-2 text-left shadow-sm transition active:scale-[0.99] sm:p-3"
              >
                <div className="flex flex-col gap-2">
                  <ProductImage src={row.imageUrl} alt={row.name} size="lg" />
                  <div className="min-w-0">
                    <div className="line-clamp-2 min-h-[38px] text-[13px] font-black leading-snug tracking-normal text-slate-950 sm:text-base">{row.name}</div>
                    {(row.nameJP || row.productCode) ? (
                      <div className="mt-1 line-clamp-1 text-[11px] font-bold text-slate-500">
                        {row.nameJP || row.productCode}
                      </div>
                    ) : null}
                  </div>
                  <div className="rounded-md bg-slate-100 px-2 py-2 text-right text-xs font-black text-slate-700">
                    재고 <span className={`ml-1 tabular-nums ${stockTone(row.stock ?? 0)}`}>{formatNumber(row.stock ?? 0)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
        {!loading && rows.length === 0 ? <EmptyBlock label="입고할 상품이 없습니다." /> : null}
      </div>

      <aside className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-[150px] lg:max-h-[calc(100vh-170px)] lg:overflow-auto">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-slate-950">
              <CalendarDays size={17} />
              오늘 입고
            </div>
            <div className="mt-1 text-xs font-bold text-slate-500">{inbounds.date} · 총 {formatNumber(inbounds.totalQuantity)}개</div>
          </div>
        </div>

        {inbounds.items.length === 0 ? (
          <div className="mb-4 rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-8 text-center text-sm font-bold text-slate-400">
            오늘 입고 기록 없음
          </div>
        ) : (
          <div className="mb-4 grid gap-2">
            {inbounds.items.map((item) => (
              <div key={item.id} className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-2">
                <ProductImage src={item.productImageUrl} alt={item.productName} size="sm" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-slate-950">{item.productName}</div>
                  <div className="mt-0.5 text-xs font-bold text-slate-500">
                    {formatTime(item.createdAt)} · {formatNumber(item.quantity)}개
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteInbound(item.id)}
                  disabled={saving}
                  className="flex h-9 w-9 items-center justify-center rounded-md bg-white text-red-600 shadow-sm disabled:opacity-50"
                  aria-label="입고 삭제"
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
          </div>
        )}

        <InboundCalendar selectedDate={selectedDate} calendar={inbounds.calendar || []} onSelectDate={onSelectDate} />
      </aside>
    </section>
  )
}

function InboundCalendar({
  selectedDate,
  calendar,
  onSelectDate,
}: {
  selectedDate: string
  calendar: Array<{ date: string; totalQuantity: number; count: number }>
  onSelectDate: (date: string) => void
}) {
  const selected = ymdToDate(selectedDate)
  const firstDay = new Date(selected.getFullYear(), selected.getMonth(), 1)
  const firstGridDay = addDays(firstDay, -firstDay.getDay())
  const calendarMap = new Map(calendar.map((item) => [item.date, item]))
  const days = Array.from({ length: 42 }, (_, index) => addDays(firstGridDay, index))
  const monthLabel = selected.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })

  function moveMonth(delta: number) {
    const next = new Date(selected)
    next.setMonth(next.getMonth() + delta)
    next.setDate(1)
    onSelectDate(formatYmd(next))
  }

  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => moveMonth(-1)}
          className="h-9 rounded-md bg-white px-3 text-sm font-black text-slate-600 shadow-sm"
        >
          이전
        </button>
        <div className="text-sm font-black text-slate-950">{monthLabel}</div>
        <button
          type="button"
          onClick={() => moveMonth(1)}
          className="h-9 rounded-md bg-white px-3 text-sm font-black text-slate-600 shadow-sm"
        >
          다음
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-black text-slate-400">
        {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
          <div key={day} className={`py-1 ${day === '일' ? 'text-red-500' : ''}`}>{day}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dateText = formatYmd(day)
          const item = calendarMap.get(dateText)
          const inCurrentMonth = day.getMonth() === selected.getMonth()
          const active = dateText === selectedDate
          const isToday = dateText === todayYmd()
          const holidayName = getHolidayName(dateText)
          const holiday = Boolean(holidayName) || day.getDay() === 0

          return (
            <button
              key={dateText}
              type="button"
              onClick={() => onSelectDate(dateText)}
              className={`min-h-[54px] rounded-md border p-1 text-left transition ${
                active
                  ? 'border-slate-950 bg-slate-950 text-white'
                  : holidayName
                    ? 'border-red-200 bg-red-50 text-red-700'
                  : item
                    ? 'border-emerald-200 bg-emerald-50 text-slate-950'
                    : 'border-slate-200 bg-white text-slate-700'
              } ${inCurrentMonth ? '' : 'opacity-40'}`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className={`text-xs font-black ${!active && holiday ? 'text-red-600' : ''}`}>{day.getDate()}</span>
                {isToday ? <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-white' : 'bg-blue-500'}`} /> : null}
              </div>
              {holidayName ? (
                <div className={`mt-0.5 truncate text-[9px] font-black leading-tight ${active ? 'text-white' : 'text-red-600'}`}>
                  {holidayName}
                </div>
              ) : null}
              {item ? (
                <div className={`mt-1 text-[10px] font-black leading-tight ${active ? 'text-white' : holidayName ? 'text-red-700' : 'text-emerald-700'}`}>
                  {formatNumber(item.totalQuantity)}개
                </div>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function KeypadModal({
  product,
  value,
  saving,
  onPress,
  onClose,
  onSubmit,
}: {
  product: ProductCandidate
  value: string
  saving: boolean
  onPress: (value: string) => void
  onClose: () => void
  onSubmit: () => void
}) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back']

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-4 shadow-2xl sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <ProductImage src={product.imageUrl} alt={product.name} />
            <div className="min-w-0">
              <div className="truncate text-lg font-black text-slate-950">{product.name}</div>
              <div className="mt-1 text-xs font-bold text-slate-500">오늘 입고 수량 입력</div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-right text-4xl font-black tabular-nums text-slate-950">
          {value || '0'}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {keys.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onPress(key)}
              className="flex h-16 items-center justify-center rounded-lg border border-slate-200 bg-white text-2xl font-black text-slate-950 shadow-sm active:bg-slate-100"
            >
              {key === 'back' ? <Delete size={24} /> : key === 'clear' ? 'C' : key}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onSubmit}
          disabled={saving || !value || Number(value) <= 0}
          className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-[#111827] text-lg font-black text-white disabled:bg-slate-300"
        >
          {saving ? <RefreshCw size={22} className="animate-spin" /> : <Check size={22} />}
          입력완료
        </button>
      </div>
    </div>
  )
}

function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="flex h-[50vh] items-center justify-center text-base font-black text-slate-500">
      <RefreshCw size={22} className="mr-2 animate-spin" />
      {label}
    </div>
  )
}

function EmptyBlock({ label }: { label: string }) {
  return (
    <div className="flex h-[40vh] flex-col items-center justify-center gap-3 text-slate-500">
      <Boxes size={28} />
      <p className="text-base font-black">{label}</p>
    </div>
  )
}
