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
        <div className="space-y-8">
            <div className="glass-panel p-2 md:p-6 rounded-2xl bg-white shadow-sm border border-gray-100">
                <div className="space-y-3 md:space-y-4">
                    {products.map((product, index) => {
                        const currentQty = quantities[product.id] || 0;
                        return (
                            <div key={product.id} className="flex flex-col md:flex-row md:items-center bg-white border border-gray-100 rounded-2xl p-3 md:p-2 hover:shadow-md transition-all duration-300 group relative gap-3 md:gap-0">
                                {/* Index - Hidden on mobile for more space */}
                                <div className="hidden md:block text-xl font-black text-gray-300 pl-4 w-8 text-center tabular-nums">{index + 1}</div>

                                <div className="flex items-center gap-4 flex-1">
                                    {/* Product Image */}
                                    <div className="w-[60px] h-[60px] md:w-[60px] md:h-[60px] flex-shrink-0 bg-white relative overflow-hidden flex items-center justify-center p-1 rounded-xl border border-gray-50">
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
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="md:hidden text-[10px] font-black text-gray-300 tabular-nums">#{index + 1}</span>
                                            <h3 className="font-bold text-gray-900 group-hover:text-[var(--color-brand-blue)] transition-colors text-sm truncate">
                                                {product.name}
                                            </h3>
                                        </div>
                                        {product.nameJP && (
                                            <p className="text-[10px] text-gray-400 font-medium leading-tight mt-0.5 break-words">
                                                {product.nameJP}
                                            </p>
                                        )}
                                        {/* Mobile ID/Barcode display */}
                                        <div className="flex md:hidden items-center gap-2 mt-1">
                                            <span className="text-[9px] font-bold text-gray-900">{product.productCode || '-'}</span>
                                            <span className="text-[9px] text-gray-300">|</span>
                                            <span className="text-[9px] font-bold text-gray-900">{product.barcode || '-'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Desktop: Product ID Section */}
                                <div className="hidden md:flex w-[100px] px-4 border-l border-gray-50 flex-col justify-center">
                                    <span className="text-[9px] text-gray-900 font-black uppercase tracking-widest mb-0.5">상품번호</span>
                                    <span className="text-xs font-bold text-gray-900">
                                        {product.productCode || '-'}
                                    </span>
                                </div>

                                {/* Desktop: Barcode Section */}
                                <div className="hidden md:flex w-[110px] px-4 border-l border-gray-50 flex-col items-center justify-center shrink-0">
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
                                            <p className="text-[10px] text-gray-900 font-bold tracking-tighter mt-1">
                                                {product.barcode}
                                            </p>
                                        </>
                                    ) : (
                                        <span className="text-[10px] text-gray-300">-</span>
                                    )}
                                </div>

                                {/* Price & Stock - Redesigned for mobile */}
                                <div className="flex md:flex-col justify-between md:justify-center items-center md:items-end px-0 md:px-4 md:border-l border-gray-100 min-w-0 md:min-w-[140px] md:h-[60px]">
                                    <div className="text-base md:text-sm font-black text-[var(--color-brand-blue)]">
                                        {product.sellPrice.toLocaleString()} <span className="text-[10px] md:text-[9px] font-normal text-gray-500">원</span>
                                    </div>
                                    <div className="flex md:flex-col gap-2 md:gap-0 items-center md:items-end">
                                        <div className={`text-[10px] ${product.stock < 5 ? 'text-orange-500 font-bold' : 'text-gray-500'}`}>
                                            재고: {product.stock.toLocaleString()}
                                        </div>
                                        <div className="text-[9px] text-orange-600 font-black bg-orange-50 px-2 py-0.5 rounded-full">
                                            최소: {product.minOrderQuantity || 1}
                                        </div>
                                    </div>
                                </div>

                                {/* Order Control */}
                                <div className="w-full md:w-[120px] md:pl-4 flex-shrink-0 mt-2 md:mt-0">
                                    <div className="flex items-center bg-gray-50 rounded-xl p-1 md:p-0.5 border border-gray-100">
                                        <button
                                            onClick={() => handleQuantityChange(product.id, Math.max(0, currentQty - 1))}
                                            className="w-10 h-10 md:w-8 md:h-8 flex items-center justify-center hover:bg-white hover:text-[var(--color-brand-blue)] hover:shadow-sm rounded-lg md:rounded-md transition-all text-gray-400 font-bold text-lg md:text-base"
                                        >
                                            -
                                        </button>
                                        <input
                                            type="number"
                                            min="0"
                                            value={currentQty === 0 ? '' : currentQty}
                                            onChange={(e) => handleQuantityChange(product.id, e.target.value)}
                                            className="w-full bg-transparent text-center font-black text-gray-900 text-base md:text-sm outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            placeholder="0"
                                        />
                                        <button
                                            onClick={() => handleQuantityChange(product.id, currentQty + 1)}
                                            className="w-10 h-10 md:w-8 md:h-8 flex items-center justify-center bg-white text-[var(--color-brand-blue)] shadow-sm rounded-lg md:rounded-md hover:bg-[var(--color-brand-blue)] hover:text-white transition-all font-bold text-lg md:text-base"
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

            <div className="fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-xl border-t border-gray-100 pt-4 md:pt-6 px-4 md:px-6 pb-4 md:pb-6 z-20 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.15)]">
                <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="w-full md:w-auto flex justify-between md:block items-baseline">
                        <div className="flex flex-col">
                            <p className="text-2xl md:text-3xl font-black text-[var(--color-brand-blue)] tabular-nums">
                                {productTotal.toLocaleString()} <span className="text-base md:text-lg font-normal text-gray-500">원</span>
                            </p>
                            <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-widest font-black">총 주문 금액</p>
                        </div>
                        <div className="md:hidden">
                            {hasItems && (
                                <button
                                    onClick={handleOrderNow}
                                    className="bg-[var(--color-brand-blue)] text-white px-6 py-2.5 rounded-xl font-black text-sm shadow-lg shadow-blue-100 active:scale-95 transition-all"
                                >
                                    주문하기
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="hidden md:block">
                        {hasItems && (
                            <button
                                onClick={handleOrderNow}
                                className="bg-[var(--color-brand-blue)] text-white px-10 py-4 rounded-2xl font-black text-lg shadow-xl shadow-blue-100 hover:shadow-2xl hover:-translate-y-1 transition-all"
                            >
                                바로 주문하기
                            </button>
                        )}
                    </div>
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

                            <h3 className="text-2xl font-bold text-[var(--color-brand-blue)] mb-6">주문 요약</h3>

                            <div className="space-y-4 mb-4 max-h-[30vh] overflow-y-auto">
                                {products.filter(p => (quantities[p.id] || 0) > 0).map(p => (
                                    <div key={p.id} className="flex justify-between text-sm">
                                        <span className="text-gray-600">{p.name} × {quantities[p.id]}</span>
                                        <span className="font-semibold">{(p.sellPrice * quantities[p.id]).toLocaleString()} 원</span>
                                    </div>
                                ))}
                                {shippingFee > 0 && (
                                    <div className="flex justify-between text-sm border-t border-dashed pt-2">
                                        <span className="text-gray-600 font-bold">📦 배송비</span>
                                        <span className="font-bold">{shippingFee.toLocaleString()} 원</span>
                                    </div>
                                )}
                            </div>

                            <div className="border-t pt-4 space-y-2 mb-6">
                                <div className="flex justify-between text-sm text-gray-500">
                                    <span>공급가액:</span>
                                    <span>{supplyTotal.toLocaleString()} 원</span>
                                </div>
                                <div className="flex justify-between text-sm text-gray-500">
                                    <span>부가세 (10%):</span>
                                    <span>{vat.toLocaleString()} 원</span>
                                </div>
                                <div className="flex justify-between font-bold text-2xl text-[var(--color-brand-blue)] pt-2 border-t-2 border-dashed border-[var(--color-brand-blue)]">
                                    <span>총 합계:</span>
                                    <span>{totalAmount.toLocaleString()} 원</span>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-xl border border-gray-200 mb-8">
                                <h4 className="text-sm font-semibold text-gray-700 mb-2">입금 계좌 정보</h4>
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
                                            alert("주문이 성공적으로 완료되었습니다!");
                                            setShowSummary(false);
                                            setQuantities({});
                                            window.location.reload();
                                        } else {
                                            const errorData = await res.json();
                                            alert(`주문 실패: ${errorData.error || '알 수 없는 오류'}`);
                                        }
                                    } catch (e) {
                                        console.error(e)
                                        alert("오류가 발생했습니다.");
                                    }
                                }}
                                className="w-full bg-[var(--color-brand-orange)] text-white py-4 rounded-xl font-bold text-lg hover:brightness-110 shadow-lg"
                            >
                                주문 확정
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
