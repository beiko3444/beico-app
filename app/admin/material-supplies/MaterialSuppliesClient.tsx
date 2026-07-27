'use client'

import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { CheckCircle2, ExternalLink, PackagePlus, Pencil, Plus, Search, ShoppingCart, Trash2, X } from 'lucide-react'
import { getMaterialSupplyUnitPrice } from '@/lib/materialSupplies'

export type MaterialSupplyItem = {
  id: string
  name: string
  category: string
  supplierName: string
  purchaseUrl: string
  unit: string
  priceKrw: number | null
  widthValue: number | null
  depthValue: number | null
  heightValue: number | null
  dimensionUnit: string
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
  widthValue: string
  depthValue: string
  heightValue: string
  dimensionUnit: 'mm' | 'cm'
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
  widthValue: '',
  depthValue: '',
  heightValue: '',
  dimensionUnit: 'mm',
  memo: '',
  sortOrder: '0',
  active: true,
})

const formatCurrency = (value: number | null) => {
  if (!value) return '-'
  return `${value.toLocaleString()}원`
}

const parsePriceInput = (value: string) => {
  const parsed = Number(value.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

const formatUnitPrice = (value: number | null) => {
  if (!value) return '단위와 가격을 입력하면 자동 계산됩니다.'
  const rounded = Math.round(value * 10) / 10
  return `개당 ${rounded.toLocaleString(undefined, { maximumFractionDigits: 1 })}원`
}

const formatDimension = (item: Pick<MaterialSupplyItem, 'widthValue' | 'depthValue' | 'heightValue' | 'dimensionUnit'>) => {
  const values = [item.widthValue, item.depthValue, item.heightValue]
  if (values.some((value) => !value || value <= 0)) return ''
  return `${values.map((value) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })).join(' x ')} ${item.dimensionUnit || 'mm'}`
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
  const [formOpen, setFormOpen] = useState(false)
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

  const formUnitPrice = useMemo(() => {
    return getMaterialSupplyUnitPrice(parsePriceInput(form.priceKrw), form.unit)
  }, [form.priceKrw, form.unit])

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
      widthValue: item.widthValue ? String(item.widthValue) : '',
      depthValue: item.depthValue ? String(item.depthValue) : '',
      heightValue: item.heightValue ? String(item.heightValue) : '',
      dimensionUnit: item.dimensionUnit === 'cm' ? 'cm' : 'mm',
      memo: item.memo,
      sortOrder: String(item.sortOrder || 0),
      active: item.active,
    })
    setFormOpen(true)
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
      setFormOpen(false)
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
      if (form.id === item.id) {
        setForm(emptyForm())
        setFormOpen(false)
      }
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
    <div className="space-y-3">
      <header className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-[#EF3B2D]">
            <PackagePlus size={20} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[20px] font-black tracking-tight text-slate-950">부자재 주문</h1>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-600">{filteredItems.length}개</span>
            </div>
            <p className="text-[11px] font-bold text-slate-500">자주 구매하는 품목을 빠르게 찾고 재주문합니다.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setForm(emptyForm())
            setFormOpen(true)
          }}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-slate-950 px-3.5 text-[12px] font-black text-white transition hover:bg-slate-800"
        >
          <Plus size={14} />
          새 부자재
        </button>
      </header>

      <div className={`grid items-start gap-3 ${formOpen ? 'xl:grid-cols-[minmax(0,1fr)_360px]' : ''}`}>
        <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="부자재명 · 카테고리 · 구매처 검색"
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-[12px] font-bold outline-none transition focus:border-slate-400 focus:bg-white"
              />
            </div>
            <div className="flex shrink-0 rounded-lg bg-slate-100 p-0.5">
              {[
                ['active', '사용중'],
                ['all', '전체'],
                ['inactive', '비활성'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setActiveFilter(value as typeof activeFilter)}
                  className={`h-8 rounded-md px-3 text-[11px] font-black transition ${activeFilter === value ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {categories.length ? (
            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setQuery(query === category ? '' : category)}
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black transition ${
                    query === category
                      ? 'border-slate-950 bg-slate-950 text-white'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          ) : null}

          {filteredItems.length ? (
            <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-2">
              {filteredItems.map((item) => {
                const unitPrice = getMaterialSupplyUnitPrice(item.priceKrw, item.unit)
                const dimension = formatDimension(item)
                return (
                  <article
                    key={item.id}
                    className={`group flex min-h-[178px] flex-col rounded-xl border p-3 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md ${
                      item.active ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50 opacity-65'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-black text-slate-500">{item.category || '미분류'}</span>
                          {!item.active ? <span className="text-[9px] font-black text-slate-400">비활성</span> : null}
                        </div>
                        <h2 className="mt-1.5 line-clamp-2 text-[14px] font-black leading-[1.35] text-slate-950">{item.name}</h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => editItem(item)}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        title="수정"
                      >
                        <Pencil size={13} />
                      </button>
                    </div>

                    <div className="mt-2 flex items-end justify-between gap-2 border-t border-slate-100 pt-2">
                      <div className="min-w-0">
                        <p className="truncate text-[10px] font-bold text-slate-400">{item.supplierName || '구매처 미입력'} · {item.unit || '단위 미입력'}</p>
                        <p className="mt-0.5 text-[15px] font-black text-slate-950">{formatCurrency(item.priceKrw)}</p>
                      </div>
                      <span className="shrink-0 text-right text-[10px] font-black text-[#EF3B2D]">
                        {unitPrice ? `개당 ${(Math.round(unitPrice * 10) / 10).toLocaleString()}원` : '-'}
                      </span>
                    </div>

                    <div className="mt-1.5 min-h-[32px] text-[10px] font-bold leading-4 text-slate-500">
                      {dimension ? <span>규격 {dimension}</span> : null}
                      {item.memo ? <p className="truncate">{item.memo}</p> : null}
                    </div>

                    <p className="mt-auto truncate text-[9px] font-bold text-slate-400">
                      최근 구매 {formatDateTime(item.lastPurchasedAt)}
                    </p>
                    <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-1.5">
                      <a
                        href={item.purchaseUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-8 min-w-0 items-center justify-center gap-1 rounded-lg bg-[#EF3B2D] px-2 text-[11px] font-black text-white transition hover:bg-[#D83326]"
                      >
                        <ExternalLink size={12} />
                        구매
                      </a>
                      <button
                        type="button"
                        onClick={() => markPurchased(item)}
                        disabled={busyId === item.id}
                        className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-emerald-200 px-2 text-[10px] font-black text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
                        title="구매 완료 기록"
                      >
                        <CheckCircle2 size={12} />
                        완료
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteItem(item)}
                        disabled={busyId === item.id}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                        title="삭제"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-14 text-center">
              <PackagePlus size={25} className="mx-auto text-slate-300" />
              <p className="mt-2 text-[12px] font-black text-slate-700">조건에 맞는 부자재가 없습니다.</p>
              <button
                type="button"
                onClick={() => {
                  setForm(emptyForm())
                  setFormOpen(true)
                }}
                className="mt-3 text-[11px] font-black text-[#EF3B2D]"
              >
                새 부자재 등록
              </button>
            </div>
          )}
        </section>

        {formOpen ? (
          <aside className="rounded-xl border border-slate-200 bg-white shadow-lg xl:sticky xl:top-20">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <ShoppingCart size={16} />
                </span>
                <div>
                  <h2 className="text-[14px] font-black text-slate-950">{form.id ? '부자재 수정' : '새 부자재'}</h2>
                  <p className="text-[10px] font-bold text-slate-400">필요한 정보만 빠르게 입력하세요.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                title="닫기"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-[calc(100vh-150px)] space-y-2.5 overflow-y-auto p-4">
            <Field label="부자재명">
              <input className={inputClass} value={form.name} onChange={(event) => setFormValue('name', event.target.value)} placeholder="예: 택배 박스 3호" />
            </Field>
            <div className="grid grid-cols-2 gap-2">
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
            <div className="grid grid-cols-3 gap-2">
              <Field label="단위">
                <input className={inputClass} value={form.unit} onChange={(event) => setFormValue('unit', event.target.value)} placeholder="100개" />
              </Field>
              <Field label="가격">
                <input inputMode="numeric" className={inputClass} value={form.priceKrw} onChange={(event) => setFormValue('priceKrw', event.target.value)} placeholder="12500" />
              </Field>
              <Field label="정렬(표시순서)">
                <input inputMode="numeric" className={inputClass} value={form.sortOrder} onChange={(event) => setFormValue('sortOrder', event.target.value)} />
              </Field>
            </div>
            <div className="rounded-lg bg-slate-50 p-2.5">
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span className="text-[10px] font-black text-slate-500">규격 (선택)</span>
                <select
                  className="h-7 rounded-md border border-slate-200 bg-white px-2 text-[10px] font-black text-slate-700 outline-none"
                  value={form.dimensionUnit}
                  onChange={(event) => setFormValue('dimensionUnit', event.target.value === 'cm' ? 'cm' : 'mm')}
                >
                  <option value="mm">mm</option>
                  <option value="cm">cm</option>
                </select>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <Field label="가로">
                  <input inputMode="decimal" className={inputClass} value={form.widthValue} onChange={(event) => setFormValue('widthValue', event.target.value)} placeholder="0" />
                </Field>
                <Field label="세로">
                  <input inputMode="decimal" className={inputClass} value={form.depthValue} onChange={(event) => setFormValue('depthValue', event.target.value)} placeholder="0" />
                </Field>
                <Field label="높이">
                  <input inputMode="decimal" className={inputClass} value={form.heightValue} onChange={(event) => setFormValue('heightValue', event.target.value)} placeholder="0" />
                </Field>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50/70 px-3 py-2 text-[11px] font-black">
                <span className="text-slate-500">개당 단가</span>
                <span className={formUnitPrice ? 'text-[#EF3B2D]' : 'text-slate-400'}>{formatUnitPrice(formUnitPrice)}</span>
            </div>
            <Field label="메모">
              <textarea className={`${inputClass} min-h-16 resize-none py-2`} value={form.memo} onChange={(event) => setFormValue('memo', event.target.value)} placeholder="주의사항, 대체 구매처 등" />
            </Field>
            <label className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-[11px] font-black text-slate-700">
              사용중으로 표시
              <input type="checkbox" checked={form.active} onChange={(event) => setFormValue('active', event.target.checked)} className="h-4 w-4 accent-slate-950" />
            </label>
            <div className="flex gap-2 pt-1.5">
              <button
                type="button"
                onClick={submitForm}
                disabled={saving}
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-slate-950 text-[12px] font-black text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
              >
                {saving ? '저장 중' : form.id ? '수정 저장' : '등록'}
              </button>
              <button type="button" onClick={() => setForm(emptyForm())} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-black text-slate-600 hover:bg-slate-50">
                초기화
              </button>
            </div>
          </div>
        </aside>
        ) : null}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-black text-slate-500">{label}</span>
      {children}
    </label>
  )
}

const inputClass = 'h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-bold text-slate-950 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100'
