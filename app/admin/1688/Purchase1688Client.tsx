'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import {
  Box,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  ExternalLink,
  ImageOff,
  Pencil,
  Plus,
  Search,
  Store,
  Trash2,
} from 'lucide-react'
import Button, { buttonClass } from '@/components/ui/Button'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import Badge, { type BadgeTone } from '@/components/ui/Badge'
import Modal from '@/components/Modal'
import ModalCloseButton from '@/components/ui/ModalCloseButton'
import { fieldClass, labelClass, selectClass } from '@/components/ui/field'
import { formatDate, formatWon } from '@/lib/format'

export type Purchase1688Item = {
  id: string
  orderNo: string
  orderedOn: string
  shop: string
  productCn: string
  productKo: string
  spec: string
  quantity: number
  unitPrice: number
  itemTotal: number
  orderPaid: number
  status: string
  trackingNo: string
  note: string
  offerId: string
  skuId: string
  imageUrl: string
  sourceUrl: string
  createdAt: string
  updatedAt: string
}

type OrderGroup = {
  orderNo: string
  orderedOn: string
  shop: string
  status: string
  trackingNo: string
  orderPaid: number
  items: Purchase1688Item[]
}

const statuses = ['확인필요', '결제완료', '배송중', '완료', '취소']
const pageSizeOptions = [20, 50, 100] as const
const blankItem = (): Purchase1688Item => ({
  id: '', orderNo: '', orderedOn: new Date().toISOString().slice(0, 10), shop: '', productCn: '', productKo: '', spec: '',
  quantity: 1, unitPrice: 0, itemTotal: 0, orderPaid: 0, status: '확인필요', trackingNo: '', note: '', offerId: '', skuId: '', imageUrl: '', sourceUrl: '', createdAt: '', updatedAt: '',
})

const money = (value: number, digits = 2) => value.toLocaleString('ko-KR', { maximumFractionDigits: digits })

function statusTone(status: string): BadgeTone {
  if (status === '완료') return 'success'
  if (status === '취소') return 'danger'
  if (status === '배송중') return 'info'
  if (status === '확인필요') return 'warning'
  return 'neutral'
}

