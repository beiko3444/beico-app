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
  ChevronDown,
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
import { buttonClass } from '@/components/ui/Button'
import PageHeader from '@/components/ui/PageHeader'
import Tabs from '@/components/ui/Tabs'
import FilterChips from '@/components/ui/FilterChips'
import EmptyState from '@/components/ui/EmptyState'
import Badge from '@/components/ui/Badge'
import StatCard from '@/components/ui/StatCard'
import { selectClass } from '@/components/ui/field'
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
  { value: 'unlinked', label: '판매 채널 없음' },
  { value: 'linked', label: '연결상품 있음' },
]

const pageSizeOptions = [20, 50, 100] as const

const tableModeTabs: Array<{ key: TableMode; label: string }> = [
  { key: 'masters', label: '관리 상품' },
  { key: 'unlinked', label: '매칭 안 된 채널 SKU' },
]

const pageButtonBase = 'inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-bold tabular-nums transition-colors'

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

/** Groups failures that share a cause ("A를 불러오지 못했습니다: <원인>") into one line with the cause shown once. */
function summarizeWarnings(warnings: string[]) {
  const failures = new Map<string, string[]>()
  const notes: string[] = []
  for (const warning of warnings) {
    const match = warning.match(/^(.+?) 불러오지 못했습니다: ([\s\S]+)$/)
    if (!match) {
      notes.push(warning)
      continue
    }
    const subjects = failures.get(match[2]) || []
    subjects.push(match[1].replace(/[을를]$/, ''))
    failures.set(match[2], subjects)
  }
  return {
    failures: [...failures.entries()].map(([reason, subjects]) => ({ reason, subjects })),
    failedCount: [...failures.values()].reduce((sum, subjects) => sum + subjects.length, 0),
    notes,
  }
}

