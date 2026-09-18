'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Minus, Plus, Search, X } from 'lucide-react'

import { calculateOrderFinalAmount } from '@/lib/orderAmount'
import { resolvePartnerOrderTerms, type PartnerOrderPricingProduct } from '@/lib/partnerOrderPricing'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'

const fieldClass =
  'w-full rounded-xl border border-slate-200 bg-white font-bold text-slate-900 transition ' +
  'focus:border-brand-orange focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40'

export type AdminOrderPartnerOption = {
  id: string
  name: string
  country?: string | null
  status: string
  partnerProfile?: {
    businessName?: string | null
    representativeName?: string | null
    grade?: string | null
  } | null
}

export type AdminOrderProductOption = PartnerOrderPricingProduct & {
  id: string
  name: string
  productCode?: string | null
}

export default function AdminOrderCreateModal({
  open,
  onClose,
  partners,
  products,
}: {
  open: boolean
  onClose: () => void
  partners: AdminOrderPartnerOption[]
  products: AdminOrderProductOption[]
}) {
  const router = useRouter()
  const [partnerId, setPartnerId] = useState('')
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const selectedPartner = partners.find((partner) => partner.id === partnerId) || null

  const pricedProducts = useMemo(() => {
    if (!selectedPartner) return []
    return products.map((product) => ({
      ...product,
      terms: resolvePartnerOrderTerms(product, {
        country: selectedPartner.country,
        grade: selectedPartner.partnerProfile?.grade,
      }),
    }))
  }, [products, selectedPartner])

  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return pricedProducts
    return pricedProducts.filter((product) => (
      product.name.toLowerCase().includes(keyword)
      || String(product.productCode || '').toLowerCase().includes(keyword)
    ))
  }, [pricedProducts, search])

  const selectedItems = pricedProducts
    .map((product) => ({
      product,
      quantity: quantities[product.id] || 0,
    }))
    .filter((item) => item.quantity > 0)
  const amount = calculateOrderFinalAmount(selectedItems.map(({ product, quantity }) => ({
    quantity,
    price: product.terms.unitPrice,
  })))

  if (!open) return null

  const setQuantity = (productId: string, quantity: number) => {
    const normalized = Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0
    setQuantities((current) => ({ ...current, [productId]: normalized }))
  }

  const stepQuantity = (product: (typeof pricedProducts)[number], direction: -1 | 1) => {
    const current = quantities[product.id] || 0
    const { minimumQuantity, orderUnit } = product.terms
    if (direction === 1 && current === 0) {
      setQuantity(product.id, Math.ceil(minimumQuantity / orderUnit) * orderUnit)
      return
    }
    setQuantity(product.id, current + (orderUnit * direction))
  }

  const handleClose = () => {
    if (submitting) return
    onClose()
  }

  const handleSubmit = async () => {
    if (!selectedPartner) {
      alert('업체를 선택해 주세요.')
      return
    }
    if (selectedItems.length === 0) {
      alert('한 개 이상의 상품 수량을 입력해 주세요.')
      return
    }

    const invalidItem = selectedItems.find(({ product, quantity }) => (
      quantity < product.terms.minimumQuantity || quantity % product.terms.orderUnit !== 0
    ))
    if (invalidItem) {
      alert(`${invalidItem.product.name}의 최소수량과 주문단위를 확인해 주세요.`)
      return
    }

    try {
      setSubmitting(true)
      const response = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerId: selectedPartner.id,
          items: selectedItems.map(({ product, quantity }) => ({
            productId: product.id,
            quantity,
          })),
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error || '발주 생성에 실패했습니다.')
      }

      alert(`${payload.partnerName} 발주서 ${payload.orderNumber}가 생성되었습니다.`)
      setPartnerId('')
      setQuantities({})
      setSearch('')
      onClose()
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : '발주 생성에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm md:p-6" onMouseDown={handleClose}>
      <div className="flex max-h-[94vh] w-full min-w-0 max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0">
            <h2 className="text-[20px] font-black tracking-tight text-slate-900">업체 발주서 생성</h2>
            <p className="mt-1 text-[13px] text-slate-500">업체를 선택하면 해당 국가와 등급에 맞는 발주 단가가 적용됩니다.</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-w-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
            <label className="block min-w-0">
              <span className="mb-2 block text-[12px] font-black text-slate-600">발주 업체</span>
              <select
                value={partnerId}
                onChange={(event) => {
                  setPartnerId(event.target.value)
                  setQuantities({})
                }}
                className={`h-11 px-4 text-[14px] ${fieldClass}`}
              >
                <option value="">업체를 선택해 주세요</option>
                {partners.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.partnerProfile?.businessName || partner.name} · {partner.partnerProfile?.grade || 'C'}등급
                  </option>
                ))}
              </select>
            </label>
            <div className="min-w-0 rounded-xl border border-orange-200 bg-brand-orange-soft px-4 py-3">
              <div className="text-[11px] font-bold text-slate-500">선택 업체 정보</div>
              <div className="mt-1 truncate text-[14px] font-black text-slate-900">
                {selectedPartner ? (selectedPartner.partnerProfile?.representativeName || selectedPartner.name) : '-'}
              </div>
              <div className="mt-1 text-[11px] font-bold text-slate-600">
                {selectedPartner ? `${selectedPartner.country || '국가 미설정'} · ${selectedPartner.partnerProfile?.grade || 'C'}등급` : '업체를 먼저 선택하세요'}
              </div>
            </div>
          </div>

          {selectedPartner ? (
            <>
              <div className="relative mt-5">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="상품명 또는 상품코드 검색"
                  className={`h-10 pl-11 pr-4 text-[13px] ${fieldClass}`}
                />
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                <div className="hidden grid-cols-[minmax(0,1fr)_120px_150px_160px] bg-brand-ink px-5 py-2.5 text-[12px] font-bold text-white md:grid">
                  <span className="whitespace-nowrap">상품</span><span className="whitespace-nowrap text-right">적용 단가</span><span className="whitespace-nowrap text-center">발주 조건</span><span className="whitespace-nowrap text-center">수량</span>
                </div>
                <div className="max-h-[390px] divide-y divide-slate-100 overflow-y-auto">
                  {filteredProducts.length > 0 ? filteredProducts.map((product) => {
                    const quantity = quantities[product.id] || 0
                    const invalid = quantity > 0 && (quantity < product.terms.minimumQuantity || quantity % product.terms.orderUnit !== 0)
                    return (
                      <div key={product.id} className={`grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_120px_150px_160px] md:items-center ${quantity > 0 ? 'bg-orange-50/50' : 'bg-white'}`}>
                        <div className="min-w-0">
                          <div className="truncate text-[14px] font-black text-slate-900">{product.name}</div>
                          <div className="mt-1 text-[11px] font-bold text-slate-500">{product.productCode || '상품코드 없음'}</div>
                        </div>
                        <div className="whitespace-nowrap text-left text-[14px] font-black text-slate-900 md:text-right">{formatCurrency(product.terms.unitPrice)}</div>
                        <div className="text-left text-[11px] font-bold text-slate-500 md:text-center">
                          최소 {product.terms.minimumQuantity.toLocaleString('ko-KR')} · 단위 {product.terms.orderUnit.toLocaleString('ko-KR')}
                        </div>
                        <div>
                          <div className={`flex h-10 items-center overflow-hidden rounded-xl border ${invalid ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}`}>
                            <button type="button" onClick={() => stepQuantity(product, -1)} aria-label="수량 감소" className="flex h-full w-10 items-center justify-center text-slate-500 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-orange/40"><Minus className="h-4 w-4" /></button>
                            <input type="number" min="0" value={quantity || ''} onChange={(event) => setQuantity(product.id, Number(event.target.value))} placeholder="0" aria-label="수량" className="min-w-0 flex-1 bg-transparent text-center text-[14px] font-black text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-orange/40" />
                            <button type="button" onClick={() => stepQuantity(product, 1)} aria-label="수량 증가" className="flex h-full w-10 items-center justify-center text-brand-orange hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-orange/40"><Plus className="h-4 w-4" /></button>
                          </div>
                          {invalid ? <div className="mt-1 text-center text-[11px] font-bold text-red-500">발주 조건을 확인하세요</div> : null}
                        </div>
                      </div>
                    )
                  }) : (
                    <div className="p-4">
                      <EmptyState compact title="검색 결과가 없습니다." />
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <EmptyState className="mt-5" title="발주할 업체를 선택하면 상품 목록과 적용 단가가 표시됩니다." />
          )}
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="grid grid-cols-3 gap-4 text-[12px]">
              <AmountSummary label="상품 공급가" value={formatCurrency(amount.productSupplyPrice)} />
              <AmountSummary label="배송비" value={formatCurrency(amount.shippingFee)} />
              <AmountSummary label="부가세 포함 합계" value={formatCurrency(amount.finalAmount)} highlight />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={handleClose} disabled={submitting}>취소</Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={!selectedPartner || selectedItems.length === 0}
                loading={submitting}
              >
                {submitting ? '발주서 생성 중...' : `${selectedItems.length}개 상품 발주서 생성`}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AmountSummary({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="whitespace-nowrap font-bold text-slate-500">{label}</div>
      <div className={`mt-1 whitespace-nowrap font-black ${highlight ? 'text-[18px] text-brand-orange' : 'text-[14px] text-slate-900'}`}>{value}</div>
    </div>
  )
}

function formatCurrency(value: number) {
  return `${Math.round(value).toLocaleString('ko-KR')}원`
}
