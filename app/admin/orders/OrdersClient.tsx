'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus } from 'lucide-react'
import AdminOrderCard from './AdminOrderCard'
import AdminOrderCreateModal, {
  type AdminOrderPartnerOption,
  type AdminOrderProductOption,
} from './AdminOrderCreateModal'
import type { OrderRecord } from './OrderDetailPage'
import { calculateOrderFinalAmount } from '@/lib/orderAmount'
import Button from '@/components/ui/Button'
import PageHeader from '@/components/ui/PageHeader'
import Tabs from '@/components/ui/Tabs'
import EmptyState from '@/components/ui/EmptyState'

const MONTH_TABS = Array.from({ length: 12 }, (_, index) => ({
  key: String(index + 1),
  label: `${index + 1}월`,
}))

const TYPE_LABELS: Record<string, string> = {
  invoice: '계산서 미발행',
  tracking: '송장 미입력',
  inprogress: '진행 중',
  completed: '거래완료',
}

export default function OrdersClient({
  orders,
  partners,
  products,
}: {
  orders: OrderRecord[]
  partners: AdminOrderPartnerOption[]
  products: AdminOrderProductOption[]
}) {
  const searchParams = useSearchParams()
  const type = searchParams.get('type')
  const latestOrderDate = useMemo(() => {
    const firstValidOrder = (orders || []).find((order) => !Number.isNaN(new Date(order.createdAt).getTime()))
    return firstValidOrder ? new Date(firstValidOrder.createdAt) : new Date()
  }, [orders])
  const [selectedYear, setSelectedYear] = useState<number>(latestOrderDate.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number>(latestOrderDate.getMonth() + 1)
  const [createOrderOpen, setCreateOrderOpen] = useState(false)
  // undefined = untouched (first order opens), null = user collapsed everything, string = chosen order
  const [expandedOrderId, setExpandedOrderId] = useState<string | null | undefined>(undefined)

  const availableYears = useMemo(() => {
    const years = new Set<number>()
    for (const order of orders || []) {
      const date = new Date(order.createdAt)
      if (!Number.isNaN(date.getTime())) years.add(date.getFullYear())
    }
    if (years.size === 0) years.add(latestOrderDate.getFullYear())
    return Array.from(years).sort((a, b) => b - a)
  }, [orders, latestOrderDate])

  const monthlyOrders = useMemo(() => {
    return (orders || []).filter((order) => {
      const createdAt = new Date(order.createdAt)
      if (Number.isNaN(createdAt.getTime())) return false
      return createdAt.getFullYear() === selectedYear && createdAt.getMonth() + 1 === selectedMonth
    })
  }, [orders, selectedYear, selectedMonth])

  const monthlySalesSummary = useMemo(() => {
    const revenueOrders = monthlyOrders.filter((order) => order.status !== 'CANCELED')
    const total = revenueOrders.reduce((sum, order) => {
      return sum + calculateOrderFinalAmount(order.items || []).finalAmount
    }, 0)

    return {
      orderCount: revenueOrders.length,
      total,
    }
  }, [monthlyOrders])

  const filteredOrders = useMemo(() => {
    return monthlyOrders.filter((order) => {
      const matchesType = (() => {
        if (type === 'invoice') return !order.taxInvoiceIssued
        if (type === 'tracking') return !order.trackingNumber && order.status === 'APPROVED'
        if (type === 'inprogress') return order.status !== 'COMPLETED' && order.status !== 'CANCELED'
        if (type === 'completed') return order.status === 'COMPLETED'
        return true
      })()
      return matchesType
    })
  }, [monthlyOrders, type])

  // Single-open accordion: the chosen order if it is still in the list, otherwise the first one.
  const activeOrderId = useMemo(() => {
    if (expandedOrderId === null) return null
    if (expandedOrderId && filteredOrders.some((order) => order.id === expandedOrderId)) return expandedOrderId
    return filteredOrders[0]?.id ?? null
  }, [expandedOrderId, filteredOrders])

  const toggleOrder = (orderId: string) => {
    setExpandedOrderId(activeOrderId === orderId ? null : orderId)
  }

  return (
    <div className="min-w-0 space-y-5">
      <AdminOrderCreateModal
        open={createOrderOpen}
        onClose={() => setCreateOrderOpen(false)}
        partners={partners}
        products={products}
      />

      <PageHeader
        title="주문관리"
        count={filteredOrders.length}
        description="주문 상품, 현재 상태, 결제 금액, 배송 처리와 문서 발행 작업을 한 화면에서 확인하고 처리합니다."
        actions={(
          <>
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOrderOpen(true)}>
              업체 발주서 생성
            </Button>
            <label className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-bold text-slate-500">
              연도
              <select
                value={selectedYear}
                onChange={(event) => setSelectedYear(Number(event.target.value))}
                className="bg-transparent text-[13px] font-black text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40"
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </label>
          </>
        )}
      />

      <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Tabs
              aria-label="월 선택"
              items={MONTH_TABS}
              value={String(selectedMonth)}
              onChange={(key) => setSelectedMonth(Number(key))}
            />
            {type ? (
              <span className="inline-flex h-7 items-center whitespace-nowrap rounded-full border border-orange-200 bg-brand-orange-soft px-3 text-[11px] font-bold text-brand-orange">
                필터: {TYPE_LABELS[type] ?? type}
              </span>
            ) : null}
          </div>
          <div className="shrink-0 lg:text-right">
            <div className="text-[12px] font-bold text-slate-500">
              {selectedYear}년 {selectedMonth}월 총매출
              <span className="ml-2 text-slate-500">취소 제외 {monthlySalesSummary.orderCount}건</span>
            </div>
            <div className="mt-0.5 whitespace-nowrap text-[22px] font-black tracking-tight text-slate-900">
              {formatCurrency(monthlySalesSummary.total)}
            </div>
          </div>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <EmptyState title="표시할 주문이 없습니다." />
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => (
            <AdminOrderCard
              key={order.id}
              order={order}
              expanded={activeOrderId === order.id}
              onToggle={() => toggleOrder(order.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function formatCurrency(value: number) {
  return `${Math.round(value).toLocaleString('ko-KR')}원`
}
