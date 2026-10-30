'use client'

import Modal from '@/components/Modal'
import Badge from '@/components/ui/Badge'
import ModalCloseButton from '@/components/ui/ModalCloseButton'
import { buttonClass } from '@/components/ui/buttonClass'
import { fieldClass } from '@/components/ui/field'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Boxes,
  CalendarDays,
  Check,
  ChevronDown,
  ImageOff,
  PackagePlus,
  Plus,
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

// Short labels so holiday names fit a calendar cell; the full name stays in the tooltip.
const HOLIDAY_SHORT_NAMES: Record<string, string> = {
  '대체공휴일': '대체',
  '부처님오신날': '석탄일',
  '근로자의날': '근로자',
  '어린이날': '어린이',
  '지방선거': '선거',
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

// Always Korean time, like the inbound dates, so "갱신" and "오늘" never point at different days.
function formatClock(date: Date) {
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' })
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return formatClock(date)
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

// Red stays with Sundays and holidays on this page; low or no stock is amber.
function stockTone(value: number | null | undefined) {
  if (value === null || value === undefined) return 'text-slate-400'
  if (value <= 5) return 'text-amber-700'
  return 'text-slate-950'
}

// Most products share a brand/line prefix ("BEIKO 퀵베이트V3 …"). Showing it as a small first line
// leaves the distinguishing name room on two lines instead of breaking mid-word.
function commonNamePrefix(names: string[]) {
  const counts = new Map<string, number>()
  for (const name of names) {
    const words = name.trim().split(/\s+/)
    for (let length = 1; length < words.length; length += 1) {
      const prefix = words.slice(0, length).join(' ')
      counts.set(prefix, (counts.get(prefix) || 0) + 1)
    }
  }
  let best = ''
  for (const [prefix, count] of counts) {
    if (count >= 3 && count >= names.length * 0.3 && prefix.length > best.length) best = prefix
  }
  return best
}

function ProductImage({ src, alt, size = 'md' }: { src: string | null | undefined; alt: string; size?: 'sm' | 'md' | 'lg' }) {
  const [failed, setFailed] = useState(false)
  const sizeClass = size === 'lg' ? 'h-40 w-full sm:h-44' : size === 'sm' ? 'h-12 w-14' : 'h-16 w-20'
  // The large image sits directly on the product card, so it gets no frame of its own.
  const frame = size === 'lg' ? '' : 'border border-slate-200'

  if (!src || failed) {
    return (
      <div className={`${sizeClass} ${frame} flex shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-400`}>
        <ImageOff size={size === 'lg' ? 28 : 20} aria-hidden />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`${sizeClass} ${frame} shrink-0 rounded-md bg-white object-contain p-2`}
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
  const [saveError, setSaveError] = useState('')
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<ProductCandidate | null>(null)
  const [keypadValue, setKeypadValue] = useState('')
  const selectedRef = useRef<ProductCandidate | null>(null)
  const loadRequestIdRef = useRef(0)

  useEffect(() => {
    selectedRef.current = selectedProduct
  }, [selectedProduct])

  async function loadInbounds(date = selectedDate, showLoader = false) {
    const requestId = loadRequestIdRef.current + 1
    loadRequestIdRef.current = requestId
    if (showLoader) setLoading(true)
    try {
      const response = await fetch(`/api/admin/inventory/inbounds?date=${date}`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error || '입고 목록을 불러오지 못했습니다.')
      if (requestId !== loadRequestIdRef.current) return
      setInbounds(payload)
      setLastLoadedAt(new Date())
      setError('')
    } catch (loadError) {
      if (requestId !== loadRequestIdRef.current) return
      setError(loadError instanceof Error ? loadError.message : '입고 목록을 불러오지 못했습니다.')
    } finally {
      if (requestId === loadRequestIdRef.current) setLoading(false)
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
  const namePrefix = useMemo(() => commonNamePrefix(rows.map(row => row.name)), [rows])
  const dayLabel = selectedDate === todayYmd() ? '오늘' : selectedDate
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
    setSaveError('')
  }

  function closeKeypad() {
    setSelectedProduct(null)
    setKeypadValue('')
    setSaveError('')
  }

  function pressKey(value: string) {
    setSaveError('')
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
      setSaveError('입고 수량을 입력하세요.')
      return
    }

    setSaving(true)
    setSaveError('')
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
    } catch (failure) {
      // Shown inside the keypad: the header banner sits behind the open dialog.
      setSaveError(failure instanceof Error ? failure.message : '입고 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteInbound(id: string) {
    const item = inbounds.items.find(item => item.id === id)
    if (!confirm(`${item?.productName || '선택 기록'} · ${selectedDate} · ${item?.quantity || 0}개 입고 기록을 삭제하시겠습니까?`)) return
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
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#111827] text-white">
                <PackagePlus size={22} aria-hidden />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-black tracking-normal text-slate-950 sm:text-2xl">창고 입고 등록</h1>
                <p className="mt-0.5 truncate text-xs font-bold text-slate-500 tabular-nums">
                  창고재고 {formatNumber(warehouseStockTotal)} · {dayLabel} 입고 {formatNumber(inbounds.totalQuantity)}
                  {lastLoadedAt ? ` · 갱신 ${formatClock(lastLoadedAt)}` : ''}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                void loadInbounds(selectedDate, true)
              }}
              className={buttonClass('secondary', 'iconMd', 'h-11 w-11')}
              aria-label="새로고침"
              title="새로고침"
            >
              <RefreshCw size={19} className={loading ? 'animate-spin' : ''} aria-hidden />
            </button>
          </div>

          {/* The search filters the product cards only, so on desktop it stops where the card column ends (380px panel + 16px gap). */}
          <div className="relative lg:mr-[396px]">
            <Search size={20} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="상품명 검색"
              aria-label="상품명 검색"
              className={fieldClass('h-12 pl-10 pr-11 text-base [&::-webkit-search-cancel-button]:hidden')}
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} className={buttonClass('ghost', 'iconMd', 'absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400')} aria-label="검색 지우기">
                <X size={20} aria-hidden />
              </button>
            )}
          </div>

          {error && (
            <div role="alert" className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
              <AlertTriangle size={18} />
              {error}
            </div>
          )}
        </div>
      </header>

      <InboundTab
        loading={loading}
        rows={filteredInboundRows}
        namePrefix={namePrefix}
        dayLabel={dayLabel}
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
          inboundDate={selectedDate}
          value={keypadValue}
          saving={saving}
          error={saveError}
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
  namePrefix,
  dayLabel,
  inbounds,
  selectedDate,
  saving,
  onSelectDate,
  onOpenKeypad,
  onDeleteInbound,
}: {
  loading: boolean
  rows: ProductCandidate[]
  namePrefix: string
  dayLabel: string
  inbounds: InboundPayload
  selectedDate: string
  saving: boolean
  onSelectDate: (date: string) => void
  onOpenKeypad: (row: ProductCandidate) => void
  onDeleteInbound: (id: string) => void
}) {
  const [panelOpen, setPanelOpen] = useState(false)
  const panelTitle = `${dayLabel} 입고`
  const panelSummary = `${inbounds.date} · 총 ${formatNumber(inbounds.totalQuantity)}개`

  return (
    <section className="mx-auto grid max-w-[1600px] gap-4 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0">
        {loading && rows.length === 0 ? (
          <LoadingBlock label="입고 상품 불러오는 중" />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {rows.map((row) => {
              const prefixed = Boolean(namePrefix) && row.name.startsWith(`${namePrefix} `)
              const mainName = prefixed ? row.name.slice(namePrefix.length + 1) : row.name
              const stock = row.stock ?? 0
              return (
                <button
                  key={`${row.sourceId || row.id}`}
                  type="button"
                  onClick={() => onOpenKeypad(row)}
                  className="flex h-full flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-slate-400 active:scale-[0.99] sm:p-4"
                >
                  <ProductImage src={row.imageUrl} alt={row.name} size="lg" />
                  <div className="min-w-0">
                    {namePrefix ? <div className="h-4 truncate text-xs font-semibold leading-4 text-slate-500">{prefixed ? namePrefix : ''}</div> : null}
                    <div className="line-clamp-2 min-h-[36px] break-keep text-[13px] font-black leading-snug tracking-normal text-slate-950 sm:min-h-[44px] sm:text-base">{mainName}</div>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2">
                    {/* Kept below the product name in weight: the name is what people pick by. */}
                    {stock <= 0 ? (
                      <Badge tone="warning">품절</Badge>
                    ) : (
                      <span className="text-sm font-semibold text-slate-500">
                        재고 <span className={`ml-1 text-base font-bold tabular-nums ${stockTone(stock)}`}>{formatNumber(stock)}</span>
                      </span>
                    )}
                    {/* The whole card opens the keypad; the chip says so. */}
                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-slate-100 px-2 py-1 text-xs font-black text-slate-900">
                      <Plus size={13} strokeWidth={3} aria-hidden />
                      입고
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
        {!loading && rows.length === 0 ? <EmptyBlock label="입고할 상품이 없습니다." /> : null}
      </div>

      {/* On phones this comes first, collapsed to one line, so the result of an entry is visible without scrolling past every product. */}
      <aside className="order-first rounded-lg border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:self-start lg:top-[150px] lg:order-none lg:max-h-[calc(100vh-170px)] lg:overflow-auto">
        <button
          type="button"
          onClick={() => setPanelOpen(open => !open)}
          aria-expanded={panelOpen}
          aria-controls="inbound-panel-body"
          className="flex min-h-11 w-full items-center justify-between gap-2 text-left lg:hidden"
        >
          <span className="flex min-w-0 items-center gap-2 text-sm font-black text-slate-950">
            <CalendarDays size={17} aria-hidden />
            {panelTitle}
            <span className="truncate text-xs font-bold text-slate-500 tabular-nums">{panelSummary}</span>
          </span>
          <ChevronDown size={18} aria-hidden className={`shrink-0 text-slate-500 transition-transform ${panelOpen ? 'rotate-180' : ''}`} />
        </button>
        <div className="mb-3 hidden lg:block">
          <div className="flex items-center gap-2 text-sm font-black text-slate-950">
            <CalendarDays size={17} aria-hidden />
            {panelTitle}
          </div>
          <div className="mt-1 text-xs font-bold text-slate-500 tabular-nums">{panelSummary}</div>
        </div>

        <div id="inbound-panel-body" className={`${panelOpen ? 'mt-3 block' : 'hidden'} lg:mt-0 lg:block`}>
          {inbounds.items.length === 0 ? (
            <p className="mb-4 py-6 text-center text-sm font-bold text-slate-400">{panelTitle} 기록 없음</p>
          ) : (
            <ul className="mb-4 divide-y divide-slate-100">
              {inbounds.items.map((item) => (
                <li key={item.id} className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-2 py-2">
                  <ProductImage src={item.productImageUrl} alt={item.productName} size="sm" />
                  <div className="min-w-0">
                    <div className="truncate break-keep text-sm font-black text-slate-950">{item.productName}</div>
                    <div className="mt-0.5 text-xs font-bold text-slate-500 tabular-nums">
                      {formatTime(item.createdAt)} · {formatNumber(item.quantity)}개
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteInbound(item.id)}
                    disabled={saving}
                    className={buttonClass('dangerGhost', 'iconMd')}
                    aria-label={`${item.productName} 입고 삭제`}
                    title="입고 삭제"
                  >
                    <Trash2 size={17} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <InboundCalendar selectedDate={selectedDate} calendar={inbounds.calendar || []} onSelectDate={onSelectDate} />
        </div>
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

  // No frame of its own: it already sits inside the panel, and cells show state by fill alone.
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => moveMonth(-1)}
          className={buttonClass('secondary', 'sm')}
        >
          이전
        </button>
        <div className="text-sm font-black text-slate-950">{monthLabel}</div>
        <button
          type="button"
          onClick={() => moveMonth(1)}
          className={buttonClass('secondary', 'sm')}
        >
          다음
        </button>
      </div>

      {/* Weekday heads start where the date numbers start (cells have p-1), so each column reads as one line. */}
      <div className="grid grid-cols-7 gap-1 text-left text-[11px] font-black text-slate-400">
        {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
          <div key={day} className={`py-1 pl-1 ${day === '일' ? 'text-red-500' : ''}`}>{day}</div>
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
              title={holidayName || undefined}
              aria-label={`${dateText}${holidayName ? ` ${holidayName}` : ''}${item ? ` 입고 ${formatNumber(item.totalQuantity)}개` : ''}`}
              aria-pressed={active}
              // Fill shows the day's state (holiday / has inbound / plain); selection only adds the ring on top.
              className={`min-h-[54px] rounded-md p-1 text-left transition ${
                holidayName
                  ? 'bg-red-50 text-red-700'
                  : item
                    ? 'bg-emerald-50 text-slate-950'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
              } ${active ? 'ring-2 ring-inset ring-slate-900' : ''} ${inCurrentMonth ? '' : 'opacity-40'}`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className={`text-xs font-black ${holiday ? 'text-red-600' : ''}`}>{day.getDate()}</span>
                {isToday ? <span className="h-1.5 w-1.5 rounded-full bg-slate-900" /> : null}
              </div>
              {holidayName ? (
                <div className="mt-0.5 truncate text-[10px] font-black leading-tight text-red-600">
                  {HOLIDAY_SHORT_NAMES[holidayName] || holidayName}
                </div>
              ) : null}
              {item ? (
                <div className={`mt-1 text-[10px] font-black leading-tight tabular-nums ${holidayName ? 'text-red-700' : 'text-emerald-700'}`}>
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
  inboundDate,
  value,
  saving,
  error,
  onPress,
  onClose,
  onSubmit,
}: {
  product: ProductCandidate
  inboundDate: string
  value: string
  saving: boolean
  error: string
  onPress: (value: string) => void
  onClose: () => void
  onSubmit: () => void
}) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back']

  return (
    <Modal label={`${product.name} 입고 수량 입력`} onClose={() => { if (!saving) onClose() }} className="flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-4 shadow-2xl sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <ProductImage src={product.imageUrl} alt={product.name} />
            <div className="min-w-0">
              <div className="truncate text-lg font-extrabold text-slate-950">{product.name}</div>
              <div className="mt-1 text-xs font-bold text-slate-500">입고 수량 입력 · {inboundDate}</div>
            </div>
          </div>
          <ModalCloseButton onClick={() => { if (!saving) onClose() }} className="shrink-0" />
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

        {error ? (
          <p role="alert" className="mt-3 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
            <AlertTriangle size={17} className="shrink-0" aria-hidden />
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={onSubmit}
          disabled={saving || !value || Number(value) <= 0}
          className={buttonClass('primary', 'md', 'mt-3 h-14 w-full text-lg')}
        >
          {saving ? <RefreshCw size={22} className="animate-spin" /> : <Check size={22} />}
          입력완료
        </button>
      </div>
    </Modal>
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
