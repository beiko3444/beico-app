'use client'

import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { CheckCircle2, ExternalLink, PackagePlus, Pencil, Plus, Search, ShoppingCart, Trash2, X } from 'lucide-react'
import { getMaterialSupplyUnitPrice } from '@/lib/materialSupplies'
import Button, { buttonClass } from '@/components/ui/Button'
import PageHeader from '@/components/ui/PageHeader'
import Tabs from '@/components/ui/Tabs'
import EmptyState from '@/components/ui/EmptyState'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/Modal'

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

type ActiveFilter = 'active' | 'all' | 'inactive'

const activeFilterItems: Array<{ key: ActiveFilter; label: string }> = [
  { key: 'active', label: '사용중' },
  { key: 'all', label: '전체' },
  { key: 'inactive', label: '비활성' },
]

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
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('active')
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

  const openNewForm = () => {
    setForm(emptyForm())
    setFormOpen(true)
  }

  const filterCounts: Record<ActiveFilter, number> = {
    active: items.filter((item) => item.active).length,
    all: items.length,
    inactive: items.filter((item) => !item.active).length,
  }

  return (
    <div className="min-w-0 space-y-3">
      <PageHeader
        title="부자재 주문"
        count={`${items.length}개`}
        description="자주 구매하는 품목을 빠르게 찾고 재주문합니다."
        actions={<Button variant="primary" onClick={openNewForm} icon={<Plus size={15} />}>새 부자재</Button>}
      />

      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">부자재 검색</span>
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="부자재명 · 카테고리 · 구매처 검색"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-[13px] font-medium text-slate-900 transition focus:border-brand-orange focus:bg-white"
            />
          </label>
          <Tabs
            aria-label="사용 상태"
            items={activeFilterItems.map((item) => ({ ...item, count: filterCounts[item.key] }))}
            value={activeFilter}
            onChange={setActiveFilter}
            className="shrink-0"
          />
        </div>

        {categories.length ? (
          <Tabs
            aria-label="카테고리"
            className="mt-2"
            items={categories.map((category) => ({ key: category, label: category }))}
            value={query}
            onChange={(category) => setQuery(query === category ? '' : category)}
          />
        ) : null}

        {filteredItems.length ? (
          <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2">
            {filteredItems.map((item) => {
              const unitPrice = getMaterialSupplyUnitPrice(item.priceKrw, item.unit)
              const dimension = formatDimension(item)
              const supplierLine = [item.supplierName, item.unit].filter(Boolean).join(' · ')
              return (
                <article
                  key={item.id}
                  className={`flex min-w-0 flex-col rounded-xl border p-3 transition hover:border-slate-300 ${
                    item.active ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className={`min-w-0 ${item.active ? '' : 'opacity-60'}`}>
                      <div className="flex items-center gap-1.5">
                        <Badge outline className="max-w-full truncate">{item.category || '미분류'}</Badge>
                        {!item.active ? <Badge>비활성</Badge> : null}
                      </div>
                      <h2 className="mt-1.5 line-clamp-2 text-[14px] font-black leading-[1.35] text-slate-950">{item.name}</h2>
                    </div>
                    <div className="-mr-1 -mt-1 flex shrink-0 items-center">
                      <button
                        type="button"
                        onClick={() => editItem(item)}
                        className={buttonClass('ghost', 'sm', 'h-8 w-8 px-0 text-slate-500 hover:text-slate-900')}
                        title="수정"
                        aria-label={`${item.name} 수정`}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteItem(item)}
                        disabled={busyId === item.id}
                        className={buttonClass('ghost', 'sm', 'h-8 w-8 px-0 text-slate-500 hover:bg-red-50 hover:text-red-600')}
                        title="삭제"
                        aria-label={`${item.name} 삭제`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className={`mt-2 border-t border-slate-100 pt-2 ${item.active ? '' : 'opacity-60'}`}>
                    <p className="truncate text-[11px] font-bold text-slate-500">{supplierLine || '구매처 미입력'}</p>
                    <div className="mt-0.5 flex items-baseline justify-between gap-2">
                      {item.priceKrw ? (
                        <p className="text-[15px] font-black tabular-nums text-slate-900">{formatCurrency(item.priceKrw)}</p>
                      ) : (
                        <p className="text-[13px] font-bold text-slate-400">가격 미입력</p>
                      )}
                      {unitPrice ? (
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black tabular-nums text-slate-600">
                          개당 {(Math.round(unitPrice * 10) / 10).toLocaleString()}원
                        </span>
                      ) : null}
                    </div>
                    {dimension ? <p className="mt-1 text-[11px] font-bold text-slate-500">규격 {dimension}</p> : null}
                    {item.memo ? <p className="mt-0.5 truncate text-[11px] text-slate-500" title={item.memo}>{item.memo}</p> : null}
                    <p className="mt-1 truncate text-[11px] font-bold tabular-nums text-slate-500">
                      최근 구매 {item.lastPurchasedAt ? formatDateTime(item.lastPurchasedAt) : '기록 없음'}
                    </p>
                  </div>

                  <div className="mt-auto grid grid-cols-2 gap-1.5 pt-3">
                    {item.purchaseUrl ? (
                      <a
                        href={item.purchaseUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={buttonClass('secondary', 'sm', 'h-9 min-w-0')}
                      >
                        <ExternalLink size={13} />
                        구매처 열기
                      </a>
                    ) : (
                      <span aria-disabled="true" title="구매 링크를 입력하면 열 수 있습니다" className={buttonClass('secondary', 'sm', 'h-9 min-w-0 cursor-not-allowed opacity-50')}>
                        <ExternalLink size={13} />
                        구매처 열기
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => markPurchased(item)}
                      disabled={busyId === item.id}
                      className={buttonClass('secondary', 'sm', 'h-9 min-w-0')}
                      title="실제 구매 후 최근 구매일을 기록합니다"
                    >
                      <CheckCircle2 size={13} />
                      구매 기록
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <EmptyState
            bare
            className="mt-3"
            icon={<PackagePlus size={20} />}
            title="조건에 맞는 부자재가 없습니다."
            action={<Button variant="secondary" size="sm" onClick={openNewForm} icon={<Plus size={13} />}>새 부자재</Button>}
          />
        )}
      </section>

      {formOpen ? (
        <Modal label={form.id ? '부자재 수정' : '새 부자재'} onClose={() => setFormOpen(false)} className="bg-slate-950/40">
          <div
            className="flex h-full w-full justify-end"
            onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false) }}
          >
            <aside className="flex h-full w-full max-w-[400px] flex-col bg-white shadow-2xl">
              <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    <ShoppingCart size={16} />
                  </span>
                  <div>
                    <h2 className="text-[14px] font-black text-slate-950">{form.id ? '부자재 수정' : '새 부자재'}</h2>
                    <p className="text-[11px] font-bold text-slate-500">필요한 정보만 빠르게 입력하세요.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className={buttonClass('ghost', 'sm', 'h-9 w-9 px-0 text-slate-500')}
                  title="닫기"
                  aria-label="닫기"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
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
                    <input inputMode="numeric" className={`${inputClass} text-right tabular-nums`} value={form.priceKrw} onChange={(event) => setFormValue('priceKrw', event.target.value)} placeholder="12500" />
                  </Field>
                  <Field label="정렬(표시순서)">
                    <input inputMode="numeric" className={`${inputClass} text-right tabular-nums`} value={form.sortOrder} onChange={(event) => setFormValue('sortOrder', event.target.value)} />
                  </Field>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-[12px] font-bold">
                  <span className="text-slate-500">개당 단가</span>
                  <span className={`tabular-nums ${formUnitPrice ? 'text-slate-900' : 'text-slate-400'}`}>{formatUnitPrice(formUnitPrice)}</span>
                </div>
                <div className="rounded-xl bg-slate-50 p-2.5">
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <span className="text-[11px] font-black text-slate-500">규격 (선택)</span>
                    <select
                      className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[12px] font-bold text-slate-700"
                      value={form.dimensionUnit}
                      onChange={(event) => setFormValue('dimensionUnit', event.target.value === 'cm' ? 'cm' : 'mm')}
                      aria-label="규격 단위"
                    >
                      <option value="mm">mm</option>
                      <option value="cm">cm</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <Field label="가로">
                      <input inputMode="decimal" className={`${inputClass} text-right tabular-nums`} value={form.widthValue} onChange={(event) => setFormValue('widthValue', event.target.value)} placeholder="0" />
                    </Field>
                    <Field label="세로">
                      <input inputMode="decimal" className={`${inputClass} text-right tabular-nums`} value={form.depthValue} onChange={(event) => setFormValue('depthValue', event.target.value)} placeholder="0" />
                    </Field>
                    <Field label="높이">
                      <input inputMode="decimal" className={`${inputClass} text-right tabular-nums`} value={form.heightValue} onChange={(event) => setFormValue('heightValue', event.target.value)} placeholder="0" />
                    </Field>
                  </div>
                </div>
                <Field label="메모">
                  <textarea className={`${inputClass} h-auto min-h-16 resize-none py-2`} value={form.memo} onChange={(event) => setFormValue('memo', event.target.value)} placeholder="주의사항, 대체 구매처 등" />
                </Field>
                <label className="flex min-h-10 items-center justify-between border-t border-slate-100 pt-3 text-[12px] font-bold text-slate-700">
                  사용중으로 표시
                  <input type="checkbox" checked={form.active} onChange={(event) => setFormValue('active', event.target.checked)} className="h-4 w-4 accent-brand-orange" />
                </label>
              </div>

              <div className="flex shrink-0 gap-2 border-t border-slate-100 bg-white px-4 py-3">
                <Button variant="secondary" onClick={() => setForm(emptyForm())}>
                  초기화
                </Button>
                <Button variant="primary" onClick={submitForm} loading={saving} className="flex-1">
                  {saving ? '저장 중' : form.id ? '수정 저장' : '등록'}
                </Button>
              </div>
            </aside>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-black text-slate-500">{label}</span>
      {children}
    </label>
  )
}

const inputClass = 'h-10 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-[13px] font-medium text-slate-950 transition focus:border-brand-orange'
