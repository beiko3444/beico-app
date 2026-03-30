'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Calendar, ChevronDown, Loader2, RefreshCw, Search } from 'lucide-react'
import { CATEGORIES, getCategoryMeta, classifyCategory } from '@/lib/cardCategory'

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
  if (typeof item.totalAmount === 'number' && item.totalAmount > 0) return item.totalAmount
  if (typeof item.approvalAmount === 'number' && item.approvalAmount > 0) return item.approvalAmount
  if (typeof item.amount === 'number' || typeof item.tax === 'number' || typeof item.serviceCharge === 'number') {
    return (item.amount || 0) + (item.tax || 0) + (item.serviceCharge || 0)
  }
  return item.totalAmount ?? item.approvalAmount ?? 0
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
function resolveCategory(item: Pick<CardUsageItem, 'category' | 'useStoreName'>) {
  const code = item.category || classifyCategory(item.useStoreName)
  return getCategoryMeta(code)
}

/* ═══════════════════ CSS tokens ═══════════════════ */
const T = {
  bg: '#FAFAF8',
  surface: '#FFFFFF',
  surfaceSecondary: '#F5F5F0',
  border: '#E8E6E1',
  borderLight: '#EEECE7',
  text: '#1A1A1A',
  textSecondary: '#6B6B6B',
  textTertiary: '#9C9C9C',
  success: '#3D8B37',
  successBg: '#EDF7EC',
  successBorder: '#D4EDD2',
  warning: '#9E7B15',
  warningBg: '#FDF6E3',
  warningBorder: '#F5E6B8',
  error: '#C53030',
  errorBg: '#FFF5F5',
  accent: '#1A1A1A',
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
  const [sortMode, setSortMode] = useState<'date' | 'amount'>('date')
  const [visibleCount, setVisibleCount] = useState(10)
  const [categoryFilter, setCategoryFilter] = useState('')

  /* ── Data loading ── */
  const load = useCallback(async (targetPage = page) => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({
        page: String(targetPage),
        pageSize: '500',
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
      setVisibleCount(10)
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

  /* ── Derived data ── */
  const allItems = data?.items ?? []
  const totalCount = data?.totalCount ?? 0
  const totalAmount = data?.summary?.totalAmount ?? 0
  const amountResolvedCount = allItems.filter(i => resolveAmount(i) > 0).length
  const amountMissingCount = allItems.length - amountResolvedCount
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
      .map(([code, total]) => ({ ...getCategoryMeta(code), total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6)
  }, [allItems])

  // Sort & group
  const sortedItems = useMemo(() => {
    let items = [...allItems]
    if (categoryFilter) {
      items = items.filter(i => (i.category || classifyCategory(i.useStoreName)) === categoryFilter)
    }
    if (sortMode === 'amount') {
      items.sort((a, b) => resolveAmount(b) - resolveAmount(a))
    }
    // default: already date desc from API
    return items
  }, [allItems, sortMode, categoryFilter])

  const visibleItems = sortedItems.slice(0, visibleCount)
  const remainingCount = sortedItems.length - visibleCount

  // Group by date
  const groupedItems = useMemo(() => {
    const groups: { date: string; label: string; items: CardUsageItem[] }[] = []
    const map = new Map<string, CardUsageItem[]>()
    for (const item of visibleItems) {
      const key = getDateKey(item.usedAt)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    for (const [key, items] of map) {
      groups.push({ date: key, label: formatDateGroup(key), items })
    }
    return groups
  }, [visibleItems])

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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
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
            {CATEGORIES.map(c => <option key={c.code} value={c.code}>{c.emoji} {c.label}</option>)}
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

      {/* ════════ Section header ════════ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: T.textTertiary, fontWeight: 500 }}>
          거래내역 {totalCount.toLocaleString()}건
        </span>
        <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: `1px solid ${T.border}` }}>
          {(['date', 'amount'] as const).map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => setSortMode(mode)}
              style={{
                padding: '5px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                background: sortMode === mode ? T.accent : T.surface,
                color: sortMode === mode ? '#fff' : T.textSecondary,
                transition: 'all .15s',
              }}
            >
              {mode === 'date' ? '날짜순' : '금액순'}
            </button>
          ))}
        </div>
      </div>

      {/* ════════ Transaction list ════════ */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: T.textTertiary, fontSize: 14 }}>
          <Loader2 size={20} className="animate-spin" style={{ display: 'inline-block', marginRight: 8 }} />
          불러오는 중...
        </div>
      ) : groupedItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: T.textTertiary, fontSize: 14 }}>
          조회된 카드 사용내역이 없습니다.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {groupedItems.map(group => (
            <div key={group.date}>
              {/* Date group label */}
              <p style={{
                fontSize: 12, fontWeight: 500, color: T.textTertiary,
                margin: '12px 0 6px', paddingBottom: 6,
                borderBottom: `1px solid ${T.borderLight}`,
              }}>
                {group.label}
              </p>

              {/* Transaction items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {group.items.map((item, idx) => {
                  const amt = resolveAmount(item)
                  const cat = resolveCategory(item)
                  const displayMemo = memoDrafts[item.id] || item.userMemo || item.memo || ''
                  const globalIdx = sortedItems.indexOf(item)

                  return (
                    <div
                      key={item.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '36px 1fr auto',
                        gap: 12,
                        alignItems: 'center',
                        background: T.surface,
                        border: `0.5px solid ${T.borderLight}`,
                        borderRadius: 10,
                        padding: '12px 14px',
                        transition: 'border-color .15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = T.border)}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = T.borderLight)}
                    >
                      {/* Icon */}
                      <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: cat.bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16,
                      }}>
                        {cat.emoji}
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
                          {formatAmPmTime(item.usedAt)} · {maskCard(item.cardNum)} · {item.approvalNum || '-'}
                        </p>
                        {/* Memo input (inline, appears on focus or has content) */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
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
                                if (nextInput) nextInput.focus()
                              }
                            }}
                            placeholder="메모 입력"
                            style={{
                              fontSize: 11, color: T.text, background: displayMemo ? T.surfaceSecondary : 'transparent',
                              border: displayMemo ? `1px solid ${T.borderLight}` : '1px solid transparent',
                              borderRadius: 6, padding: '2px 8px', height: 22,
                              outline: 'none', minWidth: 0, width: displayMemo ? 'auto' : 70,
                              transition: 'all .15s', fontFamily: 'inherit',
                            }}
                            onFocus={e => { e.currentTarget.style.background = T.surfaceSecondary; e.currentTarget.style.borderColor = T.border; e.currentTarget.style.width = '200px' }}
                            onBlur={e => {
                              if (!e.currentTarget.value) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.width = '70px' }
                            }}
                          />
                          {savingMemoId === item.id && (
                            <Loader2 size={10} className="animate-spin" style={{ color: T.textTertiary }} />
                          )}
                        </div>
                      </div>

                      {/* Amount */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontSize: 15, fontWeight: 600, color: T.text, margin: 0, whiteSpace: 'nowrap' }}>
                          {amt.toLocaleString()}<span style={{ fontSize: 12, fontWeight: 400 }}>원</span>
                        </p>
                        <p style={{ fontSize: 11, color: T.textTertiary, margin: '2px 0 0', whiteSpace: 'nowrap' }}>
                          {item.paymentPlan || '일시불'} · {item.currencyCode || 'KRW'}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ════════ Load more ════════ */}
      {remainingCount > 0 && (
        <button
          type="button"
          onClick={() => setVisibleCount(prev => prev + 20)}
          style={{
            display: 'block', width: '100%', textAlign: 'center',
            padding: '14px 0', marginTop: 12,
            fontSize: 13, fontWeight: 500, color: T.textTertiary,
            background: 'transparent', border: 'none', cursor: 'pointer',
          }}
        >
          + {remainingCount.toLocaleString()}건 더 보기
        </button>
      )}

      {/* Bottom spacer */}
      <div style={{ height: 40 }} />
    </div>
  )
}
