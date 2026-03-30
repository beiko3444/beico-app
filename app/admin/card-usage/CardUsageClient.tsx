'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Calendar, CheckCircle2, ChevronDown, Circle, Loader2, Plus, RefreshCw, Search, Settings, X } from 'lucide-react'
import { DEFAULT_CATEGORIES, getCategoryMeta, classifyCategory } from '@/lib/cardCategory'
import type { CategoryMeta } from '@/lib/cardCategory'

/* ═══════════════════ Types ═══════════════════ */
type CardUsageItem = {
  id: string
  corpNum: string
  cardNum: string
  useKey: string
  useDT: string
  usedAt: string | null
  approvalType: string | null
  approvalNum: string | null
  totalAmount: number | null
  approvalAmount: number | null
  amount: number | null
  tax: number | null
  serviceCharge: number | null
  useStoreName: string | null
  paymentPlan: string | null
  installmentMonths: string | null
  currencyCode: string | null
  memo: string | null
  userMemo: string | null
  category: string | null
  reviewedAt: string | null
  reviewedBy: string | null
  syncedAt: string
}

type CardUsageResponse = {
  items: CardUsageItem[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  summary: {
    totalAmount: number
    lastSyncedAt: string | null
  }
}

/* ═══════════════════ Helpers ═══════════════════ */
function formatInputDate(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function maskCard(cardNum: string) {
  const clean = cardNum.replace(/[^\d]/g, '')
  if (clean.length < 8) return cardNum
  return `${clean.slice(0, 4)}-****-****-${clean.slice(-4)}`
}

function errorMessage(err: unknown) {
  if (err instanceof Error) return err.message
  return '요청 처리 중 오류가 발생했습니다.'
}

function resolveAmount(item: Pick<CardUsageItem, 'totalAmount' | 'approvalAmount' | 'amount' | 'tax' | 'serviceCharge'>) {
  if (typeof item.totalAmount === 'number') return item.totalAmount
  if (typeof item.approvalAmount === 'number') return item.approvalAmount
  if (typeof item.amount === 'number' || typeof item.tax === 'number' || typeof item.serviceCharge === 'number') {
    return (item.amount || 0) + (item.tax || 0) + (item.serviceCharge || 0)
  }
  return item.totalAmount ?? item.approvalAmount ?? 0
}

function resolveUsedAtTime(item: Pick<CardUsageItem, 'usedAt' | 'useDT'>) {
  if (item.usedAt) {
    const t = new Date(item.usedAt).getTime()
    if (!Number.isNaN(t)) return t
  }
  if (item.useDT && /^\d{8}$/.test(item.useDT)) {
    const y = item.useDT.slice(0, 4)
    const m = item.useDT.slice(4, 6)
    const d = item.useDT.slice(6, 8)
    const t = new Date(`${y}-${m}-${d}T00:00:00+09:00`).getTime()
    if (!Number.isNaN(t)) return t
  }
  return 0
}

/* ── Date / time formatting ── */
function formatSyncTime(value: string | null) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  const ampm = d.getHours() < 12 ? '오전' : '오후'
  const h = d.getHours() === 0 ? 12 : d.getHours() > 12 ? d.getHours() - 12 : d.getHours()
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}. ${m}. ${day}. ${ampm} ${h}:${min}`
}

function formatAmPmTime(value: string | null) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const ampm = d.getHours() < 12 ? '오전' : '오후'
  const h = d.getHours() === 0 ? 12 : d.getHours() > 12 ? d.getHours() - 12 : d.getHours()
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${ampm} ${h}:${min}`
}

function formatMonthDay(value: string | null) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

