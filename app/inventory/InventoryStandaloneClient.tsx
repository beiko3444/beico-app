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
import type { SmartInventoryDashboardPayload, SmartInventoryMasterRow } from '@/lib/smartInventoryClient'

type TabMode = 'stock' | 'inbound'

type InboundItem = {
  id: string
  inboundDate: string
  masterId: number
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
  sourceId?: string
  name: string
  nameJP?: string | null
  imageUrl: string | null
  naverStock?: number | null
  coupangStock?: number | null
  totalStock?: number | null
  stock?: number | null
  memo?: string | null
}

const REFRESH_MS = 5000
const QUICK_BAIT_KEYWORDS = ['quickbait', 'quick bait', 'quick-bait', '퀵베이트', '퀵 베이트']

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

function isQuickBait(row: SmartInventoryMasterRow) {
  const haystack = [row.name, row.memo || '', ...row.linked.map((link) => link.name)].join(' ').toLowerCase()
  return QUICK_BAIT_KEYWORDS.some((keyword) => haystack.includes(keyword))
}

function smartRowToCandidate(row: SmartInventoryMasterRow): ProductCandidate {
  return {
    id: row.id,
    name: row.name,
    imageUrl: row.imageUrl,
    naverStock: row.naverStock,
    coupangStock: row.coupangStock,
    totalStock: row.totalStock,
    memo: row.memo,
  }
}

function stockTone(value: number | null | undefined) {
  if (value === null || value === undefined) return 'text-slate-400'
  if (value <= 0) return 'text-red-600'
  if (value <= 5) return 'text-amber-700'
  return 'text-slate-950'
}

function ProductImage({ src, alt, size = 'md' }: { src: string | null | undefined; alt: string; size?: 'sm' | 'md' | 'lg' }) {
  const [failed, setFailed] = useState(false)
  const sizeClass = size === 'lg' ? 'h-20 w-20' : size === 'sm' ? 'h-11 w-11' : 'h-14 w-14'

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
      className={`${sizeClass} shrink-0 rounded-md border border-slate-200 bg-white object-cover`}
      onError={() => setFailed(true)}
    />
  )
}

