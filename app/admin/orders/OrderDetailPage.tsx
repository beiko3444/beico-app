'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { calculateOrderFinalAmount } from '@/lib/orderAmount'
import { orderStatusMeta } from '@/lib/orderStatus'
import { formatDateTime, formatWon } from '@/lib/format'
import Modal from '@/components/Modal'
import Badge from '@/components/ui/Badge'
import { buttonClass } from '@/components/ui/buttonClass'
import { fieldClass, labelClass, selectClass } from '@/components/ui/field'
import {
  AlertTriangle,
  Check,
  ChevronDown,
  CircleCheckBig,
  Copy,
  FileText,
  Package,
  ReceiptText,
  Store,
  Truck,
} from 'lucide-react'

const formatCurrency = formatWon

interface OrderDetailPageProps {
  order?: OrderRecord | null
}

interface OrderProductRecord {
  id: string
  quantity: number
  price: number
  product: {
    id: string
    name: string
    imageUrl: string | null
  }
}

export interface OrderRecord {
  id: string
  shippingFeeOverride?: number | null
  orderNumber?: string | null
  createdAt: string | Date
  status: string
  trackingNumber?: string | null
  courier?: string | null
  taxInvoiceIssued?: boolean
  depositConfirmedAt?: string | Date | null
  adminDepositConfirmedAt?: string | Date | null
  user: {
    name: string
    country?: string | null
    partnerProfile?: {
      businessName?: string | null
      representativeName?: string | null
      grade?: string | null
      businessRegNumber?: string | null
      email?: string | null
      contact?: string | null
      address?: string | null
    } | null
  }
  items: OrderProductRecord[]
}

interface ProductLineItem {
  id: string
  name: string
  option: string
  imageUrl: string | null
  quantity: number
  unitPrice: number
  supplyPrice: number
  vat: number
  total: number
  kind?: 'product' | 'shipping'
}

interface NormalizedOrderDetail {
  id: string
  orderId: string
  orderNumber: string
  createdAtText: string
  createdAtRaw: string
  channelLabel: string
  taxInvoiceIssued: boolean
  customer: {
    company: string
    manager: string
    phone: string
    email: string
    businessNumber: string
    businessType: string
  }
  shipping: {
    recipient: string
    phone: string
    address: string
    memo: string
    carrier: string
    trackingNumber: string
  }
  payment: {
    totalQuantity: number
    productSupplyPrice: number
    shippingFee: number
    vat: number
    finalAmount: number
  }
  products: ProductLineItem[]
  depositConfirmedAt: string | null
  adminDepositConfirmedAt: string | null
  rawStatus: string
}

const DEFAULT_CARRIER = '로젠택배'
const CARRIER_OPTIONS = [DEFAULT_CARRIER]

const sampleOrderData: NormalizedOrderDetail = {
  id: '20260504001',
  orderId: 'sample-order-id',
  orderNumber: '20260504001',
  createdAtText: '2026.05.04 10:29',
  createdAtRaw: '2026-05-04T10:29:00+09:00',
  channelLabel: '주문 프로세스',
  taxInvoiceIssued: false,
  customer: {
    company: '아울렛낚시',
    manager: '이재훈',
    phone: '010-5459-8311',
    email: 'leejaehun4@naver.com',
    businessNumber: '119-09-46832',
    businessType: '도소매 / 낚시용품',
  },
  shipping: {
    recipient: '이재훈',
    phone: '010-5459-8311',
    address: '서울특별시 관악구 호암로 453 1층, 아울렛낚시',
    memo: '기본 배송지',
    carrier: DEFAULT_CARRIER,
    trackingNumber: '',
  },
  payment: {
    totalQuantity: 100,
    productSupplyPrice: 400000,
    shippingFee: 3000,
    vat: 40300,
    finalAmount: 443300,
  },
  products: [
    {
      id: 'P001',
      name: 'BEIKO 라베이EV3 홍게지렁이',
      option: '100개',
      imageUrl: '/sample-product.png',
      quantity: 100,
      unitPrice: 4000,
      supplyPrice: 400000,
      vat: 40000,
      total: 440000,
    },
  ],
  depositConfirmedAt: '2026-05-04 10:31',
  adminDepositConfirmedAt: '2026-05-04 11:15',
  rawStatus: 'DEPOSIT_COMPLETED',
}

