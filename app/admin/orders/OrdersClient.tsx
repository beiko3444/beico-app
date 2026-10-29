'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronRight, Plus, Search, X } from 'lucide-react'
import Modal from '@/components/Modal'
import PageHeader from '@/components/ui/PageHeader'
import Tabs, { type TabItem } from '@/components/ui/Tabs'
import EmptyState from '@/components/ui/EmptyState'
import { buttonClass } from '@/components/ui/buttonClass'
import OrderDetailPage, { type OrderRecord } from './OrderDetailPage'
import AdminOrderCreateModal, { type AdminOrderPartnerOption, type AdminOrderProductOption } from './AdminOrderCreateModal'
import { calculateOrderFinalAmount } from '@/lib/orderAmount'

const statuses = [
  { value: 'all', label: '전체' }, { value: 'pending', label: '입금 대기' },
  { value: 'paid', label: '입금 확인' }, { value: 'SHIPPED', label: '배송' },
  { value: 'COMPLETED', label: '거래 완료' }, { value: 'CANCELED', label: '취소' },
]
function statusLabel(status: string) {
  if (['PENDING', 'PENDING_DEPOSIT'].includes(status)) return '입금 대기'
  if (['APPROVED', 'DEPOSIT_COMPLETED'].includes(status)) return '입금 확인'
  return statuses.find(item => item.value === status)?.label || status
}
// Each state gets its own hue: waiting is amber, confirmed blue, shipped violet, done green, cancelled grey.
function statusBadgeClass(status: string) {
  if (['PENDING', 'PENDING_DEPOSIT'].includes(status)) return 'bg-amber-50 text-amber-800'
  if (['APPROVED', 'DEPOSIT_COMPLETED'].includes(status)) return 'bg-blue-50 text-blue-700'
  if (status === 'SHIPPED') return 'bg-violet-50 text-violet-700'
  if (status === 'COMPLETED') return 'bg-emerald-50 text-emerald-700'
  return 'bg-slate-100 text-slate-600'
}
function matchesStatus(order: OrderRecord, value: string) {
  if (value === 'all') return true
  if (value === 'pending') return ['PENDING', 'PENDING_DEPOSIT'].includes(order.status)
  if (value === 'paid') return ['APPROVED', 'DEPOSIT_COMPLETED'].includes(order.status)
  return order.status === value
}
const currency = (amount: number) => `${Math.round(amount).toLocaleString('ko-KR')}원`

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
  const [status, setStatus] = useState(type === 'completed' ? 'COMPLETED' : 'all')
  const [workFilter, setWorkFilter] = useState(type === 'invoice' ? 'invoice' : type === 'tracking' ? 'tracking' : type === 'inprogress' ? 'active' : 'all')
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
    if (!matchesStatus(order, status)) return false
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

  const statusTabs: TabItem[] = statuses.map(item => ({ key: item.value, label: item.label, count: monthlyOrders.filter(order => matchesStatus(order, item.value)).length }))

  return <div className="space-y-4">
    <AdminOrderCreateModal open={createOrderOpen} onClose={() => setCreateOrderOpen(false)} partners={partners} products={products} />
    <PageHeader
      title="주문 관리"
      description="주문을 선택해 입금·배송·문서를 처리하세요."
      actions={<button type="button" className={buttonClass('primary', 'md')} onClick={() => setCreateOrderOpen(true)}><Plus size={15} />업체 발주서 생성</button>}
    />
    <section className="ux-panel">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] p-4">
        {/* Year and months read as one control. Months use the segmented look but sit in a 6×2 grid on
            narrow screens, so all twelve (and the selected one) stay visible instead of scrolling away. */}
        <div className="flex min-w-0 flex-1 basis-full flex-wrap items-center gap-2 md:basis-auto">
          <select aria-label="연도" value={selectedYear} onChange={event => setSelectedYear(Number(event.target.value))} className="ux-input h-10 min-h-10 w-[112px] shrink-0 py-0">{availableYears.map(year => <option key={year} value={year}>{year}년</option>)}</select>
          <div role="group" aria-label="월 선택" className="grid w-full grid-cols-6 gap-1 rounded-[10px] bg-[#f1f3f6] p-1 md:inline-flex md:w-auto">
            {Array.from({ length: 12 }, (_, index) => index + 1).map(month => {
              const active = selectedMonth === month
              return <button key={month} type="button" aria-pressed={active} onClick={() => setSelectedMonth(month)} className={`inline-flex h-8 items-center justify-center whitespace-nowrap rounded-lg px-2 text-[13px] tabular-nums transition-colors ${active ? 'bg-white font-extrabold text-slate-900 shadow-[0_1px_2px_rgba(16,24,40,0.12)]' : 'font-semibold text-slate-600 hover:bg-white/60 hover:text-slate-900'}`}>{month}월</button>
            })}
          </div>
        </div>
        <div className="ml-auto text-right"><p className="text-xs text-[var(--muted-foreground)]">{selectedMonth}월 매출 · 취소 제외 {monthlySalesSummary.orderCount}건</p><p className="mt-1 text-xl font-bold tabular-nums">{currency(monthlySalesSummary.total)}</p><p className="mt-1 text-xs tabular-nums text-[var(--muted-foreground)]">전체 {monthlyOrders.length}건 · 취소 {monthlyOrders.length - monthlySalesSummary.orderCount}건</p></div>
      </div>
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="basis-full text-xs font-semibold text-[var(--muted-foreground)] sm:basis-auto">주문 상태</span>
          <Tabs aria-label="주문 상태" items={statusTabs} value={status} onChange={setStatus} />
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-4">
          <label className="flex items-center gap-2 text-sm"><span className="shrink-0 text-xs font-semibold text-[var(--muted-foreground)]">처리할 업무</span><select value={workFilter} onChange={event => setWorkFilter(event.target.value)} className="ux-input h-10 min-h-10 w-auto py-0"><option value="all">전체 업무</option><option value="active">진행 중인 주문</option><option value="invoice">계산서 미발행</option><option value="tracking">송장 미입력</option></select></label>
          <label className="relative min-w-0 flex-1 basis-full sm:basis-auto sm:min-w-[260px]"><span className="sr-only">거래처·주문번호·상품명 검색</span><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="거래처·주문번호·상품명 검색" className="ux-input h-10 min-h-10 py-0 pl-10" /></label>
        </div>
      </div>
    </section>
    <section className="ux-panel overflow-hidden" aria-label="주문 목록">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3"><span className="text-sm font-semibold tabular-nums">조회 결과 {filteredOrders.length}건</span><span className="text-xs text-[var(--muted-foreground)]">금액은 배송비·부가세 포함</span></div>
      {!filteredOrders.length ? <EmptyState bare title="조건에 맞는 주문이 없습니다." action={<button type="button" className={buttonClass('secondary', 'sm')} onClick={() => { setStatus('all'); setWorkFilter('all'); setQuery('') }}>검색 조건 초기화</button>} /> : <ul className="divide-y divide-[var(--border)]">
        {filteredOrders.map(order => {
          const amount = calculateOrderFinalAmount(order.items, order.shippingFeeOverride)
          const name = order.user.partnerProfile?.businessName || order.user.name
          const tasks = order.status === 'CANCELED' ? [] : [!order.taxInvoiceIssued ? '계산서 미발행' : '', !order.trackingNumber ? '송장 미입력' : ''].filter(Boolean)
          // Status and amount get their own columns beside the order instead of floating in the far corner.
          return <li key={order.id}><button type="button" onClick={() => selectOrder(order.id)} className="grid w-full grid-cols-[minmax(0,1fr)_auto_16px] items-center gap-x-4 gap-y-2 p-4 text-left transition hover:bg-[var(--surface)] sm:min-h-[104px] sm:grid-cols-[140px_minmax(0,1fr)_112px_132px_16px]">
            <span className="col-span-3 text-xs tabular-nums text-[var(--muted-foreground)] sm:col-span-1">{new Date(order.createdAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}<span className="mt-1 block font-mono">#{order.orderNumber || order.id.slice(0, 8)}</span></span>
            <span className="col-span-3 min-w-0 sm:col-span-1"><strong className="block truncate break-keep text-base">{name}</strong><span className="mt-1 block truncate text-sm text-[var(--muted-foreground)]">{order.items[0]?.product?.name || '상품 정보 없음'}{order.items.length > 1 ? ` 외 ${order.items.length - 1}종` : ''} · {amount.totalQuantity}개</span>{tasks.length > 0 && order.status !== 'COMPLETED' && <span className="mt-2 flex flex-wrap gap-1">{tasks.map(task => <span key={task} className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-bold text-amber-800 ring-1 ring-amber-200">{task}</span>)}</span>}</span>
            <span className="justify-self-start"><span className={`inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-[12px] font-bold ${statusBadgeClass(order.status)}`}>{statusLabel(order.status)}</span></span>
            <strong className="text-right tabular-nums">{currency(amount.finalAmount)}</strong>
            <ChevronRight size={16} className="text-slate-400" aria-hidden="true" />
          </button></li>
        })}
      </ul>}
    </section>
    {selectedOrder && <Modal label={`주문 ${selectedOrder.orderNumber || selectedOrder.id} 상세`} onClose={() => selectOrder()} className="flex justify-end bg-slate-950/50">
      <section className="flex h-full max-h-none w-full max-w-[1200px] flex-col overflow-hidden bg-[var(--background)] shadow-2xl">
        <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--card)] px-4"><h2 className="truncate text-lg font-black">주문 #{selectedOrder.orderNumber || selectedOrder.id}</h2><button type="button" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900" aria-label="상세 닫기" onClick={() => selectOrder()}><X size={18} /></button></header>
        <div className="min-h-0 flex-1 overflow-y-auto"><OrderDetailPage key={selectedOrder.id} order={selectedOrder} /></div>
      </section>
    </Modal>}
  </div>
}
