'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Boxes,
  Database,
  ExternalLink,
  Link2,
  Loader2,
  PackageCheck,
  RefreshCw,
  Search,
} from 'lucide-react'
import type {
  SmartInventoryChannel,
  SmartInventoryChannelRow,
  SmartInventoryDashboardPayload,
  SmartInventoryMasterRow,
} from '@/lib/smartInventoryClient'

type FilterMode = 'all' | 'empty' | 'inbound' | 'unlinked'
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
  return 'text-slate-900'
}

function StatTile({
  icon,
  label,
  value,
  sub,
  tone = 'slate',
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  tone?: 'slate' | 'green' | 'blue' | 'orange'
}) {
  const toneClass =
    tone === 'green'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : tone === 'blue'
        ? 'bg-sky-50 text-sky-700 border-sky-100'
        : tone === 'orange'
          ? 'bg-orange-50 text-orange-700 border-orange-100'
          : 'bg-white text-slate-700 border-slate-200'

  return (
    <div className={`min-h-[96px] rounded-lg border p-4 shadow-sm ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] font-black text-slate-500">{label}</span>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/80 text-current shadow-sm">
          {icon}
        </span>
      </div>
      <div className="mt-3 text-[24px] font-black leading-none tracking-tight text-slate-950">{value}</div>
      {sub ? <div className="mt-2 text-[11px] font-bold text-slate-500">{sub}</div> : null}
    </div>
  )
}

function ProductImage({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-300">
        <Boxes size={18} />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className="h-12 w-12 rounded-lg border border-slate-200 bg-white object-cover"
      onError={() => setFailed(true)}
    />
  )
}

function LinkedProducts({ links }: { links: SmartInventoryMasterRow['linked'] }) {
  if (!links.length) return <span className="text-[12px] font-bold text-slate-400">연결 없음</span>

  return (
    <div className="flex max-w-[320px] flex-wrap gap-1.5">
      {links.slice(0, 4).map((link) => (
        <a
          key={`${link.channel}:${link.productKey}`}
          href={link.productUrl || '#'}
          target="_blank"
          rel="noreferrer"
          className={`inline-flex max-w-[150px] items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-black no-underline ${
            link.channel === 'naver'
              ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
              : 'border-sky-100 bg-sky-50 text-sky-700'
          } ${link.productUrl ? 'hover:brightness-95' : 'pointer-events-none'}`}
          title={link.name}
        >
          <span className="shrink-0">{channelLabel[link.channel]}</span>
          <span className="truncate">{link.multiplier > 1 ? `x${link.multiplier}` : link.name}</span>
          {link.productUrl ? <ExternalLink size={11} className="shrink-0" /> : null}
        </a>
      ))}
      {links.length > 4 ? (
        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500">
          +{links.length - 4}
        </span>
      ) : null}
    </div>
  )
}

function MasterTable({ rows }: { rows: SmartInventoryMasterRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[1180px] table-fixed border-collapse text-left text-[13px]">
        <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-500">
          <tr>
            <th className="w-[330px] px-4 py-3">상품</th>
            <th className="w-[90px] px-3 py-3 text-right">네이버</th>
            <th className="w-[90px] px-3 py-3 text-right">쿠팡</th>
            <th className="w-[90px] px-3 py-3 text-right">총재고</th>
            <th className="w-[90px] px-3 py-3 text-right">입고대기</th>
            <th className="w-[90px] px-3 py-3 text-right">오늘판매</th>
            <th className="w-[110px] px-3 py-3 text-right">재고원가</th>
            <th className="w-[340px] px-3 py-3">연결상품</th>
            <th className="w-[110px] px-3 py-3">갱신</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length ? (
            rows.map((row) => (
              <tr key={row.id} className="bg-white hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <ProductImage src={row.imageUrl} alt={row.name} />
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-black text-slate-950" title={row.name}>
                        {row.name || `마스터 #${row.id}`}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] font-bold text-slate-500">
                        <span>단가 {formatMoney(row.unitCost)}</span>
                        {row.memo ? <span className="truncate text-emerald-700">메모 {row.memo}</span> : null}
                      </div>
                    </div>
                  </div>
                </td>
                <td className={`px-3 py-3 text-right font-black tabular-nums ${stockTone(row.naverStock)}`}>
                  {formatNumber(row.naverStock)}
                </td>
                <td className={`px-3 py-3 text-right font-black tabular-nums ${stockTone(row.coupangStock)}`}>
                  {formatNumber(row.coupangStock)}
                </td>
                <td className={`px-3 py-3 text-right text-[15px] font-black tabular-nums ${stockTone(row.totalStock)}`}>
                  {formatNumber(row.totalStock)}
                </td>
                <td className="px-3 py-3 text-right font-black tabular-nums text-orange-700">
                  {formatNumber(row.totalInboundPending)}
                </td>
                <td className="px-3 py-3 text-right font-black tabular-nums text-slate-800">
                  {formatNumber(row.totalTodaySales)}
                </td>
                <td className="px-3 py-3 text-right font-black tabular-nums text-slate-800">
                  {formatMoney(row.stockCost)}
                </td>
                <td className="px-3 py-3">
                  <LinkedProducts links={row.linked} />
                </td>
                <td className="px-3 py-3 text-[12px] font-bold text-slate-500">
                  {formatDateTime(row.updatedAt || row.linked[0]?.syncedAt)}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={9} className="h-44 px-4 py-8 text-center text-[13px] font-bold text-slate-400">
                표시할 마스터 재고가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function UnlinkedTable({ rows }: { rows: SmartInventoryChannelRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[900px] table-fixed border-collapse text-left text-[13px]">
        <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-500">
          <tr>
            <th className="w-[110px] px-4 py-3">채널</th>
            <th className="w-[420px] px-3 py-3">상품</th>
            <th className="w-[110px] px-3 py-3 text-right">재고</th>
            <th className="w-[110px] px-3 py-3 text-right">오늘판매</th>
            <th className="w-[130px] px-3 py-3 text-right">판매가</th>
            <th className="w-[130px] px-3 py-3">수집</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length ? (
            rows.map((row) => (
              <tr key={`${row.channel}:${row.identityKey}`} className="bg-white hover:bg-slate-50">
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-md border px-2 py-1 text-[11px] font-black ${
                      row.channel === 'naver'
                        ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                        : 'border-sky-100 bg-sky-50 text-sky-700'
                    }`}
                  >
                    {channelLabel[row.channel]}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <ProductImage src={row.imageUrl} alt={row.name} />
                    <div className="min-w-0">
                      <a
                        href={row.productUrl || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className={`block truncate text-[14px] font-black text-slate-950 no-underline ${
                          row.productUrl ? 'hover:text-[#d9361b]' : 'pointer-events-none'
                        }`}
                        title={row.name}
                      >
                        {row.name || row.productKey}
                      </a>
                      <div className="mt-1 truncate text-[11px] font-bold text-slate-500">{row.identityKey}</div>
                    </div>
                  </div>
                </td>
                <td className={`px-3 py-3 text-right font-black tabular-nums ${stockTone(row.stock)}`}>{formatNumber(row.stock)}</td>
                <td className="px-3 py-3 text-right font-black tabular-nums text-slate-800">{formatNumber(row.todaySales)}</td>
                <td className="px-3 py-3 text-right font-black tabular-nums text-slate-800">{formatMoney(row.price)}</td>
                <td className="px-3 py-3 text-[12px] font-bold text-slate-500">{formatDateTime(row.syncedAt)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={6} className="h-44 px-4 py-8 text-center text-[13px] font-bold text-slate-400">
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

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/admin/inventory', { cache: 'no-store' })
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
    loadDashboard()
  }, [loadDashboard])

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

  const normalizedQuery = query.trim().toLowerCase()

  const filteredMasters = useMemo(() => {
    const rows = data?.rows || []
    return rows.filter((row) => {
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
      return true
    })
  }, [data?.rows, filter, normalizedQuery])

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
  const monitorLabel = data?.monitorSource === 'gist' ? 'Gist 터널' : data?.monitorSource === 'env' ? '고정 URL' : '미설정'

  return (
    <div className="space-y-5">
      <div className="sticky top-0 z-40 -mx-4 border-b border-slate-200 bg-[#F7F7F8]/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-[12px] font-black uppercase tracking-[0.18em] text-[#d9361b]">Smart Inventory</div>
            <h1 className="mt-1 text-[22px] font-black tracking-tight text-slate-950">재고관리</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-black text-slate-600">
              <Database size={16} />
              <span>{monitorLabel}</span>
              {healthStatus ? <span className="text-emerald-700">{healthStatus}</span> : null}
            </div>
            <button
              type="button"
              onClick={loadDashboard}
              disabled={loading || syncing}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              새로고침
            </button>
            <button
              type="button"
              onClick={handleSync}
              disabled={loading || syncing || data?.configured === false}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d9361b] bg-[#d9361b] px-4 text-[13px] font-black text-white shadow-sm transition hover:bg-[#c52f16] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {syncing ? <Loader2 size={16} className="animate-spin" /> : <PackageCheck size={16} />}
              라즈베리 동기화
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-bold text-red-700">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {data?.configured === false ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-bold text-amber-800">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>라즈베리 모니터 서버 주소를 확인하지 못했습니다. Gist 터널 또는 `SMARTINVENTORY_MONITOR_URL` 설정을 확인해 주세요.</span>
        </div>
      ) : null}

      {data?.warnings?.length ? (
        <div className="rounded-lg border border-amber-200 bg-white px-4 py-3 text-[12px] font-bold text-amber-800">
          {data.warnings.map((warning) => (
            <div key={warning}>{warning}</div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <StatTile icon={<Boxes size={17} />} label="마스터 상품" value={formatNumber(data?.summary.masterCount || 0)} sub={`연결 ${formatNumber(data?.summary.linkedCount || 0)}건`} />
        <StatTile icon={<PackageCheck size={17} />} label="총재고" value={formatNumber(data?.summary.totalStock || 0)} sub={`N ${formatNumber(data?.summary.naverStock || 0)} / C ${formatNumber(data?.summary.coupangStock || 0)}`} tone="blue" />
        <StatTile icon={<Database size={17} />} label="입고대기" value={formatNumber(data?.summary.totalInboundPending || 0)} sub="채널별 대기 합산" tone="orange" />
        <StatTile icon={<Link2 size={17} />} label="미연결" value={formatNumber(data?.summary.unlinkedProducts || 0)} sub={`N ${formatNumber(data?.unlinked.naver || 0)} / C ${formatNumber(data?.unlinked.coupang || 0)}`} />
        <StatTile icon={<PackageCheck size={17} />} label="오늘판매" value={formatNumber(data?.summary.todaySales || 0)} sub={formatMoney(data?.summary.todayRevenue || 0)} tone="green" />
        <StatTile icon={<Database size={17} />} label="재고원가" value={formatMoney(data?.summary.stockCost || 0)} sub={`조회 ${formatDateTime(data?.syncedAt)}`} />
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3">
          <Search size={16} className="shrink-0 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="상품명, 링크상품, 키 검색"
            className="h-10 min-w-0 flex-1 bg-transparent text-[13px] font-bold text-slate-900 outline-none placeholder:text-slate-400"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setFilter(option.value)
                  if (option.value !== 'unlinked') setTableMode('masters')
                  if (option.value === 'unlinked') setTableMode('unlinked')
                }}
                className={`h-8 rounded-md px-3 text-[12px] font-black transition ${
                  filter === option.value ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-600 hover:bg-white'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setTableMode('masters')}
              className={`h-8 rounded-md px-3 text-[12px] font-black transition ${
                tableMode === 'masters' ? 'bg-[#d9361b] text-white shadow-sm' : 'text-slate-600 hover:bg-white'
              }`}
            >
              마스터
            </button>
            <button
              type="button"
              onClick={() => setTableMode('unlinked')}
              className={`h-8 rounded-md px-3 text-[12px] font-black transition ${
                tableMode === 'unlinked' ? 'bg-[#d9361b] text-white shadow-sm' : 'text-slate-600 hover:bg-white'
              }`}
            >
              미연결
            </button>
          </div>
          <div className="text-[12px] font-black text-slate-500">{loading ? '불러오는 중' : `${formatNumber(activeRowsCount)}건`}</div>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-slate-200 bg-white text-[13px] font-black text-slate-500 shadow-sm">
          <Loader2 size={20} className="mr-2 animate-spin text-[#d9361b]" />
          라즈베리 재고를 불러오는 중입니다.
        </div>
      ) : tableMode === 'masters' ? (
        <MasterTable rows={filteredMasters} />
      ) : (
        <UnlinkedTable rows={filteredUnlinkedRows} />
      )}
    </div>
  )
}
