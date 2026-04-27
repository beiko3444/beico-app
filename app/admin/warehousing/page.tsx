'use client'

import { useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  ArrowLeftRight,
  Boxes,
  Calendar,
  CheckCircle2,
  Database,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Truck,
  X,
} from 'lucide-react'

type TabKey = 'overview' | 'goods' | 'stock' | 'warehousing' | 'delivery'

type OverviewResponse = {
  config: {
    apiUrl: string
    cstCd: string
    configured: boolean
    hasApiCd: boolean
    hasApiKey: boolean
    hasCstCd: boolean
  }
  connection: {
    ok: boolean
    message: string
  }
  localSummary: {
    totalProducts: number
    productsWithCode: number
    productsMissingCode: number
    lowStockProducts: number
    duplicateProductCodes: number
  }
  remoteSummary: {
    goodsCount: number
    stockRows: number
  } | null
  syncSummary: {
    totalProducts: number
    createCount: number
    updateCount: number
    syncedCount: number
    missingCodeCount: number
    duplicateCodeCount: number
  } | null
  stockSummary: {
    totalProducts: number
    matchedCount: number
    mismatchCount: number
    notRegisteredCount: number
    noStockRowCount: number
    missingCodeCount: number
    duplicateCodeCount: number
  } | null
  warnings: string[]
}

type GoodsPreviewItem = {
  productId: string
  name: string
  productCode: string | null
  barcode: string | null
  action: 'CREATE' | 'UPDATE' | 'SYNCED' | 'MISSING_CODE' | 'DUPLICATE_CODE'
  reason: string
  mismatchFields: string[]
  remoteGoodsName: string | null
  remoteUseYn: string | null
  remoteBarcode: string | null
  localUseYn: 'Y' | 'N'
}

type GoodsPreviewResponse = {
  summary: {
    totalProducts: number
    createCount: number
    updateCount: number
    syncedCount: number
    missingCodeCount: number
    duplicateCodeCount: number
  }
  items: GoodsPreviewItem[]
  remoteGoodsCount: number
}

type StockCompareItem = {
  productId: string
  name: string
  productCode: string | null
  status: 'MATCHED' | 'MISMATCH' | 'NOT_REGISTERED' | 'NO_STOCK_ROW' | 'MISSING_CODE' | 'DUPLICATE_CODE'
  reason: string
  localStock: number
  safetyStock: number
  remoteGoodsName: string | null
  remoteAvailableStock: number | null
  remoteTotalStock: number | null
  remoteBadStock: number | null
  diff: number | null
}

type StockCompareResponse = {
  summary: {
    totalProducts: number
    matchedCount: number
    mismatchCount: number
    notRegisteredCount: number
    noStockRowCount: number
    missingCodeCount: number
    duplicateCodeCount: number
  }
  items: StockCompareItem[]
  remoteGoodsCount: number
  remoteStockRows: number
}

type WarehousingItem = {
  slipNo: string
  ordDt: string
  inWay: string
  wrkStat: string
  wrkStatNm?: string
  parcelComp?: string
  parcelInvoiceNo?: string
  memo?: string
}

type WarehousingResponse = {
  items: WarehousingItem[]
  summary?: {
    total: number
    doneCount: number
    pendingCount: number
    cancelledCount: number
  }
}

type DeliveryItem = {
  slipNo: string
  ordNo: string
  ordDt: string
  status: string
  statusNm: string
  outDiv: string
  custNm: string
  invoiceNo: string | null
  parcelCd: string | null
  parcelNm: string | null
}

type DeliveryResponse = {
  items: DeliveryItem[]
  summary?: {
    total: number
    doneCount: number
    shortageCount: number
    cancelCount: number
    workingCount: number
  }
}

type GoodsSyncRunResponse = {
  summary: {
    selectedCount: number
    requestedCreateCount: number
    requestedUpdateCount: number
    createdCount: number
    updatedCount: number
    skippedCount: number
    errorCount: number
  }
  errors: Array<{
    action: 'CREATE' | 'UPDATE'
    codes: string[]
    message: string
  }>
}

type WarehousingFormState = {
  inWay: string
  ordDt: string
  parcelComp: string
  parcelInvoiceNo: string
  memo: string
  godCds: Array<{ cstGodCd: string; ordQty: string }>
}

