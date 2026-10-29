'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Search, X } from 'lucide-react'
import Modal from '@/components/Modal'
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

  return <div className="ux-page-stack">
    <AdminOrderCreateModal open={createOrderOpen} onClose={() => setCreateOrderOpen(false)} partners={partners} products={products} />
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="ux-page-title">주문관리</h1><p className="mt-2 text-sm text-[var(--muted-foreground)]">주문을 선택해 입금·배송·문서를 처리하세요.</p></div>
      <button className="ux-button-primary" onClick={() => setCreateOrderOpen(true)}><Plus size={17} />업체 발주서 생성</button>
    </header>
    <section className="ux-panel">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] p-4">
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          <select aria-label="연도" value={selectedYear} onChange={event => setSelectedYear(Number(event.target.value))} className="ux-input w-auto">{availableYears.map(year => <option key={year} value={year}>{year}년</option>)}</select>
          <div className="flex max-w-full gap-1 overflow-x-auto" role="group" aria-label="월 선택">{Array.from({ length: 12 }, (_, index) => index + 1).map(month => <button key={month} aria-pressed={selectedMonth === month} onClick={() => setSelectedMonth(month)} className={`min-h-11 shrink-0 rounded-lg px-3 text-sm font-semibold ${selectedMonth === month ? 'bg-[var(--primary)] text-white' : 'text-[var(--muted-foreground)] hover:bg-[var(--surface)]'}`}>{month}월</button>)}</div>
        </div>
        <div className="text-right"><p className="text-xs text-[var(--muted-foreground)]">{selectedMonth}월 매출 · 취소 제외 {monthlySalesSummary.orderCount}건</p><p className="mt-1 text-xl font-bold tabular-nums">{currency(monthlySalesSummary.total)}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">전체 {monthlyOrders.length}건 · 취소 {monthlyOrders.length - monthlySalesSummary.orderCount}건</p></div>
      </div>
      <div className="space-y-4 p-4">
        <div role="group" aria-label="주문 상태" className="flex flex-wrap items-center gap-2"><span className="mr-2 text-xs font-semibold text-[var(--muted-foreground)]">주문 상태</span>{statuses.map(item => <button key={item.value} aria-pressed={status === item.value} onClick={() => setStatus(item.value)} className={`ux-button ${status === item.value ? 'border-[var(--primary)] bg-[var(--muted)] text-[var(--primary)]' : ''}`}>{item.label}<span className="text-xs">{monthlyOrders.filter(order => matchesStatus(order, item.value)).length}</span></button>)}</div>
        <div className="flex flex-wrap gap-3 border-t border-[var(--border)] pt-4">
          <label className="flex items-center gap-2 text-sm"><span className="shrink-0 text-xs font-semibold text-[var(--muted-foreground)]">처리할 업무</span><select value={workFilter} onChange={event => setWorkFilter(event.target.value)} className="ux-input w-auto"><option value="all">전체 업무</option><option value="active">진행 중인 주문</option><option value="invoice">계산서 미발행</option><option value="tracking">송장 미입력</option></select></label>
          <label className="relative min-w-0 flex-1"><span className="sr-only">거래처·주문번호·상품명 검색</span><Search className="pointer-events-none absolute left-3 top-3 text-slate-400" size={18} /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="거래처·주문번호·상품명 검색" className="ux-input pl-10" /></label>
        </div>
      </div>
    </section>
    <section className="ux-panel overflow-hidden" aria-label="주문 목록">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3"><span className="text-sm font-semibold">조회 결과 {filteredOrders.length}건</span><span className="text-xs text-[var(--muted-foreground)]">금액은 배송비·부가세 포함</span></div>
      {!filteredOrders.length ? <div className="ux-empty-state"><p>조건에 맞는 주문이 없습니다.</p><button className="ux-button" onClick={() => { setStatus('all'); setWorkFilter('all'); setQuery('') }}>검색 조건 초기화</button></div> : <ul className="divide-y divide-[var(--border)]">
        {filteredOrders.map(order => {
          const amount = calculateOrderFinalAmount(order.items, order.shippingFeeOverride)
          const name = order.user.partnerProfile?.businessName || order.user.name
          const tasks = order.status === 'CANCELED' ? [] : [!order.taxInvoiceIssued ? '계산서 미발행' : '', !order.trackingNumber ? '송장 미입력' : ''].filter(Boolean)
          return <li key={order.id}><button onClick={() => selectOrder(order.id)} className="grid w-full gap-3 p-4 text-left transition hover:bg-[var(--surface)] sm:grid-cols-[140px_minmax(0,1fr)_auto]">
            <span className="text-xs text-[var(--muted-foreground)]">{new Date(order.createdAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}<span className="mt-1 block font-mono">#{order.orderNumber || order.id.slice(0, 8)}</span></span>
            <span className="min-w-0"><strong className="text-base">{name}</strong><span className="mt-1 block truncate text-sm text-[var(--muted-foreground)]">{order.items[0]?.product?.name || '상품 정보 없음'}{order.items.length > 1 ? ` 외 ${order.items.length - 1}종` : ''} · {amount.totalQuantity}개</span>{tasks.length > 0 && order.status !== 'COMPLETED' && <span className="mt-2 block text-xs text-amber-800">{tasks.join(' · ')}</span>}</span>
            <span className="flex items-center justify-between gap-3 sm:flex-col sm:items-end"><strong className="tabular-nums">{currency(amount.finalAmount)}</strong><span className={`rounded-md px-2 py-1 text-xs font-semibold ${order.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : order.status === 'CANCELED' ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-blue-700'}`}>{statusLabel(order.status)}</span></span>
          </button></li>
        })}
      </ul>}
    </section>
    {selectedOrder && <Modal label={`주문 ${selectedOrder.orderNumber || selectedOrder.id} 상세`} onClose={() => selectOrder()} className="flex justify-end bg-slate-950/50">
      <section className="flex h-full max-h-none w-full max-w-[1200px] flex-col overflow-hidden bg-[var(--background)] shadow-2xl">
        <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--card)] px-4"><h2 className="truncate text-sm font-semibold">주문 #{selectedOrder.orderNumber || selectedOrder.id}</h2><button className="ux-icon-button" aria-label="상세 닫기" onClick={() => selectOrder()}><X size={20} /></button></header>
        <div className="min-h-0 flex-1 overflow-y-auto"><OrderDetailPage key={selectedOrder.id} order={selectedOrder} /></div>
      </section>
    </Modal>}
  </div>
}
