'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, ChevronRight, Plus, Search } from 'lucide-react'
import Modal from '@/components/Modal'
import PageHeader from '@/components/ui/PageHeader'
import Tabs, { type TabItem } from '@/components/ui/Tabs'
import FilterChips from '@/components/ui/FilterChips'
import EmptyState from '@/components/ui/EmptyState'
import Badge from '@/components/ui/Badge'
import ModalCloseButton from '@/components/ui/ModalCloseButton'
import { buttonClass } from '@/components/ui/buttonClass'
import { fieldClass, selectClass } from '@/components/ui/field'
import OrderDetailPage, { type OrderRecord } from './OrderDetailPage'
import AdminOrderCreateModal, { type AdminOrderPartnerOption, type AdminOrderProductOption } from './AdminOrderCreateModal'
import { calculateOrderFinalAmount } from '@/lib/orderAmount'
import { ORDER_STATUS_GROUPS, orderStatusGroup, orderStatusMeta, type OrderStatusGroup } from '@/lib/orderStatus'
import { formatDateTime, formatWon } from '@/lib/format'

type StatusFilter = 'all' | OrderStatusGroup
type WorkFilter = 'all' | 'active' | 'invoice' | 'tracking'

const hasTracking = (order: OrderRecord) => Boolean(order.trackingNumber?.trim())
const statusOf = (order: OrderRecord) => orderStatusGroup(order.status, hasTracking(order))
const workFilters: { key: WorkFilter; label: string }[] = [
  { key: 'all', label: '전체 업무' },
  { key: 'active', label: '진행 중인 주문' },
  { key: 'invoice', label: '세금계산서 미발행' },
  { key: 'tracking', label: '송장 미입력' },
]
const months = Array.from({ length: 12 }, (_, index) => ({ key: String(index + 1), label: `${index + 1}월` }))

