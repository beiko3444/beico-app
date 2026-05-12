'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { calculateOrderFinalAmount } from '@/lib/orderAmount'
import {
  AlertTriangle,
  Bell,
  Check,
  ChevronRight,
  Copy,
  FileText,
  MessageSquare,
  Package,
  ReceiptText,
  Store,
  Truck,
} from 'lucide-react'

type Tone = 'blue' | 'green' | 'orange' | 'red' | 'gray'

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

interface DepositSmsRecord {
  id: string
  messageHash?: string
  sender: string
  body: string
  receivedAt: string | Date
  amount: number | null
  depositorName?: string | null
  bankName?: string | null
  sourceDevice?: string | null
  matchStatus: string
  matchedAt?: string | Date | null
}

interface OrderRecord {
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
  depositSmsMessages?: DepositSmsRecord[]
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
  depositSmsMessages: DepositSmsRecord[]
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
  depositSmsMessages: [],
  rawStatus: 'DEPOSIT_COMPLETED',
}

function formatCurrency(value: number) {
  return `${Math.round(value).toLocaleString('ko-KR')}원`
}

function formatDateTime(value: string | Date | null | undefined) {
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
  if (hasTracking || status === 'SHIPPED') return { label: taxInvoiceIssued ? '배송완료' : '배송진행', tone: 'blue' }
  if (status === 'DEPOSIT_COMPLETED') return { label: '입금확인', tone: 'green' }
  if (status === 'APPROVED' || status === 'PENDING_DEPOSIT' || status === 'PENDING') return { label: '입금대기', tone: 'orange' }
  return { label: '주문접수', tone: 'gray' }
}

function formatDepositSmsStatus(status: string) {
  switch (status) {
    case 'AUTO_CONFIRMED':
      return { label: '자동 입금확인', tone: 'green' as Tone }
    case 'UNMATCHED':
      return { label: '미매칭', tone: 'red' as Tone }
    case 'AMBIGUOUS':
      return { label: '복수매칭', tone: 'orange' as Tone }
    case 'NOT_DEPOSIT':
      return { label: '입금문자 아님', tone: 'gray' as Tone }
    case 'DUPLICATE_OR_ALREADY_CONFIRMED':
      return { label: '중복/이미확인', tone: 'gray' as Tone }
    default:
      return { label: status || '확인 필요', tone: 'gray' as Tone }
  }
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
    depositSmsMessages: order.depositSmsMessages || [],
    rawStatus: order.status,
  }
}

