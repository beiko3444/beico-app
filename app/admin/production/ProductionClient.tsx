'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createPortal } from 'react-dom'
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    AreaChart,
    Area,
    ComposedChart
} from 'recharts'
import { TrendingUp, Package, DollarSign, Calculator, ChevronRight, Activity } from 'lucide-react'

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
        <div className="space-y-6">
            {/* Sticky Header with Title and Category Tabs */}
            {/* Sticky Header with Title and Category Tabs */}
            <div className="sticky top-0 z-40 bg-[#f0f0f0] pt-1 pb-1 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 border-b-2 border-[#808080] shadow-sm transition-all duration-300">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Link href="/admin" className="p-1 hover:bg-gray-300 border border-transparent hover:border-[#808080] text-gray-500 transition-all" title="Dashboard">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                            </Link>
                            <h1 className="text-sm font-bold text-gray-900 tracking-tight uppercase">Production Management System</h1>
                        </div>

                        <div className="h-6 w-px bg-gray-400"></div>

                        {/* Category Tabs */}
                        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
                            {CATEGORIES.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setActiveTab(cat)}
                                    className={`px-4 py-1.5 text-xs font-bold whitespace-nowrap transition-all border-t-2 border-x-2 ${activeTab === cat
                                        ? 'bg-white border-[#808080] border-b-white -mb-[2px] text-blue-800'
                                        : 'bg-[#e0e0e0] border-transparent text-gray-500 hover:bg-gray-200'
                                        }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Bar */}
            {/* Action Bar */}
            <div className="flex justify-between items-center bg-[#f0f0f0] p-3 border-2 border-[#808080] shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-800"></div>
                    <span className="text-xs font-bold text-gray-700">{activeTab} PRODUCTION LOG</span>
                </div>
                <button
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
                    className="bg-[#c0c0c0] text-black px-6 py-1.5 border-r border-b border-black border-l-[#ffffff] border-t-[#ffffff] active:border-none text-xs font-bold hover:bg-[#d0d0d0]"
                >
                    ＋ NEW RECORD
                </button>
            </div>

            {/* Statistics Dashboard */}
            {/* Statistics Dashboard */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-0 border-2 border-[#808080] bg-[#f0f0f0] divide-x divide-y lg:divide-y-0 divide-[#808080]">
                {[
                    { label: 'Total Qty', value: batches.reduce((acc, b) => acc + b.quantity, 0).toLocaleString() + ' EA' },
                    { label: 'Avg Qty', value: batches.length > 0 ? Math.round(batches.reduce((acc, b) => acc + b.quantity, 0) / batches.length).toLocaleString() + ' EA' : '0 EA' },
                    { label: 'Avg Cost', value: batches.length > 0 ? Math.round(batches.reduce((acc, b) => acc + (b.rawMaterialCost + b.electricityCost + b.packagingCost + (b.warehouseCost || 0) + (b.shippingCost || 0) + (b.customsFee || 0) + (b.customsDuty || 0) + (b.vat || 0)), 0) / batches.length).toLocaleString() + ' KRW' : '0 KRW' },
                    { label: 'Avg Unit Price', value: batches.length > 0 ? Math.round(batches.reduce((acc, b) => acc + (b.unitCost || 0), 0) / batches.length).toLocaleString() + ' KRW' : '0 KRW' },
                    {
                        label: 'Avg Margin', value: batches.length > 0 ? (batches.reduce((acc, b) => {
                            const margin = b.salesPrice > 0 ? ((b.salesPrice - (b.unitCost || 0)) / b.salesPrice) * 100 : 0
                            return acc + margin
                        }, 0) / batches.length).toFixed(1) + '%' : '0%'
                    }
                ].map((stat, idx) => (
                    <div key={idx} className="p-4 flex flex-col items-center justify-center bg-white shadow-inner">
                        <span className="text-[10px] font-bold text-gray-500 uppercase mb-1">{stat.label}</span>
                        <span className="text-base font-bold text-blue-900">{stat.value}</span>
                    </div>
                ))}
            </div>

            {/* Visual Insights Section */}
            {!loading && batches.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Total Production Cost Trend */}
                    <div className="bg-white p-4 border-2 border-[#808080] shadow-sm flex flex-col gap-3">
                        <div className="flex items-center justify-between border-b pb-1">
                            <h3 className="text-xs font-bold text-gray-700">Cost Trend</h3>
                        </div>
                        <div className="h-40 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={areaChartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
                                    <XAxis dataKey="date" fontSize={9} tickLine={false} axisLine={false} tick={{ fill: '#666' }} />
                                    <YAxis hide />
                                    <Tooltip contentStyle={{ fontSize: '10px' }} />
                                    <Area type="monotone" dataKey="cost" stroke="#000080" strokeWidth={2} fill="#00008033" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Production Quantity Trend */}
                    <div className="bg-white p-4 border-2 border-[#808080] shadow-sm flex flex-col gap-3">
                        <div className="flex items-center justify-between border-b pb-1">
                            <h3 className="text-xs font-bold text-gray-700">Quantity Flow</h3>
                        </div>
                        <div className="h-40 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={barChartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
                                    <XAxis dataKey="date" fontSize={9} tickLine={false} axisLine={false} tick={{ fill: '#666' }} />
                                    <YAxis hide />
                                    <Tooltip contentStyle={{ fontSize: '10px' }} />
                                    <Bar dataKey="qty" fill="#006400" barSize={15} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Unit Cost Trend */}
                    <div className="bg-white p-4 border-2 border-[#808080] shadow-sm flex flex-col gap-3">
                        <div className="flex items-center justify-between border-b pb-1">
                            <h3 className="text-xs font-bold text-gray-700">Unit Cost Analysis</h3>
                        </div>
                        <div className="h-40 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={lineChartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
                                    <XAxis dataKey="date" fontSize={9} tickLine={false} axisLine={false} tick={{ fill: '#666' }} />
                                    <YAxis hide />
                                    <Tooltip contentStyle={{ fontSize: '10px' }} />
                                    <Line type="stepAfter" dataKey="unit" stroke="#b22222" strokeWidth={2} dot={{ r: 3 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}


            {/* Table */}
            <div className="bg-white border-2 border-[#808080] shadow-md">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                        <thead className="bg-[#d0d0d0] text-black font-bold border-b-2 border-[#808080]">
                            <tr>
                                <th className="px-4 py-1.5 whitespace-nowrap text-center w-12 cursor-pointer hover:bg-gray-100 border-r border-gray-200" onClick={() => handleSort('productionDate')}>
                                    No {sortConfig?.key === 'productionDate' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="px-4 py-1.5 whitespace-nowrap text-center cursor-pointer hover:bg-gray-100 border-r border-gray-200" onClick={() => handleSort('productionDate')}>
                                    생산날짜 {sortConfig?.key === 'productionDate' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="px-4 py-1.5 text-center whitespace-nowrap cursor-pointer hover:bg-gray-100 border-r border-gray-200" title="원재료+전기+포장" onClick={() => handleSort('totalCost')}>
                                    총 생산비용 {sortConfig?.key === 'totalCost' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="px-4 py-1.5 text-center whitespace-nowrap cursor-pointer hover:bg-gray-100 border-r border-gray-200" onClick={() => handleSort('quantity')}>
                                    생산수량 {sortConfig?.key === 'quantity' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="px-4 py-1.5 text-center whitespace-nowrap cursor-pointer hover:bg-gray-100 border-r border-gray-200" onClick={() => handleSort('unitCost')}>
                                    단가 {sortConfig?.key === 'unitCost' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="px-4 py-1.5 text-center whitespace-nowrap cursor-pointer hover:bg-gray-100 border-r border-gray-200" onClick={() => handleSort('salesPrice')}>
                                    도매가 {sortConfig?.key === 'salesPrice' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="px-4 py-1.5 text-center whitespace-nowrap cursor-pointer hover:bg-gray-100 border-r border-gray-200" onClick={() => handleSort('wMargin')}>
                                    도매마진 {sortConfig?.key === 'wMargin' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="px-4 py-1.5 text-center whitespace-nowrap cursor-pointer hover:bg-gray-100 border-r border-gray-200" onClick={() => handleSort('wholesalePrice')}>
                                    판매가 {sortConfig?.key === 'wholesalePrice' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="px-4 py-1.5 text-center whitespace-nowrap cursor-pointer hover:bg-gray-100 border-r border-gray-200" onClick={() => handleSort('rMargin')}>
                                    소매마진 {sortConfig?.key === 'rMargin' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="px-4 py-1.5 text-center whitespace-nowrap border-r border-gray-200">메모</th>
                                <th className="px-4 py-1.5 text-center whitespace-nowrap">관리</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr><td colSpan={11} className="px-4 py-10 text-center text-gray-400">로딩 중...</td></tr>
                            ) : sortedBatches.length === 0 ? (
                                <tr><td colSpan={11} className="px-4 py-10 text-center text-gray-400">기록이 없습니다.</td></tr>
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
                                        <tr key={batch.id} className="hover:bg-blue-50 transition-colors group even:bg-gray-100/70 hover:relative hover:z-50">
                                            <td className="px-4 py-1.5 text-center text-black font-bold border-r border-gray-200">
                                                {idx + 1}
                                            </td>
                                            <td className="px-4 py-1.5 text-black font-bold border-r border-gray-200">
                                                {new Date(batch.productionDate).toISOString().split('T')[0]}
                                            </td>
                                            <td
                                                className="px-4 py-1.5 text-right tabular-nums text-black border-r border-gray-200 group/cost relative cursor-pointer hover:bg-gray-200/50 transition-colors font-bold"
                                                onClick={() => handleEdit(batch)}
                                            >
                                                <span className="underline decoration-dotted underline-offset-4 decoration-gray-300">
                                                    {totalCost.toLocaleString()}
                                                </span>
                                                {/* Tooltip for Cost Breakdown */}
                                                <div className="absolute opacity-0 group-hover/cost:opacity-100 z-[60] bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-gray-900 text-white p-3 rounded-lg text-[10px] pointer-events-none transition-opacity shadow-xl">
                                                    <div className="flex justify-between mb-1">
                                                        <span>원재료비:</span>
                                                        <span>{batch.rawMaterialCost.toLocaleString()}
                                                            {batch.depositDollar && <span className='text-[9px] text-gray-400 ml-1'>(${batch.depositDollar})</span>}
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
                                            <td className="px-4 py-1.5 text-right tabular-nums text-black border-r border-gray-200">{batch.quantity.toLocaleString()}</td>
                                            <td className="px-4 py-1.5 text-right tabular-nums text-black border-r border-gray-200">
                                                {batch.unitCost ? batch.unitCost.toLocaleString() : '-'}
                                            </td>
                                            <td className="px-4 py-1.5 text-right tabular-nums text-black border-r border-gray-200">{batch.salesPrice.toLocaleString()}</td>
                                            <td className="px-4 py-1.5 text-center border-r border-gray-200">
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${Number(wMarginRate) > 30 ? 'bg-red-50 text-red-600' : 'bg-red-50 text-red-400'}`}>
                                                    {wMarginRate}%
                                                </span>
                                            </td>
                                            <td className="px-4 py-1.5 text-right tabular-nums text-black border-r border-gray-200">{batch.wholesalePrice.toLocaleString()}</td>
                                            <td className="px-4 py-1.5 text-center border-r border-gray-200">
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${Number(rMarginRate) > 30 ? 'bg-red-50 text-red-600' : 'bg-red-50 text-red-400'}`}>
                                                    {rMarginRate}%
                                                </span>
                                            </td>
                                            <td className="px-4 py-1.5 text-black border-r border-gray-200" title={batch.memo || ''}>{batch.memo || '-'}</td>
                                            <td className="px-4 py-1.5 text-center">
                                                <div className="flex items-center justify-center gap-2 transition-opacity">
                                                    <button onClick={() => handleEdit(batch)} className="text-gray-500 hover:text-gray-700 font-bold text-[10px] border border-gray-200 bg-gray-50 px-2 py-1 rounded shadow-sm transition-colors">수정</button>
                                                    <button onClick={() => handleDelete(batch.id)} className="text-red-500 hover:text-red-700 font-bold text-[10px] border border-red-100 bg-red-50 px-2 py-1 rounded shadow-sm">삭제</button>
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
                    <div className="fixed inset-0 bg-black/40 z-[99999] flex items-center justify-center p-4 overflow-hidden" onClick={() => setIsCreating(false)}>
                        <div
                            className="bg-[#f0f0f0] border-2 border-[#808080] w-full max-w-lg shadow-md animate-in fade-in duration-100 relative"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* ERP style Header */}
                            <div className="bg-[#000080] text-white px-3 py-2 flex justify-between items-center select-none">
                                <h3 className="text-xs font-bold tracking-tight">
                                    {isEditing ? `Production Record Entry - ID:${isEditing.id.slice(-6).toUpperCase()}` : 'New Production Record Entry'}
                                </h3>
                                <button onClick={() => setIsCreating(false)} className="bg-[#c0c0c0] text-black w-5 h-5 flex items-center justify-center text-xs border-r border-b border-black border-l-[#ffffff] border-t-[#ffffff] active:border-none">✕</button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[85vh] overflow-y-auto">
                                <fieldset className="border border-gray-400 p-4 pt-2">
                                    <legend className="px-2 text-xs font-bold text-gray-700">Schedule & Identifiers</legend>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-bold text-gray-600 block">Date of Entry</label>
                                            <input
                                                type="date"
                                                required
                                                className="w-full px-2 py-1 bg-white border border-gray-400 text-sm font-mono"
                                                value={formData.productionDate}
                                                onChange={e => setFormData({ ...formData, productionDate: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-bold text-gray-600 block">Category</label>
                                            <input
                                                type="text"
                                                disabled
                                                className="w-full px-2 py-1 bg-gray-200 border border-gray-400 text-sm"
                                                value={activeTab}
                                            />
                                        </div>
                                    </div>
                                </fieldset>

                                <fieldset className="border border-gray-400 p-4 pt-2">
                                    <legend className="px-2 text-xs font-bold text-gray-700">Cost Breakdown (KRW)</legend>
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                                        <div className="col-span-2 flex items-baseline justify-between gap-4 border-b pb-2 mb-2">
                                            <label className="text-[11px] font-bold text-blue-900 min-w-fit">Raw Material Cost</label>
                                            <input
                                                type="text"
                                                required
                                                className="w-full text-right px-2 py-1 bg-white border border-gray-400 text-sm font-mono font-bold"
                                                value={formatNumber(formData.rawMaterialCost)}
                                                onChange={e => setFormData({ ...formData, rawMaterialCost: parseNumber(e.target.value) })}
                                            />
                                        </div>
                                        {[
                                            { label: 'Electricity', key: 'electricityCost' },
                                            { label: 'Packaging', key: 'packagingCost' },
                                            { label: 'Warehouse', key: 'warehouseCost' },
                                            { label: 'Shipping', key: 'shippingCost' },
                                            { label: 'Customs Duty', key: 'customsDuty' },
                                            { label: 'Taxes (VAT)', key: 'vat' },
                                            { label: 'Admin/Fees', key: 'customsFee' }
                                        ].map((field) => (
                                            <div key={field.key} className="flex flex-col gap-1">
                                                <label className="text-[10px] font-bold text-gray-600">{field.label}</label>
                                                <input
                                                    type="text"
                                                    className="w-full px-2 py-1 bg-white border border-gray-400 text-xs text-right font-mono"
                                                    value={formatNumber(formData[field.key as keyof typeof formData])}
                                                    onChange={e => setFormData({ ...formData, [field.key]: parseNumber(e.target.value) })}
                                                />
                                            </div>
                                        ))}
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-bold text-gray-400">USD Deposit ($)</label>
                                            <input
                                                type="text"
                                                placeholder="0.00"
                                                className="w-full px-2 py-1 bg-white border border-gray-300 text-xs text-right font-mono text-gray-400"
                                                value={formData.depositDollar}
                                                onChange={e => setFormData({ ...formData, depositDollar: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </fieldset>

                                <fieldset className="border border-gray-400 p-4 pt-2">
                                    <legend className="px-2 text-xs font-bold text-gray-700">Production Results</legend>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-bold text-gray-600 block">Total Quantity (EA)</label>
                                            <input
                                                type="text"
                                                required
                                                className="w-full px-2 py-1.5 bg-white border border-gray-400 text-lg font-mono font-bold text-right"
                                                value={formatNumber(formData.quantity)}
                                                onChange={e => setFormData({ ...formData, quantity: parseNumber(e.target.value) })}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-bold text-blue-800 block">Calculated Unit Cost</label>
                                            <div className="w-full px-2 py-1.5 bg-gray-100 border border-gray-400 text-lg font-mono font-bold text-right text-blue-900 shadow-inner">
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
                                </fieldset>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-gray-600">Notes / Remarks</label>
                                    <textarea
                                        rows={3}
                                        className="w-full px-2 py-1.5 bg-white border border-gray-400 text-xs outline-none focus:border-blue-600"
                                        value={formData.memo}
                                        onChange={e => setFormData({ ...formData, memo: e.target.value })}
                                    />
                                </div>

                                <div className="flex gap-2 justify-end pt-4 border-t border-gray-300">
                                    <button
                                        type="button"
                                        onClick={() => setIsCreating(false)}
                                        className="px-6 py-1.5 text-xs bg-[#c0c0c0] border-r border-b border-black border-l-[#ffffff] border-t-[#ffffff] active:border-none uppercase"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-10 py-1.5 text-xs bg-[#c0c0c0] border-r border-b border-black border-l-[#ffffff] border-t-[#ffffff] active:border-none font-bold uppercase text-blue-900"
                                    >
                                        Execute Save
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>,
                    document.body
                )
            }
        </div>
    )
}