function InventoryWarnings({ warnings }: { warnings: string[] }) {
  const { failures, failedCount, notes } = summarizeWarnings(warnings)
  return (
    <div role="status" className={`rounded-xl border px-4 py-3 text-[13px] ${failedCount ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
      <div className="flex items-start gap-2">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          {failedCount ? <p className="font-bold">재고 데이터 {failedCount}개 항목을 불러오지 못했습니다. 아래 요약 값은 확인되지 않은 항목이 있습니다.</p> : null}
          {notes.map((note) => (
            <p key={note} className={failedCount ? 'mt-1 text-[12px] font-semibold' : 'font-semibold'}>{note}</p>
          ))}
          {failures.length ? (
            <details className="group mt-1">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[12px] font-bold underline-offset-2 hover:underline [&::-webkit-details-marker]:hidden">
                자세히
                <ChevronDown size={13} className="transition-transform group-open:rotate-180" />
              </summary>
              <ul className="mt-2 space-y-2">
                {failures.map((failure) => (
                  <li key={failure.reason}>
                    <span className="font-semibold">{failure.subjects.join(', ')}</span>
                    <span className="mt-0.5 block break-all font-mono text-[11px] opacity-80">{failure.reason}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
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
    <span className="tabular-nums">
      <span>네이버 {formatNumber(naver)}</span>
      <span className="mx-1 text-slate-300">/</span>
      <span className={coupangStale ? 'text-red-700' : undefined}>
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
            className={`inline-flex max-w-[132px] items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 no-underline ${href ? 'hover:border-slate-400 hover:text-slate-900' : 'pointer-events-none'}`}
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
      className="h-[68px] bg-white transition-colors hover:bg-slate-50"
    >
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className="inline-flex h-8 w-8 cursor-grab items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40 active:cursor-grabbing"
            title="드래그해서 순위 변경"
            aria-label={`${row.name || `마스터 #${row.id}`} 순위 변경`}
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
            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40 ${
              favorite
                ? 'border-amber-200 bg-amber-50 text-amber-500'
                : 'border-slate-200 bg-white text-slate-300 hover:text-amber-500'
            }`}
            title={favorite ? '즐겨찾기 해제' : '즐겨찾기'}
            aria-label={favorite ? `${row.name} 즐겨찾기 해제` : `${row.name} 즐겨찾기`}
            aria-pressed={favorite}
          >
            <Star size={16} fill={favorite ? 'currentColor' : 'none'} />
          </button>
          <button
            type="button"
            onClick={() => onSelect(row)}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40"
            title={`${row.name} 재고차감 그래프 보기`}
          >
            <ProductImage src={row.imageUrl} alt={row.name} />
            <div className="min-w-0">
              <div className="truncate text-[14px] font-black text-slate-950" title={row.name}>
                {row.name || `마스터 #${row.id}`}
              </div>
              <div className="mt-1 truncate text-[12px] font-bold text-slate-500">
                단가 {formatMoney(row.unitCost)}
                <span className="ml-2 text-blue-700">차감 그래프</span>
                {row.memo ? <span className="ml-2 text-emerald-700">메모 {row.memo}</span> : null}
              </div>
            </div>
          </button>
        </div>
      </td>
      <td className="px-3 py-2 text-right text-[14px] font-black tabular-nums text-slate-900">{formatMoney(representativePrice(row))}</td>
      <td className="px-3 py-2 text-right text-[14px] font-bold tabular-nums text-slate-800">{formatNumber(row.naverStock)}</td>
      <td className="px-3 py-2 text-right text-[14px] font-bold tabular-nums text-slate-800">
        {coupangStale ? <span className="text-red-700" title="쿠팡 API 인증 오류로 현재 재고를 확인할 수 없습니다.">연동 오류</span> : formatNumber(row.coupangStock)}
      </td>
      <td className="px-3 py-2 text-right text-[15px] font-black tabular-nums text-slate-950">{coupangStale ? '-' : formatNumber(row.totalStock)}</td>
      <td className="px-3 py-2 text-right text-[13px] font-bold tabular-nums text-slate-800">{formatNumber(row.totalInboundPending)}</td>
      <td className="px-3 py-2 text-right text-[13px] font-black tabular-nums text-slate-900">{coupangStale ? '-' : formatMoney(row.stockCost)}</td>
      <td className="px-3 py-2"><LinkedProducts links={row.linked} /></td>
      <td className="px-3 py-2 text-[12px] font-bold text-slate-500">{formatDateTime(resolveInventoryRowSyncedAt(row))}</td>
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
  emptyState,
}: {
  rows: SmartInventoryMasterRow[]
  allRows: SmartInventoryMasterRow[]
  rankOffset: number
  favoriteIds: number[]
  onToggleFavorite: (id: number) => void
  onReorder: (nextOrder: number[]) => void
  onSelect: (row: SmartInventoryMasterRow) => void
  coupangStale: boolean
  emptyState: ReactNode
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

  // Every column is always drawn (no breakpoint-hidden cells), so the header band runs the full table width;
  // narrow screens scroll the table sideways, and 연결상태 (no fixed width) absorbs any spare room.
  return (
    <>
      <div className="max-h-[calc(100dvh-310px)] overflow-x-auto overflow-y-auto">
        <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalDrag]} onDragEnd={handleDragEnd}>
          <table className="w-full min-w-[1320px] table-fixed border-collapse text-left text-[13px]">
            <thead className="ux-thead sticky top-0 z-20">
              <tr>
                <th className="w-[88px] whitespace-nowrap text-right">순번</th>
                <th className="w-[310px] whitespace-nowrap">상품</th>
                <th className="w-[100px] whitespace-nowrap text-right">판매가</th>
                <th className="w-[78px] whitespace-nowrap text-right">네이버</th>
                <th className="w-[78px] whitespace-nowrap text-right">쿠팡</th>
                <th className="w-[82px] whitespace-nowrap text-right">총재고</th>
                <th className="w-[90px] whitespace-nowrap text-right">입고대기</th>
                <th className="w-[125px] whitespace-nowrap text-right">재고가치</th>
                <th className="whitespace-nowrap">연결상태</th>
                <th className="w-[120px] whitespace-nowrap">최근갱신</th>
              </tr>
            </thead>
            {rows.length ? (
              <tbody className="divide-y divide-slate-100">
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
              </tbody>
            ) : null}
          </table>
        </DndContext>
      </div>
      {/* Outside the table, so an empty list doesn't stretch a phantom row across hidden columns. */}
      {rows.length ? null : emptyState}
    </>
  )
}