export default function OrdersClient({ orders, partners, products }: {
  orders: OrderRecord[]
  partners: AdminOrderPartnerOption[]
  products: AdminOrderProductOption[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const type = searchParams.get('type')
  const selectedOrder = orders.find(order => order.id === searchParams.get('order'))
  const latestDate = useMemo(() => {
    const valid = orders.map(order => new Date(order.createdAt)).filter(date => !Number.isNaN(date.getTime()))
    return valid.length ? new Date(Math.max(...valid.map(date => date.getTime()))) : new Date()
  }, [orders])
  const [selectedYear, setSelectedYear] = useState(latestDate.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(latestDate.getMonth() + 1)
  const [createOrderOpen, setCreateOrderOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>(type === 'completed' ? 'completed' : 'all')
  const [workFilter, setWorkFilter] = useState<WorkFilter>(type === 'invoice' ? 'invoice' : type === 'tracking' ? 'tracking' : type === 'inprogress' ? 'active' : 'all')
  const availableYears = [...new Set([latestDate.getFullYear(), ...orders.map(order => new Date(order.createdAt).getFullYear()).filter(Number.isFinite)])].sort((a, b) => b - a)
  const monthlyOrders = useMemo(() => orders.filter(order => {
    const date = new Date(order.createdAt)
    return date.getFullYear() === selectedYear && date.getMonth() + 1 === selectedMonth
  }), [orders, selectedYear, selectedMonth])
  const revenueOrders = monthlyOrders.filter(order => order.status !== 'CANCELED')
  const monthlySalesSummary = {
    orderCount: revenueOrders.length,
    total: revenueOrders.reduce((sum, order) => sum + calculateOrderFinalAmount(order.items || [], order.shippingFeeOverride).finalAmount, 0),
  }
  const filteredOrders = monthlyOrders.filter(order => {
    if (status !== 'all' && statusOf(order) !== status) return false
    if (workFilter !== 'all' && ['CANCELED', 'COMPLETED'].includes(order.status)) return false
    if (workFilter === 'invoice' && order.taxInvoiceIssued) return false
    if (workFilter === 'tracking' && order.trackingNumber) return false
    const keyword = query.trim().toLocaleLowerCase()
    return !keyword || [order.orderNumber, order.user.name, order.user.partnerProfile?.businessName, ...order.items.map(item => item.product?.name)].some(value => value?.toLocaleLowerCase().includes(keyword))
  })
  function selectOrder(id?: string) {
    const next = new URLSearchParams(searchParams.toString())
    if (id) next.set('order', id)
    else next.delete('order')
    router.replace(`/admin/orders${next.size ? `?${next}` : ''}`, { scroll: false })
  }

  // Status tabs follow the shared order vocabulary, so a tab name is exactly the badge the rows show.
  const statusTabs: TabItem<StatusFilter>[] = [
    { key: 'all', label: '전체', count: monthlyOrders.length },
    ...ORDER_STATUS_GROUPS.map(meta => ({ key: meta.group, label: meta.label, count: monthlyOrders.filter(order => statusOf(order) === meta.group).length })),
  ]

  return <div className="space-y-4">
    <AdminOrderCreateModal open={createOrderOpen} onClose={() => setCreateOrderOpen(false)} partners={partners} products={products} />
    <PageHeader
      title="주문 관리"
      description="주문을 선택해 입금·배송·문서를 처리하세요."
      actions={<button type="button" data-primary className={buttonClass('primary', 'md')} onClick={() => setCreateOrderOpen(true)}><Plus size={15} />업체 발주서 생성</button>}
    />
    <section className="ux-panel">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] p-4">
        {/* Year and months read as one period control. Months are outline chips (not a second segmented row)
            and sit in a 6×2 grid on narrow screens, so all twelve stay visible instead of scrolling away. */}
        <div className="flex min-w-0 flex-1 basis-full flex-wrap items-center gap-2 md:basis-auto">
          <select aria-label="연도" value={selectedYear} onChange={event => setSelectedYear(Number(event.target.value))} className={selectClass(true, 'w-[112px] shrink-0')}>{availableYears.map(year => <option key={year} value={year}>{year}년</option>)}</select>
          <FilterChips aria-label="월 선택" items={months} value={String(selectedMonth)} onChange={key => setSelectedMonth(Number(key))} className="grid w-full grid-cols-6 gap-1 md:flex md:w-auto [&>button]:px-2" />
        </div>
        <div className="ml-auto text-right"><p className="text-xs text-[var(--muted-foreground)]">{selectedMonth}월 매출 · 취소 제외 {monthlySalesSummary.orderCount}건</p><p className="mt-1 text-xl font-bold tabular-nums">{formatWon(monthlySalesSummary.total)}</p><p className="mt-1 text-xs tabular-nums text-[var(--muted-foreground)]">전체 {monthlyOrders.length}건 · 취소 {monthlyOrders.length - monthlySalesSummary.orderCount}건</p></div>
      </div>
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="basis-full text-xs font-semibold text-[var(--muted-foreground)] sm:basis-auto">주문 상태</span>
          <Tabs aria-label="주문 상태" items={statusTabs} value={status} onChange={setStatus} />
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-4">
          <div className="flex min-w-0 flex-wrap items-center gap-2"><span className="shrink-0 text-xs font-semibold text-[var(--muted-foreground)]">처리할 업무</span><FilterChips aria-label="처리할 업무" items={workFilters} value={workFilter} onChange={setWorkFilter} /></div>
          <label className="relative min-w-0 flex-1 basis-full sm:basis-auto sm:min-w-[260px]"><span className="sr-only">거래처·주문번호·상품명 검색</span><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="거래처·주문번호·상품명 검색" className={fieldClass('pl-10')} /></label>
        </div>
      </div>
    </section>
    <section className="ux-panel overflow-hidden" aria-label="주문 목록">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3"><span className="text-sm font-semibold tabular-nums">조회 결과 {filteredOrders.length}건</span><span className="text-xs text-[var(--muted-foreground)]">금액은 배송비·부가세 포함</span></div>
      {!filteredOrders.length ? <EmptyState bare title="조건에 맞는 주문이 없습니다." action={<button type="button" className={buttonClass('secondary', 'sm')} onClick={() => { setStatus('all'); setWorkFilter('all'); setQuery('') }}>검색 조건 초기화</button>} /> : <ul className="divide-y divide-[var(--border)]">
        {filteredOrders.map(order => {
          const amount = calculateOrderFinalAmount(order.items, order.shippingFeeOverride)
          const name = order.user.partnerProfile?.businessName || order.user.name
          const meta = orderStatusMeta(order.status, hasTracking(order))
          const canceled = order.status === 'CANCELED'
          const selected = selectedOrder?.id === order.id
          const tasks = canceled || order.status === 'COMPLETED' ? [] : [!order.taxInvoiceIssued ? '세금계산서 미발행' : '', !order.trackingNumber ? '송장 미입력' : ''].filter(Boolean)
          // Desktop: status and amount sit right after the order info (capped width) instead of drifting to the far edge.
          // Phones: business name first, then the date line, then status and amount.
          return <li key={order.id}><button type="button" aria-current={selected || undefined} onClick={() => selectOrder(order.id)} className={`grid w-full grid-cols-[minmax(0,1fr)_auto_16px] items-center gap-x-4 gap-y-1.5 p-4 text-left transition sm:min-h-[104px] sm:grid-cols-[140px_minmax(0,560px)_112px_132px_minmax(0,1fr)_16px] sm:gap-y-2 ${selected ? 'bg-orange-50/60' : 'hover:bg-[var(--surface)]'}`}>
            <span className="col-span-3 text-[11px] tabular-nums text-[var(--muted-foreground)] max-sm:order-2 sm:col-span-1 sm:text-xs">{formatDateTime(order.createdAt)}<span className="ml-2 font-mono sm:ml-0 sm:mt-1 sm:block">#{order.orderNumber || order.id.slice(0, 8)}</span></span>
            <span className="col-span-3 min-w-0 max-sm:order-1 sm:col-span-1"><strong className="block truncate break-keep text-base">{name}</strong><span className="mt-1 block truncate text-sm text-[var(--muted-foreground)]">{order.items[0]?.product?.name || '상품 정보 없음'}{order.items.length > 1 ? ` 외 ${order.items.length - 1}종` : ''} · {amount.totalQuantity}개</span>{tasks.length > 0 && <span className="mt-2 flex flex-wrap gap-1">{tasks.map(task => <span key={task} className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] font-bold text-slate-700"><AlertCircle size={11} className="text-amber-600" aria-hidden="true" />{task}</span>)}</span>}</span>
            <span className="justify-self-start max-sm:order-3"><Badge tone={meta.tone}>{meta.label}</Badge></span>
            <strong className={`text-right tabular-nums max-sm:order-3 ${canceled ? 'font-semibold text-slate-400 line-through' : ''}`}>{formatWon(amount.finalAmount)}</strong>
            <span className="hidden sm:block" aria-hidden="true" />
            <ChevronRight size={16} className="text-slate-400 max-sm:order-3" aria-hidden="true" />
          </button></li>
        })}
      </ul>}
    </section>
    {selectedOrder && <Modal label={`주문 ${selectedOrder.orderNumber || selectedOrder.id} 상세`} onClose={() => selectOrder()} className="flex justify-end bg-slate-950/50">
      {/* Narrower than the page so the dimmed list (date, business name) stays visible beside the drawer. */}
      <section className="flex h-full max-h-none w-full max-w-full flex-col overflow-hidden border-l border-[var(--border)] bg-[var(--background)] shadow-2xl lg:max-w-[min(960px,calc(100vw-400px))]">
        <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--card)] px-4"><h2 className="truncate text-lg font-extrabold">주문 #{selectedOrder.orderNumber || selectedOrder.id}</h2><ModalCloseButton label="상세 닫기" onClick={() => selectOrder()} /></header>
        <div className="min-h-0 flex-1 overflow-y-auto"><OrderDetailPage key={selectedOrder.id} order={selectedOrder} /></div>
      </section>
    </Modal>}
  </div>
}
