'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  AlertCircle,
  AlertTriangle,
  Boxes,
  Database,
  ExternalLink,
  GripVertical,
  Link2,
  Loader2,
  PackageCheck,
  RefreshCw,
  Search,
  Star,
  WalletCards,
} from 'lucide-react'
import {
  INVENTORY_FAVORITES_EVENT,
  INVENTORY_ORDER_EVENT,
  type InventoryPreferencesPayload,
  uniqueInventoryIds,
} from '@/lib/smartInventoryPrefs'
import type {
  SmartInventoryChannel,
  SmartInventoryChannelRow,
  SmartInventoryDashboardPayload,
  SmartInventoryMasterRow,
} from '@/lib/smartInventoryClient'

type FilterMode = 'all' | 'empty' | 'inbound' | 'unlinked' | 'linked'
type TableMode = 'masters' | 'unlinked'

const channelLabel: Record<SmartInventoryChannel, string> = {
  naver: '네이버',
  coupang: '쿠팡',
}

const filterOptions: Array<{ value: FilterMode; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'empty', label: '품절' },
  { value: 'inbound', label: '입고대기' },
  { value: 'unlinked', label: '미연결' },
  { value: 'linked', label: '연결상품 있음' },
]

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return '-'
  return value.toLocaleString('ko-KR')
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return '-'
  return `${value.toLocaleString('ko-KR')}원`
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function includesQuery(value: string | null | undefined, query: string) {
  if (!query) return true
  return String(value || '').toLowerCase().includes(query)
}

function stockTone(value: number | null) {
  if (value === null) return 'text-slate-400'
  if (value <= 0) return 'text-red-600'
  if (value <= 5) return 'text-amber-700'
  return 'text-slate-950'
}

function orderRows(rows: SmartInventoryMasterRow[], order: number[]) {
  const orderMap = new Map(order.map((id, index) => [id, index]))
  return [...rows].sort((a, b) => {
    const aOrder = orderMap.get(a.id)
    const bOrder = orderMap.get(b.id)
    if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder
    if (aOrder !== undefined) return -1
    if (bOrder !== undefined) return 1
    return a.name.localeCompare(b.name, 'ko') || a.id - b.id
  })
}

function representativePrice(row: SmartInventoryMasterRow) {
  return row.naverPrice ?? row.coupangPrice ?? null
}

function StatCard({
  icon,
  label,
  value,
  sub,
  tone = 'navy',
}: {
  icon: ReactNode
  label: string
  value: string
  sub: ReactNode
  tone?: 'navy' | 'blue' | 'orange' | 'red' | 'green'
}) {
  const iconClass =
    tone === 'blue'
      ? 'bg-sky-50 text-sky-600'
      : tone === 'orange'
        ? 'bg-orange-50 text-orange-600'
        : tone === 'red'
          ? 'bg-red-50 text-red-600'
          : tone === 'green'
            ? 'bg-emerald-50 text-emerald-600'
            : 'bg-slate-100 text-[#07122F]'

  return (
    <div className="min-h-[116px] rounded-xl border border-[#E5EAF2] bg-white p-5 shadow-[0_8px_20px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[13px] font-extrabold text-slate-600">{label}</div>
          <div className="mt-2 text-[25px] font-black leading-none tracking-tight text-[#101828]">{value}</div>
        </div>
        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
          {icon}
        </span>
      </div>
      <div className="mt-3 truncate text-[12px] font-bold text-slate-500">{sub}</div>
    </div>
  )
}

function InventoryStockSub({
  naver,
  coupang,
}: {
  naver: number | null | undefined
  coupang: number | null | undefined
}) {
  return (
    <span>
      <span className="text-emerald-600">네이버 {formatNumber(naver)}</span>
      <span className="mx-1 text-slate-300">/</span>
      <span className="text-red-600">쿠팡 {formatNumber(coupang)}</span>
    </span>
  )
}

function ProductImage({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-300">
        <Boxes size={18} />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className="h-12 w-12 shrink-0 rounded-lg border border-slate-200 bg-white object-cover"
      onError={() => setFailed(true)}
    />
  )
}

