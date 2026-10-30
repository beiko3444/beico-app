'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { productionReviewReason } from '@/lib/productionReview'
import Button, { buttonClass } from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/Modal'
import PageHeader from '@/components/ui/PageHeader'
import Tabs from '@/components/ui/Tabs'
import EmptyState from '@/components/ui/EmptyState'
import StatCard from '@/components/ui/StatCard'
import ModalCloseButton from '@/components/ui/ModalCloseButton'
import { fieldClass, labelClass, selectClass } from '@/components/ui/field'
import { formatDate } from '@/lib/format'
import { getProductionPrices, getProductionProducts, selectProductionProduct, productionMargin, PRODUCTION_CATEGORIES, type ProductionPriceProduct } from '@/lib/productionPricing'
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LabelList
} from 'recharts'
import { Package, DollarSign, Calculator, Pencil, Plus, Trash2 } from 'lucide-react'

type ProductionBatch = {
    id: string
    productId?: string | null
    category: string
    productionDate: string
    rawMaterialCost: number
    depositDollar?: number | null
    electricityCost: number
    packagingCost: number
    warehouseCost?: number
    shippingCost?: number
    customsFee?: number
    customsDuty?: number
    vat?: number
    quantity: number
    unitCost: number | null
    salesPrice: number | null
    wholesalePrice: number | null
    priceProductName?: string | null
    memo: string | null
    createdAt: string
}

type Product = ProductionPriceProduct

const CATEGORIES = [...PRODUCTION_CATEGORIES]

// One series colour for every trend chart; colour is not used to tell the charts apart.
const CHART_COLOR = '#334155'
const CHART_LABEL_COLOR = '#475569'
const CHART_MARGIN = { top: 20, right: 24, left: 24, bottom: 0 }
const tooltipStyle = { borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '11px', fontWeight: 'bold' }

const batchTotalCost = (b: ProductionBatch) =>
    b.rawMaterialCost + b.electricityCost + b.packagingCost + (b.warehouseCost || 0) + (b.shippingCost || 0) + (b.customsFee || 0) + (b.customsDuty || 0) + (b.vat || 0)

const average = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null)

const legendClass = 'mb-3 w-full border-b border-slate-100 pb-2 text-[13px] font-black text-slate-900'
const fieldLabelClass = labelClass
const fieldInputClass = fieldClass()
const readonlyFieldClass = 'flex h-10 w-full items-center rounded-[10px] bg-slate-50 px-3 text-[13px] font-bold text-slate-700'

function MarginBadge({ rate }: { rate: number | null }) {
    if (rate === null) return <span className="text-slate-400">-</span>
    return <Badge tone={rate < 0 ? 'danger' : rate >= 30 ? 'success' : 'neutral'} className="tabular-nums">{rate.toFixed(1)}%</Badge>
}