function MasterCards({ rows, allRows, favoriteIds, onToggleFavorite, onReorder, onSelect, coupangStale, emptyState }: {
  coupangStale: boolean
  emptyState: ReactNode
  rows: SmartInventoryMasterRow[]
  allRows: SmartInventoryMasterRow[]
  favoriteIds: number[]
  onToggleFavorite: (id: number) => void
  onReorder: (ids: number[]) => void
  onSelect: (row: SmartInventoryMasterRow) => void
}) {
  function move(id: number, offset: number) {
    const ids = allRows.map(row => row.id)
    const index = ids.indexOf(id)
    const target = index + offset
    if (index < 0 || target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    onReorder(ids)
  }
  return <div className="space-y-3 p-3 lg:hidden">
    {!rows.length && emptyState}
    {rows.map(row => {
      const index = allRows.findIndex(item => item.id === row.id)
      const favorite = favoriteIds.includes(row.id)
      return <article key={row.id} className="ux-panel p-4">
        <div className="flex items-start gap-3">
          <button onClick={() => onSelect(row)} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left" aria-label={`${row.name} 재고 이력 보기`}>
            <ProductImage src={row.imageUrl} alt={row.name} />
            <span className="min-w-0"><span className="block text-base font-bold text-slate-900">{row.name}</span><span className="mt-1 block text-xs text-slate-500">재고 이력·차감 추이 보기</span></span>
          </button>
          <button type="button" onClick={() => onToggleFavorite(row.id)} aria-label={`${row.name} 즐겨찾기 ${favorite ? '해제' : '추가'}`} aria-pressed={favorite} className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors ${favorite ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}><Star size={18} fill={favorite ? 'currentColor' : 'none'} className={favorite ? 'text-amber-500' : 'text-slate-400'} /></button>
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3 text-center">
          <div><dt className="text-xs text-slate-500">네이버</dt><dd className="mt-1 text-lg font-bold tabular-nums">{formatNumber(row.naverStock)}</dd></div>
          <div><dt className="text-xs text-slate-500">쿠팡</dt><dd className="mt-1 text-lg font-bold tabular-nums">{coupangStale ? '확인 불가' : formatNumber(row.coupangStock)}</dd></div>
          <div><dt className="text-xs text-slate-500">합계</dt><dd className="mt-1 text-lg font-bold tabular-nums">{coupangStale ? '확인 불가' : formatNumber(row.totalStock)}</dd></div>
        </dl>
        <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs tabular-nums text-slate-600"><span>입고대기 {formatNumber(row.totalInboundPending)}개</span><span>원가 {formatMoney(row.unitCost)}</span><span>{row.linkCount ? `${row.linkCount}개 SKU 연결` : '채널 연결 없음'}</span></div>
        <details className="group mt-3 border-t border-slate-100 pt-2"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">연결 상품·목록 순서<ChevronDown size={16} className="text-slate-400 transition-transform group-open:rotate-180" /></summary>
          <div className="space-y-2">{row.linked.map(link => {
            const href = externalProductHref(link.productUrl, link.channel)
            return <div key={`${link.channel}:${link.productKey}`} className="text-sm">{href ? <a href={href} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2">{channelLabel[link.channel]} · {link.name}<ExternalLink size={14} /></a> : <span>{channelLabel[link.channel]} · {link.name}</span>}</div>
          })}{!row.linked.length && <p className="text-sm text-slate-500">연결된 채널 상품이 없습니다.</p>}</div>
          <div className="mt-2 flex gap-2"><button type="button" className={buttonClass('secondary', 'sm')} disabled={index <= 0} onClick={() => move(row.id, -1)}>위로</button><button type="button" className={buttonClass('secondary', 'sm')} disabled={index === allRows.length - 1} onClick={() => move(row.id, 1)}>아래로</button></div>
        </details>
      </article>
    })}
  </div>
}

function UnlinkedTable({ rows, rankOffset, coupangStale }: { rows: SmartInventoryChannelRow[]; rankOffset: number; coupangStale: boolean }) {
  return (
    <div className="max-h-[calc(100dvh-310px)] overflow-x-auto overflow-y-auto">
      <table className="w-full min-w-[900px] table-fixed border-collapse text-left text-[13px]">
        <thead className="ux-thead sticky top-0 z-20">
          <tr>
            <th className="w-[70px] whitespace-nowrap text-right">순번</th>
            <th className="w-[90px] whitespace-nowrap">채널</th>
            <th className="w-[360px] whitespace-nowrap">상품</th>
            <th className="w-[90px] whitespace-nowrap text-right">재고</th>
            <th className="w-[100px] whitespace-nowrap text-right">오늘판매</th>
            <th className="w-[110px] whitespace-nowrap text-right">판매가</th>
            <th className="w-[100px] whitespace-nowrap">수집</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length ? (
            rows.map((row, index) => (
              <tr key={`${row.channel}:${row.identityKey}`} className="h-16 bg-white hover:bg-slate-50">
                <td className="px-3 py-2 text-right text-[13px] font-black tabular-nums text-slate-500">{rankOffset + index + 1}</td>
                <td className="px-3 py-2">
                  <Badge outline>{channelLabel[row.channel]}</Badge>
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
                              href ? 'hover:text-brand-orange' : 'pointer-events-none'
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
              <td colSpan={7} className="p-0">
                <EmptyState bare compact icon={<AlertCircle size={20} />} title="매칭 안 된 채널 SKU가 없습니다." />
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
  const monitorUnavailable = data?.configured === false || (!data && !loading)
  const summary = data?.configured ? data.summary : null
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
    if (selectedHistoryProduct) return
    const handleKeyboardPage = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, button, [contenteditable="true"]')) return
      if (event.key === 'ArrowLeft') setPage((current) => Math.max(1, current - 1))
      if (event.key === 'ArrowRight') setPage((current) => Math.min(totalPages, current + 1))
    }
    window.addEventListener('keydown', handleKeyboardPage)
    return () => window.removeEventListener('keydown', handleKeyboardPage)
  }, [selectedHistoryProduct, totalPages])

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

  const { failedCount } = summarizeWarnings(data?.warnings || [])
  const summaryUnknown = failedCount > 0
  // When a source failed, zeros would look like real stock, so the cards show "—" (never 0).
  const statValue = (text: string, alert = false) => summaryUnknown
    ? <span className="text-slate-400">—</span>
    : <span className={alert ? 'text-red-700' : undefined}>{text}</span>
  const statCardClass = 'max-sm:gap-0.5 max-sm:p-3 max-sm:[&>div:nth-child(2)]:text-[18px] max-sm:[&>div:nth-child(3)]:hidden'
  const activeFilterLabel = filterOptions.find((option) => option.value === filter)?.label || '전체'
  const filtersApplied = filter !== 'all' || Boolean(normalizedQuery)
  const masterEmptyState = (
    <EmptyState
      bare
      compact
      icon={<Boxes size={20} />}
      title={filtersApplied ? `${filter === 'all' ? '검색 조건에 맞는' : `'${activeFilterLabel}'`} 관리 상품이 없습니다.` : '표시할 관리 상품이 없습니다.'}
      action={filtersApplied ? (
        <button type="button" onClick={() => { setFilter('all'); setQuery('') }} className={buttonClass('secondary', 'sm')}>전체 보기</button>
      ) : undefined}
    />
  )

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1540px] space-y-4 pb-6">
      <PageHeader
        title="재고 관리"
        count={summary && !summaryUnknown ? summary.masterCount : undefined}
        description="네이버·쿠팡 판매 재고입니다. 실물 창고 재고와 별도로 집계합니다."
        actions={(
          <>
            <div
              className="inline-flex h-10 min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap rounded-[10px] border border-[var(--border)] bg-white px-3 text-[12px] font-bold text-slate-600"
              title="조회 시각과 채널 수집 시각은 다를 수 있습니다. 최신 재고는 채널 재고 수집 후 확인하세요."
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${coupangStale ? 'bg-red-500' : healthStatus ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              <span>{monitorUnavailable ? '수집기 연결 실패' : coupangStale ? '쿠팡 연동 오류' : healthStatus ? '수집기 연결됨' : '연결 확인 중'}</span>
              <span className="truncate border-l border-slate-200 pl-2 text-slate-500">{cacheLabel}</span>
            </div>
            {/* Icon-only on phones so it shares the second row with the status chip. */}
            <button
              type="button"
              onClick={() => loadDashboard(true)}
              disabled={loading || syncing}
              className={buttonClass('secondary', 'md', 'max-sm:w-10 max-sm:flex-none max-sm:px-0')}
              title="화면 데이터 새로고침"
              aria-label="화면 갱신"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}<span className="max-sm:hidden">화면 갱신</span>
            </button>
            <button
              type="button"
              data-primary
              onClick={handleSync}
              disabled={loading || syncing || data?.configured === false}
              className={buttonClass('primary', 'md')}
            >
              {syncing ? <Loader2 size={15} className="animate-spin" /> : <PackageCheck size={15} />}
              채널 재고 수집
            </button>
          </>
        )}
      />

      {error ? (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-bold text-red-700">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* The warning sits directly on the numbers it affects. */}
      <section aria-label="재고 요약" className="space-y-2">
        {data?.warnings?.length ? <InventoryWarnings warnings={data.warnings} /> : null}
        {/* Phones: values only in a compact 3-column grid, so the list starts on the first screen. */}
        <div className="grid min-w-0 grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-5">
          <StatCard className={statCardClass} icon={<Boxes />} label="전체상품" value={statValue(formatNumber(summary?.masterCount))} caption="등록된 관리 상품" />
          <StatCard
            className={statCardClass}
            icon={<Database />}
            label="총 재고"
            value={statValue(monitorUnavailable || coupangStale ? '확인 불가' : formatNumber(summary?.totalStock))}
            caption={summaryUnknown ? '확인 불가' : <InventoryStockSub naver={summary?.naverStock} coupang={summary?.coupangStock} coupangStale={coupangStale} />}
          />
          <StatCard className={statCardClass} icon={<PackageCheck />} label="입고대기" value={statValue(formatNumber(summary?.totalInboundPending))} caption={summaryUnknown ? '확인 불가' : '입고 예정 수량'} />
          <StatCard
            className={statCardClass}
            icon={<AlertCircle />}
            label="미매칭 SKU"
            value={statValue(formatNumber(summary?.unlinkedProducts), (summary?.unlinkedProducts ?? 0) > 0)}
            caption={summaryUnknown ? '확인 불가' : '관리 상품과 매칭 안 된 채널 SKU'}
          />
          <StatCard
            className={`${statCardClass} col-span-2 sm:col-span-2 lg:col-span-1`}
            icon={<WalletCards />}
            label="재고가치"
            value={statValue(monitorUnavailable || coupangStale ? '확인 불가' : summary?.stockCost === null || summary?.stockCost === undefined ? '-' : formatNumber(summary.stockCost))}
            unit={summaryUnknown || monitorUnavailable || coupangStale || summary?.stockCost === null || summary?.stockCost === undefined ? undefined : '원'}
            caption={summaryUnknown ? '확인 불가' : '현재 재고 원가 기준'}
          />
        </div>
      </section>

      <section className="ux-panel overflow-hidden" aria-label="재고 목록">
        {/* One Tabs row switches what the list is; the status filter below it is a row of outline chips. */}
        <div className="space-y-3 border-b border-slate-200 p-3">
          <div className="flex min-w-0 items-center gap-2">
            <Tabs
              aria-label="목록 종류"
              items={tableModeTabs.map((tab) => ({
                ...tab,
                count: tab.key === 'masters' ? filterCounts.all : filteredUnlinkedRows.length,
              }))}
              value={tableMode}
              onChange={(value) => {
                setTableMode(value)
                setPage(1)
              }}
            />
            <button
              type="button"
              onClick={handleDownload}
              disabled={!activeRowsCount}
              className={buttonClass('secondary', 'md', 'ml-auto max-sm:w-10 max-sm:px-0')}
              aria-label="CSV 다운로드"
              title="CSV 다운로드"
            >
              <Download size={15} />
              <span className="hidden sm:inline">CSV 다운로드</span>
            </button>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="flex h-10 min-w-0 flex-1 basis-full items-center gap-2 rounded-lg border border-[var(--input-border)] bg-white px-3 focus-within:border-brand-orange focus-within:ring-2 focus-within:ring-brand-orange/15 sm:basis-auto sm:min-w-[300px] sm:max-w-[420px]">
              <Search size={17} className="shrink-0 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="상품명, 링크상품, 키워드 검색"
                aria-label="재고 검색"
                className="h-10 min-w-0 flex-1 border-0 bg-transparent text-[13px] font-normal text-slate-900 shadow-none outline-none placeholder:text-slate-400 focus:shadow-none"
              />
            </div>
            {tableMode === 'masters' ? (
              <FilterChips
                aria-label="재고 필터"
                items={filterOptions.map((option) => ({ key: option.value, label: option.label, count: filterCounts[option.value] }))}
                value={filter}
                onChange={setFilter}
              />
            ) : null}
          </div>
        </div>

        {loading && !data ? (
          <div className="flex h-64 items-center justify-center text-[13px] font-black text-slate-500">
            <Loader2 size={20} className="mr-2 animate-spin text-slate-400" />
            재고를 불러오는 중입니다.
          </div>
        ) : tableMode === 'masters' ? (
          <><MasterCards rows={pagedMasters} allRows={orderedMasters} favoriteIds={favoriteIds} onToggleFavorite={handleToggleFavorite} onReorder={handleReorder} onSelect={setSelectedHistoryProduct} coupangStale={coupangStale} emptyState={masterEmptyState} /><div className="hidden lg:block"><MasterTable
            rows={pagedMasters}
            allRows={orderedMasters}
            rankOffset={pageOffset}
            favoriteIds={favoriteIds}
            onToggleFavorite={handleToggleFavorite}
            onReorder={handleReorder}
            onSelect={setSelectedHistoryProduct}
            coupangStale={coupangStale}
            emptyState={masterEmptyState}
          /></div></>
        ) : (
          <UnlinkedTable rows={pagedUnlinkedRows} rankOffset={pageOffset} coupangStale={coupangStale} />
        )}

        {!loading && data ? (
          <footer className="flex flex-row flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-[12px] font-bold text-slate-500">
            <div className="flex flex-wrap items-center gap-3">
              <span className="tabular-nums">
                총 <strong className="text-slate-900">{formatNumber(activeRowsCount)}</strong>개 중{' '}
                {activeRowsCount ? formatNumber(pageOffset + 1) : 0}-{formatNumber(Math.min(pageOffset + pageSize, activeRowsCount))} 표시
              </span>
              <label className="inline-flex items-center gap-2">
                <span className="sr-only">페이지당 표시 수</span>
                <select
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value) as (typeof pageSizeOptions)[number])}
                  className={selectClass(true, 'h-9 w-auto text-[12px]')}
                >
                  {pageSizeOptions.map((size) => <option key={size} value={size}>{size}개씩 보기</option>)}
                </select>
              </label>
            </div>
            <nav className="ml-auto flex flex-wrap items-center gap-1" aria-label="재고 목록 페이지">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={safePage <= 1}
                className={`${pageButtonBase} border-transparent text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40`}
                title="이전 페이지 (왼쪽 방향키)"
                aria-label="이전 페이지"
              >
                <ChevronLeft size={16} />
              </button>
              {/* The current page is outlined, not filled: orange stays for the one primary action. */}
              {pageNumbers.map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => setPage(pageNumber)}
                  className={`${pageButtonBase} ${pageNumber === safePage ? 'border-slate-900 bg-white text-slate-900' : 'border-transparent text-slate-600 hover:bg-slate-100'}`}
                  aria-current={pageNumber === safePage ? 'page' : undefined}
                >
                  {pageNumber}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={safePage >= totalPages}
                className={`${pageButtonBase} border-transparent text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40`}
                title="다음 페이지 (오른쪽 방향키)"
                aria-label="다음 페이지"
              >
                <ChevronRight size={16} />
              </button>
            </nav>
          </footer>
        ) : null}
      </section>
      {selectedHistoryProduct ? (
        <ProductInventoryHistoryModal
          product={selectedHistoryProduct}
          onClose={() => setSelectedHistoryProduct(null)}
        />
      ) : null}
    </div>
  )
}