export default function Purchase1688Client({ initialItems, initialRate, loadError }: { initialItems: Purchase1688Item[]; initialRate: number; loadError: string }) {
  const [items, setItems] = useState(initialItems)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('전체')
  const [rate, setRate] = useState(initialRate)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [editing, setEditing] = useState<Purchase1688Item | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(loadError)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<(typeof pageSizeOptions)[number]>(20)

  const groups = useMemo<OrderGroup[]>(() => {
    const keyword = query.trim().toLowerCase()
    const map = new Map<string, Purchase1688Item[]>()
    for (const item of items) {
      if (status !== '전체' && item.status !== status) continue
      if (keyword && ![item.orderNo, item.shop, item.productCn, item.productKo, item.trackingNo, item.offerId].join(' ').toLowerCase().includes(keyword)) continue
      map.set(item.orderNo, [...(map.get(item.orderNo) || []), item])
    }
    return [...map.entries()].map(([orderNo, orderItems]) => ({
      orderNo,
      orderedOn: orderItems[0].orderedOn,
      shop: orderItems[0].shop,
      status: orderItems[0].status,
      trackingNo: orderItems[0].trackingNo,
      orderPaid: Math.max(...orderItems.map((item) => item.orderPaid)),
      items: orderItems,
    }))
  }, [items, query, status])

  const totalPages = Math.max(1, Math.ceil(groups.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageOffset = (safePage - 1) * pageSize
  const pagedGroups = groups.slice(pageOffset, pageOffset + pageSize)
  const pageNumberStart = Math.min(Math.max(1, safePage - 2), Math.max(1, totalPages - 4))
  const pageNumbers = Array.from({ length: Math.min(5, totalPages) }, (_, index) => pageNumberStart + index)

  useEffect(() => {
    setPage(1)
  }, [query, status, pageSize])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  function toggle(orderNo: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(orderNo)) next.delete(orderNo)
      else next.add(orderNo)
      return next
    })
  }

  async function saveRate(value: number) {
    const next = Math.max(1, value || 204)
    setRate(next)
    try {
      const response = await fetch('/api/admin/1688', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'rate', cnyKrwRate: next }) })
      if (!response.ok) throw new Error()
      setMessage('환율을 저장했습니다.')
    } catch { setMessage('환율을 저장하지 못했습니다.') }
  }

  async function saveItem() {
    if (!editing) return
    setSaving(true)
    setMessage('')
    try {
      const method = editing.id ? 'PATCH' : 'POST'
      const response = await fetch('/api/admin/1688', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '저장 실패')
      setItems((current) => editing.id ? current.map((item) => item.id === result.item.id ? result.item : item) : [result.item, ...current])
      setEditing(null)
      setMessage('구매내역을 저장했습니다.')
    } catch (error) { setMessage(error instanceof Error ? error.message : '저장하지 못했습니다.') }
    finally { setSaving(false) }
  }

  async function removeItem(item: Purchase1688Item) {
    if (!window.confirm(`이 상품을 삭제할까요?\n${item.productKo || item.productCn}`)) return
    try {
      const response = await fetch(`/api/admin/1688?id=${encodeURIComponent(item.id)}`, { method: 'DELETE' })
      if (!response.ok) throw new Error()
      setItems((current) => current.filter((row) => row.id !== item.id))
      setMessage('삭제했습니다.')
    } catch { setMessage('삭제하지 못했습니다.') }
  }

  function downloadBackup() {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), cnyKrwRate: rate, items }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `1688-주문장부-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="w-full min-w-0 max-w-[1180px] space-y-3">
      <PageHeader
        title="1688 구매내역"
        count={groups.length}
        description="구매·배송 내역을 한곳에서 관리하세요"
        actions={(
          <>
            <Button variant="secondary" onClick={downloadBackup} icon={<Download size={15} />}>백업</Button>
            <Button data-primary variant="primary" onClick={() => setEditing(blankItem())} icon={<Plus size={15} />}>주문 추가</Button>
          </>
        )}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 md:flex md:items-center">
          <label className="relative col-span-2 min-w-0 md:flex-1">
            <span className="sr-only">구매내역 검색</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="주문번호, 상품명, 판매자, 운송장 검색" className={fieldClass('pl-10')} />
          </label>
          <label className="min-w-0">
            <span className="sr-only">상태</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className={selectClass(true, 'md:w-auto')}>{['전체', ...statuses].map((value) => <option key={value}>{value}</option>)}</select>
          </label>
          <label title="환율 변경은 입력칸을 벗어나면 저장되며 전체 목록의 원화 예상액에 적용됩니다." className="flex min-h-10 items-center gap-1.5 whitespace-nowrap text-xs font-bold text-slate-500 md:ml-auto md:border-l md:border-slate-200 md:pl-3">
            환율 ¥1 =
            <input aria-label="위안 환율" type="number" value={rate} onChange={(event) => setRate(Number(event.target.value))} onBlur={(event) => saveRate(Number(event.target.value))} className={fieldClass('h-9 w-20 px-2 text-right tabular-nums')} />
            원
          </label>
        </div>
        {message && <div role="status" className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">{message}</div>}
      </section>

      <div className="rounded-2xl border border-slate-200 bg-white">
        {groups.length ? (
          <div aria-hidden="true" className="sticky top-14 z-10 hidden grid-cols-[64px_minmax(0,1fr)_56px_72px_104px_112px_40px] items-center gap-3 rounded-t-2xl border-b border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-bold text-slate-500 md:grid lg:top-[60px]">
            <span />
            <span>상품 · 판매자 · 주문번호</span>
            <span className="text-right">품목</span>
            <span className="text-right">총수량</span>
            <span className="text-right">주문결제액</span>
            <span className="text-right">한화 예상</span>
            <span />
          </div>
        ) : null}
        {pagedGroups.map((group) => {
          const isOpen = expanded.has(group.orderNo)
          const quantity = group.items.reduce((sum, item) => sum + item.quantity, 0)
          const lead = group.items[0]
          const isCancelled = group.status === '취소'
          const strike = isCancelled ? 'line-through decoration-2 text-slate-500' : 'text-slate-900'
          return (
            <article key={group.orderNo} className="border-b border-slate-200 last:border-b-0">
              <div className={`grid min-w-0 grid-cols-[64px_minmax(0,1fr)_40px] gap-3 px-3 py-3 transition-opacity sm:px-4 md:grid-cols-[64px_minmax(0,1fr)_56px_72px_104px_112px_40px] md:items-center ${isCancelled ? 'opacity-60 [&_img]:grayscale' : ''}`}>
                <ProductImage item={lead} size={64} />
                <button type="button" onClick={() => toggle(group.orderNo)} aria-expanded={isOpen} className="min-w-0 text-left">
                  <span className="flex min-w-0 items-center gap-2">
                    <Badge tone={statusTone(group.status)}>{group.status}</Badge>
                    <span className="shrink-0 text-xs font-bold tabular-nums text-slate-500">{formatDate(group.orderedOn)}</span>
                  </span>
                  <span className="mt-1 block truncate text-[15px] font-bold text-slate-900">{lead.productKo || lead.productCn}</span>
                  {lead.productKo ? <span className="block truncate text-xs text-slate-500">{lead.productCn}</span> : null}
                  {/* Seller, order number and tracking each get their own look so the three meta lines don't blur together. */}
                  <span className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-slate-600">
                    <Store size={12} className="shrink-0 text-slate-400" aria-hidden="true" />
                    <span className="truncate">{group.shop || '판매자 미확인'}</span>
                  </span>
                  <span className="block break-all font-mono text-[11px] text-slate-400 md:truncate md:break-normal">주문번호 {group.orderNo}</span>
                  {group.trackingNo ? <span className="block truncate font-mono text-[11px] text-slate-500">운송장 {group.trackingNo}</span> : null}
                </button>
                <button type="button" onClick={() => toggle(group.orderNo)} aria-label={isOpen ? '주문 접기' : '주문 펼치기'} aria-expanded={isOpen} className={buttonClass('ghost', 'iconMd', 'h-10 w-10 self-start rounded-full md:order-last md:self-center')}>{isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</button>
                {/* Phones: one summary line (count · qty · ¥) with the won estimate on the right, labels for screen readers only. */}
                <p className="col-span-3 flex min-w-0 items-baseline justify-between gap-3 md:hidden">
                  <span className={`truncate text-xs font-bold tabular-nums ${isCancelled ? 'text-slate-400 line-through' : 'text-slate-500'}`}>
                    <span className="sr-only">품목 </span>{group.items.length}개 · <span className="sr-only">총수량 </span>{money(quantity, 0)} · <span className="sr-only">주문결제액 </span>¥{money(group.orderPaid)}
                  </span>
                  <span className={`shrink-0 text-sm font-black tabular-nums ${strike}`}><span className="sr-only">한화 예상 </span>{formatWon(group.orderPaid * rate)}</span>
                </p>
                <dl className="hidden md:contents md:text-right">
                  <OrderMetric label="품목" value={`${group.items.length}개`} />
                  <OrderMetric label="총수량" value={money(quantity, 0)} />
                  <OrderMetric label="주문결제액" value={`¥${money(group.orderPaid)}`} className={strike} />
                  <OrderMetric label="한화 예상" value={formatWon(group.orderPaid * rate)} className={strike} />
                </dl>
              </div>
              {isOpen && <div className="border-t border-slate-200 bg-slate-50 p-3 sm:p-4"><div className="space-y-2">{group.items.map((item) => <ItemRow key={item.id} item={item} rate={rate} disabled={isCancelled} onEdit={() => setEditing({ ...item })} onDelete={() => removeItem(item)} />)}</div></div>}
            </article>
          )
        })}
        {!groups.length && <EmptyState bare icon={<Box size={20} />} title="조건에 맞는 구매내역이 없습니다." />}
      </div>

      {groups.length ? (
        <footer className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[12px] font-bold text-slate-500 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <span>
              총 <strong className="tabular-nums text-slate-900">{money(groups.length, 0)}</strong>건 중{' '}
              {money(pageOffset + 1, 0)}-{money(Math.min(pageOffset + pageSize, groups.length), 0)} 표시
            </span>
            <label className="inline-flex items-center gap-2">
              <span className="sr-only">페이지당 표시 수</span>
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value) as (typeof pageSizeOptions)[number])}
                className={selectClass(true, 'h-9 w-auto text-[12px]')}
              >
                {pageSizeOptions.map((size) => <option key={size} value={size}>{size}건씩 보기</option>)}
              </select>
            </label>
          </div>
          <nav className="flex flex-wrap items-center gap-1" aria-label="구매내역 페이지">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={safePage <= 1}
              className={buttonClass('secondary', 'icon', 'w-9')}
              aria-label="이전 페이지"
            >
              <ChevronLeft size={16} />
            </button>
            {pageNumbers.map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => setPage(pageNumber)}
                className={buttonClass(pageNumber === safePage ? 'primary' : 'secondary', 'sm', 'min-w-9 px-2')}
                aria-current={pageNumber === safePage ? 'page' : undefined}
              >
                {pageNumber}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={safePage >= totalPages}
              className={buttonClass('secondary', 'icon', 'w-9')}
              aria-label="다음 페이지"
            >
              <ChevronRight size={16} />
            </button>
          </nav>
        </footer>
      ) : null}

      {editing && <EditModal item={editing} setItem={setEditing} saving={saving} onSave={saveItem} onClose={() => setEditing(null)} />}
    </div>
  )
}

/** Product thumbnail: pulses while loading, shows ImageOff when there is no image or it fails. */
function ProductImage({ item, size }: { item: Purchase1688Item; size: 64 | 88 }) {
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading')
  const box = size === 64 ? 'h-16 w-16 rounded-lg border border-slate-200' : 'h-[88px] w-[88px] rounded-xl'
  const showImage = item.imageUrl && state !== 'failed'
  return <div className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-slate-100 ${box} ${showImage && state === 'loading' ? 'animate-pulse' : ''}`}>
    {showImage
      ? <Image src={item.imageUrl} alt={item.productKo || item.productCn} fill sizes={`${size}px`} className="object-cover" onLoad={() => setState('loaded')} onError={() => setState('failed')} />
      : <ImageOff size={size === 64 ? 18 : 24} className="text-slate-300" aria-hidden="true" />}
  </div>
}