type TabDefinition = {
  key: TabKey
  label: string
  description: string
  icon: LucideIcon
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  '1': { label: '입고요청', className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900' },
  '2': { label: '검수중', className: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900' },
  '3': { label: '검수완료', className: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900' },
  '4': { label: '입고완료', className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900' },
  '5': { label: '입고취소', className: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900' },
}

const DELIVERY_STATUS_MAP: Record<string, { label: string; className: string }> = {
  ORDER: { label: '출고요청', className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900' },
  WORKING: { label: '작업중', className: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900' },
  DONE: { label: '출고완료', className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900' },
  PARTDONE: { label: '부분출고', className: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900' },
  CANCEL: { label: '취소', className: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900' },
  SHORTAGE: { label: '재고부족', className: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900' },
}

const GOODS_ACTION_MAP: Record<GoodsPreviewItem['action'], { label: string; className: string }> = {
  CREATE: { label: '등록 필요', className: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900' },
  UPDATE: { label: '수정 필요', className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900' },
  SYNCED: { label: '동기화 완료', className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900' },
  MISSING_CODE: { label: '코드 없음', className: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900' },
  DUPLICATE_CODE: { label: '코드 중복', className: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-950/40 dark:text-fuchsia-300 dark:border-fuchsia-900' },
}

const STOCK_STATUS_MAP: Record<StockCompareItem['status'], { label: string; className: string }> = {
  MATCHED: { label: '일치', className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900' },
  MISMATCH: { label: '차이 발생', className: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900' },
  NOT_REGISTERED: { label: '상품 미등록', className: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900' },
  NO_STOCK_ROW: { label: '재고 행 없음', className: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900' },
  MISSING_CODE: { label: '코드 없음', className: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900' },
  DUPLICATE_CODE: { label: '코드 중복', className: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-950/40 dark:text-fuchsia-300 dark:border-fuchsia-900' },
}

const IN_WAY_MAP: Record<string, string> = {
  '01': '택배',
  '02': '차량',
}

const DELIVERY_OUT_DIV_MAP: Record<string, string> = {
  '1': '택배',
  '2': '차량배송',
}

const TABS: TabDefinition[] = [
  { key: 'overview', label: '개요', description: '연결 상태와 매핑 리스크', icon: ShieldCheck },
  { key: 'goods', label: '상품 동기화', description: '로컬 상품과 파스토 상품 비교', icon: Database },
  { key: 'stock', label: '재고 비교', description: '로컬 재고와 파스토 가용재고 비교', icon: ArrowLeftRight },
  { key: 'warehousing', label: '입고', description: '입고 요청과 입고 내역 조회', icon: Boxes },
  { key: 'delivery', label: '출고 조회', description: '출고 현황과 송장 확인', icon: Truck },
]

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload.error || payload.message || '요청 처리에 실패했습니다.')
  }

  return payload as T
}

function SummaryCard({ title, value, helper }: { title: string; value: string | number; helper: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-[#2a2a2a] dark:bg-[#171717]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">{title}</div>
      <div className="mt-3 text-2xl font-black text-gray-900 dark:text-white">{value}</div>
      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{helper}</div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-white/70 px-6 py-10 text-center text-sm text-gray-500 dark:border-[#333] dark:bg-[#171717] dark:text-gray-400">
      {message}
    </div>
  )
}

export default function WarehousingPage() {
  const now = new Date()
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [pageError, setPageError] = useState('')
  const [pageNotice, setPageNotice] = useState('')

  const [overview, setOverview] = useState<OverviewResponse | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(false)

  const [goodsPreview, setGoodsPreview] = useState<GoodsPreviewResponse | null>(null)
  const [goodsLoading, setGoodsLoading] = useState(false)
  const [goodsLoaded, setGoodsLoaded] = useState(false)
  const [goodsSyncing, setGoodsSyncing] = useState(false)
  const [goodsSyncResult, setGoodsSyncResult] = useState<GoodsSyncRunResponse | null>(null)

  const [stockCompare, setStockCompare] = useState<StockCompareResponse | null>(null)
  const [stockLoading, setStockLoading] = useState(false)
  const [stockLoaded, setStockLoaded] = useState(false)

  const [warehousingItems, setWarehousingItems] = useState<WarehousingItem[]>([])
  const [warehousingSummary, setWarehousingSummary] = useState<WarehousingResponse['summary'] | null>(null)
  const [warehousingLoading, setWarehousingLoading] = useState(false)
  const [warehousingLoaded, setWarehousingLoaded] = useState(false)
  const [showWarehousingForm, setShowWarehousingForm] = useState(false)
  const [warehousingCreating, setWarehousingCreating] = useState(false)
  const [warehousingStartDate, setWarehousingStartDate] = useState(formatDate(thirtyDaysAgo))
  const [warehousingEndDate, setWarehousingEndDate] = useState(formatDate(now))
  const [warehousingForm, setWarehousingForm] = useState<WarehousingFormState>({
    inWay: '01',
    ordDt: formatDate(now),
    parcelComp: '',
    parcelInvoiceNo: '',
    memo: '',
    godCds: [{ cstGodCd: '', ordQty: '1' }],
  })

  const [deliveryItems, setDeliveryItems] = useState<DeliveryItem[]>([])
  const [deliverySummary, setDeliverySummary] = useState<DeliveryResponse['summary'] | null>(null)
  const [deliveryLoading, setDeliveryLoading] = useState(false)
  const [deliveryLoaded, setDeliveryLoaded] = useState(false)
  const [deliveryStartDate, setDeliveryStartDate] = useState(formatDate(thirtyDaysAgo))
  const [deliveryEndDate, setDeliveryEndDate] = useState(formatDate(now))
  const [deliveryStatus, setDeliveryStatus] = useState('ALL')
  const [deliveryOutDiv, setDeliveryOutDiv] = useState('1')

  function clearFeedback() {
    setPageError('')
    setPageNotice('')
  }

  async function loadOverview() {
    setOverviewLoading(true)
    setPageError('')
    try {
      const data = await requestJson<OverviewResponse>('/api/admin/fassto/overview')
      setOverview(data)
    } catch (error) {
      setPageError(error instanceof Error ? error.message : '개요를 불러오지 못했습니다.')
    } finally {
      setOverviewLoading(false)
    }
  }

  async function loadGoodsPreview() {
    setGoodsLoading(true)
    setPageError('')
    try {
      const data = await requestJson<GoodsPreviewResponse>('/api/admin/fassto/goods/sync')
      setGoodsPreview(data)
    } catch (error) {
      setPageError(error instanceof Error ? error.message : '상품 동기화 미리보기를 불러오지 못했습니다.')
    } finally {
      setGoodsLoading(false)
      setGoodsLoaded(true)
    }
  }

  async function runGoodsSync() {
    setGoodsSyncing(true)
    clearFeedback()
    try {
      const result = await requestJson<GoodsSyncRunResponse>('/api/admin/fassto/goods/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      setGoodsSyncResult(result)
      setPageNotice(`상품 동기화를 실행했습니다. 등록 ${result.summary.createdCount}건, 수정 ${result.summary.updatedCount}건입니다.`)
      await Promise.all([loadOverview(), loadGoodsPreview(), loadStockComparison()])
    } catch (error) {
      setPageError(error instanceof Error ? error.message : '상품 동기화 실행에 실패했습니다.')
    } finally {
      setGoodsSyncing(false)
    }
  }

  async function loadStockComparison() {
    setStockLoading(true)
    setPageError('')
    try {
      const data = await requestJson<StockCompareResponse>('/api/admin/fassto/stock/compare')
      setStockCompare(data)
    } catch (error) {
      setPageError(error instanceof Error ? error.message : '재고 비교 결과를 불러오지 못했습니다.')
    } finally {
      setStockLoading(false)
      setStockLoaded(true)
    }
  }

  async function loadWarehousing() {
    setWarehousingLoading(true)
    setPageError('')
    try {
      const data = await requestJson<WarehousingResponse>(`/api/admin/fassto/warehousing?start=${warehousingStartDate}&end=${warehousingEndDate}`)
      setWarehousingItems(data.items || [])
      setWarehousingSummary(data.summary || null)
    } catch (error) {
      setPageError(error instanceof Error ? error.message : '입고 내역을 불러오지 못했습니다.')
      setWarehousingItems([])
      setWarehousingSummary(null)
    } finally {
      setWarehousingLoading(false)
      setWarehousingLoaded(true)
    }
  }

  async function loadDelivery() {
    setDeliveryLoading(true)
    setPageError('')
    try {
      const data = await requestJson<DeliveryResponse>(
        `/api/admin/fassto/delivery?start=${deliveryStartDate}&end=${deliveryEndDate}&status=${deliveryStatus}&outDiv=${deliveryOutDiv}`
      )
      setDeliveryItems(data.items || [])
      setDeliverySummary(data.summary || null)
    } catch (error) {
      setPageError(error instanceof Error ? error.message : '출고 현황을 불러오지 못했습니다.')
      setDeliveryItems([])
      setDeliverySummary(null)
    } finally {
      setDeliveryLoading(false)
      setDeliveryLoaded(true)
    }
  }

  useEffect(() => {
    void loadOverview()
  }, [])

  useEffect(() => {
    if (activeTab === 'goods' && !goodsLoaded && !goodsLoading) {
      void loadGoodsPreview()
    }
    if (activeTab === 'stock' && !stockLoaded && !stockLoading) {
      void loadStockComparison()
    }
    if (activeTab === 'warehousing' && !warehousingLoaded && !warehousingLoading) {
      void loadWarehousing()
    }
    if (activeTab === 'delivery' && !deliveryLoaded && !deliveryLoading) {
      void loadDelivery()
    }
  }, [
    activeTab,
    goodsLoaded,
    goodsLoading,
    stockLoaded,
    stockLoading,
    warehousingLoaded,
    warehousingLoading,
    deliveryLoaded,
    deliveryLoading,
  ])

  function updateWarehousingField<K extends keyof WarehousingFormState>(field: K, value: WarehousingFormState[K]) {
    setWarehousingForm((current) => ({ ...current, [field]: value }))
  }

  function addWarehousingGoodsRow() {
    setWarehousingForm((current) => ({
      ...current,
      godCds: [...current.godCds, { cstGodCd: '', ordQty: '1' }],
    }))
  }

  function removeWarehousingGoodsRow(index: number) {
    setWarehousingForm((current) => ({
      ...current,
      godCds: current.godCds.filter((_, currentIndex) => currentIndex !== index),
    }))
  }

  function updateWarehousingGoodsRow(index: number, field: 'cstGodCd' | 'ordQty', value: string) {
    setWarehousingForm((current) => ({
      ...current,
      godCds: current.godCds.map((item, currentIndex) =>
        currentIndex === index ? { ...item, [field]: value } : item
      ),
    }))
  }

  async function handleCreateWarehousing(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setWarehousingCreating(true)
    clearFeedback()

    try {
      const payload = {
        inWay: warehousingForm.inWay,
        ordDt: warehousingForm.ordDt,
        parcelComp: warehousingForm.parcelComp || undefined,
        parcelInvoiceNo: warehousingForm.parcelInvoiceNo || undefined,
        memo: warehousingForm.memo || undefined,
        godCds: warehousingForm.godCds
          .filter((item) => item.cstGodCd.trim())
          .map((item) => ({
            cstGodCd: item.cstGodCd.trim().toUpperCase(),
            ordQty: Math.max(1, Number(item.ordQty) || 1),
          })),
      }

      if (payload.godCds.length === 0) {
        throw new Error('입고할 상품코드를 최소 1개 입력해주세요.')
      }

      await requestJson('/api/admin/fassto/warehousing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      setPageNotice('입고 요청을 등록했습니다.')
      setShowWarehousingForm(false)
      setWarehousingForm({
        inWay: '01',
        ordDt: formatDate(new Date()),
        parcelComp: '',
        parcelInvoiceNo: '',
        memo: '',
        godCds: [{ cstGodCd: '', ordQty: '1' }],
      })
      await loadWarehousing()
    } catch (error) {
      setPageError(error instanceof Error ? error.message : '입고 요청 등록에 실패했습니다.')
    } finally {
      setWarehousingCreating(false)
    }
  }

  const currentTab = TABS.find((tab) => tab.key === activeTab) || TABS[0]

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-gray-200 bg-white px-6 py-6 shadow-sm dark:border-[#2a2a2a] dark:bg-[#121212]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300">
              Fassto Fulfillment Console
            </div>
            <h1 className="mt-3 text-2xl font-black tracking-tight text-gray-900 dark:text-white">물류관리</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500 dark:text-gray-400">
              파스토 상품 마스터, 재고 비교, 입고 요청, 출고 조회를 한 흐름으로 정리했습니다. 먼저 상품코드와 재고 차이를 잡고,
              그 다음 입고와 출고를 운영하면 훨씬 안정적으로 굴러갑니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void loadOverview()
              if (activeTab === 'goods') void loadGoodsPreview()
              if (activeTab === 'stock') void loadStockComparison()
              if (activeTab === 'warehousing') void loadWarehousing()
              if (activeTab === 'delivery') void loadDelivery()
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          >
            <RefreshCw size={16} />
            전체 새로고침
          </button>
        </div>
      </div>

      {pageError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {pageError}
        </div>
      ) : null}

      {pageNotice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          {pageNotice}
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-5">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const active = tab.key === activeTab
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cx(
                'rounded-2xl border px-4 py-4 text-left transition',
                active
                  ? 'border-orange-500 bg-orange-50 shadow-sm dark:border-orange-500 dark:bg-orange-950/30'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 dark:border-[#2a2a2a] dark:bg-[#171717] dark:hover:border-[#3a3a3a] dark:hover:bg-[#1c1c1c]'
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cx(
                    'flex h-10 w-10 items-center justify-center rounded-2xl',
                    active ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 dark:bg-[#232323] dark:text-gray-300'
                  )}
                >
                  <Icon size={18} />
                </div>
                <div>
                  <div className="text-sm font-black text-gray-900 dark:text-white">{tab.label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{tab.description}</div>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm dark:border-[#2a2a2a] dark:bg-[#121212]">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">Current Section</div>
            <h2 className="mt-2 text-xl font-black text-gray-900 dark:text-white">{currentTab.label}</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{currentTab.description}</p>
          </div>
        </div>

        {activeTab === 'overview' ? (
          overviewLoading && !overview ? (
            <div className="flex items-center justify-center py-16 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 size={18} className="mr-2 animate-spin" /> 개요를 불러오는 중입니다.
            </div>
          ) : overview ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <SummaryCard title="로컬 상품" value={overview.localSummary.totalProducts} helper="물류 비교 대상 전체 상품 수" />
                <SummaryCard title="상품코드 준비" value={overview.localSummary.productsWithCode} helper="파스토 코드(cstGodCd) 후보가 있는 상품" />
                <SummaryCard title="안전재고 경고" value={overview.localSummary.lowStockProducts} helper="현재 재고가 안전재고 이하인 상품" />
                <SummaryCard title="코드 중복" value={overview.localSummary.duplicateProductCodes} helper="같은 상품코드를 공유하는 로컬 상품 수" />
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-[#2a2a2a] dark:bg-[#171717]">
                  <div className="flex items-center gap-2 text-sm font-black text-gray-900 dark:text-white">
                    {overview.connection.ok ? <CheckCircle2 size={16} className="text-emerald-500" /> : <AlertTriangle size={16} className="text-orange-500" />}
                    연결 상태
                  </div>
                  <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-400">{overview.connection.message}</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-[#2a2a2a] dark:bg-[#111]">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">API URL</div>
                      <div className="mt-2 break-all text-sm font-semibold text-gray-900 dark:text-white">{overview.config.apiUrl}</div>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-[#2a2a2a] dark:bg-[#111]">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">고객사 코드</div>
                      <div className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">{overview.config.cstCd || '미설정'}</div>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-[#2a2a2a] dark:bg-[#111]">
                      <div className="text-xs text-gray-500 dark:text-gray-400">상품 응답</div>
                      <div className="mt-1 text-lg font-black text-gray-900 dark:text-white">{overview.remoteSummary?.goodsCount ?? '-'}</div>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-[#2a2a2a] dark:bg-[#111]">
                      <div className="text-xs text-gray-500 dark:text-gray-400">재고 응답</div>
                      <div className="mt-1 text-lg font-black text-gray-900 dark:text-white">{overview.remoteSummary?.stockRows ?? '-'}</div>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-[#2a2a2a] dark:bg-[#111]">
                      <div className="text-xs text-gray-500 dark:text-gray-400">환경변수 준비</div>
                      <div className="mt-1 text-lg font-black text-gray-900 dark:text-white">{overview.config.configured ? '완료' : '미완료'}</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-[#2a2a2a] dark:bg-[#171717]">
                  <div className="flex items-center gap-2 text-sm font-black text-gray-900 dark:text-white">
                    <Package size={16} className="text-orange-500" />
                    바로 조치할 항목
                  </div>
                  <div className="mt-4 space-y-3 text-sm text-gray-600 dark:text-gray-400">
                    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-[#2a2a2a] dark:bg-[#111]">
                      <div className="font-bold text-gray-900 dark:text-white">상품 동기화 후보</div>
                      <div className="mt-1">등록 {overview.syncSummary?.createCount ?? 0}건, 수정 {overview.syncSummary?.updateCount ?? 0}건</div>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-[#2a2a2a] dark:bg-[#111]">
                      <div className="font-bold text-gray-900 dark:text-white">재고 차이</div>
                      <div className="mt-1">불일치 {overview.stockSummary?.mismatchCount ?? 0}건, 미등록 {overview.stockSummary?.notRegisteredCount ?? 0}건</div>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-[#2a2a2a] dark:bg-[#111]">
                      <div className="font-bold text-gray-900 dark:text-white">상품코드 미정리</div>
                      <div className="mt-1">코드 없음 {overview.localSummary.productsMissingCode}건, 코드 중복 {overview.localSummary.duplicateProductCodes}건</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-[#2a2a2a] dark:bg-[#171717]">
                <div className="text-sm font-black text-gray-900 dark:text-white">운영 메모</div>
                <div className="mt-4 space-y-2">
                  {overview.warnings.length > 0 ? (
                    overview.warnings.map((warning) => (
                      <div key={warning} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 dark:border-[#2a2a2a] dark:bg-[#111] dark:text-gray-400">
                        {warning}
                      </div>
                    ))
                  ) : (
                    <EmptyState message="현재 표시할 경고가 없습니다." />
                  )}
                </div>
              </div>
            </div>
          ) : (
            <EmptyState message="개요 데이터가 아직 없습니다." />
          )
        ) : null}

        {activeTab === 'goods' ? (
          <div className="space-y-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="grid flex-1 gap-4 md:grid-cols-4">
                <SummaryCard title="등록 필요" value={goodsPreview?.summary.createCount ?? 0} helper="파스토에 아직 없는 상품" />
                <SummaryCard title="수정 필요" value={goodsPreview?.summary.updateCount ?? 0} helper="이름/바코드/사용여부가 다른 상품" />
                <SummaryCard title="동기화 완료" value={goodsPreview?.summary.syncedCount ?? 0} helper="기본 마스터가 일치하는 상품" />
                <SummaryCard title="정리 필요" value={(goodsPreview?.summary.missingCodeCount ?? 0) + (goodsPreview?.summary.duplicateCodeCount ?? 0)} helper="자동 동기화 전 먼저 손봐야 하는 상품" />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void loadGoodsPreview()}
                  disabled={goodsLoading}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-[#333] dark:text-gray-200 dark:hover:bg-[#1c1c1c]"
                >
                  {goodsLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  미리보기 새로고침
                </button>
                <button
                  type="button"
                  onClick={() => void runGoodsSync()}
                  disabled={goodsSyncing || !goodsPreview || (goodsPreview.summary.createCount === 0 && goodsPreview.summary.updateCount === 0)}
                  className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {goodsSyncing ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
                  상품 동기화 실행
                </button>
              </div>
            </div>

            {goodsSyncResult ? (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-[#2a2a2a] dark:bg-[#171717]">
                <div className="text-sm font-black text-gray-900 dark:text-white">최근 실행 결과</div>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-[#2a2a2a] dark:bg-[#111]">
                    <div className="text-gray-500 dark:text-gray-400">등록 성공</div>
                    <div className="mt-1 text-xl font-black text-gray-900 dark:text-white">{goodsSyncResult.summary.createdCount}</div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-[#2a2a2a] dark:bg-[#111]">
                    <div className="text-gray-500 dark:text-gray-400">수정 성공</div>
                    <div className="mt-1 text-xl font-black text-gray-900 dark:text-white">{goodsSyncResult.summary.updatedCount}</div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-[#2a2a2a] dark:bg-[#111]">
                    <div className="text-gray-500 dark:text-gray-400">건너뜀</div>
                    <div className="mt-1 text-xl font-black text-gray-900 dark:text-white">{goodsSyncResult.summary.skippedCount}</div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-[#2a2a2a] dark:bg-[#111]">
                    <div className="text-gray-500 dark:text-gray-400">오류 배치</div>
                    <div className="mt-1 text-xl font-black text-gray-900 dark:text-white">{goodsSyncResult.summary.errorCount}</div>
                  </div>
                </div>
                {goodsSyncResult.errors.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {goodsSyncResult.errors.map((item, index) => (
                      <div key={`${item.action}-${index}`} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                        <div className="font-bold">{item.action === 'CREATE' ? '등록' : '수정'} 실패</div>
                        <div className="mt-1 break-all">{item.codes.join(', ')}</div>
                        <div className="mt-1">{item.message}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {goodsLoading && !goodsPreview ? (
              <div className="flex items-center justify-center py-16 text-sm text-gray-500 dark:text-gray-400">
                <Loader2 size={18} className="mr-2 animate-spin" /> 상품 동기화 후보를 계산하는 중입니다.
              </div>
            ) : goodsPreview ? (
              <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-[#2a2a2a]">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-[#2a2a2a]">
                    <thead className="bg-gray-50 dark:bg-[#171717]">
                      <tr>
                        <th className="px-4 py-3 text-left font-bold text-gray-500 dark:text-gray-400">상품코드</th>
                        <th className="px-4 py-3 text-left font-bold text-gray-500 dark:text-gray-400">상품명</th>
                        <th className="px-4 py-3 text-left font-bold text-gray-500 dark:text-gray-400">상태</th>
                        <th className="px-4 py-3 text-left font-bold text-gray-500 dark:text-gray-400">사유</th>
                        <th className="px-4 py-3 text-left font-bold text-gray-500 dark:text-gray-400">파스토 상품명</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white dark:divide-[#2a2a2a] dark:bg-[#121212]">
                      {goodsPreview.items.map((item) => {
                        const badge = GOODS_ACTION_MAP[item.action]
                        return (
                          <tr key={item.productId} className="align-top">
                            <td className="px-4 py-4 font-mono text-xs text-gray-700 dark:text-gray-300">{item.productCode || '-'}</td>
                            <td className="px-4 py-4">
                              <div className="font-semibold text-gray-900 dark:text-white">{item.name}</div>
                              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">바코드 {item.barcode || '-'} / 사용 {item.localUseYn}</div>
                            </td>
                            <td className="px-4 py-4">
                              <span className={cx('inline-flex rounded-full border px-2.5 py-1 text-xs font-bold', badge.className)}>{badge.label}</span>
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">{item.reason}</td>
                            <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">
                              {item.remoteGoodsName ? (
                                <>
                                  <div>{item.remoteGoodsName}</div>
                                  <div className="mt-1 text-xs">바코드 {item.remoteBarcode || '-'} / 사용 {item.remoteUseYn || '-'}</div>
                                </>
                              ) : (
                                '-'
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <EmptyState message="상품 동기화 미리보기를 아직 불러오지 않았습니다." />
            )}
          </div>
        ) : null}

        {activeTab === 'stock' ? (
          <div className="space-y-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="grid flex-1 gap-4 md:grid-cols-4">
                <SummaryCard title="재고 일치" value={stockCompare?.summary.matchedCount ?? 0} helper="로컬과 파스토 가용재고가 같은 상품" />
                <SummaryCard title="재고 차이" value={stockCompare?.summary.mismatchCount ?? 0} helper="조정 또는 동기화가 필요한 상품" />
                <SummaryCard title="상품 미등록" value={stockCompare?.summary.notRegisteredCount ?? 0} helper="파스토 상품 마스터부터 먼저 등록해야 하는 상품" />
                <SummaryCard title="비교 불가" value={(stockCompare?.summary.missingCodeCount ?? 0) + (stockCompare?.summary.duplicateCodeCount ?? 0)} helper="코드가 없거나 중복인 상품" />
              </div>
              <button
                type="button"
                onClick={() => void loadStockComparison()}
                disabled={stockLoading}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-[#333] dark:text-gray-200 dark:hover:bg-[#1c1c1c]"
              >
                {stockLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                재고 비교 새로고침
              </button>
            </div>

            {stockLoading && !stockCompare ? (
              <div className="flex items-center justify-center py-16 text-sm text-gray-500 dark:text-gray-400">
                <Loader2 size={18} className="mr-2 animate-spin" /> 재고 차이를 계산하는 중입니다.
              </div>
            ) : stockCompare ? (
              <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-[#2a2a2a]">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-[#2a2a2a]">
                    <thead className="bg-gray-50 dark:bg-[#171717]">
                      <tr>
                        <th className="px-4 py-3 text-left font-bold text-gray-500 dark:text-gray-400">상품</th>
                        <th className="px-4 py-3 text-right font-bold text-gray-500 dark:text-gray-400">로컬 재고</th>
                        <th className="px-4 py-3 text-right font-bold text-gray-500 dark:text-gray-400">파스토 가용</th>
                        <th className="px-4 py-3 text-right font-bold text-gray-500 dark:text-gray-400">차이</th>
                        <th className="px-4 py-3 text-left font-bold text-gray-500 dark:text-gray-400">상태</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white dark:divide-[#2a2a2a] dark:bg-[#121212]">
                      {stockCompare.items.map((item) => {
                        const badge = STOCK_STATUS_MAP[item.status]
                        const diffClass = item.diff === null ? 'text-gray-400' : item.diff === 0 ? 'text-emerald-600 dark:text-emerald-400' : item.diff > 0 ? 'text-sky-600 dark:text-sky-400' : 'text-orange-600 dark:text-orange-400'
                        return (
                          <tr key={item.productId} className="align-top">
                            <td className="px-4 py-4">
                              <div className="font-semibold text-gray-900 dark:text-white">{item.name}</div>
                              <div className="mt-1 font-mono text-xs text-gray-500 dark:text-gray-400">{item.productCode || '-'}</div>
                              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.reason}</div>
                            </td>
                            <td className="px-4 py-4 text-right font-semibold text-gray-900 dark:text-white">{item.localStock}</td>
                            <td className="px-4 py-4 text-right text-gray-700 dark:text-gray-300">{item.remoteAvailableStock ?? '-'}</td>
                            <td className={cx('px-4 py-4 text-right font-black', diffClass)}>{item.diff === null ? '-' : item.diff > 0 ? `+${item.diff}` : item.diff}</td>
                            <td className="px-4 py-4">
                              <span className={cx('inline-flex rounded-full border px-2.5 py-1 text-xs font-bold', badge.className)}>{badge.label}</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <EmptyState message="재고 비교 데이터가 아직 없습니다." />
            )}
          </div>
        ) : null}

        {activeTab === 'warehousing' ? (
          <div className="space-y-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="grid flex-1 gap-4 md:grid-cols-4">
                <SummaryCard title="전체 입고" value={warehousingSummary?.total ?? warehousingItems.length} helper="조회 기간 내 입고 요청 건수" />
                <SummaryCard title="진행중" value={warehousingSummary?.pendingCount ?? 0} helper="입고요청, 검수중, 검수완료 포함" />
                <SummaryCard title="완료" value={warehousingSummary?.doneCount ?? 0} helper="입고완료 상태" />
                <SummaryCard title="취소" value={warehousingSummary?.cancelledCount ?? 0} helper="입고취소 상태" />
              </div>
              <button
                type="button"
                onClick={() => setShowWarehousingForm((current) => !current)}
                className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-orange-600"
              >
                <Plus size={16} />
                입고 요청 등록
              </button>
            </div>

            {showWarehousingForm ? (
              <form onSubmit={handleCreateWarehousing} className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-[#2a2a2a] dark:bg-[#171717]">
                <div className="flex items-center gap-2 text-sm font-black text-gray-900 dark:text-white">
                  <Boxes size={16} className="text-orange-500" /> 입고 요청 작성
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <label className="space-y-2 text-sm">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">입고방법</span>
                    <select
                      value={warehousingForm.inWay}
                      onChange={(event) => updateWarehousingField('inWay', event.target.value)}
                      className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none dark:border-[#333] dark:bg-[#121212] dark:text-white"
                    >
                      <option value="01">택배</option>
                      <option value="02">차량</option>
                    </select>
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">요청일자</span>
                    <input
                      type="date"
                      value={warehousingForm.ordDt}
                      onChange={(event) => updateWarehousingField('ordDt', event.target.value)}
                      className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none dark:border-[#333] dark:bg-[#121212] dark:text-white"
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">택배사</span>
                    <input
                      type="text"
                      value={warehousingForm.parcelComp}
                      onChange={(event) => updateWarehousingField('parcelComp', event.target.value)}
                      className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none dark:border-[#333] dark:bg-[#121212] dark:text-white"
                      placeholder="예: CJ대한통운"
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">송장번호</span>
                    <input
                      type="text"
                      value={warehousingForm.parcelInvoiceNo}
                      onChange={(event) => updateWarehousingField('parcelInvoiceNo', event.target.value)}
                      className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none dark:border-[#333] dark:bg-[#121212] dark:text-white"
                      placeholder="선택 입력"
                    />
                  </label>
                </div>

                <label className="mt-4 block space-y-2 text-sm">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">메모</span>
                  <input
                    type="text"
                    value={warehousingForm.memo}
                    onChange={(event) => updateWarehousingField('memo', event.target.value)}
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none dark:border-[#333] dark:bg-[#121212] dark:text-white"
                    placeholder="센터 전달 메모"
                  />
                </label>

                <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-4 dark:border-[#2a2a2a] dark:bg-[#121212]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-gray-900 dark:text-white">입고 상품</div>
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">상품코드(cstGodCd)와 수량을 입력하세요.</div>
                    </div>
                    <button
                      type="button"
                      onClick={addWarehousingGoodsRow}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-50 dark:border-[#333] dark:text-gray-200 dark:hover:bg-[#1c1c1c]"
                    >
                      <Plus size={14} /> 상품 추가
                    </button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {warehousingForm.godCds.map((item, index) => (
                      <div key={`${item.cstGodCd}-${index}`} className="grid gap-3 md:grid-cols-[1fr_120px_auto]">
                        <input
                          type="text"
                          value={item.cstGodCd}
                          onChange={(event) => updateWarehousingGoodsRow(index, 'cstGodCd', event.target.value)}
                          className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-mono outline-none dark:border-[#333] dark:bg-[#0f0f0f] dark:text-white"
                          placeholder="상품코드 (예: BEICO-001)"
                        />
                        <input
                          type="number"
                          min={1}
                          value={item.ordQty}
                          onChange={(event) => updateWarehousingGoodsRow(index, 'ordQty', event.target.value)}
                          className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none dark:border-[#333] dark:bg-[#0f0f0f] dark:text-white"
                          placeholder="수량"
                        />
                        <button
                          type="button"
                          onClick={() => removeWarehousingGoodsRow(index)}
                          disabled={warehousingForm.godCds.length === 1}
                          className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 px-3 text-sm font-bold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#333] dark:text-gray-300 dark:hover:bg-[#1c1c1c]"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowWarehousingForm(false)}
                    className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50 dark:border-[#333] dark:text-gray-200 dark:hover:bg-[#1c1c1c]"
                  >
                    닫기
                  </button>
                  <button
                    type="submit"
                    disabled={warehousingCreating}
                    className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-orange-600 disabled:opacity-50"
                  >
                    {warehousingCreating ? <Loader2 size={16} className="animate-spin" /> : <Boxes size={16} />}
                    입고 요청 저장
                  </button>
                </div>
              </form>
            ) : null}

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-[#2a2a2a] dark:bg-[#171717]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-300">
                  <Calendar size={16} className="text-orange-500" /> 조회 기간
                </div>
                <input
                  type="date"
                  value={warehousingStartDate}
                  onChange={(event) => setWarehousingStartDate(event.target.value)}
                  className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none dark:border-[#333] dark:bg-[#121212] dark:text-white"
                />
                <input
                  type="date"
                  value={warehousingEndDate}
                  onChange={(event) => setWarehousingEndDate(event.target.value)}
                  className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none dark:border-[#333] dark:bg-[#121212] dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => void loadWarehousing()}
                  disabled={warehousingLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                >
                  {warehousingLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                  입고 조회
                </button>
              </div>
            </div>

            {warehousingLoading && warehousingItems.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-sm text-gray-500 dark:text-gray-400">
                <Loader2 size={18} className="mr-2 animate-spin" /> 입고 내역을 불러오는 중입니다.
              </div>
            ) : warehousingItems.length > 0 ? (
              <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-[#2a2a2a]">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-[#2a2a2a]">
                    <thead className="bg-gray-50 dark:bg-[#171717]">
                      <tr>
                        <th className="px-4 py-3 text-left font-bold text-gray-500 dark:text-gray-400">전표번호</th>
                        <th className="px-4 py-3 text-left font-bold text-gray-500 dark:text-gray-400">요청일</th>
                        <th className="px-4 py-3 text-left font-bold text-gray-500 dark:text-gray-400">입고방법</th>
                        <th className="px-4 py-3 text-left font-bold text-gray-500 dark:text-gray-400">상태</th>
                        <th className="px-4 py-3 text-left font-bold text-gray-500 dark:text-gray-400">택배사</th>
                        <th className="px-4 py-3 text-left font-bold text-gray-500 dark:text-gray-400">송장번호</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white dark:divide-[#2a2a2a] dark:bg-[#121212]">
                      {warehousingItems.map((item) => {
                        const badge = STATUS_MAP[item.wrkStat] || { label: item.wrkStatNm || item.wrkStat, className: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-[#232323] dark:text-gray-300 dark:border-[#333]' }
                        return (
                          <tr key={item.slipNo}>
                            <td className="px-4 py-4 font-mono text-xs text-gray-700 dark:text-gray-300">{item.slipNo}</td>
                            <td className="px-4 py-4 text-gray-700 dark:text-gray-300">{item.ordDt}</td>
                            <td className="px-4 py-4 text-gray-700 dark:text-gray-300">{IN_WAY_MAP[item.inWay] || item.inWay}</td>
                            <td className="px-4 py-4">
                              <span className={cx('inline-flex rounded-full border px-2.5 py-1 text-xs font-bold', badge.className)}>{badge.label}</span>
                            </td>
                            <td className="px-4 py-4 text-gray-700 dark:text-gray-300">{item.parcelComp || '-'}</td>
                            <td className="px-4 py-4 text-gray-700 dark:text-gray-300">{item.parcelInvoiceNo || '-'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <EmptyState message="조회 기간에 해당하는 입고 내역이 없습니다." />
            )}
          </div>
        ) : null}

        {activeTab === 'delivery' ? (
          <div className="space-y-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="grid flex-1 gap-4 md:grid-cols-4">
                <SummaryCard title="전체 출고" value={deliverySummary?.total ?? deliveryItems.length} helper="조회 기간 내 출고 현황" />
                <SummaryCard title="진행중" value={deliverySummary?.workingCount ?? 0} helper="출고요청 또는 작업중" />
                <SummaryCard title="완료" value={deliverySummary?.doneCount ?? 0} helper="출고완료 건" />
                <SummaryCard title="예외" value={(deliverySummary?.shortageCount ?? 0) + (deliverySummary?.cancelCount ?? 0)} helper="재고부족 또는 취소 건" />
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-[#2a2a2a] dark:bg-[#171717]">
              <div className="grid gap-3 xl:grid-cols-[auto_auto_auto_auto_auto]">
                <input
                  type="date"
                  value={deliveryStartDate}
                  onChange={(event) => setDeliveryStartDate(event.target.value)}
                  className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none dark:border-[#333] dark:bg-[#121212] dark:text-white"
                />
                <input
                  type="date"
                  value={deliveryEndDate}
                  onChange={(event) => setDeliveryEndDate(event.target.value)}
                  className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none dark:border-[#333] dark:bg-[#121212] dark:text-white"
                />
                <select
                  value={deliveryStatus}
                  onChange={(event) => setDeliveryStatus(event.target.value)}
                  className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none dark:border-[#333] dark:bg-[#121212] dark:text-white"
                >
                  <option value="ALL">전체 상태</option>
                  <option value="ORDER">출고요청</option>
                  <option value="WORKING">작업중</option>
                  <option value="DONE">출고완료</option>
                  <option value="PARTDONE">부분출고</option>
                  <option value="CANCEL">취소</option>
                  <option value="SHORTAGE">재고부족</option>
                </select>
                <select
                  value={deliveryOutDiv}
                  onChange={(event) => setDeliveryOutDiv(event.target.value)}
                  className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none dark:border-[#333] dark:bg-[#121212] dark:text-white"
                >
                  <option value="1">택배</option>
                  <option value="2">차량배송</option>
                </select>
                <button
                  type="button"
                  onClick={() => void loadDelivery()}
                  disabled={deliveryLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                >
                  {deliveryLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                  출고 조회
                </button>
              </div>
            </div>

            {deliveryLoading && deliveryItems.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-sm text-gray-500 dark:text-gray-400">
                <Loader2 size={18} className="mr-2 animate-spin" /> 출고 현황을 불러오는 중입니다.
              </div>
            ) : deliveryItems.length > 0 ? (
              <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-[#2a2a2a]">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-[#2a2a2a]">
                    <thead className="bg-gray-50 dark:bg-[#171717]">
                      <tr>
                        <th className="px-4 py-3 text-left font-bold text-gray-500 dark:text-gray-400">전표번호</th>
                        <th className="px-4 py-3 text-left font-bold text-gray-500 dark:text-gray-400">주문번호</th>
                        <th className="px-4 py-3 text-left font-bold text-gray-500 dark:text-gray-400">주문일</th>
                        <th className="px-4 py-3 text-left font-bold text-gray-500 dark:text-gray-400">고객명</th>
                        <th className="px-4 py-3 text-left font-bold text-gray-500 dark:text-gray-400">상태</th>
                        <th className="px-4 py-3 text-left font-bold text-gray-500 dark:text-gray-400">송장정보</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white dark:divide-[#2a2a2a] dark:bg-[#121212]">
                      {deliveryItems.map((item) => {
                        const badge = DELIVERY_STATUS_MAP[item.status] || { label: item.statusNm || item.status, className: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-[#232323] dark:text-gray-300 dark:border-[#333]' }
                        return (
                          <tr key={`${item.slipNo}-${item.ordNo}`}>
                            <td className="px-4 py-4 font-mono text-xs text-gray-700 dark:text-gray-300">{item.slipNo || '-'}</td>
                            <td className="px-4 py-4 font-mono text-xs text-gray-700 dark:text-gray-300">{item.ordNo || '-'}</td>
                            <td className="px-4 py-4 text-gray-700 dark:text-gray-300">{item.ordDt || '-'}</td>
                            <td className="px-4 py-4 text-gray-700 dark:text-gray-300">{item.custNm || '-'}</td>
                            <td className="px-4 py-4">
                              <span className={cx('inline-flex rounded-full border px-2.5 py-1 text-xs font-bold', badge.className)}>{badge.label}</span>
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300">
                              <div>{item.parcelNm || item.parcelCd || DELIVERY_OUT_DIV_MAP[item.outDiv] || '-'}</div>
                              <div className="mt-1 font-mono text-xs text-gray-500 dark:text-gray-400">{item.invoiceNo || '송장 대기중'}</div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <EmptyState message="조회 조건에 맞는 출고 현황이 없습니다." />
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
