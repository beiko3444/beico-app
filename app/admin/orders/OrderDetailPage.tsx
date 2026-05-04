'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Check,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  Copy,
  FileText,
  Mail,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Package,
  Phone,
  ReceiptText,
  Store,
  Truck,
  UserRound,
} from 'lucide-react'

type Tone = 'blue' | 'green' | 'orange' | 'red' | 'gray'
type StepState = 'done' | 'current' | 'pending'

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
}

interface ProcessStep {
  label: string
  status: StepState
  time: string | null
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
      total: 400000,
    },
  ],
  depositConfirmedAt: '2026-05-04 10:31',
  adminDepositConfirmedAt: '2026-05-04 11:15',
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
      total: supplyPrice,
    }
  })

  const totalQuantity = products.reduce((sum, item) => sum + item.quantity, 0)
  const productSupplyPrice = products.reduce((sum, item) => sum + item.supplyPrice, 0)
  const shippingFee = totalQuantity > 0 ? Math.ceil(totalQuantity / 100) * 3000 : 0
  const vat = Math.round((productSupplyPrice + shippingFee) * 0.1)
  const finalAmount = productSupplyPrice + shippingFee + vat
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
      totalQuantity,
      productSupplyPrice,
      shippingFee,
      vat,
      finalAmount,
    },
    products: products.length > 0 ? products : sampleOrderData.products,
    depositConfirmedAt: order.depositConfirmedAt ? formatDateTime(order.depositConfirmedAt) : null,
    adminDepositConfirmedAt: order.adminDepositConfirmedAt ? formatDateTime(order.adminDepositConfirmedAt) : null,
    rawStatus: order.status,
  }
}

function createProcessSteps(detail: NormalizedOrderDetail, trackingNumber: string, currentStatus: string) {
  const hasTracking = trackingNumber.trim().length > 0 || currentStatus === 'SHIPPED'
  const isDepositCompleted = currentStatus === 'DEPOSIT_COMPLETED' || currentStatus === 'SHIPPED' || Boolean(detail.adminDepositConfirmedAt)

  const states: StepState[] = hasTracking
    ? ['done', 'done', 'done', 'done', 'current']
    : isDepositCompleted
      ? ['done', 'done', 'current', 'pending', 'pending']
      : ['done', 'current', 'pending', 'pending', 'pending']

  return [
    { label: '주문접수', status: states[0], time: detail.createdAtText },
    { label: '입금대기', status: states[1], time: detail.depositConfirmedAt || detail.createdAtText },
    { label: '입금확인', status: states[2], time: detail.adminDepositConfirmedAt || detail.depositConfirmedAt },
    { label: '배송준비', status: states[3], time: hasTracking ? '송장 저장 완료' : null },
    { label: '배송완료', status: states[4], time: hasTracking ? '출고 처리 완료' : null },
  ]
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
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-2">
          {icon ? <span className="text-slate-400">{icon}</span> : null}
          <h3 className="text-[15px] font-black tracking-tight text-slate-900">{title}</h3>
        </div>
        {actions}
      </div>
      <div className="p-5">{children}</div>
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

function DropdownButton({
  label,
  open,
  onToggle,
  children,
}: {
  label: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
      >
        <span>{label}</span>
        <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+8px)] z-30 min-w-[190px] rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
          {children}
        </div>
      ) : null}
    </div>
  )
}

function TimelineDot({ status }: { status: StepState }) {
  if (status === 'done') {
    return <span className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600"><Check className="h-4 w-4" /></span>
  }
  if (status === 'current') {
    return <span className="flex h-8 w-8 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-600"><Clock3 className="h-4 w-4" /></span>
  }
  return <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-400">•</span>
}