/** On phones a labelled cell in the summary strip; from md up a plain right-aligned column under the list header. */
function OrderMetric({ label, value, className = 'text-slate-900' }: { label: string; value: string; className?: string }) {
  return <div className="min-w-0">
    <dt className="truncate text-[11px] font-bold text-slate-500 md:sr-only">{label}</dt>
    <dd className={`truncate text-sm font-black tabular-nums ${className}`}>{value}</dd>
  </div>
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div><div className="text-[11px] font-bold text-slate-500">{label}</div><div className="mt-0.5 font-black tabular-nums text-slate-900">{value}</div>{sub && <div className="text-xs font-bold tabular-nums text-slate-500">{sub}</div>}</div>
}

function ItemRow({ item, rate, disabled, onEdit, onDelete }: { item: Purchase1688Item; rate: number; disabled?: boolean; onEdit: () => void; onDelete: () => void }) {
  return <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[88px_minmax(0,1fr)_120px_140px_auto] sm:items-center">
    <ProductImage item={item} size={88} />
    <div className="min-w-0"><p className="line-clamp-2 text-sm font-bold leading-5 text-slate-800">{item.productCn}</p><p className="mt-1 line-clamp-2 text-sm font-bold leading-5 text-slate-600">{item.productKo || '한글 상품명 미등록'}</p>{item.spec && <p className="mt-1 text-xs text-slate-500">{item.spec}</p>}</div>
    <Metric label="수량 · 단가" value={`${money(item.quantity, 0)}개 · ¥${money(item.unitPrice)}`} />
    <Metric label="품목 금액" value={`¥${money(item.itemTotal)}`} sub={`≈ ${formatWon(item.itemTotal * rate)}`} />
    <div className="flex gap-1 sm:justify-end">
      {item.sourceUrl && (
        disabled
          ? <span aria-disabled="true" className={buttonClass('ghost', 'iconMd', 'opacity-50')}><ExternalLink size={16} /></span>
          : <a href={item.sourceUrl} target="_blank" rel="noreferrer" aria-label="1688 상품 열기" title="1688 상품 열기" className={buttonClass('ghost', 'iconMd')}><ExternalLink size={16} /></a>
      )}
      <button type="button" onClick={onEdit} disabled={disabled} aria-label="수정" title="수정" className={buttonClass('ghost', 'iconMd')}><Pencil size={16} /></button>
      <button type="button" onClick={onDelete} disabled={disabled} aria-label="삭제" title="삭제" className={buttonClass('dangerGhost', 'iconMd')}><Trash2 size={16} /></button>
    </div>
  </div>
}