export default function InventoryStandaloneClient() {
  const [tab, setTab] = useState<TabMode>('inbound')
  const [dashboard, setDashboard] = useState<SmartInventoryDashboardPayload | null>(null)
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

  async function loadDashboard(showLoader = false) {
    if (showLoader) setLoading(true)
    try {
      const response = await fetch('/api/admin/inventory', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error || '재고를 불러오지 못했습니다.')
      setDashboard(payload)
      setLastLoadedAt(new Date())
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '재고를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function loadInbounds(date = selectedDate) {
    try {
      const response = await fetch(`/api/admin/inventory/inbounds?date=${date}`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error || '입고 목록을 불러오지 못했습니다.')
      setInbounds(payload)
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '입고 목록을 불러오지 못했습니다.')
    }
  }

  useEffect(() => {
    void loadDashboard(true)
    void loadInbounds(selectedDate)
    const timer = window.setInterval(() => {
      if (!selectedRef.current) {
        void loadDashboard(false)
        void loadInbounds(selectedDate)
      }
    }, REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [selectedDate])

  const rows = dashboard?.rows || []
  const quickRows = useMemo(() => rows.filter(isQuickBait), [rows])
  const inboundRows = useMemo(() => {
    if (quickRows.length > 0) return quickRows.map(smartRowToCandidate)
    if (inbounds.quickProducts?.length) return inbounds.quickProducts
    return rows.map(smartRowToCandidate)
  }, [inbounds.quickProducts, quickRows, rows])

  const filteredStockRows = useMemo(() => {
    const text = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (!text) return true
      return [
        row.name,
        row.memo || '',
        row.linked.map((link) => link.name).join(' '),
      ]
        .join(' ')
        .toLowerCase()
        .includes(text)
    })
  }, [query, rows])

  const filteredInboundRows = useMemo(() => {
    const text = query.trim().toLowerCase()
    return inboundRows.filter((row) => {
      if (!text) return true
      return [row.name, row.nameJP || '', row.memo || ''].join(' ').toLowerCase().includes(text)
    })
  }, [inboundRows, query])

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
          masterId: selectedProduct.id,
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
                {tab === 'stock' ? <Boxes size={22} /> : <PackagePlus size={22} />}
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-black tracking-normal text-slate-950 sm:text-2xl">재고관리</h1>
                <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold text-slate-500">
                  <span>네이버 {formatNumber(dashboard?.summary.naverStock)}</span>
                  <span>쿠팡 {formatNumber(dashboard?.summary.coupangStock)}</span>
                  <span>오늘입고 {formatNumber(inbounds.totalQuantity)}</span>
                  {lastLoadedAt && <span>갱신 {lastLoadedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void loadDashboard(true)
                  void loadInbounds(selectedDate)
                }}
                className="flex h-11 w-11 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 shadow-sm"
                aria-label="새로고침"
              >
                <RefreshCw size={19} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          <div className="grid gap-2 lg:grid-cols-[auto_1fr]">
            <div className="grid grid-cols-2 gap-2">
              <TabButton active={tab === 'stock'} label="재고현황" onClick={() => setTab('stock')} />
              <TabButton active={tab === 'inbound'} label="입고관리" onClick={() => setTab('inbound')} />
            </div>
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

      {tab === 'stock' ? (
        <StockTab loading={loading} rows={filteredStockRows} />
      ) : (
        <InboundTab
          loading={loading}
          rows={filteredInboundRows}
          quickRowsAvailable={quickRows.length > 0}
          productDbFallbackAvailable={Boolean(inbounds.quickProducts?.length)}
          inbounds={inbounds}
          selectedDate={selectedDate}
          saving={saving}
          onSelectDate={(date) => setSelectedDate(date)}
          onOpenKeypad={openKeypad}
          onDeleteInbound={(id) => void deleteInbound(id)}
        />
      )}

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

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-12 rounded-md border px-5 text-sm font-black shadow-sm ${
        active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'
      }`}
    >
      {label}
    </button>
  )
}

function StockTab({ loading, rows }: { loading: boolean; rows: SmartInventoryMasterRow[] }) {
  return (
    <section className="mx-auto max-w-[1600px] px-4 py-4 sm:px-5">
      {loading && rows.length === 0 ? (
        <LoadingBlock label="재고 불러오는 중" />
      ) : (
        <div className="grid gap-2">
          {rows.map((row) => (
            <article key={row.id} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <ProductImage src={row.imageUrl} alt={row.name} />
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-black tracking-normal text-slate-950">{row.name}</h2>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
                    <span>연결 {formatNumber(row.linkCount)}개</span>
                    {row.totalInboundPending ? <span className="text-orange-600">입고대기 {formatNumber(row.totalInboundPending)}</span> : null}
                    {row.memo ? <span className="truncate">{row.memo}</span> : null}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 md:min-w-[360px]">
                <StockPill label="네이버" value={row.naverStock} tone="green" />
                <StockPill label="쿠팡" value={row.coupangStock} tone="blue" />
                <StockPill label="합계" value={row.totalStock} tone="dark" />
              </div>
            </article>
          ))}
        </div>
      )}
      {!loading && rows.length === 0 ? <EmptyBlock label="표시할 재고가 없습니다." /> : null}
    </section>
  )
}

function StockPill({ label, value, tone }: { label: string; value: number | null; tone: 'green' | 'blue' | 'dark' }) {
  const toneClass =
    tone === 'green'
      ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
      : tone === 'blue'
        ? 'border-sky-100 bg-sky-50 text-sky-700'
        : 'border-slate-200 bg-slate-50 text-slate-950'

  return (
    <div className={`rounded-md border px-3 py-2 text-right ${toneClass}`}>
      <div className="text-[11px] font-black">{label}</div>
      <div className={`mt-1 text-2xl font-black tabular-nums ${stockTone(value)}`}>{formatNumber(value)}</div>
    </div>
  )
}

function InboundTab({
  loading,
  rows,
  quickRowsAvailable,
  productDbFallbackAvailable,
  inbounds,
  selectedDate,
  saving,
  onSelectDate,
  onOpenKeypad,
  onDeleteInbound,
}: {
  loading: boolean
  rows: ProductCandidate[]
  quickRowsAvailable: boolean
  productDbFallbackAvailable: boolean
  inbounds: InboundPayload
  selectedDate: string
  saving: boolean
  onSelectDate: (date: string) => void
  onOpenKeypad: (row: ProductCandidate) => void
  onDeleteInbound: (id: string) => void
}) {
  return (
    <section className="mx-auto grid max-w-[1600px] gap-4 px-4 py-4 sm:px-5 lg:grid-cols-[380px_minmax(0,1fr)]">
      <aside className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-[150px] lg:max-h-[calc(100vh-170px)] lg:overflow-auto">
        <InboundCalendar selectedDate={selectedDate} calendar={inbounds.calendar || []} onSelectDate={onSelectDate} />

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
          <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-8 text-center text-sm font-bold text-slate-400">
            오늘 입고 기록 없음
          </div>
        ) : (
          <div className="grid gap-2">
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
      </aside>

      <div className="min-w-0">
        {!quickRowsAvailable && !productDbFallbackAvailable ? (
          <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">
            퀵베이트 상품을 찾지 못해 전체 마스터 상품을 표시합니다.
          </div>
        ) : null}

        {loading && rows.length === 0 ? (
          <LoadingBlock label="입고 상품 불러오는 중" />
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {rows.map((row) => (
              <button
                key={`${row.sourceId || row.id}`}
                type="button"
                onClick={() => onOpenKeypad(row)}
                className="rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm transition active:scale-[0.99]"
              >
                <div className="flex items-start gap-3">
                  <ProductImage src={row.imageUrl} alt={row.name} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 min-h-[44px] text-base font-black leading-tight tracking-normal text-slate-950">{row.name}</div>
                    <div className="mt-2 grid grid-cols-2 gap-1 text-xs font-black">
                      <span className="rounded bg-emerald-50 px-2 py-1 text-right text-emerald-700">N {formatNumber(row.naverStock)}</span>
                      <span className="rounded bg-sky-50 px-2 py-1 text-right text-sky-700">C {formatNumber(row.coupangStock ?? row.stock)}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
        {!loading && rows.length === 0 ? <EmptyBlock label="입고할 상품이 없습니다." /> : null}
      </div>
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
          <div key={day} className="py-1">{day}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dateText = formatYmd(day)
          const item = calendarMap.get(dateText)
          const inCurrentMonth = day.getMonth() === selected.getMonth()
          const active = dateText === selectedDate
          const isToday = dateText === todayYmd()

          return (
            <button
              key={dateText}
              type="button"
              onClick={() => onSelectDate(dateText)}
              className={`min-h-[54px] rounded-md border p-1 text-left transition ${
                active
                  ? 'border-slate-950 bg-slate-950 text-white'
                  : item
                    ? 'border-emerald-200 bg-emerald-50 text-slate-950'
                    : 'border-slate-200 bg-white text-slate-700'
              } ${inCurrentMonth ? '' : 'opacity-40'}`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-black">{day.getDate()}</span>
                {isToday ? <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-white' : 'bg-blue-500'}`} /> : null}
              </div>
              {item ? (
                <div className={`mt-1 text-[10px] font-black leading-tight ${active ? 'text-white' : 'text-emerald-700'}`}>
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
