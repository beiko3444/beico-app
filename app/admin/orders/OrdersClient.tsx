'use client'

import { useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import OrderActions from '@/components/OrderActions'
import BarcodeDisplay from '@/components/BarcodeDisplay'
import OrderStatus from '@/components/OrderStatus'
import AdminOrderCard from './AdminOrderCard'

export default function OrdersClient({
    orders,
    pendingTaxCount,
    missingTrackingCount
}: {
    orders: any[],
    pendingTaxCount: number,
    missingTrackingCount: number
}) {
    const searchParams = useSearchParams()
    const type = searchParams.get('type')
    const [selectedPartner, setSelectedPartner] = useState<string | null>(null)
    const [statSortType, setStatSortType] = useState<'quantity' | 'total'>('quantity')

    // Extract unique partners (Business Name or Name)
    const partners = useMemo(() => {
        return Array.from(new Set(orders.map(order =>
            order.user.partnerProfile?.businessName || order.user.name
        ))).sort()
    }, [orders])

    // Current Month Statistics
    const stats = useMemo(() => {
        if (!selectedPartner) return null;

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const partnerOrdersThisMonth = orders.filter(order => {
            const partnerName = order.user.partnerProfile?.businessName || order.user.name;
            const orderDate = new Date(order.createdAt);
            return partnerName === selectedPartner && orderDate >= startOfMonth;
        });

        const totalSalesWithVAT = partnerOrdersThisMonth.reduce((sum, order) => {
            const productTotal = order.items.reduce((s: number, i: any) => s + (i.price * i.quantity), 0);
            const totalQuantity = order.items.reduce((s: number, i: any) => s + i.quantity, 0);
            const shippingFee = totalQuantity > 0 ? Math.ceil(totalQuantity / 100) * 3000 : 0;
            const supplyTotal = productTotal + shippingFee;
            return sum + Math.round(supplyTotal * 1.1);
        }, 0);

        const productDataMap: Record<string, { name: string, image: string | null, quantity: number, total: number }> = {};
        partnerOrdersThisMonth.forEach(order => {
            order.items.forEach((item: any) => {
                const id = item.productId;
                if (!productDataMap[id]) {
                    productDataMap[id] = {
                        name: item.product.name,
                        image: item.product.imageUrl,
                        quantity: 0,
                        total: 0
                    };
                }
                productDataMap[id].quantity += item.quantity;
                productDataMap[id].total += item.price * item.quantity;
            });
        });

        return {
            totalSales: totalSalesWithVAT,
            products: Object.values(productDataMap).sort((a, b) => b[statSortType] - a[statSortType]),
            orderCount: partnerOrdersThisMonth.length,
            month: now.getMonth() + 1
        };
    }, [orders, selectedPartner, statSortType]);

    const filteredOrders = orders?.filter(order => {
        const matchesType = (() => {
            if (type === 'invoice') return !order.taxInvoiceIssued
            if (type === 'tracking') return !order.trackingNumber && order.status === 'APPROVED'
            if (type === 'inprogress') return !order.trackingNumber || !order.taxInvoiceIssued
            if (type === 'completed') return order.trackingNumber && order.taxInvoiceIssued
            return true
        })()

        const partnerName = order.user.partnerProfile?.businessName || order.user.name
        const matchesPartner = !selectedPartner || partnerName === selectedPartner

        return matchesType && matchesPartner
    }) || []

    return (
        <div className="space-y-6">
            {/* Sticky Header with Title and Partner Filter */}
            <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl pt-2 pb-2 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 border-b border-gray-100 shadow-sm transition-all duration-300">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3">
                            <Link href="/admin" className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 hover:text-[#d9361b] transition-all" title="Dashboard">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                            </Link>
                            <h1 className="text-lg font-black text-gray-900 tracking-tight">주문 관리</h1>
                        </div>

                        <div className="h-4 w-px bg-gray-200"></div>

                        {/* Partner Select Toggle */}
                        <div className="relative">
                            <select
                                value={selectedPartner || ''}
                                onChange={(e) => setSelectedPartner(e.target.value || null)}
                                className="appearance-none bg-gray-50/50 border border-gray-100 text-[#d9361b] text-[11px] font-black rounded-lg focus:ring-[#d9361b] focus:border-[#d9361b] block w-full pl-2.5 pr-8 py-1 transition-all hover:bg-white cursor-pointer min-w-[140px]"
                            >
                                <option value="">🏢 모든 거래처 보기</option>
                                {partners.map(partner => (
                                    <option key={partner} value={partner}>{partner}</option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#d9361b] opacity-50">
                                <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                            </div>
                        </div>
                    </div>

                    {/* Right-aligned Status Badges */}
                    <div className="flex items-center gap-2">
                        {selectedPartner && (
                            <button
                                onClick={() => setSelectedPartner(null)}
                                className="flex items-center gap-2 px-3 py-1 rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-all shadow-sm"
                            >
                                <span className="text-[10px]">🏠</span>
                                <span className="text-[10px] font-black">모든 거래처</span>
                            </button>
                        )}

                        {pendingTaxCount > 0 && (
                            <Link
                                href={type === 'invoice' ? '/admin/orders' : '/admin/orders?type=invoice'}
                                className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-all ${type === 'invoice' ? 'bg-[#d9361b] border-[#d9361b] text-white shadow-lg scale-105' : 'bg-white border-red-200 text-[#d9361b] hover:bg-red-50'}`}
                            >
                                <span className="text-[10px]">📄</span>
                                <span className="text-[10px] font-black">{pendingTaxCount} <span className="opacity-70 font-bold ml-1">미발행</span></span>
                            </Link>
                        )}

                        {missingTrackingCount > 0 && (
                            <Link
                                href={type === 'tracking' ? '/admin/orders' : '/admin/orders?type=tracking'}
                                className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-all ${type === 'tracking' ? 'bg-gray-800 border-gray-800 text-white shadow-lg scale-105' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                            >
                                <span className="text-[10px]">📦</span>
                                <span className="text-[10px] font-black">{missingTrackingCount} <span className="opacity-70 font-bold ml-1">송장누락</span></span>
                            </Link>
                        )}

                        <Link
                            href={type === 'inprogress' ? '/admin/orders' : '/admin/orders?type=inprogress'}
                            className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-all ${type === 'inprogress' ? 'bg-orange-500 border-orange-500 text-white shadow-lg scale-105' : 'bg-white border-orange-200 text-orange-600 hover:bg-orange-50'}`}
                        >
                            <span className="text-[10px]">⏳</span>
                            <span className="text-[10px] font-black">거래중</span>
                        </Link>

                        <Link
                            href={type === 'completed' ? '/admin/orders' : '/admin/orders?type=completed'}
                            className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-all ${type === 'completed' ? 'bg-blue-600 border-blue-600 text-white shadow-lg scale-105' : 'bg-white border-blue-200 text-blue-600 hover:bg-blue-50'}`}
                        >
                            <span className="text-[10px]">✅</span>
                            <span className="text-[10px] font-black">거래완료</span>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Statistics Dashboard Section */}
            {selectedPartner && stats && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
                    {/* Monthly Sales Card */}
                    <div className="lg:col-span-1 bg-[#d9361b] rounded-2xl p-6 shadow-lg text-white relative overflow-hidden flex flex-col justify-center">
                        <div className="relative z-10">
                            <p className="text-xs font-bold opacity-80 mb-1 uppercase tracking-wider">{stats.month}월 총 매입액 (VAT 포함)</p>
                            <h2 className="text-3xl font-black mb-3">₩ {stats.totalSales.toLocaleString()}</h2>
                            <div className="flex items-center gap-2 text-xs">
                                <span className="bg-white/20 px-2 py-0.5 rounded-full font-bold">주문 {stats.orderCount}건</span>
                            </div>
                        </div>
                        <div className="absolute -right-8 -bottom-8 text-white/10 text-9xl font-black italic">
                            {stats.month}
                        </div>
                    </div>

                    {/* Product Quantity Table Card */}
                    <div className="lg:col-span-3 bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col min-h-[200px]">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
                                <span className="w-1.5 h-4 bg-[#d9361b] rounded-full"></span>
                                품목별 매입 현황 ({stats.month}월)
                            </h3>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setStatSortType('quantity')}
                                    className={`text-[10px] px-2 py-1 rounded-md font-bold transition-all ${statSortType === 'quantity' ? 'bg-[#d9361b] text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                                >
                                    수량순
                                </button>
                                <button
                                    onClick={() => setStatSortType('total')}
                                    className={`text-[10px] px-2 py-1 rounded-md font-bold transition-all ${statSortType === 'total' ? 'bg-[#d9361b] text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                                >
                                    금액순
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto max-h-[300px] scrollbar-hide">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 bg-white z-10 text-[10px] uppercase text-gray-400 font-black border-b border-gray-100">
                                    <tr>
                                        <th className="py-2 px-2 w-10 text-center">No.</th>
                                        <th className="py-2 px-2">상품정보</th>
                                        <th className="py-2 text-center">수량</th>
                                        <th className="py-2 text-right pr-2">금액 (공급가)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {stats.products.length > 0 ? (
                                        stats.products.map((product, i) => (
                                            <tr key={i} className="group even:bg-gray-100/70 hover:bg-gray-200/50 transition-colors">
                                                <td className="py-2 px-2 text-center">
                                                    <span className="text-[10px] font-bold text-gray-400">{i + 1}</span>
                                                </td>
                                                <td className="py-2 px-2 flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded border border-gray-100 overflow-hidden shrink-0 bg-gray-50 flex items-center justify-center">
                                                        {product.image ? (
                                                            <img src={product.image} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="text-[6px] text-gray-300">N/A</span>
                                                        )}
                                                    </div>
                                                    <span className="text-[11px] font-bold text-gray-800 truncate max-w-[200px]" title={product.name}>
                                                        {product.name}
                                                    </span>
                                                </td>
                                                <td className="py-2 text-center">
                                                    <span className="text-[11px] font-black text-gray-900">{product.quantity.toLocaleString()}</span>
                                                </td>
                                                <td className="py-2 text-right pr-2">
                                                    <span className="text-[11px] font-black text-gray-900">{product.total.toLocaleString()} 원</span>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={3} className="py-10 text-center text-gray-300 text-xs italic">
                                                데이터가 없습니다.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                {stats.products.length > 0 && (
                                    <tfoot className="sticky bottom-0 bg-gray-100/80 backdrop-blur-sm border-t border-gray-200">
                                        <tr className="font-black text-gray-900">
                                            <td colSpan={2} className="py-2 px-4 text-[11px]">총 합계</td>
                                            <td className="py-2 text-center text-[11px]">
                                                {stats.products.reduce((acc, p) => acc + p.quantity, 0).toLocaleString()}
                                            </td>
                                            <td className="py-2 text-right pr-2 text-[11px]">
                                                {stats.products.reduce((acc, p) => acc + p.total, 0).toLocaleString()} 원
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                </div>
            )}



            <div className="space-y-4">
                {filteredOrders.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-100">
                        <p className="text-gray-400 font-medium">검색 결과가 없습니다.</p>
                        {(type || selectedPartner) && (
                            <button onClick={() => { setSelectedPartner(null); history.pushState({}, '', '/admin/orders'); }} className="text-[#d9361b] font-bold mt-2 inline-block hover:underline">
                                모든 주문 보기
                            </button>
                        )}
                    </div>
                ) : (
                    filteredOrders.map((order, idx) => (
                        <div key={order.id}>
                            <AdminOrderCard order={order} />
                            {idx < filteredOrders.length - 1 && (
                                <div className="py-2 flex items-center gap-4 px-10 mb-8 overflow-hidden opacity-80">
                                    <div className="flex-1 h-[1.5px] bg-gradient-to-r from-transparent via-red-200 to-transparent" />
                                    <div className="text-[10px] font-black text-[#e43f29] uppercase tracking-widest whitespace-nowrap">NEXT ORDER</div>
                                    <div className="flex-1 h-[1.5px] bg-gradient-to-r from-transparent via-red-200 to-transparent" />
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
