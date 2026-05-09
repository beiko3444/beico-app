'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, ArrowLeft } from 'lucide-react'
import AdminOrderCard from './AdminOrderCard'

export default function OrdersClient({
  orders,
  depositSmsSummary,
  depositSmsActionItems = [],
}: {
  orders: any[]
  depositSmsSummary?: {
    unmatched: number
    ambiguous: number
  }
  depositSmsActionItems?: Array<{
    id: string
    sender: string
    body: string
    receivedAt: string | Date
    amount: number | null
    depositorName?: string | null
    bankName?: string | null
    matchStatus: string
  }>
}) {
  const searchParams = useSearchParams()
  const type = searchParams.get('type')
  const latestOrderDate = useMemo(() => {
    const firstValidOrder = (orders || []).find((order) => !Number.isNaN(new Date(order.createdAt).getTime()))
    return firstValidOrder ? new Date(firstValidOrder.createdAt) : new Date()
  }, [orders])
  const [selectedYear, setSelectedYear] = useState<number>(latestOrderDate.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number>(latestOrderDate.getMonth() + 1)

  const availableYears = useMemo(() => {
    const years = new Set<number>()
    for (const order of orders || []) {
      const date = new Date(order.createdAt)
      if (!Number.isNaN(date.getTime())) years.add(date.getFullYear())
    }
    if (years.size === 0) years.add(latestOrderDate.getFullYear())
    return Array.from(years).sort((a, b) => b - a)
  }, [orders, latestOrderDate])

  const filteredOrders = useMemo(() => {
    return (orders || []).filter((order) => {
      const createdAt = new Date(order.createdAt)
      if (Number.isNaN(createdAt.getTime())) return false
      const matchesMonth = createdAt.getFullYear() === selectedYear && createdAt.getMonth() + 1 === selectedMonth
      const matchesType = (() => {
        if (type === 'invoice') return !order.taxInvoiceIssued
        if (type === 'tracking') return !order.trackingNumber && order.status === 'APPROVED'
        if (type === 'inprogress') return !order.trackingNumber || !order.taxInvoiceIssued
        if (type === 'completed') return order.trackingNumber && order.taxInvoiceIssued
        return true
      })()
      return matchesMonth && matchesType
    })
  }, [orders, type, selectedYear, selectedMonth])
  const hasDepositSmsActionItems = depositSmsActionItems.length > 0

  return (
    <div className="min-h-screen bg-[#F6F8FB] -mx-4 px-4 py-6 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mx-auto max-w-[1720px] space-y-6">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[13px] font-medium text-slate-400">
                <Link href="/admin" className="inline-flex items-center gap-1 rounded-lg px-1 py-1 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900">
                  <ArrowLeft className="h-4 w-4" />
                  관리자 홈
                </Link>
                <ChevronRight className="h-4 w-4" />
                <span>주문 관리</span>
                <ChevronRight className="h-4 w-4" />
                <span>주문 상세</span>
              </div>
              <h1 className="mt-3 text-[30px] font-black tracking-tight text-slate-950">주문 상세</h1>
              <p className="mt-2 text-[14px] leading-6 text-slate-500">
                주문 상품, 현재 상태, 결제 금액, 배송 처리와 문서 발행 작업을 한 화면에서 바로 확인하고 처리합니다.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                <span className="text-[12px] font-bold text-slate-500">연도</span>
                <select
                  value={selectedYear}
                  onChange={(event) => setSelectedYear(Number(event.target.value))}
                  className="bg-transparent text-[12px] font-black text-slate-700 outline-none"
                >
                  {availableYears.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
                {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                  <button
                    key={month}
                    type="button"
                    onClick={() => setSelectedMonth(month)}
                    className={`rounded-full px-2.5 py-1 text-[12px] font-black transition ${
                      selectedMonth === month
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-500 hover:bg-white hover:text-slate-900'
                    }`}
                  >
                    {month}
                  </button>
                ))}
              </div>
              {type ? (
                <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[12px] font-bold text-blue-700">
                  필터 적용: {type}
                </span>
              ) : null}
              <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[12px] font-black text-rose-700">
                입금문자 미매칭 {depositSmsSummary?.unmatched || 0}건
              </span>
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[12px] font-black text-amber-700">
                복수매칭 {depositSmsSummary?.ambiguous || 0}건
              </span>
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[12px] font-bold text-slate-600">
                총 {filteredOrders.length}건
              </span>
            </div>
          </div>
          {hasDepositSmsActionItems ? (
            <div className="mt-5 rounded-2xl border border-rose-100 bg-rose-50/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-[14px] font-black text-rose-800">입금문자 수동확인 필요</h2>
                  <p className="mt-1 text-[12px] font-medium text-rose-600">
                    금액이 주문과 맞지 않거나 같은 금액 주문이 여러 건인 문자입니다.
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-[12px] font-black text-rose-700">
                  {depositSmsActionItems.length}건 표시
                </span>
              </div>
              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                {depositSmsActionItems.map((item) => (
                  <div key={item.id} className="rounded-xl border border-white bg-white px-4 py-3 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
                        item.matchStatus === 'AMBIGUOUS' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {item.matchStatus === 'AMBIGUOUS' ? '복수매칭' : '미매칭'}
                      </span>
                      <span className="text-[13px] font-black text-slate-900">
                        {item.amount ? `${Math.round(item.amount).toLocaleString('ko-KR')}원` : '금액 없음'}
                      </span>
                    </div>
                    <div className="mt-2 text-[12px] font-bold text-slate-500">
                      {formatCompactDateTime(item.receivedAt)} · {item.bankName || item.sender}
                      {item.depositorName ? ` · ${item.depositorName}` : ''}
                    </div>
                    <p className="mt-2 line-clamp-2 text-[12px] leading-5 text-slate-600">{item.body}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {filteredOrders.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-20 text-center shadow-sm">
            <p className="text-[16px] font-bold text-slate-500">표시할 주문이 없습니다.</p>
            <p className="mt-2 text-[13px] text-slate-400">현재 조건에 맞는 주문 상세를 찾지 못했습니다.</p>
          </div>
        ) : (
          filteredOrders.map((order, index) => (
            <div key={order.id} className="space-y-6">
              {index > 0 ? <div className="h-px bg-slate-200" /> : null}
              <AdminOrderCard order={order} />
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function formatCompactDateTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
