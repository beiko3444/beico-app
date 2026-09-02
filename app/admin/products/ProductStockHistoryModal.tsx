'use client'

import { Clock3, RefreshCw, X } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'

type StockHistoryRow = {
  id: string
  previousStock: number
  newStock: number
  delta: number
  source: string
  note?: string | null
  createdAt: string
  changedBy?: {
    name?: string | null
    username?: string | null
  } | null
}

type StockHistoryPayload = {
  product: {
    id: string
    name: string
    stock: number
  }
  history: StockHistoryRow[]
}

const sourceLabels: Record<string, string> = {
  PRODUCT_CREATE: '상품 등록',
  PRODUCT_EDIT: '상품 상세 수정',
  PRODUCT_PATCH: '상품 빠른 수정',
  PRODUCT_BULK_EDIT: '상품관리 일괄 수정',
}

const formatNumber = (value: number) => Math.round(value).toLocaleString('ko-KR')
const formatDateTime = (value: string) => new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'medium',
  timeStyle: 'medium',
}).format(new Date(value))

export default function ProductStockHistoryModal({
  productId,
  productName,
  compact = false,
}: {
  productId: string
  productName: string
  compact?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [payload, setPayload] = useState<StockHistoryPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadHistory = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/products/${productId}/stock-history?limit=200`, {
        cache: 'no-store',
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || '관리용 재고 이력을 불러오지 못했습니다.')
      setPayload(data)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '관리용 재고 이력을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const openHistory = () => {
    setIsOpen(true)
    void loadHistory()
  }

  const modal = isOpen ? (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/45 p-4" onClick={() => setIsOpen(false)}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`${productName} 관리용 재고 변경 이력`}
        className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-black text-emerald-700">
              <Clock3 size={16} /> 관리용 재고 변경 이력
            </div>
            <h2 className="mt-1 truncate text-lg font-black text-slate-950">{payload?.product.name || productName}</h2>
            <p className="mt-1 text-xs font-bold text-slate-500">
              현재 재고 <span className="text-emerald-700">{formatNumber(payload?.product.stock ?? 0)}개</span> · 최신순 최대 200건
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void loadHistory()}
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-100"
              aria-label="관리용 재고 이력 새로고침"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-100"
              aria-label="관리용 재고 이력 닫기"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        <div className="overflow-y-auto p-5">
          {loading && !payload ? (
            <div className="py-12 text-center text-sm font-bold text-slate-500">변경 이력을 불러오는 중입니다.</div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>
          ) : payload?.history.length ? (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full table-fixed border-collapse text-sm">
                <thead className="bg-slate-100 text-xs font-black text-slate-600">
                  <tr>
                    <th className="w-[31%] px-3 py-2 text-left">수정 시각</th>
                    <th className="w-[29%] px-3 py-2 text-center">수량 변경</th>
                    <th className="w-[18%] px-3 py-2 text-center">증감</th>
                    <th className="w-[22%] px-3 py-2 text-left">수정 내역</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payload.history.map((row) => {
                    const actor = row.changedBy?.name || row.changedBy?.username || '관리자'
                    return (
                      <tr key={row.id} className="align-top hover:bg-slate-50">
                        <td className="px-3 py-3 text-xs font-bold text-slate-600">
                          {formatDateTime(row.createdAt)}
                          <div className="mt-1 text-[11px] font-medium text-slate-400">{actor}</div>
                        </td>
                        <td className="px-3 py-3 text-center font-black tabular-nums text-slate-800">
                          {formatNumber(row.previousStock)} → {formatNumber(row.newStock)}
                        </td>
                        <td className={`px-3 py-3 text-center font-black tabular-nums ${row.delta > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {row.delta > 0 ? '+' : ''}{formatNumber(row.delta)}
                        </td>
                        <td className="px-3 py-3 text-xs font-bold text-slate-700">
                          {row.note || sourceLabels[row.source] || row.source}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center">
              <div className="text-sm font-black text-slate-600">저장된 변경 이력이 없습니다.</div>
              <p className="mt-1 text-xs font-medium text-slate-400">앞으로 관리용 재고가 실제로 변경될 때마다 이곳에 누적됩니다.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  ) : null

  return (
    <>
      <button
        type="button"
        onClick={openHistory}
        className={compact
          ? 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-emerald-700'
          : 'mt-1 inline-flex items-center gap-1 text-[9px] font-black text-emerald-700 hover:text-emerald-900'}
        aria-label={`${productName} 관리용 재고 이력 보기`}
        title="재고 이력"
      >
        <Clock3 size={compact ? 15 : 11} />
        {compact ? null : ' 이력'}
      </button>
      {modal ? createPortal(modal, document.body) : null}
    </>
  )
}