function toneClasses(tone: Tone) {
  switch (tone) {
    case 'blue':
      return 'border-blue-200 bg-blue-50 text-blue-700'
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

function DetailCard({
  title,
  icon,
  actions,
  children,
}: {
  title: string
  icon?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-[18px] border border-[#E6EAF2] bg-white shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
      <div className="flex items-center justify-between gap-3 border-b border-[#E6EAF2] px-7 py-5">
        <div className="flex items-center gap-2">
          {icon ? <span className="text-slate-400">{icon}</span> : null}
          <h3 className="text-[17px] font-extrabold tracking-tight text-[#0F172A]">{title}</h3>
        </div>
        {actions}
      </div>
      <div className="p-7">{children}</div>
    </section>
  )
}

function CopyButton({ copied, onClick }: { copied: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition hover:border-slate-300 hover:text-slate-700"
    >
      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
    </button>
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

  const isCompletedOrder = trackingNumber.trim().length > 0 && taxInvoiceIssued
  const currentStatusMeta = useMemo(
    () => (isCompletedOrder
      ? { label: '거래완료', tone: 'green' as Tone }
      : mapStatusMeta(currentStatus, trackingNumber.trim().length > 0, taxInvoiceIssued)),
    [currentStatus, trackingNumber, taxInvoiceIssued, isCompletedOrder]
  )
  const latestDepositSms = detail.depositSmsMessages[0]
  const latestDepositSmsMeta = latestDepositSms ? formatDepositSmsStatus(latestDepositSms.matchStatus) : null

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
        status: 'SHIPPED',
      })
      setCurrentStatus('SHIPPED')
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
    <div
      className="bg-[#F5F7FB] px-4 pb-12 pt-7 md:px-8"
      style={{
        ['--page-bg' as string]: '#F5F7FB',
        ['--card-bg' as string]: '#FFFFFF',
        ['--card-border' as string]: '#E6EAF2',
        ['--text-primary' as string]: '#0F172A',
        ['--text-secondary' as string]: '#475569',
        ['--text-muted' as string]: '#8492A6',
        ['--primary' as string]: '#2563EB',
        ['--primary-dark' as string]: '#1054E8',
        ['--success' as string]: '#10B981',
        ['--danger' as string]: '#EF4444',
      }}
    >
      <div className="mx-auto max-w-[1440px] space-y-6">
      {toastMessage ? (
        <div className="fixed right-6 top-24 z-50 rounded-xl bg-slate-900 px-4 py-2 text-[12px] font-bold text-white shadow-2xl">
          {toastMessage}
        </div>
      ) : null}

      {deleteModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
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
              className="mt-5 w-full rounded-xl border border-slate-200 px-4 py-3 text-[14px] font-bold text-slate-900 outline-none transition focus:border-red-400"
              placeholder={detail.orderNumber}
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteModalOpen(false)
                  setDeleteConfirmText('')
                }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-[13px] font-bold text-slate-600 transition hover:bg-slate-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleDeleteOrder}
                disabled={loadingAction === 'delete'}
                className="rounded-xl bg-red-600 px-4 py-2 text-[13px] font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {loadingAction === 'delete' ? '삭제 중...' : '주문 삭제'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[13px] text-[#64748B]">
          <span>관리자 홈</span>
          <ChevronRight className="h-3.5 w-3.5 text-[#94A3B8]" />
          <span>주문 관리</span>
          <ChevronRight className="h-3.5 w-3.5 text-[#94A3B8]" />
          <span className="font-semibold text-[#0F172A]">주문 상세</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="flex h-[46px] w-[46px] items-center justify-center rounded-full border border-[#D8DEE9] bg-white text-[#334155] transition hover:bg-slate-50">
            <Bell className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="inline-flex h-[46px] items-center rounded-full border border-[#D8DEE9] bg-white px-4 text-[14px] font-bold text-[#334155] transition hover:bg-slate-50"
          >
            로그아웃
          </button>
        </div>
      </section>

      <div className="rounded-[22px] border border-[#BDEFD8] bg-[linear-gradient(135deg,#F0FFF8_0%,#FFFFFF_58%,#F8FAFF_100%)] p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)] lg:p-8">
        <div className="grid items-center gap-6 xl:grid-cols-[minmax(0,1fr)_360px_360px]">
          <div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#E9FFF4] text-[#12B981]">
                <Package className="h-8 w-8" />
              </div>
              <h2 className="text-[24px] font-black tracking-[-0.04em] text-[#0F172A] md:text-[32px]">{detail.customer.company}</h2>
              <span className="hidden h-7 w-px bg-[#CBD5E1] md:block" />
              <div className="text-[22px] font-black tracking-[-0.04em] text-[#1769D9] md:text-[28px]">주문 #{detail.orderNumber}</div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] font-black ${toneClasses(currentStatusMeta.tone)}`}>{currentStatusMeta.label}</span>
              <span className="text-[14px] font-semibold text-[#64748B]">주문일시 {detail.createdAtText}</span>
            </div>
          </div>

          <div className="grid gap-2 rounded-2xl border border-[#DCE5F0] bg-white/85 p-4 shadow-sm">
            <div className="grid grid-cols-2 gap-2 text-[12px]">
              <div className="rounded-xl bg-[#F8FAFC] px-3 py-2">
                <div className="font-bold text-slate-500">상품 공급가</div>
                <div className="mt-1 text-right text-[15px] font-black text-slate-950">{formatCurrency(detail.payment.productSupplyPrice)}</div>
              </div>
              <div className="rounded-xl bg-[#F8FAFC] px-3 py-2">
                <div className="font-bold text-slate-500">배송비</div>
                <div className="mt-1 text-right text-[15px] font-black text-slate-950">{formatCurrency(detail.payment.shippingFee)}</div>
              </div>
              <div className="rounded-xl bg-[#F8FAFC] px-3 py-2">
                <div className="font-bold text-slate-500">부가세</div>
                <div className="mt-1 text-right text-[15px] font-black text-slate-950">{formatCurrency(detail.payment.vat)}</div>
              </div>
              <div className="rounded-xl bg-[#F8FAFC] px-3 py-2">
                <div className="font-bold text-slate-500">수량</div>
                <div className="mt-1 text-right text-[15px] font-black text-slate-950">{detail.payment.totalQuantity.toLocaleString('ko-KR')}개</div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-[#E6EAF2]">
              <span className="text-[13px] font-black text-slate-600">최종 결제금액</span>
              <span className="text-[24px] font-black tracking-[-0.04em] text-slate-950">{formatCurrency(detail.payment.finalAmount)}</span>
            </div>
          </div>

          <div className="grid w-full gap-2 sm:grid-cols-2 xl:w-[360px]">
            <button type="button" onClick={handlePrintStatement} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#D8DEE9] bg-white px-4 text-[13px] font-extrabold text-slate-700 transition hover:bg-slate-50">
              <FileText className="h-4 w-4" /> 거래명세표 출력
            </button>
            <button type="button" onClick={handleIssueTaxInvoice} disabled={!canIssueDocuments || taxInvoiceIssued || loadingAction === 'tax-invoice'} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#D8DEE9] bg-white px-4 text-[13px] font-extrabold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
              <ReceiptText className="h-4 w-4" /> {taxInvoiceIssued ? '계산서 발행완료' : '세금계산서 발행'}
            </button>
            <button
              type="button"
              onClick={() => setDeleteModalOpen(true)}
              className="h-12 rounded-xl border border-red-200 bg-[#FFF7F7] px-4 text-[13px] font-extrabold text-red-500 transition hover:bg-red-50 sm:col-span-2"
            >
              주문 삭제
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div className="space-y-6">
          <DetailCard title="거래처 정보" icon={<Store className="h-4 w-4" />}>
            <div className="grid gap-[14px] md:grid-cols-2 xl:grid-cols-3">
              {[
                { label: '거래처', value: detail.customer.company },
                { label: '사업자번호', value: detail.customer.businessNumber, copyKey: 'business-number' },
                { label: '연락처', value: detail.customer.phone, copyKey: 'phone' },
                { label: '이메일', value: detail.customer.email, copyKey: 'email' },
                { label: '배송지 주소', value: detail.shipping.address, copyKey: 'address' },
              ].map((field) => (
                <div key={field.label} className="min-h-[112px] rounded-[14px] border border-[#E6EAF2] bg-[#F8FAFC] px-[18px] py-[18px]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] font-bold text-slate-500">{field.label}</div>
                    {field.copyKey ? <CopyButton copied={copiedField === field.copyKey} onClick={() => showCopyToast(field.copyKey, field.value)} /> : null}
                  </div>
                  <div className="mt-2 break-all text-[16px] font-black text-slate-900">{field.value}</div>
                </div>
              ))}
            </div>
          </DetailCard>

          <DetailCard
            title={`주문 상품 (총 ${detail.products.length}종 / ${detail.payment.totalQuantity.toLocaleString('ko-KR')}개${detail.payment.shippingFee > 0 ? ', 배송비 포함' : ''})`}
            icon={<Package className="h-4 w-4" />}
          >
            <div className="hidden overflow-hidden rounded-2xl border border-[#E6EAF2] lg:block">
              <table className="w-full table-fixed border-collapse">
                <thead className="bg-slate-50 text-left text-[12px] font-black text-slate-500">
                  <tr>
                    <th className="h-14 w-[40%] px-6 py-3">상품 정보</th>
                    <th className="px-4 py-3 text-right">수량</th>
                    <th className="px-4 py-3 text-right">단가</th>
                    <th className="px-4 py-3 text-right">공급가</th>
                    <th className="px-4 py-3 text-right">부가세</th>
                    <th className="px-4 py-3 text-right">합계</th>
                  </tr>
                </thead>
                <tbody>
                  {productRows.map((product) => (
                    <tr key={product.id} className={`border-t border-slate-200 align-top ${product.kind === 'shipping' ? 'bg-slate-50/70' : ''}`}>
                      <td className="h-20 px-6 py-2.5">
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-[10px] border border-slate-200 bg-slate-50">
                            {product.kind === 'shipping' ? (
                              <Truck className="h-6 w-6 text-slate-400" />
                            ) : product.imageUrl ? (
                              <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                            ) : (
                              <Package className="h-6 w-6 text-slate-300" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-[15px] font-black text-slate-900">{product.name}</div>
                            <div className={`mt-1.5 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold ${product.kind === 'shipping' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-orange-200 bg-[#FFF1E8] text-orange-600'}`}>{product.option}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right text-[14px] font-bold text-slate-800">{product.kind === 'shipping' ? '1건' : `${product.quantity.toLocaleString('ko-KR')}개`}</td>
                      <td className="px-4 py-4 text-right text-[14px] font-bold text-slate-800">{formatCurrency(product.unitPrice)}</td>
                      <td className="px-4 py-4 text-right text-[14px] font-bold text-slate-800">{formatCurrency(product.supplyPrice)}</td>
                      <td className="px-4 py-4 text-right text-[14px] font-bold text-slate-800">{formatCurrency(product.vat)}</td>
                      <td className="px-4 py-4 text-right text-[15px] font-black text-slate-950">{formatCurrency(product.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 lg:hidden">
              {productRows.map((product) => (
                <div key={product.id} className={`rounded-2xl border border-slate-200 p-4 ${product.kind === 'shipping' ? 'bg-slate-50/70' : ''}`}>
                  <div className="flex gap-4">
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                      {product.kind === 'shipping' ? (
                        <Truck className="h-7 w-7 text-slate-400" />
                      ) : product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                      ) : (
                        <Package className="h-6 w-6 text-slate-300" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-black text-slate-900">{product.name}</div>
                      <div className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${product.kind === 'shipping' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-orange-200 bg-orange-50 text-orange-700'}`}>{product.option}</div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-[12px]">
                    <div className="rounded-xl bg-slate-50 px-3 py-2"><span className="text-slate-500">수량</span><div className="mt-1 font-bold text-slate-900">{product.kind === 'shipping' ? '1건' : `${product.quantity}개`}</div></div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2"><span className="text-slate-500">단가</span><div className="mt-1 font-bold text-slate-900">{formatCurrency(product.unitPrice)}</div></div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2"><span className="text-slate-500">공급가</span><div className="mt-1 font-bold text-slate-900">{formatCurrency(product.supplyPrice)}</div></div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2"><span className="text-slate-500">부가세</span><div className="mt-1 font-bold text-slate-900">{formatCurrency(product.vat)}</div></div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2"><span className="text-slate-500">합계</span><div className="mt-1 font-bold text-slate-900">{formatCurrency(product.total)}</div></div>
                  </div>
                </div>
              ))}
            </div>

          </DetailCard>

        </div>

        <aside className="space-y-5 xl:sticky xl:top-[104px]">
          {latestDepositSms ? (
            <DetailCard title="문자 자동입금 확인" icon={<MessageSquare className="h-4 w-4" />}>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div>
                    <div className="text-[11px] font-bold text-slate-500">매칭 상태</div>
                    <div className="mt-1 text-[15px] font-black text-slate-900">{latestDepositSmsMeta?.label}</div>
                  </div>
                  <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black ${toneClasses(latestDepositSmsMeta?.tone || 'gray')}`}>
                    {latestDepositSmsMeta?.label}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[12px]">
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <span className="font-bold text-slate-500">문자 금액</span>
                    <div className="mt-1 text-[14px] font-black text-slate-900">
                      {latestDepositSms.amount ? formatCurrency(latestDepositSms.amount) : '-'}
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <span className="font-bold text-slate-500">수신시각</span>
                    <div className="mt-1 text-[13px] font-black text-slate-900">
                      {formatDateTime(latestDepositSms.receivedAt)}
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <span className="font-bold text-slate-500">은행</span>
                    <div className="mt-1 text-[13px] font-black text-slate-900">
                      {latestDepositSms.bankName || '-'}
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <span className="font-bold text-slate-500">입금자</span>
                    <div className="mt-1 text-[13px] font-black text-slate-900">
                      {latestDepositSms.depositorName || '-'}
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="text-[11px] font-bold text-slate-500">문자 원문</div>
                  <p className="mt-2 whitespace-pre-wrap break-words text-[12px] leading-5 text-slate-700">
                    {latestDepositSms.body}
                  </p>
                </div>
              </div>
            </DetailCard>
          ) : null}

          <DetailCard title="배송 처리" icon={<Truck className="h-4 w-4" />}>
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold text-slate-500">현재 상태</div>
                    <div className="mt-1 text-[15px] font-black text-slate-900">{currentStatusMeta.label}</div>
                  </div>
                  <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-bold ${toneClasses(currentStatusMeta.tone)}`}>{currentStatusMeta.label}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-2 block text-[12px] font-bold text-slate-500">택배사</label>
                  <select
                    value={carrier}
                    onChange={(event) => setCarrier(event.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[14px] font-bold text-slate-900 outline-none transition focus:border-blue-400"
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
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[14px] font-bold text-slate-900 outline-none transition focus:border-blue-400"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveTracking}
                disabled={loadingAction === 'ship'}
                className="h-[46px] w-full rounded-xl bg-blue-600 px-4 text-[13px] font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:opacity-50"
              >
                {loadingAction === 'ship' ? '처리 중...' : '배송 처리'}
              </button>
            </div>
          </DetailCard>

        </aside>
      </div>
      </div>
    </div>
  )
}
