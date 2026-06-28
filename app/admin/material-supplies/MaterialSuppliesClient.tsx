'use client'

import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { CheckCircle2, ExternalLink, PackagePlus, Pencil, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react'

export type MaterialSupplyItem = {
  id: string
  name: string
  category: string
  supplierName: string
  purchaseUrl: string
  unit: string
  priceKrw: number | null
  memo: string
  active: boolean
  sortOrder: number
  lastPurchasedAt: string | null
  createdAt: string
  updatedAt: string
}

type FormState = {
  id: string | null
  name: string
  category: string
  supplierName: string
  purchaseUrl: string
  unit: string
  priceKrw: string
  memo: string
  sortOrder: string
  active: boolean
}

const emptyForm = (): FormState => ({
  id: null,
  name: '',
  category: '',
  supplierName: '',
  purchaseUrl: '',
  unit: '',
  priceKrw: '',
  memo: '',
  sortOrder: '0',
  active: true,
})

const formatCurrency = (value: number | null) => {
  if (!value) return '-'
  return `${value.toLocaleString()}원`
}

const formatDateTime = (value: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export default function MaterialSuppliesClient({ initialItems }: { initialItems: MaterialSupplyItem[] }) {
  const [items, setItems] = useState(initialItems)
  const [form, setForm] = useState<FormState>(() => emptyForm())
  const [query, setQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<'active' | 'all' | 'inactive'>('active')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const categories = useMemo(() => {
    return Array.from(new Set(items.map((item) => item.category.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko'))
  }, [items])

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return items.filter((item) => {
      if (activeFilter === 'active' && !item.active) return false
      if (activeFilter === 'inactive' && item.active) return false
      if (!needle) return true
      return [item.name, item.category, item.supplierName, item.unit, item.memo]
        .some((value) => value.toLowerCase().includes(needle))
    })
  }, [activeFilter, items, query])

  const setFormValue = (key: keyof FormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const editItem = (item: MaterialSupplyItem) => {
    setForm({
      id: item.id,
      name: item.name,
      category: item.category,
      supplierName: item.supplierName,
      purchaseUrl: item.purchaseUrl,
      unit: item.unit,
      priceKrw: item.priceKrw ? String(item.priceKrw) : '',
      memo: item.memo,
      sortOrder: String(item.sortOrder || 0),
      active: item.active,
    })
  }

  const upsertItem = (item: MaterialSupplyItem) => {
    setItems((prev) => {
      const next = [item, ...prev.filter((row) => row.id !== item.id)]
      return next.sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1
        const categoryCompare = a.category.localeCompare(b.category, 'ko')
        if (categoryCompare !== 0) return categoryCompare
        const sortCompare = a.sortOrder - b.sortOrder
        if (sortCompare !== 0) return sortCompare
        return a.name.localeCompare(b.name, 'ko')
      })
    })
  }

  const submitForm = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/admin/material-supplies', {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || '부자재를 저장하지 못했습니다.')
      upsertItem(data.item)
      setForm(emptyForm())
    } catch (error) {
      alert(error instanceof Error ? error.message : '부자재를 저장하지 못했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const deleteItem = async (item: MaterialSupplyItem) => {
    if (!confirm(`${item.name} 항목을 삭제할까요?`)) return
    setBusyId(item.id)
    try {
      const response = await fetch(`/api/admin/material-supplies?id=${encodeURIComponent(item.id)}`, { method: 'DELETE' })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || '부자재를 삭제하지 못했습니다.')
      setItems((prev) => prev.filter((row) => row.id !== item.id))
      if (form.id === item.id) setForm(emptyForm())
    } catch (error) {
      alert(error instanceof Error ? error.message : '부자재를 삭제하지 못했습니다.')
    } finally {
      setBusyId(null)
    }
  }

  const markPurchased = async (item: MaterialSupplyItem) => {
    setBusyId(item.id)
    try {
      const response = await fetch('/api/admin/material-supplies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, markPurchased: true }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || '구매 기록을 저장하지 못했습니다.')
      upsertItem(data.item)
    } catch (error) {
      alert(error instanceof Error ? error.message : '구매 기록을 저장하지 못했습니다.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[#EF3B2D]">Purchase Links</div>
            <h1 className="mt-1 text-[26px] font-black tracking-tight text-slate-950">부자재 주문</h1>
            <p className="mt-1 text-[13px] font-bold text-slate-500">자주 사는 부자재와 구매 링크를 저장해두고 바로 재구매합니다.</p>
          </div>
          <button
            type="button"
            onClick={() => setForm(emptyForm())}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-[12px] font-black text-white hover:bg-slate-800"
          >
            <Plus size={15} />
            새 부자재
          </button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="부자재명, 카테고리, 구매처, 메모 검색"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-[13px] font-bold outline-none focus:border-slate-400"
              />
            </div>
            <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              {[
                ['active', '사용중'],
                ['all', '전체'],
                ['inactive', '비활성'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setActiveFilter(value as typeof activeFilter)}
                  className={`h-9 rounded-lg px-3 text-[12px] font-black ${activeFilter === value ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-500 hover:bg-white'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {filteredItems.length ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {filteredItems.map((item) => (
                <article key={item.id} className={`rounded-xl border p-4 ${item.active ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50 opacity-70'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-600">{item.category || '미분류'}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${item.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {item.active ? '사용중' : '비활성'}
                        </span>
                      </div>
                      <h2 className="mt-2 truncate text-[16px] font-black text-slate-950">{item.name}</h2>
                      <p className="mt-1 text-[12px] font-bold text-slate-500">{item.supplierName || '구매처 미입력'} · {item.unit || '단위 미입력'} · {formatCurrency(item.priceKrw)}</p>
                    </div>
                    <button type="button" onClick={() => editItem(item)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" title="수정">
                      <Pencil size={15} />
                    </button>
                  </div>
                  {item.memo ? <p className="mt-3 line-clamp-2 text-[12px] font-bold leading-5 text-slate-600">{item.memo}</p> : null}
                  <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-500">
                    최근 구매 기록: {formatDateTime(item.lastPurchasedAt)}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={item.purchaseUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-[#EF3B2D] px-3 text-[12px] font-black text-white hover:bg-[#d83326]"
                    >
                      <ExternalLink size={14} />
                      구매하기
                    </a>
                    <button
                      type="button"
                      onClick={() => markPurchased(item)}
                      disabled={busyId === item.id}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 text-[12px] font-black text-emerald-700 hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-60"
                    >
                      <CheckCircle2 size={14} />
                      구매완료
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteItem(item)}
                      disabled={busyId === item.id}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-500 hover:bg-red-100 disabled:cursor-wait disabled:opacity-60"
                      title="삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center">
              <PackagePlus size={28} className="mx-auto text-slate-400" />
              <p className="mt-3 text-[13px] font-black text-slate-700">저장된 부자재가 없습니다.</p>
              <p className="mt-1 text-[12px] font-bold text-slate-500">오른쪽 입력창에서 부자재와 구매 링크를 추가하세요.</p>
            </div>
          )}
        </section>

        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-24">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-black text-slate-950">{form.id ? '부자재 수정' : '부자재 등록'}</h2>
              <p className="mt-1 text-[12px] font-bold text-slate-500">구매 링크는 http 또는 https 주소를 넣어주세요.</p>
            </div>
            <ShoppingCart size={20} className="text-slate-400" />
          </div>

          <div className="space-y-3">
            <Field label="부자재명">
              <input className={inputClass} value={form.name} onChange={(event) => setFormValue('name', event.target.value)} placeholder="예: 택배 박스 3호" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="카테고리">
                <input className={inputClass} list="material-supply-categories" value={form.category} onChange={(event) => setFormValue('category', event.target.value)} placeholder="포장" />
                <datalist id="material-supply-categories">
                  {categories.map((category) => <option key={category} value={category} />)}
                </datalist>
              </Field>
              <Field label="구매처">
                <input className={inputClass} value={form.supplierName} onChange={(event) => setFormValue('supplierName', event.target.value)} placeholder="쿠팡, 네이버..." />
              </Field>
            </div>
            <Field label="구매 링크">
              <input className={inputClass} value={form.purchaseUrl} onChange={(event) => setFormValue('purchaseUrl', event.target.value)} placeholder="https://..." />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="단위">
                <input className={inputClass} value={form.unit} onChange={(event) => setFormValue('unit', event.target.value)} placeholder="100개" />
              </Field>
              <Field label="가격">
                <input inputMode="numeric" className={inputClass} value={form.priceKrw} onChange={(event) => setFormValue('priceKrw', event.target.value)} placeholder="12500" />
              </Field>
              <Field label="정렬">
                <input inputMode="numeric" className={inputClass} value={form.sortOrder} onChange={(event) => setFormValue('sortOrder', event.target.value)} />
              </Field>
            </div>
            <Field label="메모">
              <textarea className={`${inputClass} min-h-24 resize-none py-3`} value={form.memo} onChange={(event) => setFormValue('memo', event.target.value)} placeholder="규격, 주의사항, 대체 구매처 등" />
            </Field>
            <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-[12px] font-black text-slate-700">
              사용중으로 표시
              <input type="checkbox" checked={form.active} onChange={(event) => setFormValue('active', event.target.checked)} className="h-4 w-4 accent-slate-950" />
            </label>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={submitForm}
                disabled={saving}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 text-[13px] font-black text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
              >
                {saving ? '저장 중' : form.id ? '수정 저장' : '등록'}
              </button>
              <button type="button" onClick={() => setForm(emptyForm())} className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-black text-slate-600 hover:bg-slate-50">
                초기화
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-black text-slate-500">{label}</span>
      {children}
    </label>
  )
}

const inputClass = 'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-bold text-slate-950 outline-none focus:border-slate-400'