function formatDateGroup(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`
}

function getDateKey(value: string | null) {
  if (!value) return 'unknown'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return 'unknown'
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDisplayDate(input: string) {
  if (!input) return ''
  const parts = input.split('-')
  if (parts.length !== 3) return input
  return `${parts[0]}. ${parts[1]}. ${parts[2]}`
}

/* ── Resolve category from DB or fallback ── */
function resolveCategory(item: Pick<CardUsageItem, 'category' | 'useStoreName'>, customCategories: CategoryMeta[] = []) {
  const code = item.category || classifyCategory(item.useStoreName)
  return customCategories.find(c => c.code === code) || getCategoryMeta(code)
}

/* ═══════════════════ localStorage helpers ═══════════════════ */
const STORAGE_KEY = 'beico-card-categories'

function loadUserCategories(): CategoryMeta[] {
  if (typeof window === 'undefined') return DEFAULT_CATEGORIES
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as CategoryMeta[]
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch { /* ignore */ }
  return DEFAULT_CATEGORIES
}

function saveUserCategories(cats: CategoryMeta[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cats))
}

/* ═══════════════════ CSS tokens ═══════════════════ */
const T = {
  bg: '#FAFAF8',
  surface: '#FFFFFF',
  surfaceSecondary: '#F5F5F0',
  border: '#E8E6E1',
  borderLight: '#EEECE7',
  text: '#1A1A1A',
  textSecondary: '#4A4A4A',
  textTertiary: '#737373',
  success: '#3D8B37',
  successBg: '#EDF7EC',
  successBorder: '#D4EDD2',
  warning: '#9E7B15',
  warningBg: '#FDF6E3',
  warningBorder: '#F5E6B8',
  error: '#C53030',
  errorBg: '#FFF5F5',
  accent: '#1A1A1A',
  reviewDoneBg: '#F2F8F0',
  reviewDoneBorder: '#D4EDD2',
  reviewPendingBg: '#FFF7F1',
  reviewPendingBorder: '#F6D7C8',
}

/* ═══════════════════ Component ═══════════════════ */
export default function CardUsageClient() {
  const [startDate, setStartDate] = useState(() => {
    const now = new Date()
    return formatInputDate(new Date(now.getFullYear(), now.getMonth(), 1))
  })
  const [endDate, setEndDate] = useState(() => formatInputDate(new Date()))
  const [cardNum, setCardNum] = useState('')
  const [storeName, setStoreName] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<CardUsageResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [refreshBeforeFetch, setRefreshBeforeFetch] = useState(false)
  const [error, setError] = useState('')
  const [syncMessage, setSyncMessage] = useState('')
  const [memoDrafts, setMemoDrafts] = useState<Record<string, string>>({})
  const [savingMemoId, setSavingMemoId] = useState<string | null>(null)
  const [sortField, setSortField] = useState<'date' | 'amount'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [reviewMode, setReviewMode] = useState(false)
  const [reviewOnlyPending, setReviewOnlyPending] = useState(false)
  const [reviewSavingId, setReviewSavingId] = useState<string | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)

  /* ── User-managed categories ── */
  const [categories, setCategories] = useState<CategoryMeta[]>(() => loadUserCategories())
  const [showCatManager, setShowCatManager] = useState(false)
  const [newCatLabel, setNewCatLabel] = useState('')
  const [newCatEmoji, setNewCatEmoji] = useState('')
  const [draggedCatIdx, setDraggedCatIdx] = useState<number | null>(null)

  const updateCategories = (next: CategoryMeta[]) => {
    setCategories(next)
    saveUserCategories(next)
  }
  const handleAddCategory = () => {
    const label = newCatLabel.trim()
    const emoji = newCatEmoji.trim() || '📌'
    if (!label) return
    const code = label.toUpperCase().replace(/\s+/g, '_')
    if (categories.some(c => c.code === code)) return
    const bgColors = ['#FFF3E0','#E3F2FD','#E8F5E9','#FCE4EC','#F3E5F5','#E8EAF6','#FFF8E1','#ECEFF1']
    const bgColor = bgColors[categories.length % bgColors.length]
    updateCategories([...categories, { code, label, emoji, bgColor }])
    setNewCatLabel(''); setNewCatEmoji('')
  }
  const handleDeleteCategory = (code: string) => {
    updateCategories(categories.filter(c => c.code !== code))
  }
  const handleResetCategories = () => {
    updateCategories(DEFAULT_CATEGORIES)
  }

  /* ── Inline category selector state ── */
  const [catSelectItemId, setCatSelectItemId] = useState<string | null>(null)
  const [catSelectIdx, setCatSelectIdx] = useState(0)
  const catListRef = useRef<HTMLDivElement | null>(null)

  /* ── Data loading ── */
  const load = useCallback(async (targetPage = page) => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({
        page: String(targetPage),
        pageSize: '9999',
        startDate,
        endDate,
      })
      if (cardNum.trim()) qs.set('cardNum', cardNum.trim())
      if (storeName.trim()) qs.set('storeName', storeName.trim())

      const res = await fetch(`/api/admin/card-usage?${qs.toString()}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '카드 사용내역 조회 실패')
      setData(json)
      const nextDrafts: Record<string, string> = {}
      ;(json.items || []).forEach((item: CardUsageItem) => {
        nextDrafts[item.id] = item.userMemo ?? item.memo ?? ''
      })
      setMemoDrafts(nextDrafts)
      setPage(targetPage)
    } catch (err: unknown) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [page, startDate, endDate, cardNum, storeName])

  useEffect(() => {
    load(1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSearch = () => { setSyncMessage(''); load(1) }

  const handleSync = async () => {
    setSyncing(true); setError(''); setSyncMessage('')
    try {
      const res = await fetch('/api/admin/card-usage/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate, cardNum: cardNum.trim() || undefined, refreshBeforeFetch }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '카드 사용내역 동기화 실패')
      setSyncMessage(`동기화 완료 · 조회 ${json.fetchedCount?.toLocaleString?.() ?? 0}건 / 저장 ${json.storedCount?.toLocaleString?.() ?? 0}건 / 금액확인 ${json.amountResolvedCount?.toLocaleString?.() ?? 0}건 / 금액없음 ${json.amountMissingCount?.toLocaleString?.() ?? 0}건`)
      await load(1)
    } catch (err: unknown) { setError(errorMessage(err)) }
    finally { setSyncing(false) }
  }

  const handleSaveMemo = async (item: CardUsageItem) => {
    const memo = memoDrafts[item.id] ?? ''
    setSavingMemoId(item.id); setError('')
    try {
      const res = await fetch('/api/admin/card-usage', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, memo }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '메모 저장 실패')
      setData((prev) => {
        if (!prev) return prev
        return { ...prev, items: prev.items.map((row) => row.id === item.id ? { ...row, userMemo: json.item?.userMemo ?? null } : row) }
      })
    } catch (err: unknown) { setError(errorMessage(err)) }
    finally { setSavingMemoId(null) }
  }

  /* ── Save category via PATCH ── */
  const handleSaveCategory = useCallback(async (item: CardUsageItem, categoryCode: string) => {
    try {
      const res = await fetch('/api/admin/card-usage', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, category: categoryCode }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '카테고리 저장 실패')
      setData((prev) => {
        if (!prev) return prev
        return { ...prev, items: prev.items.map((row) => row.id === item.id ? { ...row, category: json.item?.category ?? null } : row) }
      })
    } catch (err: unknown) { setError(errorMessage(err)) }
  }, [])

  const handleSetReviewed = async (item: CardUsageItem, reviewed: boolean) => {
    setReviewSavingId(item.id)
    setError('')
    try {
      const res = await fetch('/api/admin/card-usage', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, reviewed }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '리뷰 상태 저장 실패')
      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          items: prev.items.map((row) =>
            row.id === item.id
              ? {
                  ...row,
                  reviewedAt: json.item?.reviewedAt ?? (reviewed ? new Date().toISOString() : null),
                  reviewedBy: json.item?.reviewedBy ?? null,
                }
              : row,
          ),
        }
      })
    } catch (err: unknown) {
      setError(errorMessage(err))
    } finally {
      setReviewSavingId(null)
    }
  }

  const handleSortClick = (field: 'date' | 'amount') => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'))
      return
    }
    setSortField(field)
    setSortOrder('desc')
  }

  /* ── Derived data ── */
  const allItems = data?.items ?? []
  const totalCount = data?.totalCount ?? 0
  const totalAmount = data?.summary?.totalAmount ?? 0
  const amountResolvedCount = allItems.filter(i => resolveAmount(i) !== 0).length
  const amountMissingCount = allItems.length - amountResolvedCount
  const reviewedCount = allItems.filter(i => Boolean(i.reviewedAt)).length
  const pendingReviewCount = Math.max(0, allItems.length - reviewedCount)
  const reviewProgress = allItems.length > 0 ? Math.round((reviewedCount / allItems.length) * 100) : 0
  const reviewPeriodLabel = useMemo(() => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '선택 기간'
    if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
      return `${start.getFullYear()}년 ${start.getMonth() + 1}월`
    }
    return `${formatDisplayDate(startDate)} ~ ${formatDisplayDate(endDate)}`
  }, [startDate, endDate])
  const daysInRange = useMemo(() => {
    const s = new Date(startDate); const e = new Date(endDate)
    const diff = Math.max(1, Math.ceil((e.getTime() - s.getTime()) / 86400000) + 1)
    return diff
  }, [startDate, endDate])
  const dailyAvg = daysInRange > 0 ? Math.round(totalAmount / daysInRange) : 0

  // Unique card numbers & store names for dropdowns
  const uniqueCards = useMemo(() => [...new Set(allItems.map(i => i.cardNum))], [allItems])
  const uniqueStores = useMemo(() => [...new Set(allItems.map(i => i.useStoreName).filter(Boolean) as string[])], [allItems])

  // Category summary (top spending per category)
  const categorySummary = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of allItems) {
      const code = item.category || classifyCategory(item.useStoreName)
      map.set(code, (map.get(code) || 0) + resolveAmount(item))
    }
    return [...map.entries()]
      .map(([code, total]) => ({ ...(categories.find(c => c.code === code) || getCategoryMeta(code)), total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6)
  }, [allItems, categories])

  const filteredItems = useMemo(() => {
    let items = [...allItems]
    if (categoryFilter) {
      items = items.filter(i => (i.category || classifyCategory(i.useStoreName)) === categoryFilter)
    }
    if (reviewMode && reviewOnlyPending) {
      items = items.filter(i => !i.reviewedAt)
    }
    return items
  }, [allItems, categoryFilter, reviewMode, reviewOnlyPending])

  // Sort — show all items (no pagination)
  const sortedItems = useMemo(() => {
    const items = [...filteredItems]
    if (sortField === 'amount') {
      items.sort((a, b) => {
        const delta = resolveAmount(a) - resolveAmount(b)
        return sortOrder === 'asc' ? delta : -delta
      })
    } else {
      items.sort((a, b) => {
        const delta = resolveUsedAtTime(a) - resolveUsedAtTime(b)
        return sortOrder === 'asc' ? delta : -delta
      })
    }
    return items
  }, [filteredItems, sortField, sortOrder])

  // Group by date
  const groupedItems = useMemo(() => {
    if (sortField === 'amount') {
      return [{
        date: 'amount',
        label: `금액 ${sortOrder === 'desc' ? '내림차순' : '오름차순'}`,
        items: sortedItems,
      }]
    }

    const groups: { date: string; label: string; items: CardUsageItem[] }[] = []
    const map = new Map<string, CardUsageItem[]>()
    for (const item of sortedItems) {
      const key = getDateKey(item.usedAt)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    for (const [key, items] of map) {
      groups.push({ date: key, label: formatDateGroup(key), items })
    }
    return groups
  }, [sortedItems, sortField, sortOrder])

  const calendarData = useMemo(() => {
    const amountByDate = new Map<string, number>()
    for (const item of filteredItems) {
      const key = getDateKey(item.usedAt)
      if (key === 'unknown') continue
      const amount = Math.max(0, resolveAmount(item))
      amountByDate.set(key, (amountByDate.get(key) || 0) + amount)
    }

    const start = new Date(`${startDate}T00:00:00+09:00`)
    const end = new Date(`${endDate}T00:00:00+09:00`)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      return { months: [] as Array<{ key: string; label: string; cells: Array<{ key: string; date: Date; inRange: boolean; amount: number; percent: number } | null> }>, maxDailyAmount: 0 }
    }

    const maxDailyAmount = Math.max(0, ...Array.from(amountByDate.values()))
    const months: Array<{ key: string; label: string; cells: Array<{ key: string; date: Date; inRange: boolean; amount: number; percent: number } | null> }> = []
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1)

    while (cursor <= endMonth) {
      const y = cursor.getFullYear()
      const m = cursor.getMonth()
      const firstDay = new Date(y, m, 1)
      const daysInMonth = new Date(y, m + 1, 0).getDate()
      const firstWeekday = firstDay.getDay()
      const cells: Array<{ key: string; date: Date; inRange: boolean; amount: number; percent: number } | null> = []

      for (let i = 0; i < firstWeekday; i += 1) cells.push(null)

      for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(y, m, day)
        const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        const amount = amountByDate.get(key) || 0
        const inRange = date >= start && date <= end
        const percent = maxDailyAmount > 0 ? Math.round((amount / maxDailyAmount) * 100) : 0
        cells.push({ key, date, inRange, amount, percent })
      }

      months.push({
        key: `${y}-${String(m + 1).padStart(2, '0')}`,
        label: `${y}년 ${m + 1}월`,
        cells,
      })

      cursor.setMonth(cursor.getMonth() + 1)
    }

    return { months, maxDailyAmount }
  }, [filteredItems, startDate, endDate])

  useEffect(() => {
    if (!selectedItemId) return
    if (!filteredItems.some(item => item.id === selectedItemId)) {
      setSelectedItemId(null)
    }
  }, [filteredItems, selectedItemId])

  useEffect(() => {
    if (!selectedItemId) return
    const selectedItem = allItems.find(item => item.id === selectedItemId)
    if (!selectedItem) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const active = document.activeElement as HTMLElement | null
      if (active) {
        const tag = active.tagName
        const isTypingTarget = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || active.isContentEditable
        if (isTypingTarget) return
      }

      if (!/^[1-6]$/.test(event.key)) return
      const idx = Number(event.key) - 1
      const targetCategory = categories[idx]
      if (!targetCategory) return
      event.preventDefault()
      handleSaveCategory(selectedItem, targetCategory.code)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedItemId, allItems, categories, handleSaveCategory])

  /* ── Styles ── */
  const cardStyle: React.CSSProperties = {
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: 14,
  }

  const flatInputStyle: React.CSSProperties = {
    background: T.surfaceSecondary,
    border: `1px solid ${T.borderLight}`,
    borderRadius: 10,
    color: T.text,
    fontSize: 13,
    height: 42,
    outline: 'none',
    paddingLeft: 14,
    paddingRight: 14,
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '1rem', fontFamily: '"Noto Sans KR", "Apple SD Gothic Neo", sans-serif' }}>
      {/* ════════ Header ════════ */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: T.text, margin: 0, lineHeight: 1.3 }}>카드사용내역</h1>
          <p style={{ fontSize: 12, color: T.textTertiary, margin: '4px 0 0' }}>
            최근 동기화: {formatSyncTime(data?.summary?.lastSyncedAt || null)}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: T.textTertiary, cursor: 'pointer' }}>
            <input type="checkbox" checked={refreshBeforeFetch} onChange={e => setRefreshBeforeFetch(e.target.checked)} style={{ accentColor: T.accent }} />
            즉시조회
          </label>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            style={{
              height: 40, padding: '0 18px', borderRadius: 10,
              background: T.accent, color: '#fff', fontSize: 13, fontWeight: 600,
              border: 'none', cursor: syncing ? 'wait' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 7,
              opacity: syncing ? 0.7 : 1, transition: 'opacity .2s',
            }}
          >
            {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            바로빌 동기화
          </button>
        </div>
      </div>

      {/* ════════ Metric Cards ════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        {/* 이번 달 총 지출 */}
        <div style={{ ...cardStyle, padding: '18px 20px' }}>
          <p style={{ fontSize: 12, color: T.textTertiary, margin: 0, fontWeight: 500 }}>이번 달 총 지출</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: '6px 0 4px', lineHeight: 1.2 }}>
            {totalAmount.toLocaleString()}<span style={{ fontSize: 14, fontWeight: 400, color: T.textSecondary }}>원</span>
          </p>
          <p style={{ fontSize: 12, color: T.textTertiary, margin: 0 }}>
            {formatDisplayDate(startDate)} — {formatDisplayDate(endDate).split('. ').slice(1).join('. ')}
          </p>
        </div>

        {/* 거래 건수 */}
        <div style={{ ...cardStyle, padding: '18px 20px' }}>
          <p style={{ fontSize: 12, color: T.textTertiary, margin: 0, fontWeight: 500 }}>거래 건수</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: '6px 0 8px', lineHeight: 1.2 }}>
            {totalCount.toLocaleString()}<span style={{ fontSize: 14, fontWeight: 400, color: T.textSecondary }}>건</span>
          </p>
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
              background: T.successBg, color: T.success, border: `1px solid ${T.successBorder}`,
            }}>금액확인 {amountResolvedCount}건</span>
            {amountMissingCount > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                background: T.warningBg, color: T.warning, border: `1px solid ${T.warningBorder}`,
              }}>미확인 {amountMissingCount}건</span>
            )}
          </div>
        </div>

        {/* 일평균 지출 */}
        <div style={{ ...cardStyle, padding: '18px 20px' }}>
          <p style={{ fontSize: 12, color: T.textTertiary, margin: 0, fontWeight: 500 }}>일평균 지출</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: '6px 0 4px', lineHeight: 1.2 }}>
            {dailyAvg.toLocaleString()}<span style={{ fontSize: 14, fontWeight: 400, color: T.textSecondary }}>원</span>
          </p>
          <p style={{ fontSize: 12, color: T.textTertiary, margin: 0 }}>{daysInRange}일 기준</p>
        </div>
      </div>

      {/* ════════ Category Summary ════════ */}
      {categorySummary.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16, alignItems: 'center' }}>
          {categorySummary.map(cat => (
            <button
              key={cat.code}
              type="button"
              onClick={() => setCategoryFilter(prev => prev === cat.code ? '' : cat.code)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: categoryFilter === cat.code ? T.accent : cat.bgColor,
                color: categoryFilter === cat.code ? '#fff' : T.text,
                border: categoryFilter === cat.code ? `1px solid ${T.accent}` : `1px solid ${T.borderLight}`,
                cursor: 'pointer', transition: 'all .15s',
              }}
            >
              <span>{cat.emoji}</span>
              <span>{cat.label}</span>
              <span style={{ color: categoryFilter === cat.code ? 'rgba(255,255,255,0.7)' : T.textTertiary, fontWeight: 500 }}>
                {cat.total.toLocaleString()}원
              </span>
            </button>
          ))}
          {categoryFilter && (
            <button
              type="button"
              onClick={() => setCategoryFilter('')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: T.surfaceSecondary, color: T.textSecondary,
                border: `1px solid ${T.borderLight}`, cursor: 'pointer',
              }}
            >
              ✕ 필터 해제
            </button>
          )}
          {/* Category Manager toggle */}
          <button
            type="button"
            onClick={() => setShowCatManager(prev => !prev)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '6px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500,
              background: showCatManager ? T.accent : T.surfaceSecondary,
              color: showCatManager ? '#fff' : T.textSecondary,
              border: `1px solid ${showCatManager ? T.accent : T.borderLight}`,
              cursor: 'pointer', transition: 'all .15s',
            }}
          >
            <Settings size={12} />
            카테고리 관리
          </button>
        </div>
      )}

      {/* ════════ Category Manager Panel ════════ */}
      {showCatManager && (
        <div style={{
          ...cardStyle, padding: '16px 20px', marginBottom: 16,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>카테고리 관리</span>
            <button
              type="button"
              onClick={handleResetCategories}
              style={{
                fontSize: 11, color: T.textTertiary, background: 'none', border: 'none',
                cursor: 'pointer', textDecoration: 'underline',
              }}
            >
              기본값으로 초기화
            </button>
          </div>
          {/* Add new category */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                value={newCatEmoji}
                onChange={e => setNewCatEmoji(e.target.value)}
                placeholder="이모지"
                maxLength={4}
                style={{
                  ...flatInputStyle, width: 60, textAlign: 'center', height: 36,
                }}
              />
              <input
                type="text"
                value={newCatLabel}
                onChange={e => setNewCatLabel(e.target.value)}
                placeholder="카테고리 이름"
                onKeyDown={e => { if (e.key === 'Enter') handleAddCategory() }}
                style={{
                  ...flatInputStyle, flex: 1, height: 36,
                }}
              />
              <button
                type="button"
                onClick={handleAddCategory}
                style={{
                  height: 36, padding: '0 14px', borderRadius: 10,
                  background: T.accent, color: '#fff', fontSize: 12, fontWeight: 600,
                  border: 'none', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}
              >
                <Plus size={12} />
                추가
              </button>
            </div>
            
            {/* Quick emoji selector */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '4px 0', marginLeft: 2 }}>
              {['🍽️','☕','🛒','🛍️','⛽','💳','🏥','💊','🎮','🎬','🏠','🚗','✈️','💻','👕','🎁','🐶','💰','🛠️','✨'].map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setNewCatEmoji(emoji)}
                  style={{
                    background: newCatEmoji === emoji ? T.surfaceSecondary : 'transparent',
                    border: newCatEmoji === emoji ? `1px solid ${T.borderLight}` : '1px solid transparent',
                    borderRadius: 6, width: 28, height: 28, fontSize: 15,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', transition: 'all .15s'
                  }}
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          {/* Existing categories */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {categories.map((cat, idx) => (
              <div
                key={cat.code}
                draggable
                onDragStart={() => setDraggedCatIdx(idx)}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault()
                  if (draggedCatIdx === null || draggedCatIdx === idx) return
                  const nextCats = [...categories]
                  const [item] = nextCats.splice(draggedCatIdx, 1)
                  nextCats.splice(idx, 0, item)
                  updateCategories(nextCats)
                  setDraggedCatIdx(null)
                }}
                onDragEnd={() => setDraggedCatIdx(null)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '5px 10px', borderRadius: 16, fontSize: 12,
                  background: cat.bgColor, border: `1px solid ${T.borderLight}`,
                  cursor: draggedCatIdx === idx ? 'grabbing' : 'grab',
                  opacity: draggedCatIdx === idx ? 0.5 : 1,
                }}
              >
                <span>{cat.emoji}</span>
                <span style={{ fontWeight: 500, color: T.text }}>{cat.label}</span>
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(cat.code)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: T.textTertiary, padding: 0, display: 'flex', alignItems: 'center',
                  }}
                  title={`${cat.label} 삭제`}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════════ Filter bar ════════ */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {/* Date range */}
        <div style={{
          ...flatInputStyle, display: 'flex', alignItems: 'center', gap: 8,
          flex: '1 1 320px', paddingLeft: 12,
        }}>
          <Calendar size={14} style={{ color: T.textTertiary, flexShrink: 0 }} />
          <input
            type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            style={{ border: 'none', background: 'transparent', fontSize: 13, color: T.text, outline: 'none', flex: 1, fontFamily: 'inherit' }}
          />
          <span style={{ color: T.textTertiary, fontSize: 13, flexShrink: 0 }}>—</span>
          <input
            type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            style={{ border: 'none', background: 'transparent', fontSize: 13, color: T.text, outline: 'none', flex: 1, fontFamily: 'inherit' }}
          />
        </div>

        {/* Card number select */}
        <div style={{ position: 'relative', flex: '0 1 auto' }}>
          <select
            value={cardNum}
            onChange={e => setCardNum(e.target.value)}
            style={{ ...flatInputStyle, paddingRight: 32, appearance: 'none', cursor: 'pointer', minWidth: 180, fontFamily: 'inherit' }}
          >
            <option value="">카드번호 전체</option>
            {uniqueCards.map(c => <option key={c} value={c}>{maskCard(c)}</option>)}
          </select>
          <ChevronDown size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: T.textTertiary, pointerEvents: 'none' }} />
        </div>

        {/* Store name select */}
        <div style={{ position: 'relative', flex: '0 1 auto' }}>
          <select
            value={storeName}
            onChange={e => setStoreName(e.target.value)}
            style={{ ...flatInputStyle, paddingRight: 32, appearance: 'none', cursor: 'pointer', minWidth: 180, fontFamily: 'inherit' }}
          >
            <option value="">가맹점 전체</option>
            {uniqueStores.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <ChevronDown size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: T.textTertiary, pointerEvents: 'none' }} />
        </div>

        {/* Category select */}
        <div style={{ position: 'relative', flex: '0 1 auto' }}>
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            style={{ ...flatInputStyle, paddingRight: 32, appearance: 'none', cursor: 'pointer', minWidth: 140, fontFamily: 'inherit' }}
          >
            <option value="">카테고리 전체</option>
            {categories.map(c => <option key={c.code} value={c.code}>{c.emoji} {c.label}</option>)}
          </select>
          <ChevronDown size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: T.textTertiary, pointerEvents: 'none' }} />
        </div>

        {/* Search button */}
        <button
          type="button"
          onClick={handleSearch}
          disabled={loading}
          style={{
            ...flatInputStyle, background: T.accent, color: '#fff', border: 'none',
            cursor: loading ? 'wait' : 'pointer', fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            minWidth: 72, paddingLeft: 16, paddingRight: 16,
          }}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          조회
        </button>
      </div>

      {/* ════════ Status bar ════════ */}
      {syncMessage && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: T.successBg, border: `1px solid ${T.successBorder}`, borderRadius: 10,
          padding: '10px 16px', marginBottom: 16, fontSize: 13,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.success, fontWeight: 500 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.success, flexShrink: 0 }} />
            {syncMessage}
          </div>
          <span style={{ fontSize: 12, color: T.textTertiary }}>저장 완료</span>
        </div>
      )}

      {error && (
        <div style={{
          background: T.errorBg, border: `1px solid #FED7D7`, borderRadius: 10,
          padding: '10px 16px', marginBottom: 16, fontSize: 13, color: T.error, fontWeight: 500,
        }}>
          {error}
        </div>
      )}

      {/* ════════ Review mode panel ════════ */}
      {reviewMode && (
        <div style={{ ...cardStyle, padding: '14px 16px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={14} style={{ color: T.success }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
                {reviewPeriodLabel} 리뷰 진행률
              </span>
            </div>
            <span style={{ fontSize: 12, color: T.textSecondary, fontWeight: 600 }}>
              {reviewedCount.toLocaleString()} / {allItems.length.toLocaleString()}건 ({reviewProgress}%)
            </span>
          </div>
          <div style={{ height: 9, borderRadius: 999, background: T.surfaceSecondary, overflow: 'hidden', border: `1px solid ${T.borderLight}` }}>
            <div
              style={{
                width: `${reviewProgress}%`,
                height: '100%',
                background: reviewProgress >= 100 ? T.success : '#F05A28',
                transition: 'width .2s ease',
              }}
            />
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 12, color: T.textTertiary }}>
            미리뷰 {pendingReviewCount.toLocaleString()}건 · 목표 100%
          </p>
        </div>
      )}

      {/* ════════ Section header ════════ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: T.textTertiary, fontWeight: 500 }}>
            거래내역 {sortedItems.length.toLocaleString()}건
          </span>
          {reviewMode && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: pendingReviewCount > 0 ? T.warning : T.success,
                background: pendingReviewCount > 0 ? T.warningBg : T.successBg,
                border: `1px solid ${pendingReviewCount > 0 ? T.warningBorder : T.successBorder}`,
                borderRadius: 999,
                padding: '2px 8px',
              }}
            >
              {pendingReviewCount > 0 ? `미리뷰 ${pendingReviewCount}건` : '리뷰 완료'}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: `1px solid ${T.border}` }}>
            {(['list', 'calendar'] as const).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                style={{
                  padding: '5px 10px',
                  fontSize: 12,
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: viewMode === mode ? T.accent : T.surface,
                  color: viewMode === mode ? '#fff' : T.textSecondary,
                  transition: 'all .15s',
                }}
              >
                {mode === 'list' ? '리스트' : '캘린더'}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setReviewMode(prev => {
                if (prev) setReviewOnlyPending(false)
                return !prev
              })
            }}
            style={{
              height: 30,
              padding: '0 12px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              border: `1px solid ${reviewMode ? T.accent : T.border}`,
              background: reviewMode ? T.accent : T.surface,
              color: reviewMode ? '#fff' : T.textSecondary,
              cursor: 'pointer',
            }}
          >
            리뷰 모드 {reviewMode ? 'ON' : 'OFF'}
          </button>
          {reviewMode && (
            <button
              type="button"
              onClick={() => setReviewOnlyPending(prev => !prev)}
              style={{
                height: 30,
                padding: '0 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                border: `1px solid ${reviewOnlyPending ? T.warningBorder : T.border}`,
                background: reviewOnlyPending ? T.warningBg : T.surface,
                color: reviewOnlyPending ? T.warning : T.textSecondary,
                cursor: 'pointer',
              }}
          >
              미리뷰만 보기
            </button>
          )}
          {viewMode === 'list' && (
            <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: `1px solid ${T.border}` }}>
            {(['date', 'amount'] as const).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => handleSortClick(mode)}
                style={{
                  padding: '5px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: sortField === mode ? T.accent : T.surface,
                  color: sortField === mode ? '#fff' : T.textSecondary,
                  transition: 'all .15s',
                }}
              >
                {mode === 'date' ? '날짜순' : '금액순'} {sortField === mode ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
              </button>
            ))}
            </div>
          )}
        </div>
      </div>

      {viewMode === 'list' && (
        <p style={{ margin: '-4px 0 10px', fontSize: 12, color: T.textTertiary }}>
          거래내역을 클릭한 뒤 숫자키 1~6을 누르면 카테고리 순서대로 즉시 적용됩니다.
        </p>
      )}

      {/* ════════ Transaction list ════════ */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: T.textTertiary, fontSize: 14 }}>
          <Loader2 size={20} className="animate-spin" style={{ display: 'inline-block', marginRight: 8 }} />
          불러오는 중...
        </div>
      ) : viewMode === 'calendar' ? (
        calendarData.months.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: T.textTertiary, fontSize: 14 }}>
            조회된 카드 사용내역이 없습니다.
          </div>
        ) : (
          <div style={{ ...cardStyle, padding: '14px 14px 6px' }}>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: T.textTertiary }}>
              일별 사용액 게이지 (최대 {calendarData.maxDailyAmount.toLocaleString()}원 = 100%)
            </p>
            {calendarData.months.map(month => (
              <div key={month.key} style={{ marginBottom: 14 }}>
                <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: T.text }}>
                  {month.label}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6, marginBottom: 6 }}>
                  {['일', '월', '화', '수', '목', '금', '토'].map(day => (
                    <div key={`${month.key}-${day}`} style={{ textAlign: 'center', fontSize: 11, color: T.textTertiary, fontWeight: 600 }}>
                      {day}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 }}>
                  {month.cells.map((cell, idx) => (
                    cell ? (
                      <div
                        key={cell.key}
                        style={{
                          borderRadius: 10,
                          border: `1px solid ${cell.inRange ? T.borderLight : '#F2F1ED'}`,
                          background: cell.inRange
                            ? (cell.percent > 0 ? 'rgba(26,26,26,0.03)' : T.surface)
                            : '#FCFCFA',
                          padding: '8px 8px 7px',
                          minHeight: 66,
                          opacity: cell.inRange ? 1 : 0.45,
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 700, color: T.text, marginBottom: 4 }}>
                          {cell.date.getDate()}일
                        </div>
                        <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {cell.amount > 0 ? `${cell.amount.toLocaleString()}원` : '-'}
                        </div>
                        <div style={{ height: 6, borderRadius: 999, background: T.surfaceSecondary, overflow: 'hidden' }}>
                          <div style={{ width: `${cell.percent}%`, height: '100%', background: '#2563EB' }} />
                        </div>
                        <div style={{ marginTop: 4, fontSize: 10, color: T.textTertiary, textAlign: 'right' }}>
                          {cell.percent}%
                        </div>
                      </div>
                    ) : (
                      <div key={`${month.key}-blank-${idx}`} />
                    )
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      ) : groupedItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: T.textTertiary, fontSize: 14 }}>
          조회된 카드 사용내역이 없습니다.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {groupedItems.map(group => (
            <div key={group.date}>
              {/* Date group label */}
              {sortField === 'date' && (
                <p style={{
                  fontSize: 12, fontWeight: 500, color: T.textTertiary,
                  margin: '12px 0 6px', paddingBottom: 6,
                  borderBottom: `1px solid ${T.borderLight}`,
                }}>
                  {group.label}
                </p>
              )}

              {/* Transaction items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {group.items.map((item) => {
                  const amt = resolveAmount(item)
                  const cat = resolveCategory(item, categories)
                  const displayMemo = memoDrafts[item.id] || item.userMemo || item.memo || ''
                  const globalIdx = sortedItems.indexOf(item)
                  const isCatSelectOpen = catSelectItemId === item.id
                  const isReviewed = Boolean(item.reviewedAt)
                  const isSelected = selectedItemId === item.id
                  const usedMonthDay = formatMonthDay(item.usedAt)
                  const usedTime = formatAmPmTime(item.usedAt) || '-'
                  const defaultRowBg = reviewMode ? (isReviewed ? T.reviewDoneBg : T.reviewPendingBg) : T.surface
                  const defaultRowBorder = reviewMode ? (isReviewed ? T.reviewDoneBorder : T.reviewPendingBorder) : T.borderLight

                  return (
                    <div
                      key={item.id}
                      data-item-row={globalIdx}
                      onClick={() => setSelectedItemId(item.id)}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '56px 1fr auto',
                        gap: 12,
                        alignItems: 'center',
                        background: isSelected ? '#EAF3FF' : defaultRowBg,
                        border: `1px solid ${isSelected ? '#BFDBFE' : defaultRowBorder}`,
                        borderRadius: 10,
                        padding: '12px 14px',
                        transition: 'border-color .15s',
                        position: 'relative',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ position: 'relative' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedItemId(item.id)
                            setCatSelectItemId(isCatSelectOpen ? null : item.id)
                            setCatSelectIdx(0)
                          }}
                          title={`${cat.label} 카테고리`}
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            border: `1px solid ${T.borderLight}`,
                            background: cat.bgColor,
                            fontSize: 24,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            boxShadow: isSelected ? '0 0 0 2px rgba(59,130,246,0.25)' : 'none',
                          }}
                        >
                          {cat.emoji}
                        </button>

                        {isCatSelectOpen && (
                          <div
                            tabIndex={-1}
                            onKeyDown={e => {
                              if (e.key === 'ArrowDown') {
                                e.preventDefault()
                                setCatSelectIdx(prev => Math.min(prev + 1, categories.length - 1))
                              } else if (e.key === 'ArrowUp') {
                                e.preventDefault()
                                setCatSelectIdx(prev => Math.max(prev - 1, 0))
                              } else if (e.key === 'Enter') {
                                e.preventDefault()
                                const selected = categories[catSelectIdx]
                                if (selected) {
                                  handleSaveCategory(item, selected.code)
                                  setCatSelectItemId(null)
                                  const nextInput = document.querySelector(`input[data-memo-idx="${globalIdx + 1}"]`) as HTMLInputElement | null
                                  if (nextInput) {
                                    nextInput.focus()
                                    nextInput.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                  }
                                }
                              } else if (e.key === 'Escape') {
                                e.preventDefault()
                                setCatSelectItemId(null)
                              }
                            }}
                            onBlur={e => {
                              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                setCatSelectItemId(null)
                              }
                            }}
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: 'calc(100% + 4px)',
                              zIndex: 100,
                              background: T.surface,
                              border: `1px solid ${T.border}`,
                              borderRadius: 10,
                              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                              padding: '6px 0',
                              maxHeight: 220,
                              overflowY: 'auto',
                              minWidth: 170,
                            }}
                            ref={el => {
                              if (el) {
                                catListRef.current = el
                                el.focus()
                              }
                            }}
                          >
                            {categories.map((c, i) => (
                              <button
                                key={c.code}
                                type="button"
                                tabIndex={-1}
                                onClick={() => {
                                  handleSaveCategory(item, c.code)
                                  setCatSelectItemId(null)
                                  const nextInput = document.querySelector(`input[data-memo-idx="${globalIdx + 1}"]`) as HTMLInputElement | null
                                  if (nextInput) {
                                    nextInput.focus()
                                    nextInput.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                  }
                                }}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 8,
                                  width: '100%', padding: '7px 14px', border: 'none',
                                  background: i === catSelectIdx ? T.surfaceSecondary : 'transparent',
                                  cursor: 'pointer', fontSize: 12, fontWeight: 500,
                                  color: T.text, textAlign: 'left',
                                  transition: 'background .1s',
                                }}
                                onMouseEnter={() => setCatSelectIdx(i)}
                              >
                                <span style={{
                                  width: 24, height: 24, borderRadius: 6,
                                  background: c.bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 13,
                                }}>{c.emoji}</span>
                                <span>{c.label}</span>
                                {(item.category || classifyCategory(item.useStoreName)) === c.code && (
                                  <span style={{ marginLeft: 'auto', color: T.success, fontSize: 11 }}>✓</span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div style={{ minWidth: 0 }}>
                        <p style={{
                          fontSize: 14, fontWeight: 500, color: T.text, margin: 0,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {item.useStoreName || '가맹점 없음'}
                        </p>
                        <p style={{ fontSize: 12, color: T.textTertiary, margin: '2px 0 0' }}>
                          {usedMonthDay ? `${usedMonthDay} · ` : ''}{usedTime} · {maskCard(item.cardNum)} · {item.approvalNum || '-'}
                        </p>
                        {reviewMode && (
                          <p style={{ fontSize: 11, margin: '3px 0 0', color: isReviewed ? T.success : T.warning, fontWeight: 600 }}>
                            {isReviewed
                              ? `리뷰완료 ${formatSyncTime(item.reviewedAt || null)}`
                              : '리뷰 전'}
                          </p>
                        )}
                        {/* Memo input */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, position: 'relative' }}>
                          <input
                            type="text"
                            data-memo-idx={globalIdx}
                            value={memoDrafts[item.id] ?? ''}
                            onChange={e => setMemoDrafts(prev => ({ ...prev, [item.id]: e.target.value }))}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                handleSaveMemo(item)
                                const nextInput = document.querySelector(`input[data-memo-idx="${globalIdx + 1}"]`) as HTMLInputElement | null
                                if (nextInput) {
                                  nextInput.focus()
                                  nextInput.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                }
                              }
                              if (e.key === 'Tab') {
                                e.preventDefault()
                                handleSaveMemo(item)
                                setCatSelectItemId(item.id)
                                setCatSelectIdx(0)
                              }
                            }}
                            placeholder="메모 입력"
                            style={{
                              fontSize: 12, color: T.text, background: displayMemo ? T.surfaceSecondary : 'transparent',
                              border: displayMemo ? `1px solid ${T.borderLight}` : '1px solid transparent',
                              borderRadius: 6, padding: '2px 8px', height: 24,
                              outline: 'none', minWidth: 0, width: displayMemo ? 'auto' : 70,
                              transition: 'all .15s', fontFamily: 'inherit', flex: 1, maxWidth: 300,
                            }}
                            onFocus={e => { e.currentTarget.style.background = T.surfaceSecondary; e.currentTarget.style.borderColor = T.border; }}
                            onBlur={e => {
                              if (!e.currentTarget.value) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }
                            }}
                          />
                          {savingMemoId === item.id && (
                            <Loader2 size={12} className="animate-spin" style={{ color: T.textTertiary }} />
                          )}
                        </div>
                      </div>

                      {/* Amount */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{
                          fontSize: 15, fontWeight: 600, margin: 0, whiteSpace: 'nowrap',
                          color: amt < 0 ? '#2563EB' : T.text // Blue for negative amounts/cancellations
                        }}>
                          {amt.toLocaleString()}<span style={{ fontSize: 12, fontWeight: 400 }}>원</span>
                        </p>
                        <p style={{ fontSize: 11, color: T.textTertiary, margin: '2px 0 0', whiteSpace: 'nowrap' }}>
                          {item.paymentPlan || '일시불'} · {item.currencyCode || 'KRW'}
                        </p>
                        {reviewMode && (
                          <button
                            type="button"
                            onClick={() => handleSetReviewed(item, !isReviewed)}
                            disabled={reviewSavingId === item.id}
                            style={{
                              marginTop: 6,
                              height: 26,
                              padding: '0 10px',
                              borderRadius: 8,
                              border: `1px solid ${isReviewed ? T.successBorder : T.warningBorder}`,
                              background: isReviewed ? T.successBg : T.warningBg,
                              color: isReviewed ? T.success : T.warning,
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: reviewSavingId === item.id ? 'wait' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 5,
                              minWidth: 96,
                            }}
                          >
                            {reviewSavingId === item.id ? (
                              <>
                                <Loader2 size={11} className="animate-spin" />
                                저장중
                              </>
                            ) : isReviewed ? (
                              <>
                                <CheckCircle2 size={11} />
                                리뷰완료
                              </>
                            ) : (
                              <>
                                <Circle size={11} />
                                리뷰하기
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom spacer */}
      <div style={{ height: 40 }} />
    </div>
  )
}
