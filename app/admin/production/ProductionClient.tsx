'use client'

import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import Button from '@/components/ui/Button'
import PageHeader from '@/components/ui/PageHeader'
import Tabs from '@/components/ui/Tabs'
import EmptyState from '@/components/ui/EmptyState'
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    AreaChart,
    Area,
    ComposedChart,
    LabelList
} from 'recharts'
import { TrendingUp, Package, DollarSign, Calculator, ChevronRight, Activity, Plus, X } from 'lucide-react'

type ProductionBatch = {
    id: string
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
    salesPrice: number
    wholesalePrice: number
    memo: string | null
    createdAt: string
}

type Product = {
    id: string
    name: string
    nameJP?: string
    sellPrice: number
    onlinePrice?: number | null
    priceC?: number | null
}

const CATEGORIES = ['청갯지렁이', '홍갯지렁이', '혼무시', '멍게', '번데기']

export default function ProductionClient() {
    const [activeTab, setActiveTab] = useState(CATEGORIES[0]) // Default to 청갯지렁이

    // Formatting Helpers
    const formatNumber = (val: string | number) => {
        if (!val && val !== 0) return ''
        return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    }
    const parseNumber = (val: string) => val.replace(/[^0-9]/g, '')
    const parseDecimal = (val: string) => val.replace(/[^0-9.]/g, '')

    const [batches, setBatches] = useState<ProductionBatch[]>([])
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [isEditing, setIsEditing] = useState<ProductionBatch | null>(null)
    const [isCreating, setIsCreating] = useState(false)
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'productionDate', direction: 'desc' })
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

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
            aVal = a.salesPrice ? (a.salesPrice - (a.unitCost || 0)) / a.salesPrice : 0
            bVal = b.salesPrice ? (b.salesPrice - (b.unitCost || 0)) / b.salesPrice : 0
        } else if (key === 'rMargin') {
            aVal = a.wholesalePrice ? (a.wholesalePrice - (a.unitCost || 0)) / a.wholesalePrice : 0
            bVal = b.wholesalePrice ? (b.wholesalePrice - (b.unitCost || 0)) / b.wholesalePrice : 0
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
    const fetchBatches = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/production?category=${activeTab}`)
            const data = await res.json()
            setBatches(data)
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    // Fetch Products (for pricing)
    const fetchProducts = async () => {
        try {
            const res = await fetch('/api/products') // Assuming this returns all products
            const data = await res.json()
            setProducts(data)
        } catch (error) {
            console.error("Failed to fetch products for pricing", error)
        }
    }

    useEffect(() => {
        fetchProducts()
    }, [])

    useEffect(() => {
        fetchBatches()
    }, [activeTab])

    const handleEdit = (batch: ProductionBatch) => {
        setIsEditing(batch)
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

    // Find linked product for pricing
    const getProductPricing = () => {
        if (!products || products.length === 0) return { salesPrice: 0, wholesalePrice: 0, exists: false }

        const cleanTab = activeTab.replaceAll(' ', '').toLowerCase()

        // Exact match or partial match
        const product = products.find(p => {
            const cleanName = p.name.replaceAll(' ', '').toLowerCase()
            const cleanJP = (p.nameJP || '').replaceAll(' ', '').toLowerCase()
            return cleanName.includes(cleanTab) || cleanJP.includes(cleanTab) || cleanTab.includes(cleanName)
        })

        return {
            salesPrice: product ? product.sellPrice : 0, // Wholesale
            wholesalePrice: product ? (product.onlinePrice || 0) : 0, // Retail
            exists: !!product,
            productName: product?.name
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        const priceInfo = getProductPricing()
        if (!priceInfo.exists) {
            if (!confirm(`'${activeTab}' 상품 정보를 찾을 수 없습니다. 판매가/도매가가 0원으로 저장됩니다. 진행하시겠습니까?`)) {
                return
            }
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

        // Ensure we use the latest pricing info
        const finalPriceInfo = getProductPricing()

        const body = {
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
            salesPrice: finalPriceInfo.salesPrice,
            wholesalePrice: finalPriceInfo.wholesalePrice,
            memo: formData.memo
        }

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
                unit: b.unitCost || 0
            })), [batches]
    )

    return (
        <div className="min-w-0 space-y-6">
            <PageHeader
                title="생산관리"
                description="카테고리별 생산 기록과 원가·마진을 관리합니다."
                count={batches.length}
                actions={
                    <Button
                        variant="primary"
                        icon={<Plus size={15} />}
                        onClick={() => {
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
                            setIsCreating(true)
                        }}
                    >
                        생산 기록
                    </Button>
                }
            />

            {/* Category Tabs */}
            <Tabs
                aria-label="생산 카테고리"
                items={CATEGORIES.map(cat => ({ key: cat, label: cat }))}
                value={activeTab}
                onChange={setActiveTab}
            />

            <h2 className="text-[13px] font-bold text-slate-800 dark:text-gray-300">{activeTab} 생산일지</h2>

            {/* Statistics Dashboard */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                    {
                        label: '총 생산수량',
                        value: batches.reduce((acc, b) => acc + b.quantity, 0).toLocaleString() + '개'
                    },
                    {
                        label: '평균 생산수량',
                        value: batches.length > 0
                            ? Math.round(batches.reduce((acc, b) => acc + b.quantity, 0) / batches.length).toLocaleString() + '개'
                            : '0개'
                    },
                    {
                        label: '평균 생산비용',
                        value: batches.length > 0
                            ? Math.round(batches.reduce((acc, b) => acc + (b.rawMaterialCost + b.electricityCost + b.packagingCost + (b.warehouseCost || 0) + (b.shippingCost || 0) + (b.customsFee || 0) + (b.customsDuty || 0) + (b.vat || 0)), 0) / batches.length).toLocaleString() + '원'
                            : '0원'
                    },
                    {
                        label: '평균 생산단가',
                        value: batches.length > 0
                            ? Math.round(batches.reduce((acc, b) => acc + (b.unitCost || 0), 0) / batches.length).toLocaleString() + '원'
                            : '0원'
                    },
                    {
                        label: '평균 마진율',
                        value: batches.length > 0
                            ? (batches.reduce((acc, b) => {
                                const margin = b.salesPrice > 0 ? ((b.salesPrice - (b.unitCost || 0)) / b.salesPrice) * 100 : 0
                                return acc + margin
                            }, 0) / batches.length).toFixed(1) + '%'
                            : '0%'
                    }
                ].map((stat, idx) => (
                    <div key={idx} className="bg-white dark:bg-[#1e1e1e] p-5 rounded-2xl border border-gray-100 dark:border-[#2a2a2a] shadow-sm dark:shadow-none flex flex-col gap-1 min-w-0">
                        <span className="text-[11px] font-bold text-slate-500 dark:text-gray-400">{stat.label}</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-xl font-black text-slate-900 dark:text-white truncate">{stat.value}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Visual Insights Section */}
            {!loading && batches.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Total Production Cost Trend */}
                    <div className="bg-white dark:bg-[#1e1e1e] p-6 rounded-2xl border border-gray-100 dark:border-[#2a2a2a] shadow-sm dark:shadow-none flex flex-col gap-4 min-w-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                                    <DollarSign className="w-4 h-4" />
                                </div>
                                <h3 className="text-sm font-black text-gray-900 dark:text-white tracking-tight">총 생산비용 추이</h3>
                            </div>
                            <Activity className="w-4 h-4 text-gray-300" />
                        </div>
                        <div className="h-48 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={areaChartData}>
                                    <defs>
                                        <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                    <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#9ca3af', fontWeight: 'bold' }} />
                                    <YAxis hide />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '11px', fontWeight: 'bold' }}
                                        formatter={(value: any) => [Number(value).toLocaleString() + '원', '비용']}
                                    />
                                    <Area type="monotone" dataKey="cost" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorCost)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Production Quantity Trend */}
                    <div className="bg-white dark:bg-[#1e1e1e] p-6 rounded-2xl border border-gray-100 dark:border-[#2a2a2a] shadow-sm dark:shadow-none flex flex-col gap-4 min-w-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                                    <Package className="w-4 h-4" />
                                </div>
                                <h3 className="text-sm font-black text-gray-900 dark:text-white tracking-tight">생산수량 변동</h3>
                            </div>
                            <TrendingUp className="w-4 h-4 text-gray-300" />
                        </div>
                        <div className="h-48 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={barChartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                    <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#9ca3af', fontWeight: 'bold' }} />
                                    <YAxis hide />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '11px', fontWeight: 'bold' }}
                                        formatter={(value: any) => [Number(value).toLocaleString() + '개', '수량']}
                                    />
                                    <Line type="linear" dataKey="qty" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0 }}>
                                        <LabelList dataKey="qty" position="top" fill="#059669" fontSize={10} fontWeight={700} formatter={(value: any) => Number(value).toLocaleString()} />
                                    </Line>
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Unit Cost Trend */}
                    <div className="bg-white dark:bg-[#1e1e1e] p-6 rounded-2xl border border-gray-100 dark:border-[#2a2a2a] shadow-sm dark:shadow-none flex flex-col gap-4 min-w-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-orange-50 rounded-lg text-orange-600">
                                    <Calculator className="w-4 h-4" />
                                </div>
                                <h3 className="text-sm font-black text-gray-900 dark:text-white tracking-tight">생산단가 추이</h3>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-300" />
                        </div>
                        <div className="h-48 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={lineChartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                    <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#9ca3af', fontWeight: 'bold' }} />
                                    <YAxis hide />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '11px', fontWeight: 'bold' }}
                                        formatter={(value: any) => [Number(value).toLocaleString() + '원', '단가']}
                                    />
                                    <Line type="linear" dataKey="unit" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: '#f59e0b', strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0 }}>
                                        <LabelList dataKey="unit" position="top" fill="#d97706" fontSize={10} fontWeight={700} formatter={(value: any) => Number(value).toLocaleString()} />
                                    </Line>
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}


            {/* Table */}
            <div className="bg-white dark:bg-[#1e1e1e] border border-gray-100 dark:border-[#2a2a2a] rounded-2xl overflow-x-auto shadow-sm dark:shadow-none pb-16">
                <div className="min-w-[800px]">
                    <table className="w-full text-xs text-left">
                        <thead className="ux-thead">
                            <tr>
                                <th className="px-4 py-1.5 whitespace-nowrap text-center w-12 cursor-pointer hover:bg-brand-ink/80" onClick={() => handleSort('productionDate')}>
                                    No {sortConfig?.key === 'productionDate' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="px-4 py-1.5 whitespace-nowrap text-center cursor-pointer hover:bg-brand-ink/80" onClick={() => handleSort('productionDate')}>
                                    생산날짜 {sortConfig?.key === 'productionDate' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="px-4 py-1.5 text-center whitespace-nowrap cursor-pointer hover:bg-brand-ink/80" title="원재료+전기+포장" onClick={() => handleSort('totalCost')}>
                                    총 생산비용 {sortConfig?.key === 'totalCost' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="px-4 py-1.5 text-center whitespace-nowrap cursor-pointer hover:bg-brand-ink/80" onClick={() => handleSort('quantity')}>
                                    생산수량 {sortConfig?.key === 'quantity' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="px-4 py-1.5 text-center whitespace-nowrap cursor-pointer hover:bg-brand-ink/80" onClick={() => handleSort('unitCost')}>
                                    단가 {sortConfig?.key === 'unitCost' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="px-4 py-1.5 text-center whitespace-nowrap cursor-pointer hover:bg-brand-ink/80" onClick={() => handleSort('salesPrice')}>
                                    도매가 {sortConfig?.key === 'salesPrice' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="px-4 py-1.5 text-center whitespace-nowrap cursor-pointer hover:bg-brand-ink/80" onClick={() => handleSort('wMargin')}>
                                    도매마진 {sortConfig?.key === 'wMargin' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="px-4 py-1.5 text-center whitespace-nowrap cursor-pointer hover:bg-brand-ink/80" onClick={() => handleSort('wholesalePrice')}>
                                    판매가 {sortConfig?.key === 'wholesalePrice' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="px-4 py-1.5 text-center whitespace-nowrap cursor-pointer hover:bg-brand-ink/80" onClick={() => handleSort('rMargin')}>
                                    소매마진 {sortConfig?.key === 'rMargin' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="px-4 py-1.5 text-center whitespace-nowrap">메모</th>
                                <th className="px-4 py-1.5 text-center whitespace-nowrap">관리</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-[#2a2a2a]">
                            {loading ? (
                                <tr><td colSpan={11} className="px-4 py-10 text-center text-[12px] font-bold text-slate-500 dark:text-gray-400">로딩 중...</td></tr>
                            ) : sortedBatches.length === 0 ? (
                                <tr><td colSpan={11} className="p-3"><EmptyState compact title="생산 기록이 없습니다" description="생산 기록 버튼을 눌러 첫 기록을 등록하세요." /></td></tr>
                            ) : (
                                sortedBatches.map((batch, idx) => {
                                    const totalCost = batch.rawMaterialCost
                                        + batch.electricityCost
                                        + batch.packagingCost
                                        + (batch.warehouseCost || 0)
                                        + (batch.shippingCost || 0)
                                        + (batch.customsFee || 0)
                                        + (batch.customsDuty || 0)
                                        + (batch.vat || 0)
                                    // Swapped back to match corrected data mapping
                                    const wMarginRate = batch.salesPrice ? (((batch.salesPrice - (batch.unitCost || 0)) / batch.salesPrice) * 100).toFixed(1) : '0';
                                    const rMarginRate = batch.wholesalePrice ? (((batch.wholesalePrice - (batch.unitCost || 0)) / batch.wholesalePrice) * 100).toFixed(1) : '0';

                                    return (
                                        <tr key={batch.id} className="hover:bg-brand-orange-soft dark:hover:bg-[#252525] transition-colors group even:bg-slate-50 dark:even:bg-[#1a1a1a] hover:relative hover:z-50">
                                            <td className="px-4 py-1.5 text-center text-black dark:text-white font-bold border-r border-gray-200 dark:border-[#2a2a2a]">
                                                {idx + 1}
                                            </td>
                                            <td className="px-4 py-1.5 text-black dark:text-white font-bold border-r border-gray-200 dark:border-[#2a2a2a]">
                                                {new Date(batch.productionDate).toISOString().split('T')[0]}
                                            </td>
                                            <td
                                                className="px-4 py-1.5 text-right tabular-nums text-black dark:text-white border-r border-gray-200 dark:border-[#2a2a2a] group/cost relative cursor-pointer hover:bg-gray-200/50 dark:hover:bg-[#252525] transition-colors font-bold"
                                                onClick={() => handleEdit(batch)}
                                            >
                                                <span className="underline decoration-dotted underline-offset-4 decoration-gray-300">
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
                                            <td className="px-4 py-1.5 text-right tabular-nums text-black dark:text-white border-r border-gray-200 dark:border-[#2a2a2a]">{batch.quantity.toLocaleString()}</td>
                                            <td className="px-4 py-1.5 text-right tabular-nums text-black dark:text-white border-r border-gray-200 dark:border-[#2a2a2a]">
                                                {batch.unitCost ? batch.unitCost.toLocaleString() : '-'}
                                            </td>
                                            <td className="px-4 py-1.5 text-right tabular-nums text-black dark:text-white border-r border-gray-200 dark:border-[#2a2a2a]">{batch.salesPrice.toLocaleString()}</td>
                                            <td className="px-4 py-1.5 text-center border-r border-gray-200 dark:border-[#2a2a2a]">
                                                <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${Number(wMarginRate) > 30 ? 'bg-red-50 dark:bg-red-900/30 text-red-600' : 'bg-red-50 dark:bg-red-900/30 text-red-400'}`}>
                                                    {wMarginRate}%
                                                </span>
                                            </td>
                                            <td className="px-4 py-1.5 text-right tabular-nums text-black dark:text-white border-r border-gray-200 dark:border-[#2a2a2a]">{batch.wholesalePrice.toLocaleString()}</td>
                                            <td className="px-4 py-1.5 text-center border-r border-gray-200 dark:border-[#2a2a2a]">
                                                <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${Number(rMarginRate) > 30 ? 'bg-red-50 dark:bg-red-900/30 text-red-600' : 'bg-red-50 dark:bg-red-900/30 text-red-400'}`}>
                                                    {rMarginRate}%
                                                </span>
                                            </td>
                                            <td className="px-4 py-1.5 text-black dark:text-white border-r border-gray-200 dark:border-[#2a2a2a]" title={batch.memo || ''}>{batch.memo || '-'}</td>
                                            <td className="px-4 py-1.5 text-center">
                                                <div className="flex items-center justify-center gap-2 transition-opacity">
                                                    <Button variant="secondary" size="sm" onClick={() => handleEdit(batch)}>수정</Button>
                                                    <Button variant="danger" size="sm" onClick={() => handleDelete(batch.id)}>삭제</Button>
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

            {/* Modal */}
            {
                isCreating && mounted && createPortal(
                    <div className="fixed inset-0 bg-black/40 z-[99999] flex items-center justify-center p-4 overflow-hidden">
                        <div
                            className="bg-white w-full max-w-lg rounded-2xl border border-slate-200 shadow-xl animate-in fade-in duration-100 relative overflow-hidden"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="production-record-modal-title"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="px-5 py-4 flex justify-between items-center border-b border-slate-100">
                                <h3 id="production-record-modal-title" className="text-base font-black tracking-tight text-slate-900">
                                    {isEditing ? '생산 기록 수정' : '생산 기록 등록'}
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setIsCreating(false)}
                                    aria-label="닫기"
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-5 space-y-5 max-h-[80vh] overflow-y-auto scrollbar-hide">
                                {/* Schedule Info */}
                                <fieldset className="rounded-2xl border border-slate-200 p-4">
                                    <legend className="px-2 text-[13px] font-bold text-slate-800">일정 및 생산 구분</legend>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-bold text-slate-600">생산일</label>
                                            <input
                                                type="date"
                                                required
                                                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-brand-orange text-sm font-bold"
                                                value={formData.productionDate}
                                                onChange={e => setFormData({ ...formData, productionDate: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-bold text-slate-600">생산 구분</label>
                                            <div className="w-full h-9 px-3 flex items-center bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700">
                                                {activeTab}
                                            </div>
                                        </div>
                                    </div>
                                </fieldset>

                                {/* Cost Details */}
                                <fieldset className="rounded-2xl border border-slate-200 p-4">
                                    <legend className="px-2 text-[13px] font-bold text-slate-800">비용 상세</legend>
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-[11px] font-bold text-slate-600">해외송금금액 (원)</label>
                                                <input
                                                    type="text"
                                                    required
                                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-brand-orange text-sm text-right tabular-nums"
                                                    value={formatNumber(formData.rawMaterialCost)}
                                                    onChange={e => setFormData({ ...formData, rawMaterialCost: parseNumber(e.target.value) })}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[11px] font-bold text-slate-600">송금액 (USD)</label>
                                                <input
                                                    type="text"
                                                    placeholder="0.00"
                                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-brand-orange text-sm text-right tabular-nums"
                                                    value={formData.depositDollar}
                                                    onChange={e => setFormData({ ...formData, depositDollar: e.target.value })}
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2">
                                            {[
                                                { label: '전기세', key: 'electricityCost', small: 'Elec' },
                                                { label: '포장비', key: 'packagingCost', small: 'Pack' },
                                                { label: '창고료', key: 'warehouseCost', small: 'Whse' },
                                                { label: '운송료', key: 'shippingCost', small: 'Ship' },
                                                { label: '관세사비', key: 'customsFee', small: 'Fees' },
                                                { label: '관세', key: 'customsDuty', small: 'Duty' },
                                                { label: '부가세', key: 'vat', small: 'VAT' }
                                            ].map((field) => (
                                                <div key={field.key} className="space-y-1">
                                                    <label className="text-[11px] font-bold text-slate-600">{field.label}</label>
                                                    <input
                                                        type="text"
                                                        className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-brand-orange text-xs text-right tabular-nums"
                                                        value={formatNumber(formData[field.key as keyof typeof formData])}
                                                        onChange={e => setFormData({ ...formData, [field.key]: parseNumber(e.target.value) })}
                                                    />
                                                </div>
                                            ))}
                                            <div className="space-y-1 col-start-2">
                                                <label className="text-[11px] font-bold text-slate-600">환율 (해외송금금액/USD)</label>
                                                <div className="w-full h-9 px-2.5 flex items-center justify-end bg-slate-50 border border-slate-200 rounded-xl text-xs text-right tabular-nums font-bold text-slate-900">
                                                    {remittanceExchangeRate !== null
                                                        ? `1 USD = ₩${remittanceExchangeRate.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                                                        : '-'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </fieldset>

                                {/* Production Result */}
                                <fieldset className="rounded-2xl border border-slate-200 p-4">
                                    <legend className="px-2 text-[13px] font-bold text-slate-800">생산 결과</legend>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-bold text-slate-600">생산 수량</label>
                                            <input
                                                type="text"
                                                required
                                                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-brand-orange text-sm text-right font-black text-slate-900 tabular-nums"
                                                value={formatNumber(formData.quantity)}
                                                onChange={e => setFormData({ ...formData, quantity: parseNumber(e.target.value) })}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-bold text-slate-600">산출 단가</label>
                                            <div className="w-full h-9 px-3 flex items-center justify-end bg-slate-50 border border-slate-200 rounded-xl text-sm text-right font-black text-slate-900 tabular-nums">
                                                {(
                                                    ((Number(parseNumber(formData.rawMaterialCost)) || 0) +
                                                        (Number(parseNumber(formData.electricityCost)) || 0) +
                                                        (Number(parseNumber(formData.packagingCost)) || 0) +
                                                        (Number(parseNumber(formData.warehouseCost)) || 0) +
                                                        (Number(parseNumber(formData.shippingCost)) || 0) +
                                                        (Number(parseNumber(formData.customsFee)) || 0) +
                                                        (Number(parseNumber(formData.customsDuty)) || 0) +
                                                        (Number(parseNumber(formData.vat)) || 0)) /
                                                    (Number(parseNumber(formData.quantity)) || 1)
                                                ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Pricing Ref */}
                                    <div className="mt-4 grid grid-cols-2 gap-4">
                                        <div className="text-[11px] space-y-0.5">
                                            <span className="block font-bold text-slate-500">참고 도매가</span>
                                            <span className="block font-black text-slate-900">{currentPriceInfo.salesPrice.toLocaleString()}원</span>
                                        </div>
                                        <div className="text-[11px] space-y-0.5 text-right">
                                            <span className="block font-bold text-slate-500">참고 판매가</span>
                                            <span className="block font-black text-slate-900">{currentPriceInfo.wholesalePrice.toLocaleString()}원</span>
                                        </div>
                                    </div>
                                </fieldset>

                                {/* Memo */}
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-600">특이사항</label>
                                    <textarea
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-brand-orange text-xs h-16 resize-none"
                                        placeholder="생산 관련 메모를 입력하세요"
                                        value={formData.memo || ''}
                                        onChange={e => setFormData({ ...formData, memo: e.target.value })}
                                    />
                                </div>

                                <div className="flex gap-2 justify-end pt-2">
                                    <Button variant="secondary" onClick={() => setIsCreating(false)}>
                                        취소
                                    </Button>
                                    <Button variant="primary" type="submit">
                                        {isEditing ? '수정 저장' : '저장'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>,
                    document.body
                )
            }
        </div >
    )
}
