'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  type Modifier,
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
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  ExternalLink,
  GripVertical,
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
import { externalProductHref } from '@/lib/smartInventoryLinks.mjs'
import { resolveInventoryRowSyncedAt } from '@/lib/smartInventoryDates'
import ProductInventoryHistoryModal from './ProductInventoryHistoryModal'

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

const pageSizeOptions = [20, 50, 100] as const

const restrictToVerticalDrag: Modifier = ({ transform }) => ({
  ...transform,
  x: 0,
})

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
    <div className="flex min-w-[205px] flex-1 items-center gap-3 border-r border-slate-200 px-5 py-4 last:border-r-0">
      <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[12px] font-extrabold text-slate-500">{label}</div>
        <div className="mt-0.5 truncate text-[24px] font-black leading-tight text-[#101828]">{value}</div>
        <div className="mt-0.5 truncate text-[11px] font-bold text-slate-500">{sub}</div>
      </div>
    </div>
  )
}

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? '' : String(value)
  return `"${text.replaceAll('"', '""')}"`
}

function InventoryStockSub({
  naver,
  coupang,
  coupangStale = false,
}: {
  naver: number | null | undefined
  coupang: number | null | undefined
  coupangStale?: boolean
}) {
  return (
    <span>
      <span className="text-emerald-600">네이버 {formatNumber(naver)}</span>
      <span className="mx-1 text-slate-300">/</span>
      <span className={coupangStale ? 'text-red-700' : 'text-red-600'}>
        쿠팡 {coupangStale ? '연동 오류' : formatNumber(coupang)}
      </span>
    </span>
  )
}

function ProductImage({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-300">
        <Boxes size={18} />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className="h-11 w-11 shrink-0 rounded-md border border-slate-200 bg-white object-cover shadow-sm"
      onError={() => setFailed(true)}
    />
  )
}

function LinkedProducts({ links }: { links: SmartInventoryMasterRow['linked'] }) {
  if (!links.length) return <span className="text-[12px] font-bold text-slate-400">연결 없음</span>

  return (
    <div className="flex max-w-[280px] flex-wrap gap-1.5">
      {links.slice(0, 3).map((link) => {
        const href = externalProductHref(link.productUrl, link.channel)

        return (
          <a
            key={`${link.channel}:${link.productKey}`}
            href={href || '#'}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => {
              event.stopPropagation()
              if (!href) event.preventDefault()
            }}
            onPointerDown={(event) => event.stopPropagation()}
            className={`inline-flex max-w-[132px] items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-black no-underline ${
              link.channel === 'naver'
                ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                : 'border-sky-100 bg-sky-50 text-sky-700'
            } ${href ? 'hover:brightness-95' : 'pointer-events-none'}`}
            title={link.name}
          >
            <span className="shrink-0">{channelLabel[link.channel]}</span>
            <span className="truncate">{link.name}</span>
            {href ? <ExternalLink size={11} className="shrink-0" /> : null}
          </a>
        )
      })}
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
  onSelect,
  coupangStale,
}: {
  row: SmartInventoryMasterRow
  rank: number
  favorite: boolean
  onToggleFavorite: (id: number) => void
  onSelect: (row: SmartInventoryMasterRow) => void
  coupangStale: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id })
  const dragHandleStyle = {
    touchAction: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
  } as const

  return (
    <tr
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        zIndex: isDragging ? 50 : 'auto',
      }}
      className="h-[68px] bg-white transition-colors hover:bg-[#F8FAFC]"
    >
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-8 w-8 cursor-grab items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400 active:cursor-grabbing"
            title="드래그해서 순위 변경"
            style={dragHandleStyle}
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
          <button
            type="button"
            onClick={() => onSelect(row)}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left outline-none transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-[#EF3B2D]/40"
            title={`${row.name} 재고차감 그래프 보기`}
          >
            <ProductImage src={row.imageUrl} alt={row.name} />
            <div className="min-w-0">
              <div className="truncate text-[14px] font-black text-slate-950" title={row.name}>
                {row.name || `마스터 #${row.id}`}
              </div>
              <div className="mt-1 truncate text-[12px] font-bold text-slate-500">
                단가 {formatMoney(row.unitCost)}
                <span className="ml-2 text-[#EF3B2D]">차감 그래프</span>
                {row.memo ? <span className="ml-2 text-emerald-700">메모 {row.memo}</span> : null}
              </div>
            </div>
          </button>
        </div>
      </td>
      <td className="px-3 py-2 text-right text-[14px] font-black tabular-nums text-slate-900">{formatMoney(representativePrice(row))}</td>
      <td className="px-3 py-2 text-right text-[14px] font-black tabular-nums text-emerald-600">{formatNumber(row.naverStock)}</td>
      <td className="px-3 py-2 text-right text-[14px] font-black tabular-nums text-red-600">
        {coupangStale ? <span title="쿠팡 API 인증 오류로 현재 재고를 확인할 수 없습니다.">연동 오류</span> : formatNumber(row.coupangStock)}
      </td>
      <td className="px-3 py-2 text-right text-[15px] font-black tabular-nums text-slate-950">{coupangStale ? '-' : formatNumber(row.totalStock)}</td>
      <td className="hidden px-3 py-2 text-right text-[13px] font-black tabular-nums text-orange-600 xl:table-cell">{formatNumber(row.totalInboundPending)}</td>
      <td className="hidden px-3 py-2 text-right text-[13px] font-black tabular-nums text-slate-900 2xl:table-cell">{coupangStale ? '-' : formatMoney(row.stockCost)}</td>
      <td className="px-3 py-2"><LinkedProducts links={row.linked} /></td>
      <td className="hidden px-3 py-2 text-[12px] font-bold text-slate-500 2xl:table-cell">{formatDateTime(resolveInventoryRowSyncedAt(row))}</td>
    </tr>
  )
}

