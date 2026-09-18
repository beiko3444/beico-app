'use client'

import { ChevronDown } from 'lucide-react'
import { calculateOrderFinalAmount } from '@/lib/orderAmount'
import OrderDetailPage, {
  formatCurrency,
  formatDateTime,
  getOrderStatusMeta,
  toneClasses,
  type OrderRecord,
} from './OrderDetailPage'

export default function AdminOrderCard({
  order,
  expanded,
  onToggle,
}: {
  order: OrderRecord
  expanded: boolean
  onToggle: () => void
}) {
  const status = getOrderStatusMeta(order)
  const company = order.user?.partnerProfile?.businessName || order.user?.name || '거래처 정보 없음'
  const orderNumber = order.orderNumber || order.id.slice(0, 8)
  const finalAmount = calculateOrderFinalAmount(order.items || []).finalAmount
  const isCompleted = order.status === 'COMPLETED'
  const panelId = `order-panel-${order.id}`

  return (
    <div className={`min-w-0 overflow-hidden rounded-2xl border bg-white ${expanded ? 'border-brand-orange/40' : 'border-slate-200'}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className={`flex w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-orange/40 ${
          isCompleted ? 'bg-slate-50/70' : ''
        }`}
      >
        <span className="min-w-0 flex-1 basis-[180px]">
          <span className="block truncate text-[14px] font-black text-slate-900">{company}</span>
          <span className="mt-0.5 block whitespace-nowrap text-[11px] font-bold text-slate-500">주문 #{orderNumber}</span>
        </span>
        <span className={`inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full border px-2.5 text-[11px] font-bold ${toneClasses(status.tone)}`}>
          {status.label}
        </span>
        <span className="shrink-0 whitespace-nowrap text-[12px] text-slate-500">{formatDateTime(order.createdAt)}</span>
        <span className="ml-auto shrink-0 whitespace-nowrap text-[15px] font-black text-slate-900">{formatCurrency(finalAmount)}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {expanded ? (
        <div id={panelId} className="border-t border-slate-200 bg-slate-50/50 p-4 md:p-5">
          <OrderDetailPage order={order} />
        </div>
      ) : null}
    </div>
  )
}
