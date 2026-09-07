'use client'

import { Check, Clock3, Pencil, RefreshCw, X } from 'lucide-react'
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
const notePresets = ['파스토', '쿠팡', '도매처: ', '고객: ']

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
  const [noteError, setNoteError] = useState('')
  const [editingHistoryId, setEditingHistoryId] = useState<string | null>(null)
  const [draftNote, setDraftNote] = useState('')
  const [savingHistoryId, setSavingHistoryId] = useState<string | null>(null)

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

  const startEditingNote = (row: StockHistoryRow) => {
    setEditingHistoryId(row.id)
    setDraftNote(row.note || '')
    setNoteError('')
  }

  const cancelEditingNote = () => {
    setEditingHistoryId(null)
    setDraftNote('')
    setNoteError('')
  }

  const saveHistoryNote = async (historyId: string) => {
    const note = draftNote.trim()
    if (note.length > 200) {
      setNoteError('수정내역은 200자 이하로 입력해주세요.')
      return
    }

    setSavingHistoryId(historyId)
    setNoteError('')
    try {
      const response = await fetch(`/api/products/${productId}/stock-history`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ historyId, note }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || '수정내역을 저장하지 못했습니다.')

      setPayload((current) => current ? {
        ...current,
        history: current.history.map((row) => row.id === historyId
          ? { ...row, note: data?.note ?? null }
          : row),
      } : current)
      setEditingHistoryId(null)
      setDraftNote('')
    } catch (saveError) {
      setNoteError(saveError instanceof Error ? saveError.message : '수정내역을 저장하지 못했습니다.')
    } finally {
      setSavingHistoryId(null)
    }
  }

  const modal = isOpen ? (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/45 p-0 sm:p-4" onClick={() => setIsOpen(false)}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`${productName} 관리용 재고 변경 이력`}
        className="flex h-[100dvh] max-h-[100dvh] w-full max-w-4xl flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[88vh] sm:rounded-2xl sm:border sm:border-slate-200"
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

        <div className="overflow-y-auto p-3 sm:p-5">
          {noteError ? (
            <div className="mb-3 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
              <span>{noteError}</span>
              <button type="button" onClick={() => setNoteError('')} className="shrink-0" aria-label="수정내역 오류 닫기"><X size={14} /></button>
            </div>
          ) : null}
          {loading && !payload ? (
            <div className="py-12 text-center text-sm font-bold text-slate-500">변경 이력을 불러오는 중입니다.</div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>
          ) : payload?.history.length ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 text-sm">
              <div className="hidden grid-cols-[1.1fr_1fr_.55fr_1.6fr] bg-slate-100 px-3 py-2 text-xs font-black text-slate-600 sm:grid">
                <div>수정 시각</div>
                <div className="text-center">수량 변경</div>
                <div className="text-center">증감</div>
                <div>수정내역</div>
              </div>
              <div className="divide-y divide-slate-100">
                {payload.history.map((row) => {
                  const actor = row.changedBy?.name || row.changedBy?.username || '관리자'
                  const sourceLabel = sourceLabels[row.source] || row.source
                  const editing = editingHistoryId === row.id
                  return (
                    <div key={row.id} className="grid gap-3 p-3 hover:bg-slate-50 sm:grid-cols-[1.1fr_1fr_.55fr_1.6fr] sm:items-start sm:gap-2">
                      <div className="text-xs font-bold text-slate-600">
                        <div className="mb-1 text-[10px] font-black text-slate-400 sm:hidden">수정 시각</div>
                        {formatDateTime(row.createdAt)}
                        <div className="mt-1 text-[11px] font-medium text-slate-400">{actor}</div>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:block sm:text-center">
                        <span className="text-[10px] font-black text-slate-400 sm:hidden">수량 변경</span>
                        <span className="font-black tabular-nums text-slate-800">{formatNumber(row.previousStock)} → {formatNumber(row.newStock)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:block sm:text-center">
                        <span className="text-[10px] font-black text-slate-400 sm:hidden">증감</span>
                        <span className={`inline-flex min-w-14 justify-center rounded-full px-2 py-1 font-black tabular-nums ${row.delta > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                          {row.delta > 0 ? '+' : ''}{formatNumber(row.delta)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="mb-1 text-[10px] font-black text-slate-400 sm:hidden">수정내역</div>
                        {editing ? (
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-1">
                              {notePresets.map((preset) => (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() => setDraftNote(preset)}
                                  className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-black text-blue-700 hover:bg-blue-100"
                                >
                                  {preset.trim()}
                                </button>
                              ))}
                            </div>
                            <textarea
                              value={draftNote}
                              onChange={(event) => setDraftNote(event.target.value)}
                              maxLength={200}
                              rows={2}
                              placeholder="예: 쿠팡 출고, 도매처: 우리낚시, 고객: 홍길동"
                              className="w-full resize-none rounded-lg border border-blue-300 bg-white px-2.5 py-2 text-xs font-bold text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                              autoFocus
                            />
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-bold tabular-nums text-slate-400">{draftNote.length}/200</span>
                              <div className="flex gap-1.5">
                                <button type="button" onClick={cancelEditingNote} disabled={savingHistoryId === row.id} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-black text-slate-600 disabled:opacity-50"><X size={12} />취소</button>
                                <button type="button" onClick={() => void saveHistoryNote(row.id)} disabled={savingHistoryId === row.id} className="inline-flex h-8 items-center gap-1 rounded-lg bg-blue-600 px-2.5 text-[10px] font-black text-white disabled:opacity-50"><Check size={12} />{savingHistoryId === row.id ? '저장 중' : '저장'}</button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 text-xs font-bold text-slate-700">
                              <div className="break-words">{row.note || sourceLabel}</div>
                              {row.note && row.note !== sourceLabel ? <div className="mt-1 text-[10px] font-medium text-slate-400">{sourceLabel}</div> : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => startEditingNote(row)}
                              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-blue-600 hover:border-blue-300 hover:bg-blue-50"
                              aria-label={`${formatDateTime(row.createdAt)} 수정내역 편집`}
                              title="수정내역 편집"
                            >
                              <Pencil size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
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
