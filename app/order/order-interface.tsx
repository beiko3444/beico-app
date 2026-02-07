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
        <div className="space-y-8">
            <div className="glass-panel p-6 rounded-2xl bg-white shadow-sm border border-gray-100">
                <div className="space-y-4">
                    {products.map((product, index) => {
                        const currentQty = quantities[product.id] || 0;
                        return (
                            <div key={product.id} className="flex items-center bg-white border border-gray-100 rounded-2xl p-2 hover:shadow-md transition-all duration-300 group relative">
                                <div className="text-xl font-black text-gray-300 pl-4 w-8 text-center tabular-nums">{index + 1}</div>
                                {/* Product Image */}
                                <div className="w-[60px] h-[60px] flex-shrink-0 bg-white relative overflow-hidden flex items-center justify-center p-1 rounded-xl border border-gray-50">
                                    {product.imageUrl ? (
                                        <img src={product.imageUrl} alt={product.name} className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-500" />
                                    ) : (
                                        <div className="text-gray-300 text-[9px]">No Image</div>
                                    )}
                                    {product.stock <= 0 && (
                                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center rounded-xl">
                                            <span className="text-white font-bold bg-black/60 px-1.5 py-0.5 rounded-full text-[9px]">품절</span>
                                        </div>
                                    )}
                                </div>

                                {/* Product Info Section */}
                                <div className="flex-1 ml-4 min-w-0 pr-4">
                                    <h3 className="font-bold text-gray-900 group-hover:text-[var(--color-brand-blue)] transition-colors text-sm truncate">
                                        {product.name}
                                    </h3>
                                    {product.nameJP && (
                                        <p className="text-[10px] text-gray-400 font-medium leading-tight mt-0.5 break-words">
                                            {product.nameJP}
                                        </p>
                                    )}
                                </div>

                                {/* Product ID Section - Aligned Column */}
                                <div className="w-[100px] px-4 border-l border-gray-50 flex flex-col justify-center">
                                    <span className="text-[9px] text-gray-300 font-black uppercase tracking-widest mb-0.5">Product ID</span>
                                    <span className="text-[10px] font-bold text-gray-500 font-mono italic">
                                        {product.productCode || '-'}
                                    </span>
                                </div>

                                {/* Barcode Section - Aligned Column */}
                                <div className="w-[110px] px-4 border-l border-gray-50 flex flex-col items-center justify-center shrink-0">
                                    {product.barcode ? (
                                        <>
                                            <div className="h-[14px] flex items-center overflow-hidden opacity-70">
                                                <Barcode
                                                    value={product.barcode}
                                                    width={0.6}
                                                    height={14}
                                                    fontSize={10}
                                                    displayValue={false}
                                                    margin={0}
                                                />
                                            </div>
                                            <p className="text-[10px] text-gray-400 font-mono tracking-tighter mt-1">
                                                {product.barcode}
                                            </p>
                                        </>
                                    ) : (
                                        <span className="text-[10px] text-gray-300">-</span>
                                    )}
                                </div>

                                {/* Price & Stock */}
                                <div className="px-4 text-right border-l border-gray-100 min-w-[140px] flex flex-col justify-center h-[60px]">
                                    <div className="text-sm font-bold text-[var(--color-brand-blue)]">
                                        {product.sellPrice.toLocaleString()} <span className="text-[9px] font-normal text-gray-500">KRW</span>
                                    </div>
                                    <div className={`text-[10px] mt-0.5 ${product.stock < 5 ? 'text-orange-500 font-bold' : 'text-gray-500'}`}>
                                        재고: {product.stock.toLocaleString()}
                                    </div>
                                    <div className="text-[9px] mt-0.5 text-orange-600 font-bold bg-orange-50 px-1.5 py-0.5 rounded-full inline-block self-end">
                                        최소: {product.minOrderQuantity || 1}
                                    </div>
                                </div>

                                {/* Order Control */}
                                <div className="w-[120px] pl-4 flex-shrink-0">
                                    <div className="flex items-center bg-gray-50 rounded-lg p-0.5 border border-gray-100">
                                        <button
                                            onClick={() => handleQuantityChange(product.id, Math.max(0, currentQty - 1))}
                                            className="w-8 h-8 flex items-center justify-center hover:bg-white hover:text-[var(--color-brand-blue)] hover:shadow-sm rounded-md transition-all text-gray-400 font-bold text-base"
                                        >
                                            -
                                        </button>
                                        <input
                                            type="number"
                                            min="0"
                                            value={currentQty === 0 ? '' : currentQty}
                                            onChange={(e) => handleQuantityChange(product.id, e.target.value)}
                                            className="w-full bg-transparent text-center font-bold text-gray-900 text-sm outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            placeholder="0"
                                        />
                                        <button
                                            onClick={() => handleQuantityChange(product.id, currentQty + 1)}
                                            className="w-8 h-8 flex items-center justify-center bg-white text-[var(--color-brand-blue)] shadow-sm rounded-md hover:bg-[var(--color-brand-blue)] hover:text-white transition-all font-bold text-base"
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-100 pt-6 px-6 pb-2 z-20 shadow-[0_15px_40px_-5px_rgba(0,0,0,0.15)]">
                <div className="max-w-4xl mx-auto flex justify-between items-center">
                    <div>
                        <div className="flex flex-col">
                            <p className="text-3xl font-bold text-[var(--color-brand-blue)] tabular-nums">
                                {productTotal.toLocaleString()} <span className="text-lg font-normal text-gray-500">KRW</span>
                            </p>
                            <p className="text-xs text-gray-500 uppercase tracking-wide font-bold">Total Order Amount</p>
                        </div>
                    </div>

                    {hasItems && (
                        <button
                            onClick={handleOrderNow}
                            className="bg-[var(--color-brand-blue)] text-white px-8 py-3 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all"
                        >
                            주문하기
                        </button>
                    )}
                </div>
            </div>

            {
                showSummary && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative animate-in zoom-in-95 duration-200">
                            <button
                                onClick={() => setShowSummary(false)}
                                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                            >
                                ✕
                            </button>

                            <h3 className="text-2xl font-bold text-[var(--color-brand-blue)] mb-6">Order Summary</h3>

                            <div className="space-y-4 mb-4 max-h-[30vh] overflow-y-auto">
                                {products.filter(p => (quantities[p.id] || 0) > 0).map(p => (
                                    <div key={p.id} className="flex justify-between text-sm">
                                        <span className="text-gray-600">{p.name} × {quantities[p.id]}</span>
                                        <span className="font-semibold">{(p.sellPrice * quantities[p.id]).toLocaleString()} KRW</span>
                                    </div>
                                ))}
                                {shippingFee > 0 && (
                                    <div className="flex justify-between text-sm border-t border-dashed pt-2">
                                        <span className="text-gray-600 font-bold">📦 배송비 (Shipping Fee)</span>
                                        <span className="font-bold">{shippingFee.toLocaleString()} KRW</span>
                                    </div>
                                )}
                            </div>

                            <div className="border-t pt-4 space-y-2 mb-6">
                                <div className="flex justify-between text-sm text-gray-500">
                                    <span>공급가액 (Supply Total):</span>
                                    <span>{supplyTotal.toLocaleString()} KRW</span>
                                </div>
                                <div className="flex justify-between text-sm text-gray-500">
                                    <span>부가세 (VAT 10%):</span>
                                    <span>{vat.toLocaleString()} KRW</span>
                                </div>
                                <div className="flex justify-between font-bold text-2xl text-[var(--color-brand-blue)] pt-2 border-t-2 border-dashed border-[var(--color-brand-blue)]">
                                    <span>총 합계:</span>
                                    <span>{totalAmount.toLocaleString()} KRW</span>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-xl border border-gray-200 mb-8">
                                <h4 className="text-sm font-semibold text-gray-700 mb-2">Deposit Account Info</h4>
                                <p className="text-xl font-bold text-[var(--color-brand-blue)] mb-1">{BANK_INFO.account}</p>
                                <p className="text-sm text-gray-600">{BANK_INFO.bank} ({BANK_INFO.holder})</p>
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
                                            alert("Order placed successfully!");
                                            setShowSummary(false);
                                            setQuantities({});
                                            window.location.reload(); // Refresh to update stock in UI
                                        } else {
                                            const errorData = await res.json();
                                            alert(`Failed to place order: ${errorData.error || 'Unknown error'}`);
                                        }
                                    } catch (e) {
                                        console.error(e)
                                        alert("An error occurred.");
                                    }
                                }}
                                className="w-full bg-[var(--color-brand-orange)] text-white py-4 rounded-xl font-bold text-lg hover:brightness-110 shadow-lg"
                            >
                                Confirm Order
                            </button>
                        </div>
                    </div>
                )
            }

            {/* Spacer for fixed bottom bar */}
            <div className="h-24"></div>
        </div >
    )
}