export default function ProductionClient({ initialCounts = {} }: { initialCounts?: Record<string, number> }) {
    const [excludeReview, setExcludeReview] = useState(false)
    const [activeTab, setActiveTab] = useState(CATEGORIES[0]) // Default to 청갯지렁이
    // Batches per category for the tab counts; the active tab's count is refreshed from every fetch.
    const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>(initialCounts)

    // Formatting Helpers
    const formatNumber = (val: string | number) => {
        if (!val && val !== 0) return ''
        return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    }
    const parseNumber = (val: string) => val.replace(/[^0-9]/g, '')
    const parseDecimal = (val: string) => val.replace(/[^0-9.]/g, '')

    const [batches, setBatches] = useState<ProductionBatch[]>([])
    const [products, setProducts] = useState<Product[]>([])
    const [selectedProductId, setSelectedProductId] = useState('')
    const [priceLoading, setPriceLoading] = useState(true)
    const [priceError, setPriceError] = useState('')
    const [loading, setLoading] = useState(true)
    const [batchError, setBatchError] = useState('')
    const [saving, setSaving] = useState(false)
    const savingRef = useRef(false)
    const productRequestRef = useRef(0)
    const batchRequestRef = useRef(0)
    const [isEditing, setIsEditing] = useState<ProductionBatch | null>(null)
    const [isCreating, setIsCreating] = useState(false)
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'productionDate', direction: 'desc' })

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc'
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc'
        }
        setSortConfig({ key, direction })
    }

    const sortedBatches = [...batches].sort((a, b) => {
        if (!sortConfig) return 0
        const { key, direction } = sortConfig

        let aVal: any
        let bVal: any

        if (key === 'totalCost') {
            aVal = a.rawMaterialCost + a.electricityCost + a.packagingCost + (a.warehouseCost || 0) + (a.shippingCost || 0) + (a.customsFee || 0) + (a.customsDuty || 0) + (a.vat || 0)
            bVal = b.rawMaterialCost + b.electricityCost + b.packagingCost + (b.warehouseCost || 0) + (b.shippingCost || 0) + (b.customsFee || 0) + (b.customsDuty || 0) + (b.vat || 0)
        } else if (key === 'wMargin') {
            aVal = productionMargin(a.salesPrice, a.unitCost)
            bVal = productionMargin(b.salesPrice, b.unitCost)
        } else if (key === 'rMargin') {
            aVal = productionMargin(a.wholesalePrice, a.unitCost)
            bVal = productionMargin(b.wholesalePrice, b.unitCost)
        } else {
            aVal = a[key as keyof ProductionBatch]
            bVal = b[key as keyof ProductionBatch]
        }

        if (aVal === bVal) return 0
        if (aVal === null || aVal === undefined) return 1
        if (bVal === null || bVal === undefined) return -1

        if (aVal < bVal) return direction === 'asc' ? -1 : 1
        return direction === 'asc' ? 1 : -1
    })

    // Form Stats
    const [formData, setFormData] = useState({
        productionDate: new Date().toISOString().split('T')[0],
        rawMaterialCost: '',
        depositDollar: '',
        electricityCost: '30000',
        packagingCost: '200',
        warehouseCost: '20350',
        shippingCost: '',
        customsFee: '33000',
        customsDuty: '',
        vat: '',
        quantity: '',
        memo: ''
    })

    // Fetch Batches
    const fetchBatches = useCallback(async () => {
        const requestId = ++batchRequestRef.current
        setLoading(true)
        setBatchError('')
        try {
            const res = await fetch(`/api/production?category=${encodeURIComponent(activeTab)}`, { cache: 'no-store' })
            if (!res.ok) throw new Error('생산 기록 조회 실패')
            const data = await res.json()
            if (!Array.isArray(data)) throw new Error('생산 기록 응답 오류')
            if (requestId === batchRequestRef.current) {
                setBatches(data)
                setCategoryCounts(current => ({ ...current, [activeTab]: data.length }))
            }
        } catch (error) {
            console.error(error)
            if (requestId === batchRequestRef.current) {
                setBatches([])
                setBatchError('생산 기록을 불러오지 못했습니다.')
            }
        } finally {
            if (requestId === batchRequestRef.current) setLoading(false)
        }
    }, [activeTab])

    // Fetch Products (for pricing)
    const fetchProducts = useCallback(async () => {
        const requestId = ++productRequestRef.current
        setPriceLoading(true)
        setPriceError('')
        try {
            const res = await fetch('/api/production/products', { cache: 'no-store' })
            if (!res.ok) throw new Error('상품 가격 조회 실패')
            const data = await res.json()
            if (!Array.isArray(data)) throw new Error('상품 가격 응답 오류')
            if (requestId === productRequestRef.current) setProducts(data)
        } catch (error) {
            console.error("Failed to fetch products for pricing", error)
            if (requestId === productRequestRef.current) setPriceError('상품 가격을 불러오지 못했습니다.')
        } finally {
            if (requestId === productRequestRef.current) setPriceLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchProducts()
    }, [fetchProducts])

    useEffect(() => {
        fetchBatches()
        setSelectedProductId('')
    }, [fetchBatches])

    useEffect(() => {
        if (isCreating) fetchProducts()
    }, [isCreating, fetchProducts])

    const handleEdit = (batch: ProductionBatch) => {
        if (batch.category !== activeTab) return
        setIsEditing(batch)
        setSelectedProductId(batch.productId || '')
        setFormData({
            productionDate: batch.productionDate ? new Date(batch.productionDate).toISOString().split('T')[0] : '',
            rawMaterialCost: String(batch.rawMaterialCost),
            depositDollar: batch.depositDollar ? String(batch.depositDollar) : '',
            electricityCost: String(batch.electricityCost),
            packagingCost: String(batch.packagingCost),
            warehouseCost: batch.warehouseCost ? String(batch.warehouseCost) : '',
            shippingCost: batch.shippingCost ? String(batch.shippingCost) : '',
            customsFee: batch.customsFee ? String(batch.customsFee) : '',
            customsDuty: batch.customsDuty ? String(batch.customsDuty) : '',
            vat: batch.vat ? String(batch.vat) : '',
            quantity: String(batch.quantity),
            memo: batch.memo || ''
        })
        setIsCreating(true)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('정말 삭제하시겠습니까?')) return
        await fetch(`/api/production/${id}`, { method: 'DELETE' })
        fetchBatches()
    }

    const priceProducts = getProductionProducts(products, activeTab)
    const selectedProduct = selectProductionProduct(products, activeTab, selectedProductId)

    const getProductPricing = () => {
        return {
            ...(selectedProduct ? getProductionPrices(selectedProduct) : { salesPrice: 0, wholesalePrice: 0 }),
            exists: !!selectedProduct,
            productName: selectedProduct?.name,
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (savingRef.current) return

        const priceInfo = getProductPricing()
        if (priceLoading || priceError || !priceInfo.exists) {
            alert(priceError || '가격을 가져올 생산 상품을 선택해 주세요.')
            return
        }

        const url = isEditing ? `/api/production/${isEditing.id}` : '/api/production'
        const method = isEditing ? 'PUT' : 'POST'

        const raw = Number(parseNumber(formData.rawMaterialCost)) || 0
        const deposit = formData.depositDollar ? Number(parseDecimal(formData.depositDollar)) : null
        const elec = Number(parseNumber(formData.electricityCost)) || 0
        const pack = Number(parseNumber(formData.packagingCost)) || 0
        const warehouse = Number(parseNumber(formData.warehouseCost)) || 0
        const shipping = Number(parseNumber(formData.shippingCost)) || 0
        const customs = Number(parseNumber(formData.customsFee)) || 0
        const duty = Number(parseNumber(formData.customsDuty)) || 0
        const vat = Number(parseNumber(formData.vat)) || 0

        const qty = Number(parseNumber(formData.quantity)) || 1
        // Total cost calculation
        const totalSum = raw + elec + pack + warehouse + shipping + customs + duty + vat
        const calculatedUnitCost = qty > 0 ? Math.round(totalSum / qty) : 0

        const body = {
            productId: selectedProduct?.id,
            category: activeTab,
            productionDate: formData.productionDate,
            rawMaterialCost: raw,
            depositDollar: deposit,
            electricityCost: elec,
            packagingCost: pack,
            warehouseCost: warehouse,
            shippingCost: shipping,
            customsFee: customs,
            customsDuty: duty,
            vat: vat,
            quantity: qty,
            unitCost: calculatedUnitCost,
            memo: formData.memo
        }

        savingRef.current = true
        setSaving(true)
        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })

            if (res.ok) {
                setIsCreating(false)
                setIsEditing(null)
                setFormData({
                    productionDate: new Date().toISOString().split('T')[0],
                    rawMaterialCost: '',
                    depositDollar: '',
                    electricityCost: '30000',
                    packagingCost: '200',
                    warehouseCost: '20350',
                    shippingCost: '',
                    customsFee: '33000',
                    customsDuty: '',
                    vat: '',
                    quantity: '',
                    memo: ''
                })
                fetchBatches()
            } else {
                const errData = await res.json().catch(() => ({ error: '알 수 없는 서버 오류' }))
                const errMsg = errData.details ? `${errData.error}\n정보: ${errData.details}` : errData.error
                alert(`저장에 실패했습니다: ${errMsg}`)
            }
        } catch {
            alert('저장에 실패했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.')
        } finally {
            savingRef.current = false
            setSaving(false)
        }
    }

    const currentPriceInfo = getProductPricing()
    const overseasRemittanceAmount = Number(parseNumber(formData.rawMaterialCost)) || 0
    const usdAmount = Number(parseDecimal(formData.depositDollar)) || 0
    const remittanceExchangeRate = usdAmount > 0 ? overseasRemittanceAmount / usdAmount : null

    const areaChartData = useMemo(() =>
        [...batches].sort((a, b) => new Date(a.productionDate).getTime() - new Date(b.productionDate).getTime())
            .map(b => ({
                date: new Date(b.productionDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
                cost: b.rawMaterialCost + b.electricityCost + b.packagingCost + (b.warehouseCost || 0) + (b.shippingCost || 0) + (b.customsFee || 0) + (b.customsDuty || 0) + (b.vat || 0)
            })), [batches]
    )

    const barChartData = useMemo(() =>
        [...batches].sort((a, b) => new Date(a.productionDate).getTime() - new Date(b.productionDate).getTime())
            .map(b => ({
                date: new Date(b.productionDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
                qty: b.quantity
            })), [batches]
    )

    const lineChartData = useMemo(() =>
        [...batches].sort((a, b) => new Date(a.productionDate).getTime() - new Date(b.productionDate).getTime())
            .map(b => ({
                date: new Date(b.productionDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
                // A batch without a unit cost is a gap in the line, not a zero.
                unit: b.unitCost && b.unitCost > 0 ? b.unitCost : null
            })), [batches]
    )

    const unitCostMissing = lineChartData.every(point => point.unit === null)
    const formTotalCost = ['rawMaterialCost', 'electricityCost', 'packagingCost', 'warehouseCost', 'shippingCost', 'customsFee', 'customsDuty', 'vat']
        .reduce((sum, key) => sum + (Number(parseNumber(formData[key as keyof typeof formData])) || 0), 0)
    const formQuantity = Number(parseNumber(formData.quantity)) || 0

    const reviewBatches = batches.filter(batch => productionReviewReason(batch))
    const summaryBatches = excludeReview ? batches.filter(batch => !productionReviewReason(batch)) : batches
    const wholesaleMargins = summaryBatches.map(batch => productionMargin(batch.salesPrice, batch.unitCost)).filter((margin): margin is number => margin !== null)
    const averageQuantity = average(summaryBatches.map(batch => batch.quantity))
    const averageCost = average(summaryBatches.map(batchTotalCost))
    const averageUnitCost = average(summaryBatches.map(batch => batch.unitCost).filter((cost): cost is number => cost !== null && cost > 0))
    const averageMargin = average(wholesaleMargins)
    const showEmpty = !loading && !batchError && batches.length === 0

    const openNewRecord = () => {
        setIsEditing(null)
        setSelectedProductId('')
        setFormData({
            productionDate: new Date().toISOString().split('T')[0],
            rawMaterialCost: '',
            depositDollar: '',
            electricityCost: '30000',
            packagingCost: '200',
            warehouseCost: '20350',
            shippingCost: '',
            customsFee: '33000',
            customsDuty: '',
            vat: '',
            quantity: '',
            memo: ''
        })
        setIsCreating(true)
    }

    const sortHeader = (key: string, label: string, title?: string) => (
        <th
            className="cursor-pointer select-none text-right hover:bg-slate-100"
            title={title}
            aria-sort={sortConfig?.key === key ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : undefined}
            onClick={() => handleSort(key)}
        >
            {label} {sortConfig?.key === key && (sortConfig.direction === 'asc' ? '↑' : '↓')}
        </th>
    )

    return (
        <div className="min-w-0 space-y-6">
            <PageHeader
                title="생산 관리"
                description="카테고리별 생산 기록과 원가·마진을 관리합니다."
                actions={
                    <Button data-primary variant="primary" icon={<Plus size={15} />} onClick={openNewRecord}>
                        생산 기록
                    </Button>
                }
            />

            <div className="space-y-2">
                <Tabs
                    aria-label="생산 카테고리"
                    items={CATEGORIES.map(cat => ({ key: cat, label: cat, count: categoryCounts[cat] ?? null }))}
                    value={activeTab}
                    onChange={category => {
                        ++batchRequestRef.current
                        setLoading(true)
                        setBatches([])
                        setIsCreating(false)
                        setIsEditing(null)
                        setSelectedProductId('')
                        setActiveTab(category)
                    }}
                />
                {!loading && batches.length > 0 ? (
                    <p className="text-xs text-slate-500 dark:text-gray-400">
                        {activeTab} · 전체 {batches.length}차수 중 {summaryBatches.length}차수 집계 · 평균은 차수별 단순 평균입니다.
                    </p>
                ) : null}
            </div>

            {reviewBatches.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-900" role="status">
                    <p className="font-bold">원가·수량을 검토할 기록이 {reviewBatches.length}건 있습니다.</p>
                    <p className="mt-1 text-xs">생산단가 미입력, 수량 0 이하 또는 단가가 도매가보다 높은 기록입니다. 오류나 생산 미완료로 단정하지 않으며 기본 집계에는 포함됩니다.</p>
                    <label className="mt-2 flex min-h-10 cursor-pointer items-center gap-2 text-xs font-bold"><input type="checkbox" checked={excludeReview} onChange={event => setExcludeReview(event.target.checked)} className="h-4 w-4 accent-brand-orange" />검토할 기록을 요약 집계에서 제외</label>
                </div>
            )}

            {showEmpty ? (
                <EmptyState
                    title={`${activeTab} 생산 기록이 없습니다`}
                    description="상단의 ‘생산 기록’으로 등록하면 원가·수량 지표와 추이 차트가 여기에 표시됩니다."
                />
            ) : (
            <>
            {/* Statistics Dashboard */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {[
                    { label: '총 생산수량', value: summaryBatches.length > 0 ? summaryBatches.reduce((acc, b) => acc + b.quantity, 0) : null, unit: '개' },
                    { label: '차수 평균 수량', value: averageQuantity !== null ? Math.round(averageQuantity) : null, unit: '개' },
                    { label: '차수 평균 비용', value: averageCost !== null ? Math.round(averageCost) : null, unit: '원' },
                    { label: '차수 평균 단가', value: averageUnitCost !== null ? Math.round(averageUnitCost) : null, unit: '원' },
                    { label: '차수 평균 도매 마진', value: averageMargin, unit: '%', digits: 1 },
                ].map((stat, idx) => (
                    <StatCard
                        key={stat.label}
                        label={stat.label}
                        value={stat.value === null ? <span className="text-slate-400">—</span> : stat.digits ? stat.value.toFixed(stat.digits) : stat.value.toLocaleString('ko-KR')}
                        unit={stat.value === null ? undefined : stat.unit}
                        className={idx === 0 ? 'col-span-2 sm:col-span-1' : ''}
                    />
                ))}
            </div>

            {/* Visual Insights Section */}
            {!loading && batches.length > 0 && (
                <div className="hidden grid-cols-1 gap-4 sm:grid lg:grid-cols-3">
                    {[
                        { title: '총 생산비용 추이', icon: <DollarSign className="h-4 w-4" /> },
                        { title: '생산수량 변동', icon: <Package className="h-4 w-4" /> },
                        { title: '생산단가 추이', icon: <Calculator className="h-4 w-4" /> },
                    ].map((chart, chartIndex) => (
                        <div key={chart.title} className="flex min-w-0 flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2a2a2a] dark:bg-[#1e1e1e] dark:shadow-none">
                            <div className="flex items-center gap-2">
                                <span className="rounded-lg bg-slate-100 p-2 text-slate-600 dark:bg-[#252525] dark:text-gray-300">{chart.icon}</span>
                                <h3 className="text-sm font-black text-slate-900 dark:text-white">{chart.title}</h3>
                            </div>
                            {chartIndex === 2 && unitCostMissing ? (
                                <div className="flex h-48 w-full items-center justify-center rounded-xl bg-slate-50 px-6 text-center text-xs font-bold text-slate-500 [text-wrap:balance] dark:bg-[#252525] dark:text-gray-400">
                                    생산단가가 입력된 차수가 없습니다. 수량을 입력하면 계산됩니다.
                                </div>
                            ) : (
                            <div className="h-48 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    {chartIndex === 0 ? (
                                        <LineChart data={areaChartData} margin={CHART_MARGIN}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontWeight: 'bold' }} />
                                            <YAxis hide />
                                            <Tooltip contentStyle={tooltipStyle} formatter={(value) => [Number(value).toLocaleString() + '원', '비용']} />
                                            <Line type="linear" dataKey="cost" stroke={CHART_COLOR} strokeWidth={2.5} dot={{ r: 3, fill: CHART_COLOR, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }}>
                                                <LabelList dataKey="cost" position="top" fill={CHART_LABEL_COLOR} fontSize={10} fontWeight={700} formatter={(value) => Number(value).toLocaleString()} />
                                            </Line>
                                        </LineChart>
                                    ) : chartIndex === 1 ? (
                                        <LineChart data={barChartData} margin={CHART_MARGIN}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontWeight: 'bold' }} />
                                            <YAxis hide />
                                            <Tooltip contentStyle={tooltipStyle} formatter={(value) => [Number(value).toLocaleString() + '개', '수량']} />
                                            <Line type="linear" dataKey="qty" stroke={CHART_COLOR} strokeWidth={2.5} dot={{ r: 3, fill: CHART_COLOR, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }}>
                                                <LabelList dataKey="qty" position="top" fill={CHART_LABEL_COLOR} fontSize={10} fontWeight={700} formatter={(value) => Number(value).toLocaleString()} />
                                            </Line>
                                        </LineChart>
                                    ) : (
                                        <LineChart data={lineChartData} margin={CHART_MARGIN}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontWeight: 'bold' }} />
                                            <YAxis hide />
                                            <Tooltip contentStyle={tooltipStyle} formatter={(value) => [value === null || value === undefined ? '미입력' : Number(value).toLocaleString() + '원', '단가']} />
                                            <Line type="linear" dataKey="unit" connectNulls={false} stroke={CHART_COLOR} strokeWidth={2.5} dot={{ r: 3, fill: CHART_COLOR, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }}>
                                                <LabelList dataKey="unit" position="top" fill={CHART_LABEL_COLOR} fontSize={10} fontWeight={700} formatter={(value) => (value === null || value === undefined ? '' : Number(value).toLocaleString())} />
                                            </Line>
                                        </LineChart>
                                    )}
                                </ResponsiveContainer>
                            </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Table — on wide screens it fits, so overflow stays visible and the cost tooltip can rise above the first rows. */}
            {/* Phones: one card per batch so cost, quantity, unit cost and the actions stay on screen. */}
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm dark:divide-[#2a2a2a] dark:border-[#2a2a2a] dark:bg-[#1e1e1e] sm:hidden">
                {loading ? (
                    <li className="px-4 py-10 text-center text-[12px] font-bold text-slate-500 dark:text-gray-400">로딩 중...</li>
                ) : batchError ? (
                    <li className="px-4 py-10 text-center text-sm text-red-600" role="alert">{batchError} <button type="button" className="underline" onClick={fetchBatches}>다시 불러오기</button></li>
                ) : (
                    sortedBatches.map(batch => {
                        const reviewReason = productionReviewReason(batch)
                        const dateText = formatDate(batch.productionDate)
                        return (
                            <li key={batch.id} className="flex items-start gap-2 px-3 py-3">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 text-[13px] font-bold tabular-nums text-slate-900 dark:text-white">
                                        {dateText}
                                        {reviewReason ? <span title={reviewReason} className="inline-flex"><Badge tone="warning">검토</Badge><span className="sr-only">: {reviewReason}</span></span> : null}
                                    </div>
                                    <dl className="mt-1.5 grid grid-cols-3 gap-2 text-[11px]">
                                        <div className="min-w-0"><dt className="font-bold text-slate-500">총 비용</dt><dd className="truncate text-[13px] font-bold tabular-nums text-slate-900 dark:text-white">{batchTotalCost(batch).toLocaleString()}</dd></div>
                                        <div className="min-w-0"><dt className="font-bold text-slate-500">수량</dt><dd className="truncate text-[13px] tabular-nums text-slate-900 dark:text-white">{batch.quantity.toLocaleString()}</dd></div>
                                        <div className="min-w-0"><dt className="font-bold text-slate-500">단가</dt><dd className="truncate text-[13px] tabular-nums text-slate-900 dark:text-white">{batch.unitCost ? batch.unitCost.toLocaleString() : <span className="text-slate-400">-</span>}</dd></div>
                                    </dl>
                                    <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold text-slate-500">도매마진 <MarginBadge rate={productionMargin(batch.salesPrice, batch.unitCost)} /></p>
                                </div>
                                <div className="-mr-1 flex shrink-0 items-center">
                                    <button type="button" onClick={() => handleEdit(batch)} className={buttonClass('ghost', 'iconMd')} title="수정" aria-label={`${dateText} 생산 기록 수정`}>
                                        <Pencil size={16} />
                                    </button>
                                    <button type="button" onClick={() => handleDelete(batch.id)} className={buttonClass('dangerGhost', 'iconMd')} title="삭제" aria-label={`${dateText} 생산 기록 삭제`}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </li>
                        )
                    })
                )}
            </ul>

            <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-[#2a2a2a] dark:bg-[#1e1e1e] dark:shadow-none sm:block xl:overflow-visible">
                <div className="min-w-[800px]">
                    <table className="w-full text-left text-xs">
                        <thead className="ux-thead">
                            <tr>
                                <th className="w-12 text-center">No</th>
                                <th
                                    className="cursor-pointer select-none text-left hover:bg-slate-100"
                                    aria-sort={sortConfig?.key === 'productionDate' ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                                    onClick={() => handleSort('productionDate')}
                                >
                                    생산날짜 {sortConfig?.key === 'productionDate' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                {sortHeader('totalCost', '총 생산비용', '원재료+전기+포장 외 비용 합계')}
                                {sortHeader('quantity', '생산수량')}
                                {sortHeader('unitCost', '단가')}
                                {sortHeader('salesPrice', '도매가')}
                                {sortHeader('wMargin', '도매마진')}
                                {sortHeader('wholesalePrice', '소매가')}
                                {sortHeader('rMargin', '소매마진')}
                                <th className="text-left">메모</th>
                                <th className="text-center">관리</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-[#2a2a2a]">
                            {loading ? (
                                <tr><td colSpan={11} className="px-4 py-10 text-center text-[12px] font-bold text-slate-500 dark:text-gray-400">로딩 중...</td></tr>
                            ) : batchError ? (
                                <tr><td colSpan={11} className="px-4 py-10 text-center text-sm text-red-600" role="alert">{batchError} <button type="button" className="underline" onClick={fetchBatches}>다시 불러오기</button></td></tr>
                            ) : (
                                sortedBatches.map((batch, idx) => {
                                    const totalCost = batchTotalCost(batch)
                                    const reviewReason = productionReviewReason(batch)
                                    const wMarginRate = productionMargin(batch.salesPrice, batch.unitCost)
                                    const rMarginRate = productionMargin(batch.wholesalePrice, batch.unitCost)

                                    return (
                                        <tr key={batch.id} className="group transition-colors even:bg-slate-50 hover:relative hover:z-10 hover:bg-slate-100 dark:even:bg-[#1a1a1a] dark:hover:bg-[#252525]">
                                            <td className="px-3 py-2 text-center font-bold tabular-nums text-slate-900 dark:text-white">
                                                {idx + 1}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-2 font-bold tabular-nums text-slate-900 dark:text-white">
                                                {formatDate(batch.productionDate)}
                                                {reviewReason && (
                                                    <span className="ml-1.5 inline-flex align-middle" title={reviewReason}>
                                                        <Badge tone="warning">검토</Badge>
                                                        <span className="sr-only">: {reviewReason}</span>
                                                    </span>
                                                )}
                                            </td>
                                            <td
                                                className="group/cost relative cursor-pointer px-3 py-2 text-right font-bold tabular-nums text-slate-900 transition-colors hover:bg-slate-200/60 dark:text-white dark:hover:bg-[#252525]"
                                                onClick={() => handleEdit(batch)}
                                            >
                                                <span className="underline decoration-slate-300 decoration-dotted underline-offset-4">
                                                    {totalCost.toLocaleString()}
                                                </span>
                                                {/* Tooltip for Cost Breakdown */}
                                                <div className="absolute opacity-0 group-hover/cost:opacity-100 z-[60] bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-gray-900 text-white p-3 rounded-lg text-[11px] pointer-events-none transition-opacity shadow-xl">
                                                    <div className="flex justify-between mb-1">
                                                        <span>해외송금금액:</span>
                                                        <span>{batch.rawMaterialCost.toLocaleString()}
                                                            {batch.depositDollar && <span className='text-[11px] text-gray-400 ml-1'>(${batch.depositDollar})</span>}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between mb-1">
                                                        <span>전기세:</span>
                                                        <span>{batch.electricityCost.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex justify-between mb-1">
                                                        <span>포장비:</span>
                                                        <span>{batch.packagingCost.toLocaleString()}</span>
                                                    </div>
                                                    {(batch.warehouseCost || 0) > 0 && (
                                                        <div className="flex justify-between mb-1">
                                                            <span>창고료:</span>
                                                            <span>{batch.warehouseCost?.toLocaleString()}</span>
                                                        </div>
                                                    )}
                                                    {(batch.shippingCost || 0) > 0 && (
                                                        <div className="flex justify-between mb-1">
                                                            <span>운송료:</span>
                                                            <span>{batch.shippingCost?.toLocaleString()}</span>
                                                        </div>
                                                    )}
                                                    {(batch.customsFee || 0) > 0 && (
                                                        <div className="flex justify-between mb-1">
                                                            <span>관세사비:</span>
                                                            <span>{batch.customsFee?.toLocaleString()}</span>
                                                        </div>
                                                    )}
                                                    {(batch.customsDuty || 0) > 0 && (
                                                        <div className="flex justify-between mb-1">
                                                            <span>관세:</span>
                                                            <span>{batch.customsDuty?.toLocaleString()}</span>
                                                        </div>
                                                    )}
                                                    {(batch.vat || 0) > 0 && (
                                                        <div className="flex justify-between">
                                                            <span>부가세:</span>
                                                            <span>{batch.vat?.toLocaleString()}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-right tabular-nums text-slate-900 dark:text-white">{batch.quantity.toLocaleString()}</td>
                                            <td className="px-3 py-2 text-right tabular-nums text-slate-900 dark:text-white">
                                                {batch.unitCost ? batch.unitCost.toLocaleString() : <span className="text-slate-400">-</span>}
                                            </td>
                                            <td title={batch.priceProductName || '수정창에서 가격 기준 상품을 선택하세요.'} className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-900 dark:text-white">{batch.salesPrice?.toLocaleString() ?? <span className="text-slate-400">상품 연결 필요</span>}</td>
                                            <td className="px-3 py-2 text-right">
                                                <MarginBadge rate={wMarginRate} />
                                            </td>
                                            <td title={batch.priceProductName || '수정창에서 가격 기준 상품을 선택하세요.'} className="px-3 py-2 text-right tabular-nums text-slate-900 dark:text-white">{batch.wholesalePrice?.toLocaleString() ?? <span className="text-slate-400">-</span>}</td>
                                            <td className="px-3 py-2 text-right">
                                                <MarginBadge rate={rMarginRate} />
                                            </td>
                                            <td className="max-w-[200px] truncate px-3 py-2 text-slate-700 dark:text-gray-300" title={batch.memo || ''}>{batch.memo || <span className="text-slate-400">-</span>}</td>
                                            <td className="px-3 py-2 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <Button variant="secondary" size="sm" onClick={() => handleEdit(batch)}>수정</Button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(batch.id)}
                                                        className={buttonClass('dangerGhost', 'icon')}
                                                        title="삭제"
                                                        aria-label={`${formatDate(batch.productionDate)} 생산 기록 삭제`}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            </>
            )}

            {isCreating && (
                <Modal labelledBy="production-record-modal-title" onClose={() => setIsCreating(false)} className="bg-slate-950/50">
                    <div className="flex h-full w-full items-end justify-center sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsCreating(false) }}>
                        <form
                            onSubmit={handleSubmit}
                            className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
                        >
                            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
                                <h2 id="production-record-modal-title" className="text-lg font-extrabold text-slate-900">
                                    {isEditing ? '생산 기록 수정' : '생산 기록 등록'}
                                </h2>
                                <ModalCloseButton onClick={() => setIsCreating(false)} />
                            </div>

                            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
                                <fieldset>
                                    <legend className={legendClass}>일정 및 생산 구분</legend>
                                    <div className="grid grid-cols-2 gap-4">
                                        <label className="block">
                                            <span className={fieldLabelClass}>생산일</span>
                                            <input
                                                type="date"
                                                required
                                                className={fieldInputClass}
                                                value={formData.productionDate}
                                                onChange={e => setFormData({ ...formData, productionDate: e.target.value })}
                                            />
                                        </label>
                                        <div>
                                            <span className={fieldLabelClass}>생산 구분</span>
                                            <div className={readonlyFieldClass}>{activeTab}</div>
                                        </div>
                                    </div>
                                </fieldset>

                                <fieldset>
                                    <legend className={legendClass}>비용 상세</legend>
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <label className="block">
                                                <span className={fieldLabelClass}>해외송금금액 (원)</span>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    required
                                                    className={fieldClass('text-right tabular-nums')}
                                                    value={formatNumber(formData.rawMaterialCost)}
                                                    onChange={e => setFormData({ ...formData, rawMaterialCost: parseNumber(e.target.value) })}
                                                />
                                            </label>
                                            <label className="block">
                                                <span className={fieldLabelClass}>송금액 (USD)</span>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    placeholder="0.00"
                                                    className={fieldClass('text-right tabular-nums')}
                                                    value={formData.depositDollar}
                                                    onChange={e => setFormData({ ...formData, depositDollar: e.target.value })}
                                                />
                                            </label>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2">
                                            {[
                                                { label: '전기세', key: 'electricityCost' },
                                                { label: '포장비', key: 'packagingCost' },
                                                { label: '창고료', key: 'warehouseCost' },
                                                { label: '운송료', key: 'shippingCost' },
                                                { label: '관세사비', key: 'customsFee' },
                                                { label: '관세', key: 'customsDuty' },
                                                { label: '부가세', key: 'vat' }
                                            ].map((field) => (
                                                <label key={field.key} className="block">
                                                    <span className={fieldLabelClass}>{field.label}</span>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        className={fieldClass('px-2.5 text-right tabular-nums')}
                                                        value={formatNumber(formData[field.key as keyof typeof formData])}
                                                        onChange={e => setFormData({ ...formData, [field.key]: parseNumber(e.target.value) })}
                                                    />
                                                </label>
                                            ))}
                                            <div className="col-span-2">
                                                <span className={fieldLabelClass}>환율 (해외송금금액/USD)</span>
                                                <div className={`${readonlyFieldClass} justify-end tabular-nums`}>
                                                    {remittanceExchangeRate !== null
                                                        ? `1 USD = ₩${remittanceExchangeRate.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                                                        : '-'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </fieldset>

                                <fieldset>
                                    <legend className={legendClass}>생산 결과</legend>
                                    <div className="grid grid-cols-2 gap-4">
                                        <label className="block">
                                            <span className={fieldLabelClass}>생산 수량</span>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                required
                                                className={fieldClass('text-right tabular-nums')}
                                                value={formatNumber(formData.quantity)}
                                                onChange={e => setFormData({ ...formData, quantity: parseNumber(e.target.value) })}
                                            />
                                        </label>
                                        <div>
                                            <span className={fieldLabelClass}>산출 단가</span>
                                            {/* No quantity yet: show nothing rather than total ÷ 1, which reads like a real unit cost. */}
                                            <div className={`${readonlyFieldClass} justify-end tabular-nums ${formQuantity > 0 ? 'font-black text-slate-900' : 'text-slate-400'}`}>
                                                {formQuantity > 0 ? Math.round(formTotalCost / formQuantity).toLocaleString() : '-'}
                                            </div>
                                            {formQuantity > 0 ? null : <p className="text-[11px] text-slate-400">수량 입력 시 계산</p>}
                                        </div>
                                    </div>

                                    <div className="mt-4 space-y-1">
                                        <label htmlFor="production-price-product" className={fieldLabelClass}>가격 기준 상품</label>
                                        <select id="production-price-product" required disabled={priceLoading || saving} value={selectedProduct?.id || ''} onChange={event => setSelectedProductId(event.target.value)} className={selectClass(!!selectedProduct)}>
                                            <option value="">{priceLoading ? '상품 가격 불러오는 중…' : '생산 상품을 선택하세요'}</option>
                                            {priceProducts.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}
                                        </select>
                                        {priceError ? <p role="alert" className="text-xs text-red-600">{priceError} <button type="button" onClick={fetchProducts} className="underline">다시 불러오기</button></p> : !priceLoading && priceProducts.length === 0 ? <p className="text-xs text-slate-500">해당 생산 구분의 상품을 상품관리에 등록해 주세요.</p> : null}
                                        {!priceLoading && !priceError && selectedProductId && !selectedProduct ? <p role="alert" className="text-xs text-red-600">연결된 상품을 찾을 수 없습니다. 가격 기준 상품을 다시 선택해 주세요.</p> : null}
                                    </div>
                                    <div className="mt-4 grid grid-cols-2 gap-4">
                                        <div className="space-y-0.5 text-[11px]">
                                            <span className="block font-bold text-slate-500">도매가 (C등급)</span>
                                            <span className="block text-sm font-black tabular-nums text-slate-900">{!priceLoading && !priceError && currentPriceInfo.exists ? `${currentPriceInfo.salesPrice.toLocaleString()}원` : '-'}</span>
                                        </div>
                                        <div className="space-y-0.5 text-[11px]">
                                            <span className="block font-bold text-slate-500">소매 판매가</span>
                                            <span className="block text-sm font-black tabular-nums text-slate-900">{!priceLoading && !priceError && currentPriceInfo.exists ? `${currentPriceInfo.wholesalePrice.toLocaleString()}원` : '-'}</span>
                                        </div>
                                    </div>
                                </fieldset>

                                <label className="block">
                                    <span className={fieldLabelClass}>특이사항</span>
                                    <textarea
                                        className={fieldClass('h-16 resize-none py-2')}
                                        placeholder="생산 관련 메모를 입력하세요"
                                        value={formData.memo || ''}
                                        onChange={e => setFormData({ ...formData, memo: e.target.value })}
                                    />
                                </label>
                            </div>

                            <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 bg-white px-5 py-3">
                                <Button variant="secondary" disabled={saving} onClick={() => setIsCreating(false)}>
                                    취소
                                </Button>
                                <Button variant="primary" type="submit" loading={saving} disabled={priceLoading || !!priceError || !selectedProduct}>
                                    {isEditing ? '수정 저장' : '저장'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </Modal>
            )}
        </div>
    )
}