function toIsoString(value: string | Date | null | undefined) {
  if (!value) return sampleOrderData.createdAtRaw
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return sampleOrderData.createdAtRaw
  return date.toISOString()
}

function parseTrackingNumbers(value: string | null | undefined) {
  if (!value) return []
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

/** Status for a raw order record — the same lib/orderStatus vocabulary the order list uses. */
export function getOrderStatusMeta(order: OrderRecord) {
  return orderStatusMeta(order.status, parseTrackingNumbers(order.trackingNumber).length > 0)
}

function buildOrderDetailData(order?: OrderRecord | null): NormalizedOrderDetail {
  if (!order) return sampleOrderData

  const partnerProfile = order.user?.partnerProfile
  const orderNumber = order.orderNumber || order.id.slice(0, 8)
  const createdAtText = formatDateTime(order.createdAt)
  const createdAtRaw = toIsoString(order.createdAt)
  const trackingNumbers = parseTrackingNumbers(order.trackingNumber)
  const products = (order.items || []).map((item) => {
    const supplyPrice = Math.round(item.price * item.quantity)
    const vat = Math.round(supplyPrice * 0.1)
    return {
      id: item.id,
      name: item.product?.name || '상품명 없음',
      option: `${item.quantity.toLocaleString('ko-KR')}개`,
      imageUrl: item.product?.imageUrl || null,
      quantity: item.quantity,
      unitPrice: Math.round(item.price),
      supplyPrice,
      vat,
      total: supplyPrice + vat,
    }
  })

  const payment = calculateOrderFinalAmount(order.items || [], order.shippingFeeOverride)

  return {
    id: orderNumber,
    orderId: order.id,
    orderNumber,
    createdAtText,
    createdAtRaw,
    channelLabel: '주문 프로세스',
    taxInvoiceIssued: Boolean(order.taxInvoiceIssued),
    customer: {
      company: partnerProfile?.businessName || order.user?.name || '거래처 정보 없음',
      manager: partnerProfile?.representativeName || order.user?.name || '-',
      phone: partnerProfile?.contact || '-',
      email: partnerProfile?.email || '-',
      businessNumber: partnerProfile?.businessRegNumber || '-',
      businessType: order.user?.country ? `${order.user.country} 거래처` : sampleOrderData.customer.businessType,
    },
    shipping: {
      recipient: partnerProfile?.representativeName || order.user?.name || '-',
      phone: partnerProfile?.contact || '-',
      address: partnerProfile?.address || '-',
      memo: '기본 배송지',
      carrier: order.courier === 'Rosen' ? DEFAULT_CARRIER : (order.courier || DEFAULT_CARRIER),
      trackingNumber: trackingNumbers[0] || '',
    },
    payment: {
      totalQuantity: payment.totalQuantity,
      productSupplyPrice: payment.productSupplyPrice,
      shippingFee: payment.shippingFee,
      vat: payment.vat,
      finalAmount: payment.finalAmount,
    },
    products: products.length > 0 ? products : sampleOrderData.products,
    depositConfirmedAt: order.depositConfirmedAt ? formatDateTime(order.depositConfirmedAt) : null,
    adminDepositConfirmedAt: order.adminDepositConfirmedAt ? formatDateTime(order.adminDepositConfirmedAt) : null,
    rawStatus: order.status,
  }
}

function DetailCard({
  title,
  icon,
  actions,
  className = '',
  muted = false,
  children,
}: {
  title: string
  icon?: React.ReactNode
  actions?: React.ReactNode
  className?: string
  muted?: boolean
  children: React.ReactNode
}) {
  return (
    <section className={`ux-panel overflow-hidden ${muted ? 'bg-slate-50' : ''} ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3.5 md:px-5">
        <div className="flex min-w-0 items-center gap-2">
          {icon ? <span className="text-slate-400">{icon}</span> : null}
          <h3 className="text-[15px] font-extrabold text-slate-900">{title}</h3>
        </div>
        {actions}
      </div>
      <div className="p-4 md:p-5">{children}</div>
    </section>
  )
}

function CopyButton({ copied, onClick }: { copied: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="복사"
      title="복사"
      className={buttonClass('ghost', 'icon', 'text-slate-400 hover:text-slate-700')}
    >
      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
    </button>
  )
}

// Plain label/value pairs on the summary card — no box of their own, the total stands out by size and weight only.
function SummaryMetric({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`min-w-0 ${highlight ? 'col-span-2 @xl:col-span-1' : ''}`}>
      <dt className="truncate text-[12px] font-semibold text-slate-500">{label}</dt>
      <dd className={`mt-1 whitespace-nowrap tabular-nums text-slate-950 ${
        highlight ? 'text-[20px] font-extrabold' : 'text-[15px] font-bold'
      }`}>
        {value}
      </dd>
    </div>
  )
}

function InfoField({
  label,
  value,
  copyKey,
  copiedField,
  onCopy,
  wide = false,
}: {
  label: string
  value: string
  copyKey?: string
  copiedField: string | null
  onCopy: (fieldKey: string, value: string) => void
  wide?: boolean
}) {
  return (
    <div className={`min-w-0 rounded-lg bg-[var(--surface)] px-3 py-2.5 ${wide ? '@3xl:col-span-2' : ''}`}>
      <div className="flex min-h-8 items-center justify-between gap-3">
        <div className="text-[12px] font-semibold text-slate-500">{label}</div>
        {copyKey ? <CopyButton copied={copiedField === copyKey} onClick={() => onCopy(copyKey, value)} /> : null}
      </div>
      <div className="break-words text-[14px] font-bold leading-6 text-slate-900">{value}</div>
    </div>
  )
}

export default function OrderDetailPage({ order }: OrderDetailPageProps) {
  const router = useRouter()
  const detail = useMemo(() => buildOrderDetailData(order), [order])
  const productRows = useMemo<ProductLineItem[]>(() => {
    if (detail.payment.shippingFee <= 0) return detail.products

    const shippingVat = Math.round(detail.payment.shippingFee * 0.1)

    return [
      ...detail.products,
      {
        id: 'shipping-fee',
        name: '배송비',
        option: `${detail.payment.totalQuantity.toLocaleString('ko-KR')}개 기준`,
        imageUrl: null,
        quantity: 1,
        unitPrice: detail.payment.shippingFee,
        supplyPrice: detail.payment.shippingFee,
        vat: shippingVat,
        total: detail.payment.shippingFee + shippingVat,
        kind: 'shipping',
      },
    ]
  }, [detail])

  const [currentStatus, setCurrentStatus] = useState(detail.rawStatus)
  const [taxInvoiceIssued, setTaxInvoiceIssued] = useState(detail.taxInvoiceIssued)
  const [carrier, setCarrier] = useState(detail.shipping.carrier || DEFAULT_CARRIER)
  const [trackingNumber, setTrackingNumber] = useState(detail.shipping.trackingNumber)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState('')
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [shippingFeeInput, setShippingFeeInput] = useState('')
  const [editingShippingFee, setEditingShippingFee] = useState(false)
  const [editingQuantityId, setEditingQuantityId] = useState<string | null>(null)
  const [quantityInput, setQuantityInput] = useState('')

  useEffect(() => {
    setCurrentStatus(detail.rawStatus)
    setTaxInvoiceIssued(detail.taxInvoiceIssued)
    setCarrier(detail.shipping.carrier || DEFAULT_CARRIER)
    setTrackingNumber(detail.shipping.trackingNumber)
  }, [detail])

  useEffect(() => {
    if (!toastMessage) return
    const timeout = window.setTimeout(() => setToastMessage(''), 1500)
    return () => window.clearTimeout(timeout)
  }, [toastMessage])

  const isCompletedOrder = currentStatus === 'COMPLETED'
  // Same words and colours as the order list: read from the saved tracking number, not the one being typed.
  const currentStatusMeta = orderStatusMeta(currentStatus, detail.shipping.trackingNumber.length > 0)
  const canIssueDocuments = currentStatus !== 'CANCELED'
  const showCopyToast = (fieldKey: string, value: string) => {
    if (!value || value === '-') return
    navigator.clipboard.writeText(value)
    setCopiedField(fieldKey)
    setToastMessage('복사됨')
    window.setTimeout(() => setCopiedField((prev) => (prev === fieldKey ? null : prev)), 1500)
  }

  const patchOrder = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/orders/${detail.orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: '업데이트에 실패했습니다.' }))
      throw new Error(data.error || '업데이트에 실패했습니다.')
    }
  }

  const validateShipping = () => {
    if (!carrier) return '택배사를 선택해야 합니다.'
    if (!trackingNumber.trim()) return '송장번호를 입력해야 합니다.'
    if (!/^[0-9-]+$/.test(trackingNumber.trim())) return '송장번호는 숫자와 하이픈만 입력할 수 있습니다.'
    return null
  }

  const handleShippingFee = async (reset = false) => {
    const fee = reset ? null : Number(shippingFeeInput)
    if (!reset && (!shippingFeeInput.trim() || !Number.isSafeInteger(fee) || Number(fee) < 0 || Number(fee) > 100000000)) {
      alert('배송비는 0 이상 1억 원 이하의 정수로 입력해 주세요.')
      return
    }
    setLoadingAction('shippingFee')
    try {
      await patchOrder({ shippingFeeOverride: fee })
      setEditingShippingFee(false)
      setToastMessage(reset ? '자동 배송비로 복원했습니다.' : '배송비를 수정했습니다.')
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : '배송비 수정에 실패했습니다.')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleQuantitySave = async () => {
    const quantity = Number(quantityInput)
    if (!quantityInput.trim() || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000000) {
      alert('수량은 1 이상 1,000,000 이하의 정수로 입력해 주세요.')
      return
    }
    if (!editingQuantityId || loadingAction) return
    setLoadingAction('quantity')
    try {
      await patchOrder({ items: [{ id: editingQuantityId, quantity }] })
      setEditingQuantityId(null)
      setToastMessage('수량과 주문금액을 수정했습니다.')
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : '수량 수정에 실패했습니다.')
    } finally {
      setLoadingAction(null)
    }
  }

  const renderQuantity = (product: ProductLineItem) => {
    if (product.kind === 'shipping') return '1건'
    if (editingQuantityId === product.id && !taxInvoiceIssued) {
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-end gap-1">
            <input type="number" min="1" max="1000000" step="1"
              aria-label={`${product.name} 주문 수량`}
              className={fieldClass('h-9 w-24 px-2 text-right')}
              value={quantityInput} disabled={Boolean(loadingAction)}
              onChange={(event) => setQuantityInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void handleQuantitySave()
                if (event.key === 'Escape' && !loadingAction) setEditingQuantityId(null)
              }} />
            <span>개</span>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" disabled={Boolean(loadingAction)} onClick={() => setEditingQuantityId(null)}
              className={buttonClass('secondary', 'sm')}>취소</button>
            <button type="button" disabled={Boolean(loadingAction)} onClick={() => void handleQuantitySave()}
              className={buttonClass('primary', 'sm')}>
              {loadingAction === 'quantity' ? '저장 중…' : '저장'}
            </button>
          </div>
        </div>
      )
    }
    return (
      <div>
        <span>{product.quantity.toLocaleString('ko-KR')}개</span>
        {order && !taxInvoiceIssued ? (
          <button type="button" aria-label={`${product.name} 수량 수정`} disabled={Boolean(loadingAction)}
            className={buttonClass('ghost', 'sm', 'ml-1 min-h-11 min-w-11 px-2 text-slate-700 underline underline-offset-2')} onClick={() => {
              setEditingQuantityId(product.id)
              setQuantityInput(String(product.quantity))
            }}>수정</button>
        ) : null}
      </div>
    )
  }

  const handleSaveTracking = async () => {
    const errorMessage = validateShipping()
    if (errorMessage) {
      alert(errorMessage)
      return
    }

    try {
      setLoadingAction('ship')
      await patchOrder({
        courier: carrier,
        trackingNumber: trackingNumber.trim(),
        ...(currentStatus === 'COMPLETED' ? {} : { status: 'SHIPPED' }),
      })
      if (currentStatus !== 'COMPLETED') setCurrentStatus('SHIPPED')
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : '배송 처리에 실패했습니다.')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleIssueTaxInvoice = async () => {
    if (taxInvoiceIssued) {
      alert('이미 세금계산서가 발행되었습니다.')
      return
    }

    try {
      setLoadingAction('tax-invoice')
      const res = await fetch('/api/admin/tax-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: detail.orderId }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || '세금계산서 발행에 실패했습니다.')
      }
      setTaxInvoiceIssued(true)
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : '세금계산서 발행에 실패했습니다.')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleCompleteOrder = async () => {
    if (currentStatus === 'COMPLETED') return
    if (!confirm('배송 처리나 계산서 발급 여부와 관계없이 이 주문을 마감 처리하시겠습니까?')) return

    try {
      setLoadingAction('complete')
      await patchOrder({ status: 'COMPLETED' })
      setCurrentStatus('COMPLETED')
      setToastMessage('주문을 마감 처리했습니다.')
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : '주문 마감 처리에 실패했습니다.')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleDeleteOrder = async () => {
    if (deleteConfirmText !== detail.orderNumber) {
      alert('주문번호를 정확히 입력해야 합니다.')
      return
    }

    try {
      setLoadingAction('delete')
      const res = await fetch(`/api/orders/${detail.orderId}`, { method: 'DELETE', cache: 'no-store' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: '주문 삭제에 실패했습니다.' }))
        throw new Error(data.error || '주문 삭제에 실패했습니다.')
      }
      window.location.reload()
    } catch (error) {
      alert(error instanceof Error ? error.message : '주문 삭제에 실패했습니다.')
    } finally {
      setLoadingAction(null)
    }
  }

  const handlePrintStatement = () => {
    router.push(`/invoice/${detail.orderId}`)
  }


  return (
    // A plain stack: no outer shell, accent bar or local blue palette — status lives in the Badge only.
    <div className="@container space-y-4 p-4 md:space-y-6 md:p-6">
      {toastMessage ? (
        <div className="fixed right-6 top-24 z-50 rounded-xl bg-slate-900 px-4 py-2 text-[12px] font-bold text-white shadow-2xl" role="status">
          {toastMessage}
        </div>
      ) : null}

      {deleteModalOpen ? (
        <Modal
          label="주문 삭제 확인"
          onClose={() => {
            if (loadingAction === 'delete') return
            setDeleteModalOpen(false)
            setDeleteConfirmText('')
          }}
          className="flex items-center justify-center bg-slate-950/50 px-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-lg font-extrabold text-slate-900">주문을 삭제하시겠습니까?</h4>
                <p className="mt-2 text-[13px] leading-6 text-slate-500">
                  삭제된 주문은 복구할 수 없습니다. 정말 삭제하려면 주문번호 <strong className="text-slate-900">{detail.orderNumber}</strong> 를 입력하세요.
                </p>
              </div>
            </div>
            <input
              type="text"
              aria-label="삭제할 주문번호"
              value={deleteConfirmText}
              onChange={(event) => setDeleteConfirmText(event.target.value)}
              className={fieldClass('mt-5')}
              placeholder={detail.orderNumber}
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteModalOpen(false)
                  setDeleteConfirmText('')
                }}
                className={buttonClass('secondary')}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleDeleteOrder}
                disabled={loadingAction === 'delete'}
                className={buttonClass('danger')}
              >
                {loadingAction === 'delete' ? '삭제 중...' : '주문 삭제'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      <section className={`ux-panel space-y-4 p-4 md:p-5 ${isCompletedOrder ? 'bg-slate-50' : ''}`}>
        {/* The drawer title already names the order number, so the card leads with the business. */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className={`break-keep text-[20px] font-extrabold leading-tight ${isCompletedOrder ? 'text-slate-600' : 'text-slate-900'}`}>{detail.customer.company}</h2>
            <Badge tone={currentStatusMeta.tone}>{currentStatusMeta.label}</Badge>
          </div>
          <span className="whitespace-nowrap text-[13px] tabular-nums text-slate-500">주문일시 {detail.createdAtText}</span>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-[var(--border)] pt-4 @xl:grid-cols-3 @3xl:grid-cols-5">
          <SummaryMetric label="상품 공급가" value={formatCurrency(detail.payment.productSupplyPrice)} />
          <SummaryMetric label="배송비" value={formatCurrency(detail.payment.shippingFee)} />
          <SummaryMetric label="부가세" value={formatCurrency(detail.payment.vat)} />
          <SummaryMetric label="수량" value={`${detail.payment.totalQuantity.toLocaleString('ko-KR')}개`} />
          <SummaryMetric label="최종 결제금액" value={formatCurrency(detail.payment.finalAmount)} highlight />
        </dl>

        <div className="grid grid-cols-2 gap-2 border-t border-[var(--border)] pt-4 @3xl:grid-cols-3">
          <button type="button" onClick={handlePrintStatement} className={buttonClass('secondary', 'md', 'h-11 w-full')}>
            <FileText className="h-4 w-4" /> 거래명세표 출력
          </button>
          <button type="button" onClick={handleIssueTaxInvoice} disabled={!canIssueDocuments || taxInvoiceIssued || loadingAction === 'tax-invoice'} className={buttonClass('secondary', 'md', 'h-11 w-full')}>
            <ReceiptText className="h-4 w-4" /> {taxInvoiceIssued ? '계산서 발행완료' : '세금계산서 발행'}
          </button>
          <details className="group col-span-2 rounded-lg border border-[var(--border)] @3xl:col-span-1">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-[13px] font-bold text-slate-600 [&::-webkit-details-marker]:hidden">
              주문 마감·삭제
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="space-y-2 px-3 pb-3">
              <p className="text-xs leading-5 text-slate-500">배송·계산서 처리 여부와 별도로 주문을 마감할 수 있습니다. 삭제는 복구할 수 없습니다.</p>
              <button
                type="button"
                onClick={handleCompleteOrder}
                disabled={currentStatus === 'CANCELED' || currentStatus === 'COMPLETED' || loadingAction === 'complete'}
                className={buttonClass('secondary', 'md', 'h-11 w-full')}
              >
                <CircleCheckBig className="h-4 w-4" /> {currentStatus === 'COMPLETED' ? '주문 마감됨' : loadingAction === 'complete' ? '마감 처리 중...' : '주문 마감 처리'}
              </button>
              <button
                type="button"
                onClick={() => setDeleteModalOpen(true)}
                className={buttonClass('danger', 'md', 'h-11 w-full')}
              >
                주문 삭제
              </button>
            </div>
          </details>
        </div>
      </section>

      {/* Phones: 배송 처리 (the one primary action) comes right after the summary, before the line items. */}
      <div className="grid gap-4 md:gap-6 @4xl:grid-cols-[minmax(0,1fr)_320px] @4xl:items-start">
        <div className="min-w-0 space-y-4 md:space-y-6" style={{ containerType: 'inline-size', containerName: 'order-lines' }}>
          <DetailCard
            title={`주문 상품 (총 ${detail.products.length}종 / ${detail.payment.totalQuantity.toLocaleString('ko-KR')}개${detail.payment.shippingFee > 0 ? ', 배송비 포함' : ''})`}
            icon={<Package className="h-4 w-4" />}
            muted={isCompletedOrder}
          >
            <p className="mb-3 text-xs leading-5 text-slate-500">
              {taxInvoiceIssued
                ? '세금계산서를 취소한 뒤 수량과 배송비를 수정할 수 있습니다.'
                : '품목별 수량 옆의 수정 버튼으로 변경하세요. 단가는 유지되며 상품금액·부가세·총액과 자동 배송비가 다시 계산됩니다. 직접 지정한 배송비는 유지됩니다.'}
            </p>
            <div className="ux-order-line-table overflow-x-auto rounded-lg border border-[var(--border)]">
              <table className="w-full min-w-[900px] border-collapse">
                <thead className="ux-thead text-left">
                  <tr>
                    <th className="min-w-[320px] px-5">상품 정보</th>
                    <th className="min-w-[150px] px-4 text-right">수량</th>
                    <th className="w-[130px] px-4 text-right">단가</th>
                    <th className="w-[140px] px-4 text-right">공급가</th>
                    <th className="w-[130px] px-4 text-right">부가세</th>
                    <th className="w-[150px] px-5 text-right">합계</th>
                  </tr>
                </thead>
                <tbody>
                  {productRows.map((product) => (
                    <tr key={product.id} className={`border-t border-slate-200 align-middle ${product.kind === 'shipping' ? 'bg-slate-50/70' : ''}`}>
                      <td className="h-20 px-5 py-3">
                        <div className="flex min-w-0 items-center gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-slate-200 bg-slate-50">
                            {product.kind === 'shipping' ? (
                              <Truck className="h-6 w-6 text-slate-400" />
                            ) : product.imageUrl ? (
                              <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                            ) : (
                              <Package className="h-6 w-6 text-slate-300" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="line-clamp-2 break-keep text-[14px] font-bold leading-5 text-slate-900">{product.name}</div>
                            <Badge outline className="mt-1.5">{product.option}</Badge>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right text-[14px] font-semibold tabular-nums text-slate-800">{renderQuantity(product)}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-right text-[14px] font-semibold tabular-nums text-slate-800">{formatCurrency(product.unitPrice)}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-right text-[14px] font-semibold tabular-nums text-slate-800">{formatCurrency(product.supplyPrice)}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-right text-[14px] font-semibold tabular-nums text-slate-800">{formatCurrency(product.vat)}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-right text-[14px] font-extrabold tabular-nums text-slate-950">{formatCurrency(product.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="ux-order-line-cards divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
              {productRows.map((product) => (
                <li key={product.id} className={`p-4 ${product.kind === 'shipping' ? 'bg-slate-50/70' : ''}`}>
                  <div className="flex gap-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-slate-200 bg-slate-50">
                      {product.kind === 'shipping' ? (
                        <Truck className="h-6 w-6 text-slate-400" />
                      ) : product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                      ) : (
                        <Package className="h-6 w-6 text-slate-300" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="break-keep text-[14px] font-bold leading-5 text-slate-900">{product.name}</div>
                      <Badge outline className="mt-1.5">{product.option}</Badge>
                    </div>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
                    <div><dt className="text-slate-500">수량</dt><dd className="mt-0.5 font-bold tabular-nums text-slate-900">{renderQuantity(product)}</dd></div>
                    <div><dt className="text-slate-500">단가</dt><dd className="mt-0.5 whitespace-nowrap font-bold tabular-nums text-slate-900">{formatCurrency(product.unitPrice)}</dd></div>
                    <div><dt className="text-slate-500">공급가</dt><dd className="mt-0.5 whitespace-nowrap font-bold tabular-nums text-slate-900">{formatCurrency(product.supplyPrice)}</dd></div>
                    <div><dt className="text-slate-500">부가세</dt><dd className="mt-0.5 whitespace-nowrap font-bold tabular-nums text-slate-900">{formatCurrency(product.vat)}</dd></div>
                    <div><dt className="text-slate-500">합계</dt><dd className="mt-0.5 whitespace-nowrap font-extrabold tabular-nums text-slate-950">{formatCurrency(product.total)}</dd></div>
                  </dl>
                </li>
              ))}
            </ul>

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-[var(--border)] pt-4 text-[14px] font-bold text-slate-900 @2xl:grid-cols-5">
              <div>
                <dt className="text-[12px] font-semibold text-slate-500">총 수량</dt>
                <dd className="mt-1 whitespace-nowrap tabular-nums">{detail.payment.totalQuantity.toLocaleString('ko-KR')}개</dd>
              </div>
              <div>
                <dt className="text-[12px] font-semibold text-slate-500">공급가</dt>
                <dd className="mt-1 whitespace-nowrap tabular-nums">{formatCurrency(detail.payment.productSupplyPrice)}</dd>
              </div>
              <div>
                <dt className="text-[12px] font-semibold text-slate-500">부가세</dt>
                <dd className="mt-1 whitespace-nowrap tabular-nums">{formatCurrency(detail.payment.vat)}</dd>
              </div>
              <div>
                <dt className="text-[12px] font-semibold text-slate-500">배송비</dt>
                <dd className="mt-1 whitespace-nowrap tabular-nums">{formatCurrency(detail.payment.shippingFee)}</dd>
                <dd className="mt-1 text-[11px] font-medium text-slate-500">
                  {order?.shippingFeeOverride != null ? '관리자 지정 · VAT 별도' : '자동 책정 · VAT 별도'}
                </dd>
                {!taxInvoiceIssued && !editingShippingFee ? (
                  <dd>
                    <button type="button" disabled={Boolean(loadingAction)} className={buttonClass('ghost', 'sm', 'mt-1 -ml-2 px-2 text-slate-700 underline underline-offset-2')} onClick={() => {
                      setShippingFeeInput(String(detail.payment.shippingFee))
                      setEditingShippingFee(true)
                    }}>배송비 수정</button>
                  </dd>
                ) : null}
                {editingShippingFee ? (
                  <dd className="mt-2 space-y-2">
                    <input aria-label="배송비 (VAT 별도)" type="number" min="0" max="100000000" step="1"
                      className={fieldClass('h-9 px-2')}
                      value={shippingFeeInput} onChange={(event) => setShippingFeeInput(event.target.value)} />
                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" disabled={Boolean(loadingAction)} onClick={() => void handleShippingFee()}
                        className={buttonClass('primary', 'sm')}>저장</button>
                      <button type="button" disabled={Boolean(loadingAction)} onClick={() => void handleShippingFee(true)}
                        className={buttonClass('secondary', 'sm')}>자동 책정</button>
                      <button type="button" onClick={() => setEditingShippingFee(false)} className={buttonClass('ghost', 'sm')}>취소</button>
                    </div>
                  </dd>
                ) : null}
              </div>
              <div className="col-span-2 @2xl:col-span-1">
                <dt className="text-[12px] font-semibold text-slate-500">최종 결제금액</dt>
                <dd className="mt-1 whitespace-nowrap text-[20px] font-extrabold tabular-nums text-slate-950">{formatCurrency(detail.payment.finalAmount)}</dd>
              </div>
            </dl>
          </DetailCard>

          <DetailCard title="거래처 정보" icon={<Store className="h-4 w-4" />} muted={isCompletedOrder}>
            <div className="grid gap-3 @xl:grid-cols-2 @3xl:grid-cols-3">
              {[
                { label: '거래처', value: detail.customer.company },
                { label: '사업자번호', value: detail.customer.businessNumber, copyKey: 'business-number' },
                { label: '연락처', value: detail.customer.phone, copyKey: 'phone' },
                { label: '이메일', value: detail.customer.email, copyKey: 'email' },
                { label: '배송지 주소', value: detail.shipping.address, copyKey: 'address', wide: true },
              ].map((field) => (
                <InfoField
                  key={field.label}
                  label={field.label}
                  value={field.value}
                  copyKey={field.copyKey}
                  copiedField={copiedField}
                  onCopy={showCopyToast}
                  wide={field.wide}
                />
              ))}
            </div>
          </DetailCard>
        </div>

        <aside id={`order-${detail.orderId}-shipping`} className="order-first scroll-mt-4 @4xl:order-none @4xl:sticky @4xl:top-4">
          <DetailCard
            title="배송 처리"
            icon={<Truck className="h-4 w-4" />}
            muted={isCompletedOrder}
          >
            <div className="space-y-4">
              <div>
                <label htmlFor={`order-${detail.orderId}-carrier`} className={labelClass}>택배사</label>
                <select
                  id={`order-${detail.orderId}-carrier`}
                  value={carrier}
                  onChange={(event) => setCarrier(event.target.value)}
                  className={selectClass(Boolean(carrier))}
                >
                  {CARRIER_OPTIONS.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`order-${detail.orderId}-tracking`} className={labelClass}>송장번호</label>
                <input
                  id={`order-${detail.orderId}-tracking`}
                  type="text"
                  inputMode="numeric"
                  value={trackingNumber}
                  onChange={(event) => setTrackingNumber(event.target.value)}
                  placeholder="숫자와 하이픈만 입력해주세요"
                  className={fieldClass()}
                />
              </div>

              <button
                type="button"
                onClick={handleSaveTracking}
                disabled={loadingAction === 'ship'}
                className={buttonClass('primary', 'md', 'w-full')}
              >
                {loadingAction === 'ship' ? '처리 중...' : '배송 처리'}
              </button>
            </div>
          </DetailCard>
        </aside>
      </div>
    </div>
  )
}
