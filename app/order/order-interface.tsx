'use client'

import { useState } from 'react'
import Barcode from 'react-barcode'

type Product = {
    id: string
    name: string
    sellPrice: number
    stock: number
    imageUrl?: string | null
    productCode?: string | null
    barcode?: string | null
    nameJP?: string | null
    minOrderQuantity: number
    appliedGrade?: string
}

// Hardcoded bank info for now as requested
const BANK_INFO = {
    bank: "Shinhan Bank",
    account: "110-123-456789",
    holder: "beiko Inc."
}

export default function OrderInterface({ products }: { products: Product[] }) {
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

    // Shipping: 3000 base + 3000 extra for every 100 items starting from 101
    const shippingFee = totalQuantity > 0 ? Math.ceil(totalQuantity / 100) * 3000 : 0

    const supplyTotal = productTotal + shippingFee
    const vat = Math.round(supplyTotal * 0.1)
    const totalAmount = supplyTotal + vat

    const hasItems = productTotal > 0

    return (
        <div className="pb-32 space-y-4">
            {products.map((product) => {
                const qty = quantities[product.id] || 0
                return (
                    <div key={product.id} className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row gap-6 items-start md:items-center">
                        {/* Image */}
                        <div className="w-24 h-24 bg-gray-50 rounded-2xl flex-shrink-0 p-2 flex items-center justify-center">
                            {product.imageUrl ? (
                                <img src={product.imageUrl} alt={product.name} className="max-h-full max-w-full object-contain mix-blend-multiply" />
                            ) : (
                                <div className="text-xs text-gray-300">No Image</div>
                            )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-bold text-gray-900 leading-tight">
                                {product.nameJP || product.name}
                            </h3>
                            <p className="text-sm text-gray-500 mt-0.5 font-medium">
                                {product.name}
                            </p>
                            <div className="flex flex-col gap-1 mt-2.5">
                                <p className="text-[10px] text-gray-400 font-mono tracking-wide">
                                    SKU: <span className="text-gray-500">{product.productCode || '-'}</span>
                                </p>
                                {product.barcode && (
                                    <div className="flex items-center gap-2">
                                        <div className="opacity-40 grayscale">
                                            <Barcode value={product.barcode} width={1} height={15} displayValue={false} margin={0} background="transparent" />
                                        </div>
                                        <span className="text-[10px] text-gray-400 font-mono">{product.barcode}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Price & Stock */}
                        <div className="text-right min-w-[120px] pt-2 md:pt-0">
                            <p className="text-2xl font-bold text-gray-900 tabular-nums tracking-tight">
                                {product.sellPrice.toLocaleString()}円
                            </p>
                            <p className="text-xs text-gray-400 mt-1 font-medium">
                                在庫: {product.stock.toLocaleString()}
                            </p>
                        </div>

                        {/* Quantity Control */}
                        <div className="flex items-center border border-gray-200 rounded-full h-12 w-[140px] px-1 bg-white shadow-sm">
                            <button
                                onClick={() => handleQuantityChange(product.id, Math.max(0, qty - 1))}
                                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <span className="text-2xl leading-none mb-1">-</span>
                            </button>
                            <input
                                type="number"
                                value={qty === 0 ? '' : qty}
                                onChange={(e) => handleQuantityChange(product.id, e.target.value)}
                                className="flex-1 text-center font-bold text-gray-900 outline-none bg-transparent"
                                placeholder="0"
                            />
                            <button
                                onClick={() => handleQuantityChange(product.id, qty + 1)}
                                className="w-10 h-10 flex items-center justify-center text-[#e34219] hover:text-[#c03512] transition-colors"
                            >
                                <span className="text-2xl leading-none mb-1">+</span>
                            </button>
                        </div>
                    </div>
                )
            })}

            {/* Shipping Card */}
            <div className="bg-white rounded-[24px] p-6 shadow-sm border-2 border-dashed border-gray-200 flex items-center gap-6 mt-4">
                <div className="w-24 h-24 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-300">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="1" y="3" width="15" height="13"></rect>
                        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                        <circle cx="5.5" cy="18.5" r="2.5"></circle>
                        <circle cx="18.5" cy="18.5" r="2.5"></circle>
                    </svg>
                </div>
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900">配送料</h3>
                    <p className="text-sm text-gray-500 font-medium">Shipping Fee</p>
                </div>
                <div className="text-right">
                    {shippingFee > 0 ? (
                        <p className="text-xl font-bold text-gray-900 tabular-nums">{shippingFee.toLocaleString()}円</p>
                    ) : (
                        <p className="text-sm text-gray-400">배송비 별도 / Extra</p>
                    )}
                </div>
            </div>

            {/* Sticky Footer */}
            <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-gray-200 p-4 md:px-8 md:py-6 z-50 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-end items-center gap-4 md:gap-12">
                    <div className="text-right flex flex-col items-end">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total (Excl. Tax)</p>
                        <p className="text-4xl font-black text-[#111827] leading-none">
                            合計 {productTotal.toLocaleString()}円 <span className="text-sm font-bold text-gray-500 ml-1">(税別)</span>
                        </p>
                    </div>

                    {hasItems && (
                        <button
                            onClick={handleOrderNow}
                            className="bg-[#e34219] hover:bg-[#c03512] text-white pl-8 pr-6 py-4 rounded-full font-bold text-lg shadow-lg shadow-orange-200/50 hover:shadow-orange-200 transition-all flex items-center gap-3 active:scale-[0.98] w-full md:w-auto justify-center group"
                        >
                            <div className="flex flex-col items-start leading-none">
                                <span>今すぐ注文する</span>
                                <span className="text-[9px] opacity-80 font-medium tracking-widest mt-1">ORDER NOW</span>
                            </div>
                            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center group-hover:translate-x-1 transition-transform">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                </svg>
                            </div>
                        </button>
                    )}
                </div>
            </div>

            {showSummary && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[32px] shadow-2xl max-w-md w-full p-8 relative animate-in zoom-in-95 duration-200 overflow-hidden">
                        <button
                            onClick={() => setShowSummary(false)}
                            className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                        >
                            ✕
                        </button>

                        <h3 className="text-2xl font-black text-gray-900 mb-2">注文内容の確認</h3>
                        <p className="text-xs text-gray-500 mb-8 font-medium">Order Summary</p>

                        <div className="space-y-4 mb-6 max-h-[40vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-200">
                            {products.filter(p => (quantities[p.id] || 0) > 0).map(p => (
                                <div key={p.id} className="flex justify-between items-center py-2 border-b border-gray-50">
                                    <div>
                                        <p className="text-sm font-bold text-gray-800">{p.nameJP || p.name}</p>
                                        <p className="text-[10px] text-gray-400 mt-0.5">{p.name} × {quantities[p.id]}</p>
                                    </div>
                                    <span className="font-bold text-gray-900">{(p.sellPrice * quantities[p.id]).toLocaleString()}円</span>
                                </div>
                            ))}
                            {shippingFee > 0 && (
                                <div className="flex justify-between items-center py-2 border-t border-dashed border-gray-200 mt-2">
                                    <span className="text-sm font-bold text-gray-600">配送料 (Shipping)</span>
                                    <span className="font-bold text-gray-900">{shippingFee.toLocaleString()}円</span>
                                </div>
                            )}
                        </div>

                        <div className="bg-gray-50 rounded-2xl p-6 space-y-3 mb-8">
                            <div className="flex justify-between text-sm text-gray-500 font-medium">
                                <span>供給価額 (Supply)</span>
                                <span>{supplyTotal.toLocaleString()}円</span>
                            </div>
                            <div className="flex justify-between text-sm text-gray-500 font-medium">
                                <span>消費税 (10%)</span>
                                <span>{vat.toLocaleString()}円</span>
                            </div>
                            <div className="flex justify-between items-baseline pt-4 border-t border-gray-200 mt-2">
                                <span className="font-bold text-lg text-gray-900">合計金額</span>
                                <span className="text-3xl font-black text-[#e34219]">{totalAmount.toLocaleString()}円</span>
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
                                        window.location.reload();
                                    } else {
                                        const errorData = await res.json();
                                        alert(`Order Failed: ${errorData.error}`);
                                    }
                                } catch (e) {
                                    console.error(e)
                                    alert("Error occurred.");
                                }
                            }}
                            className="w-full bg-[#111827] text-white py-4 rounded-xl font-bold text-lg hover:bg-black transition-colors shadow-xl"
                        >
                            注文を確定する
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