function LinkedProducts({ links }: { links: SmartInventoryMasterRow['linked'] }) {
  if (!links.length) return <span className="text-[12px] font-bold text-slate-400">연결 없음</span>

  return (
    <div className="flex max-w-[280px] flex-wrap gap-1.5">
      {links.slice(0, 3).map((link) => (
        <a
          key={`${link.channel}:${link.productKey}`}
          href={link.productUrl || '#'}
          target="_blank"
          rel="noreferrer"
          className={`inline-flex max-w-[132px] items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-black no-underline ${
            link.channel === 'naver'
              ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
              : 'border-sky-100 bg-sky-50 text-sky-700'
          } ${link.productUrl ? 'hover:brightness-95' : 'pointer-events-none'}`}
          title={link.name}
        >
          <span className="shrink-0">{channelLabel[link.channel]}</span>
          <span className="truncate">{link.name}</span>
          {link.productUrl ? <ExternalLink size={11} className="shrink-0" /> : null}
        </a>
      ))}
      {links.length > 3 ? (
        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500">
          +{links.length - 3}
        </span>
      ) : null}
    </div>
  )
}

function SortableMasterRow({
  row,
  rank,
  favorite,
  onToggleFavorite,
}: {
  row: SmartInventoryMasterRow
  rank: number
  favorite: boolean
  onToggleFavorite: (id: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id })

  return (
    <tr
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        zIndex: isDragging ? 50 : 'auto',
      }}
      className="h-16 bg-white hover:bg-slate-50"
    >
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-8 w-8 cursor-grab items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400 active:cursor-grabbing"
            title="드래그해서 순위 변경"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={16} />
          </button>
          <span className="min-w-7 text-right text-[13px] font-black tabular-nums text-slate-500">{rank}</span>
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => onToggleFavorite(row.id)}
            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition ${
              favorite
                ? 'border-amber-200 bg-amber-50 text-amber-500'
                : 'border-slate-200 bg-white text-slate-300 hover:text-amber-500'
            }`}
            title={favorite ? '즐겨찾기 해제' : '즐겨찾기'}
          >
            <Star size={16} fill={favorite ? 'currentColor' : 'none'} />
          </button>
          <ProductImage src={row.imageUrl} alt={row.name} />
          <div className="min-w-0">
            <div className="truncate text-[14px] font-black text-slate-950" title={row.name}>
              {row.name || `마스터 #${row.id}`}
            </div>
            <div className="mt-1 truncate text-[12px] font-bold text-slate-500">
              단가 {formatMoney(row.unitCost)}
              {row.memo ? <span className="ml-2 text-emerald-700">메모 {row.memo}</span> : null}
            </div>
          </div>
        </div>
      </td>
      <td className="px-3 py-2 text-right text-[13px] font-black tabular-nums text-slate-900">{formatMoney(representativePrice(row))}</td>
      <td className="px-3 py-2 text-right text-[13px] font-black tabular-nums text-emerald-600">{formatNumber(row.naverStock)}</td>
      <td className="px-3 py-2 text-right text-[13px] font-black tabular-nums text-red-600">{formatNumber(row.coupangStock)}</td>
      <td className="px-3 py-2 text-right text-[14px] font-black tabular-nums text-slate-950">{formatNumber(row.totalStock)}</td>
      <td className="px-3 py-2 text-right text-[13px] font-black tabular-nums text-orange-600">{formatNumber(row.totalInboundPending)}</td>
      <td className="px-3 py-2 text-right text-[13px] font-black tabular-nums text-slate-900">{formatMoney(row.stockCost)}</td>
      <td className="px-3 py-2"><LinkedProducts links={row.linked} /></td>
      <td className="px-3 py-2 text-[12px] font-bold text-slate-500">{formatDateTime(row.updatedAt || row.linked[0]?.syncedAt)}</td>
    </tr>
  )
}

