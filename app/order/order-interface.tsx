'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import BarcodeDisplay from '@/components/BarcodeDisplay'
import { Minus, Plus, ArrowRight } from 'lucide-react'

type Product = {
    id: string
    name: string
    sellPrice: number
    stock: number
    imageUrl?: string | null
    productCode?: string | null
    barcode?: string | null
    nameJP?: string | null
    nameEN?: string | null
    minOrderQuantity: number
    appliedGrade?: string
    onlinePrice: number
    jpBuyPrice: number
    jpSellPrice: number
    krBuyPrice: number
    krSellPrice: number
    usBuyPrice: number
    usSellPrice: number
    country?: string | null
}

// Hardcoded bank info for now as requested
const BANK_INFO = {
    bank: "Shinhan Bank",
    account: "110-123-456789",
    holder: "beiko Inc."
}

export default function OrderInterface({ products }: { products: Product[] }) {
    const router = useRouter()
    const [quantities, setQuantities] = useState<Record<string, number>>({})
    const [showSummary, setShowSummary] = useState(false)

    const handleQuantityChange = (productId: string, value: string | number) => {
        const qty = typeof value === 'string' ? parseInt(value) || 0 : value
        const product = products.find(p => p.id === productId)
        if (!product) return

        if (qty > (product.stock || 0)) {
            alert(`Cannot order more than available stock (${product.stock || 0})`)
            setQuantities(prev => ({
                ...prev,
                [productId]: product.stock || 0
            }))
            return
        }

        setQuantities(prev => ({
            ...prev,
            [productId]: qty < 0 ? 0 : qty
        }))
    }

    const handleOrderNow = () => {
        const violations = products
            .filter(p => {
                const qty = quantities[p.id] || 0;
                return qty > 0 && qty < (p.minOrderQuantity || 1);
            })
            .map(p => `- ${p.name}: 주문 ${quantities[p.id]}개 / 최소 ${p.minOrderQuantity}개`);

        if (violations.length > 0) {
            alert(`최소 주문 수량이 미달된 상품이 있습니다:\n\n${violations.join('\n')}\n\n최소 주문 수량 이상으로 주문해 주세요.`);
            return;
        }
        setShowSummary(true);
    };

    const productTotal = products.reduce((sum, p) => {
        return sum + (p.sellPrice * (quantities[p.id] || 0))
    }, 0)

    const totalQuantity = Object.values(quantities).reduce((sum, q) => sum + q, 0)
    const userCountry = products[0]?.country
    const currencySymbol = userCountry === 'Korea' ? '₩' : userCountry === 'Japan' ? '¥' : '$'
    const isUSD = userCountry !== 'Korea' && userCountry !== 'Japan'

    // Shipping: 3000 base + 3000 extra for every 100 items starting from 101
    // Disabled for US pricing users as requested
    const shippingFee = (totalQuantity > 0 && !isUSD) ? Math.ceil(totalQuantity / 100) * 3000 : 0

    const supplyTotal = productTotal + shippingFee
    const vat = isUSD ? 0 : Math.round(supplyTotal * 0.1)
    const totalAmount = supplyTotal + vat

    const hasItems = productTotal > 0


    return (
        <div className="pb-32 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {products.map((product, index) => {
                    const qty = quantities[product.id] || 0
                    const displayRetail = product.country === 'Korea' ? product.krSellPrice : product.country === 'Japan' ? product.jpSellPrice : product.usSellPrice;
                    const displayWholesale = product.country === 'Korea' ? product.krBuyPrice : product.country === 'Japan' ? product.jpBuyPrice : product.usBuyPrice;
                    const marginPercent = displayRetail > 0 ? ((displayRetail - displayWholesale) / displayRetail * 100).toFixed(1) : 0;

                    return (
                        <div key={product.id} className="bg-white dark:bg-[#1e1e1e] rounded-lg overflow-hidden shadow-lg shadow-gray-300/50 dark:shadow-none border border-gray-100 dark:border-[#2a2a2a] flex flex-col h-full transition-all duration-300 relative">
                            {/* Product Index Number */}
                            <div className="absolute top-2 left-3 text-[10px] font-bold text-gray-600 dark:text-gray-400 font-inter">
                                {String(index + 1).padStart(3, '0')}
                            </div>
                            <div className="px-8 pt-8 flex-1">
                                <div className="flex gap-6 mb-6">
                                    {/* Image Container */}
                                    <div className="w-[120px] h-[120px] bg-[#f1f3f5] dark:bg-[#2a2a2a] rounded-xl flex-shrink-0 p-1 flex items-center justify-center relative overflow-hidden">
                                        {product.imageUrl ? (
                                            <img src={product.imageUrl} alt={product.name} className="max-h-full max-w-full object-contain mix-blend-multiply transition-transform group-hover:scale-110" />
                                        ) : (
                                            <div className="text-xs text-gray-300 dark:text-gray-500 font-bold uppercase tracking-widest">No Image</div>
                                        )}
                                        {product.stock <= 0 && (
                                            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
                                                <span className="bg-white/90 text-black px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase">売り切れ</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Header Info */}
                                    <div className="min-w-0 flex-1 pt-1 space-y-1">
                                        <h3 className="text-lg font-black text-black dark:text-white leading-tight truncate tracking-tight">
                                            {product.nameJP || product.name}
                                        </h3>
                                        <p className="text-[13px] font-medium text-black dark:text-white uppercase tracking-normal truncate">
                                            {product.nameEN || product.name}
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-bold text-black dark:text-white uppercase tracking-normal">Product Code:</span>
                                            <span className="text-[11px] font-medium text-black dark:text-white uppercase tracking-tighter font-inter">{product.productCode || '-'}</span>
                                        </div>

                                        {/* Barcode Section with Download Buttons */}
                                        {product.barcode ? (
                                            <div className="pt-0.5">
                                                <BarcodeDisplay
                                                    value={product.barcode}
                                                    width={0.8}
                                                    height={24}
                                                    displayValue={false}
                                                    containerClassName="gap-3 mb-1"
                                                    buttonClassName="px-2 py-0.5 bg-gray-50 dark:bg-[#1a1a1a] text-[9px] font-medium text-gray-400 dark:text-gray-500 rounded-md hover:bg-[#e34219] hover:text-white hover:border-[#e34219] border border-gray-200 dark:border-[#2a2a2a] transition-all uppercase"
                                                />
                                                <p className="text-[10px] font-medium text-black dark:text-white font-inter mt-1 tracking-widest">{product.barcode}</p>
                                            </div>
                                        ) : (
                                            <div className="pt-0.5">
                                                <span className="text-[9px] font-bold text-gray-300 dark:text-gray-500 uppercase tracking-widest">No Barcode</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Info Grid - Conditional Display by Country */}
                                <div className="bg-[#f1f3f5] dark:bg-[#2a2a2a] rounded-md overflow-hidden mb-4 border border-gray-300 dark:border-[#3a3a3a] dark:border-[#3a3a3a]">
                                    {/* US Pricing - Shown for "Other" countries or non-Korea/Japan */}
                                    {(!product.country || (product.country !== 'Korea' && product.country !== 'Japan')) && (
                                        <div className="grid grid-cols-2 border-b border-gray-300 dark:border-[#3a3a3a]">
                                            <div className="py-1.5 px-4 border-r border-gray-300 dark:border-[#3a3a3a]">
                                                <div className="flex flex-col mb-0.5">
                                                    <span className="text-[11px] font-black text-black dark:text-white leading-tight">卸売価格 米国</span>
                                                    <span className="text-[8px] font-bold text-black dark:text-white uppercase tracking-widest leading-none">wholesale US</span>
                                                </div>
                                                <p className="text-[22px] font-medium text-gray-900 dark:text-white leading-none tabular-nums font-inter tracking-tighter text-right">
                                                    <span className="text-[0.85em] mr-0.5">$</span>{product.usBuyPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </p>
                                            </div>
                                            <div className="py-1.5 px-4">
                                                <div className="flex flex-col mb-0.5">
                                                    <span className="text-[11px] font-black text-black dark:text-white leading-tight">小売価格 米国</span>
                                                    <span className="text-[8px] font-bold text-black dark:text-white uppercase tracking-widest leading-none">Retail Price US</span>
                                                </div>
                                                <p className="text-[22px] font-medium text-gray-900 dark:text-white leading-none tabular-nums font-inter tracking-tighter text-right">
                                                    <span className="text-[0.85em] mr-0.5">$</span>{product.usSellPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* JP Pricing - Shown only for JP users */}
                                    {product.country === 'Japan' && (
                                        <div className="grid grid-cols-2 border-b border-gray-300 dark:border-[#3a3a3a]">
                                            <div className="py-1.5 px-4 border-r border-gray-300 dark:border-[#3a3a3a]">
                                                <div className="flex flex-col mb-0.5">
                                                    <span className="text-[11px] font-black text-black dark:text-white leading-tight">卸売価格 日本</span>
                                                    <span className="text-[8px] font-bold text-black dark:text-white uppercase tracking-widest leading-none">wholesale JP</span>
                                                </div>
                                                <p className="text-[22px] font-medium text-gray-900 dark:text-white leading-none tabular-nums font-inter tracking-tighter text-right">
                                                    <span className="text-[0.85em] mr-0.5">¥</span>{product.jpBuyPrice.toLocaleString()}
                                                </p>
                                            </div>
                                            <div className="py-1.5 px-4">
                                                <div className="flex flex-col mb-0.5">
                                                    <span className="text-[11px] font-black text-black dark:text-white leading-tight">小売価格 日本</span>
                                                    <span className="text-[8px] font-bold text-black dark:text-white uppercase tracking-widest leading-none">Retail Price JP</span>
                                                </div>
                                                <p className="text-[22px] font-medium text-gray-900 dark:text-white leading-none tabular-nums font-inter tracking-tighter text-right">
                                                    <span className="text-[0.85em] mr-0.5">¥</span>{product.jpSellPrice.toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* KR Pricing - Shown only for KR users */}
                                    {product.country === 'Korea' && (
                                        <div className="grid grid-cols-2 border-b border-gray-300 dark:border-[#3a3a3a]">
                                            <div className="py-1.5 px-4 border-r border-gray-300 dark:border-[#3a3a3a]">
                                                <div className="flex flex-col mb-0.5">
                                                    <span className="text-[11px] font-black text-black dark:text-white leading-tight">卸売価格 韓国</span>
                                                    <span className="text-[8px] font-bold text-black dark:text-white uppercase tracking-widest leading-none">wholesale KR</span>
                                                </div>
                                                <p className="text-[22px] font-medium text-gray-900 dark:text-white leading-none tabular-nums font-inter tracking-tighter text-right">
                                                    <span className="text-[0.7em] mr-0.5">₩</span>{product.krBuyPrice.toLocaleString()}
                                                </p>
                                            </div>
                                            <div className="py-1.5 px-4">
                                                <div className="flex flex-col mb-0.5">
                                                    <span className="text-[11px] font-black text-black dark:text-white leading-tight">小売가격 韓国</span>
                                                    <span className="text-[8px] font-bold text-black dark:text-white uppercase tracking-widest leading-none">Retail Price KR</span>
                                                </div>
                                                <p className="text-[22px] font-medium text-gray-900 dark:text-white leading-none tabular-nums font-inter tracking-tighter text-right">
                                                    <span className="text-[0.7em] mr-0.5">₩</span>{product.krSellPrice.toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Stock & Margin */}
                                    <div className="grid grid-cols-2">
                                        <div className="py-1.5 px-4 border-r border-gray-300 dark:border-[#3a3a3a]">
                                            <div className="flex flex-col mb-0.5">
                                                <span className="text-[11px] font-black text-black dark:text-white leading-tight">在庫</span>
                                                <span className="text-[8px] font-bold text-black dark:text-white uppercase tracking-widest leading-none">Stock</span>
                                            </div>
                                            <p className={`text-[22px] font-medium leading-none tabular-nums font-inter tracking-tighter text-right ${product.stock <= 0 ? 'text-[#e34219]' : 'text-gray-900 dark:text-white'}`}>
                                                {product.stock.toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="py-1.5 px-4">
                                            <div className="flex flex-col mb-0.5">
                                                <span className="text-[11px] font-black text-black dark:text-white leading-tight">マージン</span>
                                                <span className="text-[8px] font-bold text-black dark:text-white uppercase tracking-widest leading-none">Margin%</span>
                                            </div>
                                            <p className="text-[22px] font-medium text-[#e34219] leading-none tabular-nums font-inter tracking-tighter text-right">
                                                {marginPercent}%
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Order Control Area */}
                            <div className="px-8 pb-8 flex items-center justify-between gap-6 pt-0">
                                <div className="flex flex-col">
                                    <span className="text-[11px] font-black text-[#e34219] uppercase tracking-widest leading-tight">最小注文数量</span>
                                    <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-none mt-1">Min Order: {product.minOrderQuantity}ea</span>
                                </div>

                                {product.stock > 0 ? (
                                    <div className="flex flex-col items-end gap-2">
                                        <div className={`flex items-center border rounded-md overflow-hidden shadow-sm dark:shadow-none transition-all duration-300 ${qty === 0
                                            ? 'bg-white dark:bg-[#1e1e1e] border-gray-200 dark:border-[#2a2a2a]'
                                            : qty < product.minOrderQuantity
                                                ? 'bg-[#fff5f5] dark:bg-[#2a1a1a] border-[#e34219]'
                                                : 'bg-blue-50 dark:bg-[#1a1a2a] border-blue-600'
                                            }`}>
                                            <button
                                                onClick={() => handleQuantityChange(product.id, Math.max(0, qty - 1))}
                                                className={`w-9 h-9 flex items-center justify-center transition-colors ${qty === 0
                                                    ? 'text-black dark:text-white hover:bg-gray-50 dark:hover:bg-[#252525]'
                                                    : qty < product.minOrderQuantity
                                                        ? 'text-[#e34219] hover:bg-[#ffebeb] dark:hover:bg-[#3a1a1a]'
                                                        : 'text-blue-600 hover:bg-blue-100 dark:hover:bg-[#1a1a3a]'
                                                    }`}
                                            >
                                                <Minus size={14} strokeWidth={2.5} />
                                            </button>
                                            <input
                                                type="text"
                                                value={qty.toLocaleString()}
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/,/g, '')
                                                    if (/^\d*$/.test(val)) {
                                                        handleQuantityChange(product.id, val)
                                                    }
                                                }}
                                                className={`w-16 h-9 text-center font-bold text-lg bg-transparent outline-none font-inter ${qty === 0
                                                    ? 'text-[#1e293b] dark:text-white'
                                                    : qty < product.minOrderQuantity
                                                        ? 'text-[#e34219]'
                                                        : 'text-blue-600'
                                                    }`}
                                            />
                                            <button
                                                onClick={() => handleQuantityChange(product.id, qty + 1)}
                                                className={`w-9 h-9 flex items-center justify-center transition-colors ${qty === 0
                                                    ? 'text-black dark:text-white hover:bg-gray-50 dark:hover:bg-[#252525]'
                                                    : qty < product.minOrderQuantity
                                                        ? 'text-[#e34219] hover:bg-[#ffebeb] dark:hover:bg-[#3a1a1a]'
                                                        : 'text-blue-600 hover:bg-blue-100 dark:hover:bg-[#1a1a3a]'
                                                    }`}
                                            >
                                                <Plus size={14} strokeWidth={2.5} />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center text-[13px] font-bold text-[#e34219] bg-[#fff5f5] dark:bg-[#2a1a1a] px-4 py-2 rounded-lg border border-red-100 dark:border-[#3a2a2a]">
                                        こちらの商品は品切れとなりました。
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Sticky Footer */}
            {hasItems && (
                <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-[#1e1e1e]/95 backdrop-blur-xl border-t border-gray-200 dark:border-[#2a2a2a] p-4 md:px-8 md:py-6 z-50 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] dark:shadow-none animate-in slide-in-from-bottom duration-300">
                    <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-end items-end md:items-center gap-4 md:gap-12">
                        <div className="text-right flex flex-col items-end">
                            <div className="flex flex-col items-end mb-1 text-gray-400 dark:text-gray-500 gap-0.5">
                                <span className="text-[10px] font-black leading-tight">合計金額 (税抜)</span>
                                <span className="text-[8px] font-bold uppercase tracking-widest leading-none">Total (Excl. Tax)</span>
                            </div>
                            <p className="text-4xl font-medium text-[#111827] dark:text-white leading-none font-inter tracking-tighter">
                                <span className="text-[0.5em] mr-1">{currencySymbol}</span>{productTotal.toLocaleString(undefined, isUSD ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : {})}
                            </p>
                        </div>

                        <button
                            onClick={handleOrderNow}
                            className="h-14 px-10 bg-[#e34219] hover:bg-[#d03a15] text-white rounded-lg shadow-[0_4px_14px_0_rgba(227,66,25,0.12)] hover:shadow-[0_6px_20px_0_rgba(227,66,25,0.18)] transition-all active:scale-[0.98] flex items-center justify-end md:justify-center gap-3 font-bold text-[15px] tracking-wide group w-full md:w-auto"
                        >
                            <div className="flex flex-col items-end md:items-start leading-none">
                                <span className="text-lg">今すぐ注文する</span>
                                <span className="text-[9px] opacity-70 font-bold tracking-[0.2em] -mt-0.5">ORDER NOW</span>
                            </div>
                            <ArrowRight size={20} strokeWidth={2.5} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </div>
            )}

            {
                showSummary && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-[#1e1e1e] rounded-[32px] shadow-2xl dark:shadow-none max-w-md w-full p-8 relative animate-in zoom-in-95 duration-200 overflow-hidden">
                            <button
                                onClick={() => setShowSummary(false)}
                                className="absolute top-6 right-6 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-[#2a2a2a] transition-colors"
                            >
                                ✕
                            </button>

                            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">注文内容の確認</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-8 font-medium uppercase tracking-widest">Order Summary</p>

                            <div className="space-y-4 mb-6 max-h-[40vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
                                {products.filter(p => (quantities[p.id] || 0) > 0).map(p => (
                                    <div key={p.id} className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-[#2a2a2a]">
                                        <div>
                                            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{p.nameJP || p.name}</p>
                                            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                                                {p.nameEN && <span className="mr-1">{p.nameEN}</span>}
                                                <span>× {quantities[p.id]}</span>
                                            </p>
                                        </div>
                                        <span className="font-bold text-gray-900 dark:text-white"><span className="text-[0.7em] mr-0.5">{currencySymbol}</span>{(p.sellPrice * quantities[p.id]).toLocaleString(undefined, isUSD ? { minimumFractionDigits: 2 } : {})}</span>
                                    </div>
                                ))}
                                {shippingFee > 0 && (
                                    <div className="flex justify-between items-center py-2 border-t border-dashed border-gray-200 dark:border-[#2a2a2a] mt-2">
                                        <span className="text-sm font-bold text-gray-600 dark:text-gray-400">配送料 (Shipping)</span>
                                        <span className="font-bold text-gray-900 dark:text-white"><span className="text-[0.7em] mr-0.5">{currencySymbol}</span>{shippingFee.toLocaleString(undefined, isUSD ? { minimumFractionDigits: 2 } : {})}</span>
                                    </div>
                                )}
                            </div>

                            <div className="bg-gray-50 dark:bg-[#1a1a1a] rounded-2xl p-6 space-y-3 mb-8">
                                <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 font-medium">
                                    <span>供給価額 (Supply)</span>
                                    <span><span className="text-[0.8em] mr-0.5">{currencySymbol}</span>{supplyTotal.toLocaleString(undefined, isUSD ? { minimumFractionDigits: 2 } : {})}</span>
                                </div>
                                {!isUSD && (
                                    <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 font-medium">
                                        <span>消費税 (10%)</span>
                                        <span><span className="text-[0.8em] mr-0.5">{currencySymbol}</span>{vat.toLocaleString()}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-baseline pt-4 border-t border-gray-200 dark:border-[#2a2a2a] mt-2">
                                    <span className="font-bold text-lg text-gray-900 dark:text-white">合計金額</span>
                                    <span className="text-3xl font-black text-[#e34219]"><span className="text-[0.5em] mr-1">{currencySymbol}</span>{totalAmount.toLocaleString(undefined, isUSD ? { minimumFractionDigits: 2 } : {})}</span>
                                </div>
                            </div>

                            <button
                                onClick={async () => {
                                    try {
                                        const items = products
                                            .filter(p => (quantities[p.id] || 0) > 0)
                                            .map(p => ({
                                                productId: p.id,
                                                quantity: quantities[p.id],
                                                price: p.sellPrice
                                            }))

                                        const res = await fetch('/api/orders', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ items, total: totalAmount })
                                        })

                                        if (res.ok) {
                                            alert("ご注文ありがとうございます！\nThank you for your order!");
                                            setShowSummary(false);
                                            setQuantities({});
                                            router.push('/order/history');
                                        } else {
                                            const errorData = await res.json();
                                            alert(`Order Failed: ${errorData.error}`);
                                        }
                                    } catch (e) {
                                        console.error(e)
                                        alert("Error occurred.");
                                    }
                                }}
                                className="w-full bg-[#111827] dark:bg-white text-white dark:text-[#111827] py-4 rounded-xl font-bold text-lg hover:bg-black dark:hover:bg-gray-200 transition-colors shadow-xl dark:shadow-none"
                            >
                                注文を確定する
                            </button>
                        </div>
                    </div>
                )}
        </div>
    )
}