function MasterTable({
  rows,
  allRows,
  rankOffset,
  favoriteIds,
  onToggleFavorite,
  onReorder,
  onSelect,
  coupangStale,
}: {
  rows: SmartInventoryMasterRow[]
  allRows: SmartInventoryMasterRow[]
  rankOffset: number
  favoriteIds: number[]
  onToggleFavorite: (id: number) => void
  onReorder: (nextOrder: number[]) => void
  onSelect: (row: SmartInventoryMasterRow) => void
  coupangStale: boolean
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
    <div className="max-h-[calc(100dvh-310px)] min-h-[360px] overflow-auto rounded-lg border border-[#DDE3EC] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalDrag]} onDragEnd={handleDragEnd}>
        <table className="w-full min-w-[1100px] table-fixed border-collapse text-left text-[13px]">
          <thead className="sticky top-0 z-20 border-b border-[#18243A] bg-[#101828] text-[12px] font-black text-white shadow-sm">
            <tr>
              <th className="w-[88px] px-3 py-3">순번</th>
              <th className="w-[310px] px-3 py-3">상품</th>
              <th className="w-[100px] px-3 py-3 text-right">판매가</th>
              <th className="w-[78px] px-3 py-3 text-right text-emerald-300">네이버</th>
              <th className="w-[78px] px-3 py-3 text-right text-red-300">쿠팡</th>
              <th className="w-[82px] px-3 py-3 text-right">총재고</th>
              <th className="hidden w-[90px] px-3 py-3 text-right xl:table-cell">입고대기</th>
              <th className="hidden w-[125px] px-3 py-3 text-right 2xl:table-cell">재고가치</th>
              <th className="w-[250px] px-3 py-3">연결상태</th>
              <th className="hidden w-[120px] px-3 py-3 2xl:table-cell">최근갱신</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length ? (
              <SortableContext items={rows.map((row) => row.id)} strategy={verticalListSortingStrategy}>
                {rows.map((row, index) => (
                  <SortableMasterRow
                    key={row.id}
                    row={row}
                    rank={rankOffset + index + 1}
                    favorite={favoriteIds.includes(row.id)}
                    onToggleFavorite={onToggleFavorite}
                    onSelect={onSelect}
                    coupangStale={coupangStale}
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

function UnlinkedTable({ rows, rankOffset, coupangStale }: { rows: SmartInventoryChannelRow[]; rankOffset: number; coupangStale: boolean }) {
  return (
    <div className="max-h-[calc(100dvh-310px)] min-h-[360px] overflow-auto rounded-lg border border-[#DDE3EC] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <table className="w-full min-w-[900px] table-fixed border-collapse text-left text-[13px]">
        <thead className="sticky top-0 z-20 border-b border-[#18243A] bg-[#101828] text-[12px] font-black text-white shadow-sm">
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
                <td className="px-3 py-2 text-right text-[13px] font-black tabular-nums text-slate-500">{rankOffset + index + 1}</td>
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
                      {(() => {
                        const href = externalProductHref(row.productUrl, row.channel)

                        return (
                          <a
                            href={href || '#'}
                            target="_blank"
                            rel="noreferrer"
                            className={`block truncate text-[14px] font-black text-slate-950 no-underline ${
                              href ? 'hover:text-[#EF3B2D]' : 'pointer-events-none'
                            }`}
                            title={row.name}
                          >
                            {row.name || row.productKey}
                          </a>
                        )
                      })()}
                      <div className="mt-1 truncate text-[12px] font-bold text-slate-500">{row.identityKey}</div>
                    </div>
                  </div>
                </td>
                <td className={`px-3 py-2 text-right font-black tabular-nums ${stockTone(row.stock)}`}>
                  {row.channel === 'coupang' && coupangStale ? '연동 오류' : formatNumber(row.stock)}
                </td>
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
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<(typeof pageSizeOptions)[number]>(20)
  const [masterOrder, setMasterOrder] = useState<number[]>([])
  const [favoriteIds, setFavoriteIds] = useState<number[]>([])
  const [selectedHistoryProduct, setSelectedHistoryProduct] = useState<SmartInventoryMasterRow | null>(null)

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
      setData((current) => {
        const receivedNoInventory =
          payload?.rows?.length === 0 &&
          payload?.channels?.naver?.length === 0 &&
          payload?.channels?.coupang?.length === 0 &&
          Array.isArray(payload?.warnings) &&
          payload.warnings.length > 0
        const hasCurrentInventory =
          Boolean(current?.rows.length) ||
          Boolean(current?.channels.naver.length) ||
          Boolean(current?.channels.coupang.length)

        if (!receivedNoInventory || !hasCurrentInventory || !current) return payload

        return {
          ...current,
          health: payload.health,
          monitorUrl: payload.monitorUrl,
          monitorSource: payload.monitorSource,
          syncedAt: payload.syncedAt,
          cache: {
            ...current.cache,
            hit: true,
            refreshing: false,
          },
          warnings: [
            ...payload.warnings,
            '라즈베리 응답이 지연되어 화면의 마지막 정상 재고를 유지합니다.',
          ],
        }
      })
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
  const totalPages = Math.max(1, Math.ceil(activeRowsCount / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageOffset = (safePage - 1) * pageSize
  const pagedMasters = filteredMasters.slice(pageOffset, pageOffset + pageSize)
  const pagedUnlinkedRows = filteredUnlinkedRows.slice(pageOffset, pageOffset + pageSize)
  const filterCounts = useMemo<Record<FilterMode, number>>(() => ({
    all: orderedMasters.length,
    empty: orderedMasters.filter((row) => (row.totalStock ?? 0) <= 0).length,
    inbound: orderedMasters.filter((row) => (row.totalInboundPending ?? 0) > 0).length,
    unlinked: orderedMasters.filter((row) => row.linkCount === 0).length,
    linked: orderedMasters.filter((row) => row.linkCount > 0).length,
  }), [orderedMasters])
  const healthStatus = String(data?.health?.status || '')
  const coupangStale = data?.channelHealth?.coupang?.status === 'stale'
  const cacheLabel = data?.cache?.hit
    ? `캐시 표시 중${data.cache.refreshing ? ' / 갱신 중' : ''}`
    : data?.cache?.cachedAt
      ? '최신 조회'
      : '조회 대기'

  useEffect(() => {
    setPage(1)
  }, [filter, normalizedQuery, pageSize, tableMode])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  useEffect(() => {
    const handleKeyboardPage = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, button, [contenteditable="true"]')) return
      if (event.key === 'ArrowLeft') setPage((current) => Math.max(1, current - 1))
      if (event.key === 'ArrowRight') setPage((current) => Math.min(totalPages, current + 1))
    }
    window.addEventListener('keydown', handleKeyboardPage)
    return () => window.removeEventListener('keydown', handleKeyboardPage)
  }, [totalPages])

  const handleDownload = () => {
    const lines = tableMode === 'masters'
      ? [
          ['순번', '상품명', '판매가', '네이버', '쿠팡', '총재고', '입고대기', '재고가치', '최근갱신'],
          ...filteredMasters.map((row, index) => [
            index + 1,
            row.name,
            representativePrice(row),
            row.naverStock,
            coupangStale ? '' : row.coupangStock,
            coupangStale ? '' : row.totalStock,
            row.totalInboundPending,
            coupangStale ? '' : row.stockCost,
            resolveInventoryRowSyncedAt(row),
          ]),
        ]
      : [
          ['순번', '채널', '상품명', '상품키', '재고', '판매가', '수집시각'],
          ...filteredUnlinkedRows.map((row, index) => [
            index + 1,
            channelLabel[row.channel],
            row.name,
            row.identityKey,
            row.channel === 'coupang' && coupangStale ? '' : row.stock,
            row.price,
            row.syncedAt,
          ]),
        ]
    const csv = `\uFEFF${lines.map((line) => line.map(csvCell).join(',')).join('\r\n')}`
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `재고관리_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  const pageNumberStart = Math.min(Math.max(1, safePage - 2), Math.max(1, totalPages - 4))
  const pageNumbers = Array.from({ length: Math.min(5, totalPages) }, (_, index) => pageNumberStart + index)

  return (
    <div className="mx-auto w-full max-w-[1540px] space-y-4 pb-6">
      <header className="sticky top-[56px] z-40 -mx-3 border-b border-[#E5EAF2] bg-[#F6F8FB]/95 px-3 py-3 backdrop-blur sm:-mx-5 sm:px-5 lg:top-0 lg:-mx-6 lg:px-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-baseline gap-3">
              <h1 className="text-[25px] font-black leading-none text-[#101828]">재고관리</h1>
              <span className="rounded-md bg-slate-200 px-2 py-1 text-[11px] font-black text-slate-600">
                {formatNumber(data?.summary.masterCount || 0)}개
              </span>
            </div>
            <p className="mt-1.5 text-[12px] font-bold text-slate-500">채널별 재고, 입고 예정 수량과 재고가치를 한곳에서 확인합니다.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#DDE3EC] bg-white px-3 text-[11px] font-black text-slate-600 shadow-sm">
              <span className={`h-2 w-2 rounded-full ${coupangStale ? 'bg-red-500' : healthStatus ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              <span>{coupangStale ? '쿠팡 연동 오류' : healthStatus ? '수집기 연결됨' : '연결 확인 중'}</span>
              <span className="hidden border-l border-slate-200 pl-2 text-slate-400 sm:inline">{cacheLabel}</span>
            </div>
            <button
              type="button"
              onClick={() => loadDashboard(true)}
              disabled={loading || syncing}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#DDE3EC] bg-white text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-60"
              title="화면 데이터 새로고침"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            </button>
            <button
              type="button"
              onClick={handleSync}
              disabled={loading || syncing || data?.configured === false}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#E43D20] px-4 text-[12px] font-black text-white shadow-sm hover:bg-[#C9331B] disabled:opacity-60"
            >
              {syncing ? <Loader2 size={15} className="animate-spin" /> : <PackageCheck size={15} />}
              재고 동기화
            </button>
          </div>
        </div>
      </header>

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

      <section className="overflow-x-auto rounded-lg border border-[#DDE3EC] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]" aria-label="재고 요약">
        <div className="flex min-w-[1030px]">
          <StatCard icon={<Boxes size={20} />} label="전체상품" value={formatNumber(data?.summary.masterCount || 0)} sub="등록된 관리 상품" />
          <StatCard
            icon={<Database size={20} />}
            label="총 재고"
            value={coupangStale ? '확인 불가' : formatNumber(data?.summary.totalStock || 0)}
            sub={<InventoryStockSub naver={data?.summary.naverStock || 0} coupang={data?.summary.coupangStock || 0} coupangStale={coupangStale} />}
            tone="blue"
          />
          <StatCard icon={<PackageCheck size={20} />} label="입고대기" value={formatNumber(data?.summary.totalInboundPending || 0)} sub="입고 예정 수량" tone="orange" />
          <StatCard icon={<AlertCircle size={20} />} label="미연결" value={formatNumber(data?.summary.unlinkedProducts || 0)} sub="채널 연결 필요" tone="red" />
          <StatCard icon={<WalletCards size={20} />} label="재고가치" value={coupangStale ? '확인 불가' : formatMoney(data?.summary.stockCost || 0)} sub="현재 재고 원가 기준" tone="green" />
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-lg border border-[#DDE3EC] bg-white p-2 shadow-[0_1px_3px_rgba(15,23,42,0.05)] xl:flex-row xl:items-center">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-lg border border-[#DDE3EC] bg-white px-3 focus-within:border-[#2563EB] xl:max-w-[620px]">
          <Search size={17} className="shrink-0 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="상품명, 링크상품, 키워드 검색"
            className="h-10 min-w-0 flex-1 border-0 bg-transparent text-[13px] font-bold text-slate-900 shadow-none outline-none placeholder:text-slate-400 focus:shadow-none"
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 xl:pb-0">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setFilter(option.value)
                if (option.value !== 'unlinked') setTableMode('masters')
                if (option.value === 'unlinked') setTableMode('unlinked')
              }}
              className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-[12px] font-black transition ${
                filter === option.value
                  ? 'border-[#2563EB] bg-[#2563EB] text-white shadow-sm'
                  : 'border-[#E5EAF2] bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {option.label}
              <span className={`rounded px-1.5 py-0.5 text-[10px] ${filter === option.value ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {formatNumber(filterCounts[option.value])}
              </span>
            </button>
          ))}
        </div>
        <div className="hidden h-7 w-px bg-slate-200 xl:block" />
        <button
          type="button"
          onClick={handleDownload}
          disabled={!activeRowsCount}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-[#DDE3EC] bg-white px-3 text-[12px] font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <Download size={15} className="text-emerald-600" />
          CSV 다운로드
        </button>
      </section>

      {loading && !data ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-[#E5EAF2] bg-white text-[13px] font-black text-slate-500 shadow-sm">
          <Loader2 size={20} className="mr-2 animate-spin text-[#EF3B2D]" />
          재고를 불러오는 중입니다.
        </div>
      ) : tableMode === 'masters' ? (
        <MasterTable
          rows={pagedMasters}
          allRows={orderedMasters}
          rankOffset={pageOffset}
          favoriteIds={favoriteIds}
          onToggleFavorite={handleToggleFavorite}
          onReorder={handleReorder}
          onSelect={setSelectedHistoryProduct}
          coupangStale={coupangStale}
        />
      ) : (
        <UnlinkedTable rows={pagedUnlinkedRows} rankOffset={pageOffset} coupangStale={coupangStale} />
      )}

      {!loading && data ? (
        <footer className="flex flex-col gap-3 rounded-lg border border-[#DDE3EC] bg-white px-4 py-3 text-[12px] font-bold text-slate-500 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span>
              총 <strong className="text-slate-900">{formatNumber(activeRowsCount)}</strong>개 중{' '}
              {activeRowsCount ? formatNumber(pageOffset + 1) : 0}-{formatNumber(Math.min(pageOffset + pageSize, activeRowsCount))} 표시
            </span>
            <label className="inline-flex items-center gap-2">
              <span className="sr-only">페이지당 표시 수</span>
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value) as (typeof pageSizeOptions)[number])}
                className="h-9 rounded-lg border border-[#DDE3EC] bg-white px-3 text-[12px] font-black text-slate-700"
              >
                {pageSizeOptions.map((size) => <option key={size} value={size}>{size}개씩 보기</option>)}
              </select>
            </label>
          </div>
          <nav className="flex items-center gap-1" aria-label="재고 목록 페이지">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={safePage <= 1}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#DDE3EC] bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-35"
              title="이전 페이지 (왼쪽 방향키)"
            >
              <ChevronLeft size={16} />
            </button>
            {pageNumbers.map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => setPage(pageNumber)}
                className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-[12px] font-black ${
                  pageNumber === safePage
                    ? 'border-[#2563EB] bg-[#2563EB] text-white'
                    : 'border-[#DDE3EC] bg-white text-slate-600 hover:bg-slate-50'
                }`}
                aria-current={pageNumber === safePage ? 'page' : undefined}
              >
                {pageNumber}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={safePage >= totalPages}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#DDE3EC] bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-35"
              title="다음 페이지 (오른쪽 방향키)"
            >
              <ChevronRight size={16} />
            </button>
          </nav>
        </footer>
      ) : null}
      {selectedHistoryProduct ? (
        <ProductInventoryHistoryModal
          product={selectedHistoryProduct}
          onClose={() => setSelectedHistoryProduct(null)}
        />
      ) : null}
    </div>
  )
}