function EditModal({ item, setItem, saving, onSave, onClose }: { item: Purchase1688Item; setItem: (item: Purchase1688Item) => void; saving: boolean; onSave: () => void; onClose: () => void }) {
  const field = (key: keyof Purchase1688Item, value: string | number) => setItem({ ...item, [key]: value })
  const title = item.id ? '구매내역 수정' : '구매내역 추가'
  return <Modal labelledBy="purchase-1688-modal-title" onClose={onClose} className="bg-slate-950/50">
    <div className="flex h-full w-full items-end justify-center sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 id="purchase-1688-modal-title" className="text-lg font-extrabold text-slate-950">{title}</h2><p className="text-xs text-slate-500">저장하면 데이터베이스에 바로 반영됩니다.</p></div><ModalCloseButton onClick={onClose} /></div>
        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5 sm:grid-cols-2">
          <Input label="주문번호 *" value={item.orderNo} onChange={(v) => field('orderNo', v)} /><Input label="주문일" type="date" value={item.orderedOn} onChange={(v) => field('orderedOn', v)} /><Input label="판매자" value={item.shop} onChange={(v) => field('shop', v)} wide /><Input label="중문 상품명 *" value={item.productCn} onChange={(v) => field('productCn', v)} wide textarea /><Input label="한글 상품명" value={item.productKo} onChange={(v) => field('productKo', v)} wide /><Input label="규격/옵션" value={item.spec} onChange={(v) => field('spec', v)} wide />
          <Input label="수량" type="number" value={item.quantity} onChange={(v) => field('quantity', Number(v))} /><Input label="단가(¥)" type="number" value={item.unitPrice} onChange={(v) => field('unitPrice', Number(v))} /><Input label="품목 금액(¥)" type="number" value={item.itemTotal} onChange={(v) => field('itemTotal', Number(v))} /><Input label="주문 결제액(¥)" type="number" value={item.orderPaid} onChange={(v) => field('orderPaid', Number(v))} />
          <label className="block"><span className={labelClass}>상태</span><select value={item.status} onChange={(e) => field('status', e.target.value)} className={selectClass(true)}>{statuses.map((value) => <option key={value}>{value}</option>)}</select></label><Input label="운송장번호" value={item.trackingNo} onChange={(v) => field('trackingNo', v)} /><Input label="상품 링크" value={item.sourceUrl} onChange={(v) => field('sourceUrl', v)} wide /><Input label="메모" value={item.note} onChange={(v) => field('note', v)} wide textarea />
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 bg-white p-4"><Button variant="secondary" onClick={onClose}>취소</Button><Button variant="primary" disabled={!item.orderNo || !item.productCn} loading={saving} onClick={onSave}>{saving ? '저장 중…' : '저장'}</Button></div>
      </div>
    </div>
  </Modal>
}

function Input({ label, value, onChange, type = 'text', wide, textarea }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; wide?: boolean; textarea?: boolean }) {
  return <label className={`block ${wide ? 'sm:col-span-2' : ''}`}><span className={labelClass}>{label}</span>{textarea ? <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className={fieldClass('h-auto py-2.5')} /> : <input type={type} value={value} onChange={(e) => onChange(e.target.value)} step={type === 'number' ? 'any' : undefined} className={fieldClass(type === 'number' ? 'text-right tabular-nums' : '')} />}</label>
}