function MasterTable({
  rows,
  allRows,
  favoriteIds,
  onToggleFavorite,
  onReorder,
}: {
  rows: SmartInventoryMasterRow[]
  allRows: SmartInventoryMasterRow[]
  favoriteIds: number[]
  onToggleFavorite: (id: number) => void
  onReorder: (nextOrder: number[]) => void
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeId = Number(active.id)
    const overId = Number(over.id)
    const visibleIds = rows.map((row) => row.id)
    const oldIndex = visibleIds.indexOf(activeId)
    const newIndex = visibleIds.indexOf(overId)
    if (oldIndex < 0 || newIndex < 0) return

    const movedVisibleIds = arrayMove(visibleIds, oldIndex, newIndex)
    const visibleSet = new Set(visibleIds)
    let cursor = 0
    const nextOrder = allRows.map((row) => (visibleSet.has(row.id) ? movedVisibleIds[cursor++] : row.id))
    onReorder(nextOrder)
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[#E5EAF2] bg-white shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <table className="w-[1360px] table-fixed border-collapse text-left text-[13px]">
          <thead className="border-b border-[#E5EAF2] bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-[86px] px-3 py-3">순번</th>
              <th className="w-[330px] px-3 py-3">상품</th>
              <th className="w-[105px] px-3 py-3 text-right">판매가</th>
              <th className="w-[84px] px-3 py-3 text-right text-emerald-600">네이버</th>
              <th className="w-[84px] px-3 py-3 text-right text-red-600">쿠팡</th>
              <th className="w-[90px] px-3 py-3 text-right">총재고</th>
              <th className="w-[90px] px-3 py-3 text-right">입고대기</th>
              <th className="w-[130px] px-3 py-3 text-right">재고가치</th>
              <th className="w-[310px] px-3 py-3">연결상태</th>
              <th className="w-[125px] px-3 py-3">갱신</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length ? (
              <SortableContext items={rows.map((row) => row.id)} strategy={verticalListSortingStrategy}>
                {rows.map((row, index) => (
                  <SortableMasterRow
                    key={row.id}
                    row={row}
                    rank={index + 1}
                    favorite={favoriteIds.includes(row.id)}
                    onToggleFavorite={onToggleFavorite}
                  />
                ))}
              </SortableContext>
            ) : (
              <tr>
                <td colSpan={10} className="h-44 px-4 py-8 text-center text-[13px] font-bold text-slate-400">
                  표시할 마스터 재고가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </DndContext>
    </div>
  )
}

function UnlinkedTable({ rows }: { rows: SmartInventoryChannelRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#E5EAF2] bg-white shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
      <table className="w-[900px] table-fixed border-collapse text-left text-[13px]">
        <thead className="border-b border-[#E5EAF2] bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-500">
          <tr>
            <th className="w-[70px] px-3 py-3 text-right">순번</th>
            <th className="w-[90px] px-3 py-3">채널</th>
            <th className="w-[360px] px-3 py-3">상품</th>
            <th className="w-[90px] px-3 py-3 text-right">재고</th>
            <th className="w-[100px] px-3 py-3 text-right">오늘판매</th>
            <th className="w-[110px] px-3 py-3 text-right">판매가</th>
            <th className="w-[100px] px-3 py-3">수집</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length ? (
            rows.map((row, index) => (
              <tr key={`${row.channel}:${row.identityKey}`} className="h-16 bg-white hover:bg-slate-50">
                <td className="px-3 py-2 text-right text-[13px] font-black tabular-nums text-slate-500">{index + 1}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex rounded-md border px-2 py-1 text-[11px] font-black ${
                    row.channel === 'naver'
                      ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                      : 'border-sky-100 bg-sky-50 text-sky-700'
                  }`}>
                    {channelLabel[row.channel]}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <ProductImage src={row.imageUrl} alt={row.name} />
                    <div className="min-w-0">
                      <a
                        href={row.productUrl || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className={`block truncate text-[14px] font-black text-slate-950 no-underline ${
                          row.productUrl ? 'hover:text-[#EF3B2D]' : 'pointer-events-none'
                        }`}
                        title={row.name}
                      >
                        {row.name || row.productKey}
                      </a>
                      <div className="mt-1 truncate text-[12px] font-bold text-slate-500">{row.identityKey}</div>
                    </div>
                  </div>
                </td>
                <td className={`px-3 py-2 text-right font-black tabular-nums ${stockTone(row.stock)}`}>{formatNumber(row.stock)}</td>
                <td className="px-3 py-2 text-right font-black tabular-nums text-slate-900">{formatNumber(row.todaySales)}</td>
                <td className="px-3 py-2 text-right font-black tabular-nums text-slate-900">{formatMoney(row.price)}</td>
                <td className="px-3 py-2 text-[12px] font-bold text-slate-500">{formatDateTime(row.syncedAt)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7} className="h-44 px-4 py-8 text-center text-[13px] font-bold text-slate-400">
                미연결 상품이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export default function InventoryClient() {
  const [data, setData] = useState<SmartInventoryDashboardPayload | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterMode>('all')
  const [tableMode, setTableMode] = useState<TableMode>('masters')
  const [masterOrder, setMasterOrder] = useState<number[]>([])
  const [favoriteIds, setFavoriteIds] = useState<number[]>([])

  const savePreferences = useCallback(async (patch: Partial<InventoryPreferencesPayload>) => {
    try {
      const response = await fetch('/api/admin/inventory/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || '재고 설정을 저장하지 못했습니다.')
      setFavoriteIds(uniqueInventoryIds(payload?.favoriteMasterIds))
      setMasterOrder(uniqueInventoryIds(payload?.masterOrder))
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '재고 설정을 저장하지 못했습니다.')
    }
  }, [])

  const loadPreferences = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/inventory/preferences', { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || '재고 설정을 불러오지 못했습니다.')
      setFavoriteIds(uniqueInventoryIds(payload?.favoriteMasterIds))
      setMasterOrder(uniqueInventoryIds(payload?.masterOrder))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '재고 설정을 불러오지 못했습니다.')
    }
  }, [])

  const loadDashboard = useCallback(async (refresh = false) => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/admin/inventory${refresh ? '?refresh=1' : ''}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || '재고 정보를 불러오지 못했습니다.')
      setData(payload)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '재고 정보를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPreferences()
    loadDashboard()
  }, [loadDashboard, loadPreferences])

  const handleSync = async () => {
    setSyncing(true)
    setError('')
    try {
      const response = await fetch('/api/admin/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || '재고 동기화에 실패했습니다.')
      setData(payload.dashboard)
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : '재고 동기화에 실패했습니다.')
    } finally {
      setSyncing(false)
    }
  }

  const handleReorder = (nextOrder: number[]) => {
    setMasterOrder(nextOrder)
    window.dispatchEvent(new CustomEvent(INVENTORY_ORDER_EVENT, { detail: { masterOrder: nextOrder } }))
    void savePreferences({ masterOrder: nextOrder })
  }

  const handleToggleFavorite = (id: number) => {
    const next = favoriteIds.includes(id) ? favoriteIds.filter((item) => item !== id) : [...favoriteIds, id]
    setFavoriteIds(next)
    window.dispatchEvent(new CustomEvent(INVENTORY_FAVORITES_EVENT, {
      detail: { favoriteMasterIds: next, rows: data?.rows || [] },
    }))
    void savePreferences({ favoriteMasterIds: next })
  }

  const normalizedQuery = query.trim().toLowerCase()
  const orderedMasters = useMemo(() => orderRows(data?.rows || [], masterOrder), [data?.rows, masterOrder])

  const filteredMasters = useMemo(() => {
    return orderedMasters.filter((row) => {
      if (
        normalizedQuery &&
        !includesQuery(row.name, normalizedQuery) &&
        !includesQuery(row.memo, normalizedQuery) &&
        !row.linked.some((link) => includesQuery(link.name, normalizedQuery) || includesQuery(link.productKey, normalizedQuery))
      ) {
        return false
      }
      if (filter === 'empty') return (row.totalStock ?? 0) <= 0
      if (filter === 'inbound') return (row.totalInboundPending ?? 0) > 0
      if (filter === 'unlinked') return row.linkCount === 0
      if (filter === 'linked') return row.linkCount > 0
      return true
    })
  }, [filter, normalizedQuery, orderedMasters])

  const filteredUnlinkedRows = useMemo(() => {
    const rows = [...(data?.unlinkedRows.naver || []), ...(data?.unlinkedRows.coupang || [])]
    return rows.filter(
      (row) =>
        !normalizedQuery ||
        includesQuery(row.name, normalizedQuery) ||
        includesQuery(row.identityKey, normalizedQuery) ||
        includesQuery(row.productKey, normalizedQuery),
    )
  }, [data?.unlinkedRows.coupang, data?.unlinkedRows.naver, normalizedQuery])

  const activeRowsCount = tableMode === 'masters' ? filteredMasters.length : filteredUnlinkedRows.length
  const healthStatus = String(data?.health?.status || '')
  const cacheLabel = data?.cache?.hit
    ? `캐시 표시 중${data.cache.refreshing ? ' / 갱신 중' : ''}`
    : data?.cache?.cachedAt
      ? '최신 조회'
      : '조회 대기'

  return (
    <div className="space-y-5">
      <div className="sticky top-0 z-40 -mx-4 border-b border-[#E5EAF2] bg-[#F6F8FB]/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-end gap-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[#EF3B2D]">Smart Inventory</div>
              <h1 className="mt-1 text-[26px] font-black tracking-tight text-[#101828]">재고관리</h1>
            </div>
            <p className="mb-1 hidden text-[13px] font-bold text-slate-500 md:block">등록된 상품의 재고 현황을 확인하고 관리합니다.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#E5EAF2] bg-white px-3 text-[12px] font-black text-slate-600 shadow-sm">
              <span className={`h-2 w-2 rounded-full ${healthStatus ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              <span>{healthStatus ? '마스틱 연결됨' : '마스틱 상태 확인'}</span>
            </div>
            <div className="inline-flex h-10 items-center rounded-lg border border-[#E5EAF2] bg-white px-3 text-[12px] font-black text-slate-500 shadow-sm">
              {cacheLabel}
            </div>
            <button
              type="button"
              onClick={() => loadDashboard(true)}
              disabled={loading || syncing}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#E5EAF2] bg-white px-3 text-[12px] font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              새로고침
            </button>
            <button
              type="button"
              onClick={handleSync}
              disabled={loading || syncing || data?.configured === false}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#EF3B2D] bg-[#EF3B2D] px-4 text-[12px] font-black text-white shadow-sm transition hover:bg-[#d83326] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {syncing ? <Loader2 size={15} className="animate-spin" /> : <PackageCheck size={15} />}
              마스틱 동기화
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-bold text-red-700">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {data?.warnings?.length ? (
        <div className="rounded-xl border border-amber-200 bg-white px-4 py-3 text-[12px] font-bold text-amber-800">
          {data.warnings.map((warning) => (
            <div key={warning}>{warning}</div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={<Boxes size={20} />} label="전체상품" value={formatNumber(data?.summary.masterCount || 0)} sub="등록된 전체 상품 수" />
        <StatCard
          icon={<Database size={20} />}
          label="총 재고"
          value={formatNumber(data?.summary.totalStock || 0)}
          sub={<InventoryStockSub naver={data?.summary.naverStock || 0} coupang={data?.summary.coupangStock || 0} />}
          tone="blue"
        />
        <StatCard icon={<PackageCheck size={20} />} label="입고대기" value={formatNumber(data?.summary.totalInboundPending || 0)} sub="입고 예정 상품 수" tone="orange" />
        <StatCard icon={<AlertCircle size={20} />} label="미연결" value={formatNumber(data?.summary.unlinkedProducts || 0)} sub="연결되지 않은 상품 수" tone="red" />
        <StatCard icon={<WalletCards size={20} />} label="재고가치" value={formatMoney(data?.summary.stockCost || 0)} sub="총 재고 기준 금액" tone="green" />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-[#E5EAF2] bg-white p-2 shadow-[0_8px_20px_rgba(15,23,42,0.05)] xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#E5EAF2] bg-white px-3">
          <Search size={17} className="shrink-0 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="상품명, 링크상품, 키워드 검색"
            className="h-11 min-w-0 flex-1 bg-transparent text-[13px] font-bold text-slate-900 outline-none placeholder:text-slate-400"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setFilter(option.value)
                if (option.value !== 'unlinked') setTableMode('masters')
                if (option.value === 'unlinked') setTableMode('unlinked')
              }}
              className={`h-10 rounded-lg border px-4 text-[12px] font-black transition ${
                filter === option.value
                  ? 'border-[#07122F] bg-[#07122F] text-white shadow-sm'
                  : 'border-[#E5EAF2] bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setTableMode('unlinked')}
            className={`h-10 rounded-lg border px-4 text-[12px] font-black transition ${
              tableMode === 'unlinked'
                ? 'border-[#EF3B2D] bg-[#EF3B2D] text-white shadow-sm'
                : 'border-[#E5EAF2] bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            미연결
          </button>
          <div className="px-2 text-[12px] font-black text-slate-500">{loading ? '불러오는 중' : `${formatNumber(activeRowsCount)}건`}</div>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-[#E5EAF2] bg-white text-[13px] font-black text-slate-500 shadow-sm">
          <Loader2 size={20} className="mr-2 animate-spin text-[#EF3B2D]" />
          재고를 불러오는 중입니다.
        </div>
      ) : tableMode === 'masters' ? (
        <MasterTable
          rows={filteredMasters}
          allRows={orderedMasters}
          favoriteIds={favoriteIds}
          onToggleFavorite={handleToggleFavorite}
          onReorder={handleReorder}
        />
      ) : (
        <UnlinkedTable rows={filteredUnlinkedRows} />
      )}
    </div>
  )
}
