'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import BarcodeDisplay from '@/components/BarcodeDisplay'

type Product = {
    id: string
    name: string
    nameJP?: string | null
    barcode?: string | null
    productCode?: string | null
    buyPrice: number
    sellPrice: number
    onlinePrice?: number | null
    priceA?: number | null
    priceB?: number | null
    priceC?: number | null
    priceD?: number | null
    stock: number
    safetyStock?: number
    imageUrl?: string | null
    minOrderQuantity: number
}

interface ProductFormProps {
    initialData?: Product
    trigger?: React.ReactNode
}

export default function ProductForm({ initialData, trigger }: ProductFormProps) {
    const router = useRouter()
    const [mounted, setMounted] = useState(false)
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])
    const [name, setName] = useState('')
    const [nameJP, setNameJP] = useState('')
    const [barcode, setBarcode] = useState('')
    const [productCode, setProductCode] = useState('')
    const [buyPrice, setBuyPrice] = useState('')
    const [sellPrice, setSellPrice] = useState('')
    const [onlinePrice, setOnlinePrice] = useState('')
    const [stock, setStock] = useState('')
    const [safetyStock, setSafetyStock] = useState('')
    const [priceA, setPriceA] = useState('')
    const [priceB, setPriceB] = useState('')
    const [priceC, setPriceC] = useState('')
    const [priceD, setPriceD] = useState('')
    const [imageUrl, setImageUrl] = useState<string | null>(null)
    const [minOrderQuantity, setMinOrderQuantity] = useState('1')
    const [loading, setLoading] = useState(false)

    // Helper for formatting number with commas
    const formatNumber = (val: string | number) => {
        if (val === "" || val === null || val === undefined) return "";
        const num = String(val).replace(/[^0-9]/g, "");
        if (!num) return "";
        return Number(num).toLocaleString();
    };

    const parseNumber = (val: string) => {
        return val.replace(/,/g, "");
    };

    // Initialize form when opening if initialData exists
    useEffect(() => {
        if (isOpen && initialData) {
            setName(initialData.name)
            setNameJP(initialData.nameJP || '')
            setBarcode(initialData.barcode || '')
            setProductCode(initialData.productCode || '')
            setBuyPrice(formatNumber(initialData.buyPrice))
            setSellPrice(formatNumber(initialData.sellPrice))
            setOnlinePrice(formatNumber(initialData.onlinePrice || 0))
            setStock(formatNumber(initialData.stock || 0))
            setSafetyStock(formatNumber(initialData.safetyStock || 0))
            setPriceA(formatNumber(initialData.priceA ?? ""))
            setPriceB(formatNumber(initialData.priceB ?? ""))
            setPriceC(formatNumber(initialData.priceC ?? ""))
            setPriceD(formatNumber(initialData.priceD ?? ""))
            setImageUrl(initialData.imageUrl || null)
            setMinOrderQuantity(formatNumber(initialData.minOrderQuantity || 1))
        } else if (isOpen && !initialData) {
            // Reset for create mode
            setName('')
            setNameJP('')
            setBarcode('')
            setProductCode('')
            setBuyPrice('')
            setSellPrice('')
            setOnlinePrice('')
            setStock('0')
            setSafetyStock('0')
            setPriceA('')
            setPriceB('')
            setPriceC('')
            setPriceD('')
            setImageUrl(null)
            setMinOrderQuantity('1')
        }
    }, [isOpen, initialData])

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (event) => {
            const img = new Image()
            img.onload = () => {
                const canvas = document.createElement('canvas')
                canvas.width = 500
                canvas.height = 500
                const ctx = canvas.getContext('2d')
                if (ctx) {
                    ctx.drawImage(img, 0, 0, 500, 500)
                    const base64 = canvas.toDataURL('image/jpeg', 0.8)
                    setImageUrl(base64)
                }
            }
            img.src = event.target?.result as string
        }
        reader.readAsDataURL(file)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const url = initialData ? `/api/products/${initialData.id}` : '/api/products'
            const method = initialData ? 'PUT' : 'POST'

            // Prepare the body with numbers, ensuring we don't send NaN
            const productData = {
                name: name.trim(),
                nameJP: nameJP.trim(),
                barcode: barcode.trim(),
                productCode: productCode.trim(),
                buyPrice: parseInt(parseNumber(buyPrice)) || 0,
                sellPrice: parseInt(parseNumber(sellPrice)) || 0,
                onlinePrice: parseInt(parseNumber(onlinePrice)) || 0,
                stock: parseInt(parseNumber(stock)) || 0,
                safetyStock: parseInt(parseNumber(safetyStock)) || 0,
                priceA: priceA === "" ? null : parseInt(parseNumber(priceA)),
                priceB: priceB === "" ? null : parseInt(parseNumber(priceB)),
                priceC: parseInt(parseNumber(sellPrice)) || 0, // Always sync C with Wholesale (sellPrice)
                priceD: priceD === "" ? null : parseInt(parseNumber(priceD)),
                imageUrl: imageUrl,
                minOrderQuantity: parseInt(parseNumber(minOrderQuantity)) || 1,
            }

            console.log("Submitting product data:", productData);

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productData),
            })

            if (res.ok) {
                setIsOpen(false)
                router.refresh()
                if (!initialData) {
                    setName('')
                    setNameJP('')
                    setBuyPrice('')
                    setSellPrice('')
                    setOnlinePrice('')
                    setStock('0')
                    setSafetyStock('0')
                    setPriceA('')
                    setPriceB('')
                    setPriceC('')
                    setPriceD('')
                    setImageUrl(null)
                    setMinOrderQuantity('1')
                }
            } else {
                const data = await res.json()
                alert(`Error: ${data.message || data.error || 'Failed to save product'}`)
            }
        } catch (error) {
            console.error("Submission error:", error)
            alert('오류가 발생했습니다. 연결 상태를 확인해주세요.')
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) {
        return (
            <div onClick={() => setIsOpen(true)}>
                {trigger || (
                    <button
                        className="bg-[#d9361b] text-white px-5 py-2 rounded-lg font-bold hover:brightness-110 transition-all shadow-md hover:shadow-lg text-xs"
                    >
                        ＋ 새 상품 추가
                    </button>
                )}
            </div>
        )
    }

    const modalContent = (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[99999] flex items-center justify-center p-4 overflow-hidden" onClick={() => setIsOpen(false)}>
            <div
                className="bg-white p-8 rounded-2xl w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto relative border border-gray-100"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-black text-gray-900 tracking-tight">
                        {initialData ? '상품 정보 수정' : '새 상품 등록'}
                    </h3>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <form
                    onSubmit={handleSubmit}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            const target = e.target as HTMLElement;
                            if (target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'file') {
                                e.preventDefault();
                                handleSubmit(e as any);
                            }
                        }
                    }}
                    className="space-y-4"
                >
                    {/* Image Upload Section */}
                    <div className="flex items-center gap-6 p-4 rounded-2xl bg-gray-50 border border-gray-100">
                        <div className="w-24 h-24 bg-white rounded-xl overflow-hidden flex items-center justify-center border border-gray-100 shadow-inner">
                            {imageUrl ? (
                                <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-[10px] font-bold text-gray-300 text-center px-1 uppercase tracking-widest">이미지 없음</span>
                            )}
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">상품 이미지 (500x500)</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageChange}
                                className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:bg-gray-900 file:text-white hover:file:bg-black transition-all"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">상품명 (국문)</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#d9361b] focus:bg-white outline-none transition-all font-bold"
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">상품명 (일문)</label>
                            <input
                                type="text"
                                value={nameJP}
                                onChange={e => setNameJP(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#d9361b] focus:bg-white outline-none transition-all font-bold"
                                placeholder="일본어 상품명 (선택사항)"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">바코드 (Barcode)</label>
                            <div className="space-y-2">
                                <input
                                    type="text"
                                    value={barcode}
                                    onChange={e => setBarcode(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#d9361b] focus:bg-white outline-none transition-all font-mono text-sm"
                                    placeholder="바코드 번호 입력"
                                />
                                {barcode && (
                                    <div className="flex justify-center bg-white p-3 border border-gray-100 rounded-xl shadow-sm">
                                        <BarcodeDisplay value={barcode} width={1.8} height={50} fontSize={14} />
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">현재 재고</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={stock}
                                onChange={e => setStock(formatNumber(e.target.value))}
                                className={`w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#d9361b] focus:bg-white outline-none transition-all font-black text-lg ${parseInt(parseNumber(stock)) <= 0 ? 'text-red-500' : 'text-gray-900'}`}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">안전 재고</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={safetyStock}
                                onChange={e => setSafetyStock(formatNumber(e.target.value))}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none transition-all font-bold text-orange-600"
                                placeholder="0"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">최소 주문 수량</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={minOrderQuantity}
                                onChange={e => setMinOrderQuantity(formatNumber(e.target.value))}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all font-bold text-emerald-600"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">상품 코드 (SKU)</label>
                            <input
                                type="text"
                                value={productCode}
                                onChange={e => setProductCode(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#d9361b] focus:bg-white outline-none transition-all font-mono text-sm uppercase"
                                placeholder="e.g. BEIKO-01"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">매입 단가 (Purchase)</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={buyPrice}
                                onChange={e => setBuyPrice(formatNumber(e.target.value))}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#d9361b] focus:bg-white outline-none transition-all font-bold"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-[#d9361b] uppercase tracking-widest ml-1">도매 단가 (Wholesale)</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={sellPrice}
                                onChange={e => {
                                    const val = formatNumber(e.target.value);
                                    setSellPrice(val);
                                    setPriceC(val);
                                }}
                                className="w-full px-4 py-3 bg-red-50 border border-red-100 rounded-xl focus:ring-2 focus:ring-[#d9361b] focus:bg-white outline-none transition-all font-black text-lg text-[#d9361b]"
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">소매 단가 (Retail)</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={onlinePrice}
                                onChange={e => setOnlinePrice(formatNumber(e.target.value))}
                                className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:bg-white outline-none transition-all font-black text-lg text-gray-800"
                                placeholder="소매가 입력"
                            />
                        </div>
                    </div>

                    {/* Tiered Pricing */}
                    <div className="p-6 rounded-[2rem] bg-gray-50 border border-gray-100 space-y-4">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">등급별 단가 정책 (Tiered Pricing)</label>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-gray-400 uppercase ml-1">A 등급</label>
                                <input type="text" inputMode="numeric" value={priceA} onChange={e => setPriceA(formatNumber(e.target.value))} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#d9361b] transition-all font-bold text-sm" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-gray-400 uppercase ml-1">B 등급</label>
                                <input type="text" inputMode="numeric" value={priceB} onChange={e => setPriceB(formatNumber(e.target.value))} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#d9361b] transition-all font-bold text-sm" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-gray-300 uppercase ml-1">C 등급 (도매가 동기화)</label>
                                <input type="text" disabled value={sellPrice} className="w-full px-3 py-2 bg-gray-100 border border-gray-100 rounded-xl font-bold text-sm text-gray-400" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-gray-400 uppercase ml-1">D 등급</label>
                                <input type="text" inputMode="numeric" value={priceD} onChange={e => setPriceD(formatNumber(e.target.value))} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#d9361b] transition-all font-bold text-sm" />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 justify-end pt-6 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="px-6 py-3 text-sm font-black text-gray-400 hover:text-gray-900 transition-colors uppercase tracking-widest"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-gray-900 text-white px-10 py-3 rounded-2xl font-black text-sm uppercase tracking-[0.2em] hover:bg-black disabled:opacity-50 transition-all shadow-xl active:scale-[0.98]"
                        >
                            {loading ? '처리 중...' : initialData ? '정보 수정' : '상품 등록'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )

    return (
        <>
            {isOpen ? null : (
                <div onClick={() => setIsOpen(true)}>
                    {trigger || (
                        <button
                            className="bg-[#d9361b] text-white px-5 py-2 rounded-lg font-bold hover:brightness-110 transition-all shadow-md hover:shadow-lg text-xs"
                        >
                            ＋ 새 상품 추가
                        </button>
                    )}
                </div>
            )}
            {isOpen && mounted && createPortal(modalContent, document.body)}
        </>
    )
}