export default function OrderDetailPage({ order }: OrderDetailPageProps) {
  const router = useRouter()
  const detail = useMemo(() => buildOrderDetailData(order), [order])

  const [currentStatus, setCurrentStatus] = useState(detail.rawStatus)
  const [taxInvoiceIssued, setTaxInvoiceIssued] = useState(detail.taxInvoiceIssued)
  const [carrier, setCarrier] = useState(detail.shipping.carrier || DEFAULT_CARRIER)
  const [trackingNumber, setTrackingNumber] = useState(detail.shipping.trackingNumber)
  const [isEditingTracking, setIsEditingTracking] = useState(!detail.shipping.trackingNumber)
  const [adminDepositConfirmedAt, setAdminDepositConfirmedAt] = useState(detail.adminDepositConfirmedAt)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState('')
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [documentMenuOpen, setDocumentMenuOpen] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  useEffect(() => {
    setCurrentStatus(detail.rawStatus)
    setTaxInvoiceIssued(detail.taxInvoiceIssued)
    setCarrier(detail.shipping.carrier || DEFAULT_CARRIER)
    setTrackingNumber(detail.shipping.trackingNumber)
    setIsEditingTracking(!detail.shipping.trackingNumber)
    setAdminDepositConfirmedAt(detail.adminDepositConfirmedAt)
  }, [detail])

  useEffect(() => {
    if (!toastMessage) return
    const timeout = window.setTimeout(() => setToastMessage(''), 1500)
    return () => window.clearTimeout(timeout)
  }, [toastMessage])

  const processSteps = useMemo(
    () => createProcessSteps(detail, trackingNumber, currentStatus),
    [detail, trackingNumber, currentStatus]
  )

  const isCompletedOrder = trackingNumber.trim().length > 0 && taxInvoiceIssued
  const currentStatusMeta = useMemo(
    () => (isCompletedOrder
      ? { label: '거래완료', tone: 'green' as Tone }
      : mapStatusMeta(currentStatus, trackingNumber.trim().length > 0, taxInvoiceIssued)),
    [currentStatus, trackingNumber, taxInvoiceIssued, isCompletedOrder]
  )

  const nextActionDescription = trackingNumber.trim().length > 0
    ? '거래명세표 또는 세금계산서 발행으로 마감 작업을 진행하세요.'
    : currentStatus === 'DEPOSIT_COMPLETED' || adminDepositConfirmedAt
      ? '송장 정보를 입력하고 배송준비 처리 버튼으로 다음 단계를 진행하세요.'
      : '입금 확인을 먼저 처리한 뒤 배송 작업을 진행하세요.'

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

  const handleConfirmDeposit = async () => {
    try {
      setLoadingAction('deposit')
      const now = new Date().toISOString()
      await patchOrder({ adminDepositConfirmedAt: now })
      setCurrentStatus('DEPOSIT_COMPLETED')
      setAdminDepositConfirmedAt(formatDateTime(now))
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : '입금확인 처리에 실패했습니다.')
    } finally {
      setLoadingAction(null)
    }
  }

  const validateShipping = () => {
    if (!carrier) return '택배사를 선택해야 합니다.'
    if (!trackingNumber.trim()) return '송장번호를 입력해야 합니다.'
    if (!/^[0-9-]+$/.test(trackingNumber.trim())) return '송장번호는 숫자와 하이픈만 입력할 수 있습니다.'
    return null
  }

  const handleSaveTracking = async (advanceStatus: boolean) => {
    const errorMessage = validateShipping()
    if (errorMessage) {
      alert(errorMessage)
      return
    }

    try {
      setLoadingAction(advanceStatus ? 'ship' : 'save-tracking')
      await patchOrder({
        courier: carrier,
        trackingNumber: trackingNumber.trim(),
        ...(advanceStatus ? { status: 'SHIPPED' } : {}),
      })
      if (advanceStatus) {
        setCurrentStatus('SHIPPED')
      }
      setIsEditingTracking(false)
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : '송장 저장에 실패했습니다.')
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

  const handlePrototypeAction = (message: string) => {
    alert(message)
  }

  return (
    <div className="space-y-6">
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

      <div className={`rounded-[28px] border p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)] ${
        isCompletedOrder
          ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white'
          : 'border-slate-200 bg-white'
      }`}>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-[13px] font-medium text-slate-400">주문 관리 &gt; 주문 상세</div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h2 className="text-[34px] font-black tracking-tight text-slate-950">{detail.customer.company}</h2>
              <span className="text-[28px] font-black tracking-tight text-slate-300">/</span>
              <div className="text-[28px] font-black tracking-tight text-slate-950">주문 #{detail.orderNumber}</div>
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] font-black ${toneClasses(currentStatusMeta.tone)}`}>
                {currentStatusMeta.label}
              </span>
              {isCompletedOrder ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[12px] font-bold text-emerald-700">
                  배송완료 + 계산서 발행완료
                </span>
              ) : null}
              {taxInvoiceIssued ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[12px] font-bold text-emerald-700">
                  세금계산서 발행 완료
                </span>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-slate-500">
              <span>주문일시 {detail.createdAtText}</span>
              <span>주문 채널 {detail.channelLabel} ({detail.channelStatus})</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <DropdownButton label="문서 발행" open={documentMenuOpen} onToggle={() => setDocumentMenuOpen((prev) => !prev)}>
              <button type="button" onClick={handlePrintStatement} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-bold text-slate-700 transition hover:bg-slate-50">
                <FileText className="h-4 w-4" /> 거래명세표 출력
              </button>
              <button type="button" onClick={handleIssueTaxInvoice} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-bold text-slate-700 transition hover:bg-slate-50">
                <ReceiptText className="h-4 w-4" /> 세금계산서 발행
              </button>
              <button type="button" onClick={() => handlePrototypeAction('견적서 출력은 준비 중입니다.')} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-bold text-slate-700 transition hover:bg-slate-50">
                <ClipboardList className="h-4 w-4" /> 견적서 출력
              </button>
            </DropdownButton>

            <DropdownButton label="더보기" open={moreMenuOpen} onToggle={() => setMoreMenuOpen((prev) => !prev)}>
              <button type="button" onClick={() => handlePrototypeAction('주문 복제 기능은 준비 중입니다.')} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-bold text-slate-700 transition hover:bg-slate-50">
                <Package className="h-4 w-4" /> 주문 복제
              </button>
              <button type="button" onClick={() => window.print()} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-bold text-slate-700 transition hover:bg-slate-50">
                <MoreHorizontal className="h-4 w-4" /> 인쇄하기
              </button>
            </DropdownButton>
            <button
              type="button"
              onClick={() => setDeleteModalOpen(true)}
              className="rounded-xl border border-red-200 bg-white px-3 py-2 text-[13px] font-bold text-red-600 transition hover:bg-red-50"
            >
              주문 삭제
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div className="space-y-6">
          <DetailCard title="거래처 정보" icon={<Store className="h-4 w-4" />}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[
                { label: '거래처', value: detail.customer.company },
                { label: '담당자', value: detail.customer.manager },
                { label: '사업자번호', value: detail.customer.businessNumber, copyKey: 'business-number' },
                { label: '연락처', value: detail.customer.phone, copyKey: 'phone' },
                { label: '이메일', value: detail.customer.email, copyKey: 'email' },
                { label: '업태/종목', value: detail.customer.businessType },
              ].map((field) => (
                <div key={field.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
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
            title={`주문 상품 (총 ${detail.products.length}종 / ${detail.payment.totalQuantity.toLocaleString('ko-KR')}개)`}
            icon={<Package className="h-4 w-4" />}
            actions={
              <button
                type="button"
                onClick={() => handlePrototypeAction('상품 추가 기능은 준비 중입니다.')}
                className="rounded-xl border border-slate-200 px-3 py-2 text-[12px] font-bold text-slate-600 transition hover:bg-slate-50"
              >
                상품 추가
              </button>
            }
          >
            <div className="hidden overflow-hidden rounded-2xl border border-slate-200 lg:block">
              <table className="w-full table-fixed border-collapse">
                <thead className="bg-slate-50 text-left text-[12px] font-black text-slate-500">
                  <tr>
                    <th className="px-4 py-3 w-[40%]">상품 정보</th>
                    <th className="px-4 py-3 text-right">수량</th>
                    <th className="px-4 py-3 text-right">단가</th>
                    <th className="px-4 py-3 text-right">공급가</th>
                    <th className="px-4 py-3 text-right">부가세</th>
                    <th className="px-4 py-3 text-right">공급가 합계</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.products.map((product) => (
                    <tr key={product.id} className="border-t border-slate-200 align-top">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-4">
                          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                            {product.imageUrl ? (
                              <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                            ) : (
                              <Package className="h-6 w-6 text-slate-300" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-[15px] font-black text-slate-900">{product.name}</div>
                            <div className="mt-2 inline-flex rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-orange-700">{product.option}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right text-[14px] font-bold text-slate-800">{product.quantity.toLocaleString('ko-KR')}개</td>
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
              {detail.products.map((product) => (
                <div key={product.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex gap-4">
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                      ) : (
                        <Package className="h-6 w-6 text-slate-300" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-black text-slate-900">{product.name}</div>
                      <div className="mt-2 inline-flex rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-orange-700">{product.option}</div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-[12px]">
                    <div className="rounded-xl bg-slate-50 px-3 py-2"><span className="text-slate-500">수량</span><div className="mt-1 font-bold text-slate-900">{product.quantity}개</div></div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2"><span className="text-slate-500">단가</span><div className="mt-1 font-bold text-slate-900">{formatCurrency(product.unitPrice)}</div></div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2"><span className="text-slate-500">공급가</span><div className="mt-1 font-bold text-slate-900">{formatCurrency(product.supplyPrice)}</div></div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2"><span className="text-slate-500">부가세</span><div className="mt-1 font-bold text-slate-900">{formatCurrency(product.vat)}</div></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 border-t border-slate-200 pt-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={() => handlePrototypeAction('상품 추가 기능은 준비 중입니다.')}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-[13px] font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    상품 추가
                  </button>
                  <div className="text-[12px] font-medium text-slate-500">
                    주문상품 카드 안에서 배송비와 부가세까지 함께 확인할 수 있습니다.
                  </div>
                </div>

                <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 min-[520px]:grid-cols-2 xl:min-w-[440px]">
                  <div className="flex items-center justify-between gap-4 text-[13px]">
                    <span className="font-medium text-slate-500">상품 공급가 합계</span>
                    <span className="font-black text-slate-900">{formatCurrency(detail.payment.productSupplyPrice)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-[13px]">
                    <span className="font-medium text-slate-500">배송비</span>
                    <span className="font-black text-slate-900">{formatCurrency(detail.payment.shippingFee)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-[13px]">
                    <span className="font-medium text-slate-500">부가세</span>
                    <span className="font-black text-slate-900">{formatCurrency(detail.payment.vat)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-xl bg-white px-3 py-2 text-[14px]">
                    <span className="font-bold text-slate-600">최종 결제금액</span>
                    <span className="text-[20px] font-black text-slate-950">{formatCurrency(detail.payment.finalAmount)}</span>
                  </div>
                </div>
              </div>
            </div>
          </DetailCard>

          <DetailCard
            title="배송지"
            icon={<MapPin className="h-4 w-4" />}
            actions={
              <button
                type="button"
                onClick={() => handlePrototypeAction('배송지 변경 기능은 준비 중입니다.')}
                className="rounded-xl border border-slate-200 px-3 py-2 text-[12px] font-bold text-slate-600 transition hover:bg-slate-50"
              >
                배송지 변경
              </button>
            }
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold text-slate-500">주소</div>
                    <div className="mt-2 text-[15px] font-bold leading-7 text-slate-900">{detail.shipping.address}</div>
                  </div>
                  <CopyButton copied={copiedField === 'address'} onClick={() => showCopyToast('address', detail.shipping.address)} />
                </div>
                <div className="mt-3 text-[12px] font-medium text-slate-500">{detail.shipping.memo}</div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-2xl border border-slate-200 px-4 py-4">
                  <div className="text-[11px] font-bold text-slate-500">수령인</div>
                  <div className="mt-2 text-[15px] font-black text-slate-900">{detail.shipping.recipient}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-bold text-slate-500">연락처</div>
                      <div className="mt-2 text-[15px] font-black text-slate-900">{detail.shipping.phone}</div>
                    </div>
                    <CopyButton copied={copiedField === 'shipping-phone'} onClick={() => showCopyToast('shipping-phone', detail.shipping.phone)} />
                  </div>
                </div>
              </div>
            </div>
          </DetailCard>

        </div>

        <aside className="space-y-4 xl:sticky xl:top-6">
          <DetailCard title="현재 상태" icon={<Clock3 className="h-4 w-4" />}>
            <div className="space-y-3">
              {processSteps.map((step, index) => (
                <div key={step.label} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <TimelineDot status={step.status} />
                    {index < processSteps.length - 1 ? <span className="mt-1 h-full w-px bg-slate-200" /> : null}
                  </div>
                  <div className="pb-4">
                    <div className="text-[14px] font-black text-slate-900">{step.label}</div>
                    <div className="mt-1 text-[12px] font-medium text-slate-500">{step.time || '대기 중'}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4">
              <div className="text-[12px] font-black text-blue-700">다음 작업</div>
              <p className="mt-2 text-[13px] leading-6 text-blue-900/80">{nextActionDescription}</p>
            </div>
          </DetailCard>

          <DetailCard title="결제 요약" icon={<CircleDollarSign className="h-4 w-4" />}>
            <div className="space-y-3">
              {[
                { label: '총 수량', value: `${detail.payment.totalQuantity.toLocaleString('ko-KR')}개` },
                { label: '상품 공급가', value: formatCurrency(detail.payment.productSupplyPrice) },
                { label: '배송비', value: formatCurrency(detail.payment.shippingFee) },
                { label: '부가세', value: formatCurrency(detail.payment.vat) },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <span className="text-[13px] font-medium text-slate-500">{item.label}</span>
                  <span className="text-[15px] font-black text-slate-900">{item.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-600 px-4 py-4 text-white shadow-lg shadow-blue-600/20">
              <div className="text-[12px] font-bold text-blue-100">최종 결제금액</div>
              <div className="mt-2 text-[32px] font-black leading-none">{formatCurrency(detail.payment.finalAmount)}</div>
            </div>
          </DetailCard>

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
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[14px] font-bold text-slate-900 outline-none transition focus:border-blue-400"
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
                    onChange={(event) => {
                      setTrackingNumber(event.target.value)
                      setIsEditingTracking(true)
                    }}
                    placeholder="숫자와 하이픈만 입력해주세요"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[14px] font-bold text-slate-900 outline-none transition focus:border-blue-400"
                  />
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => handleSaveTracking(false)}
                  disabled={loadingAction === 'save-tracking' || !isEditingTracking}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loadingAction === 'save-tracking' ? '송장 저장 중...' : '송장 저장'}
                </button>
                <button
                  type="button"
                  onClick={currentStatus === 'DEPOSIT_COMPLETED' || adminDepositConfirmedAt ? () => handleSaveTracking(true) : handleConfirmDeposit}
                  disabled={loadingAction === 'ship' || loadingAction === 'deposit'}
                  className="rounded-xl bg-blue-600 px-4 py-3 text-[13px] font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {loadingAction === 'ship'
                    ? '처리 중...'
                    : loadingAction === 'deposit'
                      ? '입금확인 중...'
                      : currentStatus === 'DEPOSIT_COMPLETED' || adminDepositConfirmedAt
                        ? '배송준비 처리'
                        : '관리자 입금확인'}
                </button>
              </div>
            </div>
          </DetailCard>

          <DetailCard title="바로가기" icon={<FileText className="h-4 w-4" />}>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={handlePrintStatement} className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-4 text-[12px] font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
                <FileText className="h-5 w-5" /> 거래명세표
              </button>
              <button type="button" onClick={handleIssueTaxInvoice} disabled={!canIssueDocuments || taxInvoiceIssued || loadingAction === 'tax-invoice'} className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-4 text-[12px] font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                <ReceiptText className="h-5 w-5" /> {taxInvoiceIssued ? '세금계산서 완료' : '세금계산서'}
              </button>
              <button type="button" onClick={() => handlePrototypeAction('견적서 출력은 준비 중입니다.')} className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-4 text-[12px] font-bold text-slate-700 transition hover:bg-slate-50">
                <ClipboardList className="h-5 w-5" /> 견적서
              </button>
              <button type="button" onClick={() => handlePrototypeAction('문자 발송 연동은 준비 중입니다.')} className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-4 text-[12px] font-bold text-slate-700 transition hover:bg-slate-50">
                <MessageSquare className="h-5 w-5" /> 문자 발송
              </button>
            </div>
          </DetailCard>

        </aside>
      </div>
    </div>
  )
}
