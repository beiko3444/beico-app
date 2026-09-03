'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import {
  Box,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ImageOff,
  PackageCheck,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'

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
const blankItem = (): Purchase1688Item => ({
  id: '', orderNo: '', orderedOn: new Date().toISOString().slice(0, 10), shop: '', productCn: '', productKo: '', spec: '',
  quantity: 1, unitPrice: 0, itemTotal: 0, orderPaid: 0, status: '확인필요', trackingNo: '', note: '', offerId: '', skuId: '', imageUrl: '', sourceUrl: '', createdAt: '', updatedAt: '',
})

const money = (value: number, digits = 2) => value.toLocaleString('ko-KR', { maximumFractionDigits: digits })

function statusStyle(status: string) {
  if (status === '완료') return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  if (status === '취소') return 'bg-rose-50 text-rose-700 ring-rose-200'
  if (status === '배송중') return 'bg-blue-50 text-blue-700 ring-blue-200'
  if (status === '결제완료') return 'bg-amber-50 text-amber-700 ring-amber-200'
  return 'bg-slate-100 text-slate-700 ring-slate-200'
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

  const totals = useMemo(() => ({
    orders: new Set(items.map((item) => item.orderNo)).size,
    products: items.length,
    quantity: items.reduce((sum, item) => sum + item.quantity, 0),
    paid: [...new Map(items.map((item) => [item.orderNo, item.orderPaid])).values()].reduce((sum, value) => sum + value, 0),
  }), [items])

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

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-4">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-5 bg-gradient-to-br from-[#fff7f2] via-white to-[#fffaf7] p-5 sm:p-7 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[#ef5b2a]"><PackageCheck size={16} /> 1688 Purchase Ledger</div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">1688 구매내역</h1>
            <p className="mt-2 text-sm text-slate-500">중문·한글 상품명, 주문 금액, 배송 정보를 한 화면에서 관리합니다.</p>
          </div>
          <button onClick={() => setEditing(blankItem())} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#ef5b2a] px-5 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#d94b1e] focus:outline-none focus:ring-2 focus:ring-[#ef5b2a] focus:ring-offset-2"><Plus size={18} /> 내역 추가</button>
        </div>
        <div className="grid grid-cols-2 border-t border-slate-100 lg:grid-cols-4">
          {[
            ['주문', `${money(totals.orders, 0)}건`], ['품목', `${money(totals.products, 0)}개`], ['총수량', `${money(totals.quantity, 0)}개`], ['주문결제액', `¥${money(totals.paid)} · ≈${money(totals.paid * rate, 0)}원`],
          ].map(([label, value]) => <div key={label} className="border-b border-r border-slate-100 p-4 last:border-r-0 lg:border-b-0"><div className="text-xs font-bold text-slate-400">{label}</div><div className="mt-1 text-lg font-black text-slate-900">{value}</div></div>)}
        </div>
      </section>

      <section className="sticky top-[68px] z-20 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur sm:top-[76px]">
        <div className="flex flex-col gap-2 md:flex-row">
          <label className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="주문번호, 상품명, 판매자, 운송장 검색" className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none transition focus:border-[#ef5b2a] focus:bg-white focus:ring-2 focus:ring-orange-100" /></label>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-[#ef5b2a]">{['전체', ...statuses].map((value) => <option key={value}>{value}</option>)}</select>
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-500">¥1 ≈ <input aria-label="위안 환율" type="number" value={rate} onChange={(event) => setRate(Number(event.target.value))} onBlur={(event) => saveRate(Number(event.target.value))} className="w-16 bg-transparent text-right text-sm font-black text-slate-900 outline-none" />원</label>
        </div>
        {message && <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">{message}</div>}
      </section>

      <div className="space-y-3">
        {groups.map((group) => {
          const isOpen = expanded.has(group.orderNo)
          const quantity = group.items.reduce((sum, item) => sum + item.quantity, 0)
          return (
            <article key={group.orderNo} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <button onClick={() => toggle(group.orderNo)} className="grid w-full gap-4 p-4 text-left transition hover:bg-slate-50 sm:p-5 lg:grid-cols-[minmax(260px,1.4fr)_100px_110px_210px_32px] lg:items-center">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ring-1 ${statusStyle(group.status)}`}>{group.status}</span><span className="text-xs font-bold text-slate-400">{group.orderedOn}</span></div><div className="mt-2 truncate text-base font-black text-slate-900">주문 {group.orderNo}</div><div className="mt-1 truncate text-sm text-slate-500">{group.shop || '판매자 미확인'}{group.trackingNo ? ` · 운송장 ${group.trackingNo}` : ''}</div></div>
                <Metric label="품목" value={`${group.items.length}개`} />
                <Metric label="총수량" value={`${money(quantity, 0)}개`} />
                <Metric label="주문결제액" value={`¥${money(group.orderPaid)}`} sub={`≈ ${money(group.orderPaid * rate, 0)}원`} />
                <span className="hidden text-slate-400 lg:block">{isOpen ? <ChevronUp /> : <ChevronDown />}</span>
              </button>
              {isOpen && <div className="border-t border-slate-100 bg-slate-50/70 p-3 sm:p-4"><div className="space-y-2">{group.items.map((item) => <ItemRow key={item.id} item={item} rate={rate} onEdit={() => setEditing({ ...item })} onDelete={() => removeItem(item)} />)}</div></div>}
            </article>
          )
        })}
        {!groups.length && <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center"><Box className="mx-auto text-slate-300" size={36} /><p className="mt-3 font-bold text-slate-600">조건에 맞는 구매내역이 없습니다.</p></div>}
      </div>

      {editing && <EditModal item={editing} setItem={setEditing} saving={saving} onSave={saveItem} onClose={() => setEditing(null)} />}
    </div>
  )
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div><div className="text-[11px] font-bold text-slate-400">{label}</div><div className="mt-0.5 font-black text-slate-900">{value}</div>{sub && <div className="text-xs font-bold text-[#ef5b2a]">{sub}</div>}</div>
}

function ItemRow({ item, rate, onEdit, onDelete }: { item: Purchase1688Item; rate: number; onEdit: () => void; onDelete: () => void }) {
  const [imageFailed, setImageFailed] = useState(false)
  return <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[88px_minmax(0,1fr)_120px_140px_auto] sm:items-center">
    <div className="relative flex h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-lg bg-slate-100">{item.imageUrl && !imageFailed ? <Image src={item.imageUrl} alt={item.productKo || item.productCn} fill sizes="88px" className="object-cover" onError={() => setImageFailed(true)} /> : <ImageOff className="text-slate-300" />}</div>
    <div className="min-w-0"><p className="line-clamp-2 text-sm font-bold leading-5 text-slate-800">{item.productCn}</p><p className="mt-1 line-clamp-2 text-sm font-extrabold leading-5 text-[#c9461b]">{item.productKo || '한글 상품명 미등록'}</p>{item.spec && <p className="mt-1 text-xs text-slate-500">{item.spec}</p>}</div>
    <Metric label="수량 · 단가" value={`${money(item.quantity, 0)}개 · ¥${money(item.unitPrice)}`} />
    <Metric label="품목 금액" value={`¥${money(item.itemTotal)}`} sub={`≈ ${money(item.itemTotal * rate, 0)}원`} />
    <div className="flex gap-1 sm:justify-end">{item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer" aria-label="1688 상품 열기" className="flex h-10 w-10 items-center justify-center rounded-lg text-[#ef5b2a] hover:bg-orange-50"><ExternalLink size={18} /></a>}<button onClick={onEdit} aria-label="수정" className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><Pencil size={17} /></button><button onClick={onDelete} aria-label="삭제" className="flex h-10 w-10 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50"><Trash2 size={17} /></button></div>
  </div>
}

function EditModal({ item, setItem, saving, onSave, onClose }: { item: Purchase1688Item; setItem: (item: Purchase1688Item) => void; saving: boolean; onSave: () => void; onClose: () => void }) {
  const field = (key: keyof Purchase1688Item, value: string | number) => setItem({ ...item, [key]: value })
  return <div className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-5" role="dialog" aria-modal="true">
    <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4"><div><h2 className="text-lg font-black text-slate-950">{item.id ? '구매내역 수정' : '구매내역 추가'}</h2><p className="text-xs text-slate-500">저장하면 데이터베이스에 바로 반영됩니다.</p></div><button onClick={onClose} aria-label="닫기" className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-slate-100"><X /></button></div>
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <Input label="주문번호 *" value={item.orderNo} onChange={(v) => field('orderNo', v)} /><Input label="주문일" type="date" value={item.orderedOn} onChange={(v) => field('orderedOn', v)} /><Input label="판매자" value={item.shop} onChange={(v) => field('shop', v)} wide /><Input label="중문 상품명 *" value={item.productCn} onChange={(v) => field('productCn', v)} wide textarea /><Input label="한글 상품명" value={item.productKo} onChange={(v) => field('productKo', v)} wide /><Input label="규격/옵션" value={item.spec} onChange={(v) => field('spec', v)} wide />
        <Input label="수량" type="number" value={item.quantity} onChange={(v) => field('quantity', Number(v))} /><Input label="단가(¥)" type="number" value={item.unitPrice} onChange={(v) => field('unitPrice', Number(v))} /><Input label="품목 금액(¥)" type="number" value={item.itemTotal} onChange={(v) => field('itemTotal', Number(v))} /><Input label="주문 결제액(¥)" type="number" value={item.orderPaid} onChange={(v) => field('orderPaid', Number(v))} />
        <label className="text-xs font-bold text-slate-600"><span className="mb-1.5 block">상태</span><select value={item.status} onChange={(e) => field('status', e.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#ef5b2a]">{statuses.map((value) => <option key={value}>{value}</option>)}</select></label><Input label="운송장번호" value={item.trackingNo} onChange={(v) => field('trackingNo', v)} /><Input label="상품 링크" value={item.sourceUrl} onChange={(v) => field('sourceUrl', v)} wide /><Input label="메모" value={item.note} onChange={(v) => field('note', v)} wide textarea />
      </div>
      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-100 bg-white p-4"><button onClick={onClose} className="min-h-11 rounded-xl border border-slate-200 px-5 text-sm font-bold">취소</button><button disabled={saving || !item.orderNo || !item.productCn} onClick={onSave} className="min-h-11 rounded-xl bg-[#ef5b2a] px-6 text-sm font-extrabold text-white disabled:opacity-40">{saving ? '저장 중…' : '저장'}</button></div>
    </div>
  </div>
}

function Input({ label, value, onChange, type = 'text', wide, textarea }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; wide?: boolean; textarea?: boolean }) {
  return <label className={`text-xs font-bold text-slate-600 ${wide ? 'sm:col-span-2' : ''}`}><span className="mb-1.5 block">{label}</span>{textarea ? <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#ef5b2a]" /> : <input type={type} value={value} onChange={(e) => onChange(e.target.value)} step={type === 'number' ? 'any' : undefined} className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#ef5b2a]" />}</label>
}
