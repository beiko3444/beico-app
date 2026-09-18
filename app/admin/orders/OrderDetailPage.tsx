'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { calculateOrderFinalAmount } from '@/lib/orderAmount'
import Button from '@/components/ui/Button'
import {
  AlertTriangle,
  Check,
  CircleCheckBig,
  Copy,
  FileText,
  Package,
  ReceiptText,
  Store,
  Truck,
} from 'lucide-react'

export type Tone = 'blue' | 'green' | 'orange' | 'red' | 'gray'

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
  statusLabel: string
  statusTone: Tone
  channelLabel: string
  channelStatus: string
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
  createdAtText: '2026-05-04 10:29',
  createdAtRaw: '2026-05-04T10:29:00+09:00',
  statusLabel: '입금확인',
  statusTone: 'green',
  channelLabel: '주문 프로세스',
  channelStatus: '입금확인',
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

export function formatCurrency(value: number) {
  return `${Math.round(value).toLocaleString('ko-KR')}원`
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return '-'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`
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

function mapStatusMeta(status: string, hasTracking: boolean, taxInvoiceIssued: boolean): { label: string; tone: Tone } {
  if (status === 'CANCELED') return { label: '주문취소', tone: 'red' }
  if (status === 'COMPLETED') return { label: '거래완료', tone: 'green' }
  if (hasTracking || status === 'SHIPPED') return { label: taxInvoiceIssued ? '배송완료' : '배송진행', tone: 'blue' }
  if (status === 'DEPOSIT_COMPLETED') return { label: '입금확인', tone: 'green' }
  if (status === 'APPROVED' || status === 'PENDING_DEPOSIT' || status === 'PENDING') return { label: '입금대기', tone: 'orange' }
  return { label: '주문접수', tone: 'gray' }
}

/** Status label/tone for a raw order record — used by the collapsed summary row. */
export function getOrderStatusMeta(order: OrderRecord): { label: string; tone: Tone } {
  return mapStatusMeta(order.status, parseTrackingNumbers(order.trackingNumber).length > 0, Boolean(order.taxInvoiceIssued))
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

  const payment = calculateOrderFinalAmount(order.items || [])
  const statusMeta = mapStatusMeta(order.status, trackingNumbers.length > 0, Boolean(order.taxInvoiceIssued))

  return {
    id: orderNumber,
    orderId: order.id,
    orderNumber,
    createdAtText,
    createdAtRaw,
    statusLabel: statusMeta.label,
    statusTone: statusMeta.tone,
    channelLabel: '주문 프로세스',
    channelStatus: statusMeta.label,
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

export function toneClasses(tone: Tone) {
  switch (tone) {
    case 'blue':
      return 'border-sky-200 bg-sky-50 text-sky-700'
    case 'green':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'orange':
      return 'border-orange-200 bg-orange-50 text-orange-700'
    case 'red':
      return 'border-red-200 bg-red-50 text-red-700'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700'
  }
}

const inputClass =
  'h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[14px] font-bold text-slate-900 transition ' +
  'focus:border-brand-orange focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40'

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
    <section className={`min-w-0 overflow-hidden rounded-2xl border ${
      muted ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'
    } ${className}`}>
      <div className={`flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5 ${
        muted ? 'bg-slate-100/70' : ''
      }`}>
        <div className="flex min-w-0 items-center gap-2">
          {icon ? <span className="shrink-0 text-slate-500">{icon}</span> : null}
          <h3 className="break-keep text-[15px] font-extrabold tracking-tight text-slate-900">{title}</h3>
        </div>
        {actions}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  )
}

function CopyButton({ copied, onClick }: { copied: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="복사"
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40"
    >
      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
    </button>
  )
}

function SummaryMetric({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`min-w-0 border-slate-200 px-4 py-3 text-center sm:border-l first:sm:border-l-0 ${
      highlight ? 'bg-brand-orange-soft' : 'bg-white'
    }`}>
      <div className="truncate text-[11px] font-bold text-slate-500">{label}</div>
      <div className={`mt-1.5 whitespace-nowrap font-black tracking-tight ${
        highlight ? 'text-[20px] text-brand-orange' : 'text-[16px] text-slate-900'
      }`}>
        {value}
      </div>
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
    <div className={`min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 ${wide ? 'xl:col-span-2' : ''}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-bold text-slate-500">{label}</div>
        {copyKey ? <CopyButton copied={copiedField === copyKey} onClick={() => onCopy(copyKey, value)} /> : null}
      </div>
      <div className="mt-1.5 break-words text-[14px] font-black leading-6 text-slate-900">{value}</div>
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
  const currentStatusMeta = useMemo(
    () => (isCompletedOrder
      ? { label: '거래완료', tone: 'green' as Tone }
      : mapStatusMeta(currentStatus, trackingNumber.trim().length > 0, taxInvoiceIssued)),
    [currentStatus, trackingNumber, taxInvoiceIssued, isCompletedOrder]
  )
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
    <div className="min-w-0 space-y-5">
      {toastMessage ? (
        <div className="fixed right-6 top-24 z-50 rounded-xl bg-brand-ink px-4 py-2 text-[12px] font-bold text-white shadow-2xl">
          {toastMessage}
        </div>
      ) : null}

      {deleteModalOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-[18px] font-black text-slate-900">주문을 삭제하시겠습니까?</h4>
                <p className="mt-2 text-[13px] leading-6 text-slate-500">
                  삭제된 주문은 복구할 수 없습니다. 정말 삭제하려면 주문번호 <strong className="text-slate-900">{detail.orderNumber}</strong> 를 입력하세요.
                </p>
              </div>
            </div>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(event) => setDeleteConfirmText(event.target.value)}
              className={`mt-5 ${inputClass}`}
              placeholder={detail.orderNumber}
            />
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setDeleteModalOpen(false)
                  setDeleteConfirmText('')
                }}
              >
                취소
              </Button>
              <Button variant="danger" onClick={handleDeleteOrder} loading={loadingAction === 'delete'}>
                {loadingAction === 'delete' ? '삭제 중...' : '주문 삭제'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" icon={<FileText className="h-3.5 w-3.5" />} onClick={handlePrintStatement}>
          거래명세표 출력
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={<ReceiptText className="h-3.5 w-3.5" />}
          onClick={handleIssueTaxInvoice}
          disabled={!canIssueDocuments || taxInvoiceIssued}
          loading={loadingAction === 'tax-invoice'}
        >
          {taxInvoiceIssued ? '계산서 발행완료' : '세금계산서 발행'}
        </Button>
        <Button
          variant="primary"
          size="sm"
          icon={<CircleCheckBig className="h-3.5 w-3.5" />}
          onClick={handleCompleteOrder}
          disabled={currentStatus === 'CANCELED' || currentStatus === 'COMPLETED'}
          loading={loadingAction === 'complete'}
        >
          {currentStatus === 'COMPLETED' ? '주문 마감됨' : loadingAction === 'complete' ? '마감 처리 중...' : '주문 마감 처리'}
        </Button>
        <Button variant="danger" size="sm" className="ml-auto" onClick={() => setDeleteModalOpen(true)}>
          주문 삭제
        </Button>
      </div>

      <div className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white sm:grid-cols-3 xl:grid-cols-5">
        <SummaryMetric label="상품 공급가" value={formatCurrency(detail.payment.productSupplyPrice)} />
        <SummaryMetric label="배송비" value={formatCurrency(detail.payment.shippingFee)} />
        <SummaryMetric label="부가세" value={formatCurrency(detail.payment.vat)} />
        <SummaryMetric label="수량" value={`${detail.payment.totalQuantity.toLocaleString('ko-KR')}개`} />
        <SummaryMetric label="최종 결제금액" value={formatCurrency(detail.payment.finalAmount)} highlight />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div className="min-w-0 space-y-5">
          <DetailCard
            title={`주문 상품 (총 ${detail.products.length}종 / ${detail.payment.totalQuantity.toLocaleString('ko-KR')}개${detail.payment.shippingFee > 0 ? ', 배송비 포함' : ''})`}
            icon={<Package className="h-4 w-4" />}
            muted={isCompletedOrder}
          >
            <div className="hidden overflow-x-auto rounded-xl border border-slate-200 lg:block">
              <table className="w-full min-w-[900px] border-collapse">
                <thead className="ux-thead text-left">
                  <tr>
                    <th className="min-w-[320px] whitespace-nowrap px-5">상품 정보</th>
                    <th className="w-[110px] whitespace-nowrap px-4 text-right">수량</th>
                    <th className="w-[130px] whitespace-nowrap px-4 text-right">단가</th>
                    <th className="w-[140px] whitespace-nowrap px-4 text-right">공급가</th>
                    <th className="w-[130px] whitespace-nowrap px-4 text-right">부가세</th>
                    <th className="w-[150px] whitespace-nowrap px-5 text-right">합계</th>
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
                            <div className="line-clamp-2 break-keep text-[14px] font-black leading-5 text-slate-900">{product.name}</div>
                            <div className={`mt-1.5 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold ${product.kind === 'shipping' ? 'border-slate-200 bg-slate-50 text-slate-600' : 'border-orange-200 bg-brand-orange-soft text-brand-orange'}`}>{product.option}</div>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right text-[14px] font-bold text-slate-800">{product.kind === 'shipping' ? '1건' : `${product.quantity.toLocaleString('ko-KR')}개`}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-right text-[14px] font-bold text-slate-800">{formatCurrency(product.unitPrice)}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-right text-[14px] font-bold text-slate-800">{formatCurrency(product.supplyPrice)}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-right text-[14px] font-bold text-slate-800">{formatCurrency(product.vat)}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-right text-[14px] font-black text-slate-900">{formatCurrency(product.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 lg:hidden">
              {productRows.map((product) => (
                <div key={product.id} className={`min-w-0 rounded-2xl border border-slate-200 p-4 ${product.kind === 'shipping' ? 'bg-slate-50/70' : ''}`}>
                  <div className="flex gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                      {product.kind === 'shipping' ? (
                        <Truck className="h-7 w-7 text-slate-400" />
                      ) : product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                      ) : (
                        <Package className="h-6 w-6 text-slate-300" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="break-keep text-[14px] font-black leading-5 text-slate-900">{product.name}</div>
                      <div className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${product.kind === 'shipping' ? 'border-slate-200 bg-slate-50 text-slate-600' : 'border-orange-200 bg-brand-orange-soft text-brand-orange'}`}>{product.option}</div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-[12px]">
                    <div className="rounded-xl bg-slate-50 px-3 py-2"><span className="text-slate-500">수량</span><div className="mt-1 whitespace-nowrap font-bold text-slate-900">{product.kind === 'shipping' ? '1건' : `${product.quantity.toLocaleString('ko-KR')}개`}</div></div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2"><span className="text-slate-500">단가</span><div className="mt-1 whitespace-nowrap font-bold text-slate-900">{formatCurrency(product.unitPrice)}</div></div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2"><span className="text-slate-500">공급가</span><div className="mt-1 whitespace-nowrap font-bold text-slate-900">{formatCurrency(product.supplyPrice)}</div></div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2"><span className="text-slate-500">부가세</span><div className="mt-1 whitespace-nowrap font-bold text-slate-900">{formatCurrency(product.vat)}</div></div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2"><span className="text-slate-500">합계</span><div className="mt-1 whitespace-nowrap font-bold text-slate-900">{formatCurrency(product.total)}</div></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-[14px] font-black text-slate-900 sm:grid-cols-2 xl:grid-cols-5">
              <div className="flex items-center justify-between gap-3 xl:block">
                <span className="text-slate-500">총 수량</span>
                <div className="whitespace-nowrap xl:mt-1">{detail.payment.totalQuantity.toLocaleString('ko-KR')}개</div>
              </div>
              <div className="flex items-center justify-between gap-3 xl:block">
                <span className="text-slate-500">공급가</span>
                <div className="whitespace-nowrap xl:mt-1">{formatCurrency(detail.payment.productSupplyPrice)}</div>
              </div>
              <div className="flex items-center justify-between gap-3 xl:block">
                <span className="text-slate-500">부가세</span>
                <div className="whitespace-nowrap xl:mt-1">{formatCurrency(detail.payment.vat)}</div>
              </div>
              <div className="flex items-center justify-between gap-3 xl:block">
                <span className="text-slate-500">배송비</span>
                <div className="whitespace-nowrap xl:mt-1">{formatCurrency(detail.payment.shippingFee)}</div>
              </div>
              <div className="flex items-center justify-between gap-3 sm:col-span-2 xl:col-span-1 xl:block">
                <span className="text-slate-500">최종 결제금액</span>
                <div className="whitespace-nowrap text-[20px] text-brand-orange xl:mt-1">{formatCurrency(detail.payment.finalAmount)}</div>
              </div>
            </div>
          </DetailCard>

          <DetailCard title="거래처 정보" icon={<Store className="h-4 w-4" />} muted={isCompletedOrder}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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

        <aside className="min-w-0 space-y-5">
          <DetailCard
            title="배송 처리"
            icon={<Truck className="h-4 w-4" />}
            muted={isCompletedOrder}
            actions={(
              <span className={`inline-flex h-7 items-center whitespace-nowrap rounded-full border px-3 text-[11px] font-bold ${toneClasses(currentStatusMeta.tone)}`}>
                {currentStatusMeta.label}
              </span>
            )}
          >
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-[12px] font-bold text-slate-500">택배사</label>
                <select
                  value={carrier}
                  onChange={(event) => setCarrier(event.target.value)}
                  className={inputClass}
                >
                  {CARRIER_OPTIONS.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-[12px] font-bold text-slate-500">송장번호</label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(event) => setTrackingNumber(event.target.value)}
                  placeholder="숫자와 하이픈만 입력해주세요"
                  className={inputClass}
                />
              </div>

              <Button variant="primary" className="w-full" onClick={handleSaveTracking} loading={loadingAction === 'ship'}>
                {loadingAction === 'ship' ? '처리 중...' : '배송 처리'}
              </Button>
            </div>
          </DetailCard>
        </aside>
      </div>
    </div>
  )
}
