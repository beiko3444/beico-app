'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import BarcodeDisplay from '@/components/BarcodeDisplay'

type Product = {
    id: string
    name: string
    nameJP?: string | null
    nameEN?: string | null
    barcode?: string | null
    productCode?: string | null
    buyPrice: number
    sellPrice: number
    onlinePrice?: number | null
    jpBuyPrice?: number | null
    jpSellPrice?: number | null
    krBuyPrice?: number | null
    krSellPrice?: number | null
    usBuyPrice?: number | null
    usSellPrice?: number | null
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
    isCopy?: boolean
}

export default function ProductForm({ initialData, trigger, isCopy }: ProductFormProps) {
    const router = useRouter()
    const [mounted, setMounted] = useState(false)
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])
    const [name, setName] = useState('')
    const [nameJP, setNameJP] = useState('')
    const [nameEN, setNameEN] = useState('')
    const [barcode, setBarcode] = useState('')
    const [productCode, setProductCode] = useState('')
    const [buyPrice, setBuyPrice] = useState('')
    const [sellPrice, setSellPrice] = useState('')
    const [onlinePrice, setOnlinePrice] = useState('')
    const [jpBuyPrice, setJpBuyPrice] = useState('')
    const [jpSellPrice, setJpSellPrice] = useState('')
    const [krBuyPrice, setKrBuyPrice] = useState('')
    const [krSellPrice, setKrSellPrice] = useState('')
    const [usBuyPrice, setUsBuyPrice] = useState('')
    const [usSellPrice, setUsSellPrice] = useState('')
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
        const strVal = String(val);
        // Remove characters except digits and the decimal point
        const numStr = strVal.replace(/[^0-9.]/g, "");
        if (!numStr) return "";

        const parts = numStr.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");

        // Return with decimal part if it exists (even if it's just '123.')
        if (parts.length > 1) {
            return `${parts[0]}.${parts.slice(1).join('')}`;
        }
        return parts[0];
    };

    const parseNumber = (val: string) => {
        return val.replace(/,/g, "");
    };

    // Initialize form when opening if initialData exists
    useEffect(() => {
        if (isOpen && initialData) {
            setName(isCopy ? `${initialData.name} (복사)` : initialData.name)
            setNameJP(initialData.nameJP || '')
            setNameEN(initialData.nameEN || '')
            setBarcode(isCopy ? '' : (initialData.barcode || ''))
            setProductCode(isCopy ? '' : (initialData.productCode || ''))
            setBuyPrice(formatNumber(initialData.buyPrice))
            setSellPrice(formatNumber(initialData.sellPrice))
            setOnlinePrice(formatNumber(initialData.onlinePrice || 0))
            setJpBuyPrice(formatNumber(initialData.jpBuyPrice || 0))
            setJpSellPrice(formatNumber(initialData.jpSellPrice || 0))
            setKrBuyPrice(formatNumber(initialData.krBuyPrice || 0))
            setKrSellPrice(formatNumber(initialData.krSellPrice || 0))
            setUsBuyPrice(formatNumber(initialData.usBuyPrice || 0))
            setUsSellPrice(formatNumber(initialData.usSellPrice || 0))
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
            setNameEN('')
            setBarcode('')
            setProductCode('')
            setBuyPrice('')
            setSellPrice('')
            setOnlinePrice('')
            setJpBuyPrice('')
            setJpSellPrice('')
            setKrBuyPrice('')
            setKrSellPrice('')
            setUsBuyPrice('')
            setUsSellPrice('')
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
            const isNew = !initialData || isCopy
            const url = isNew ? '/api/products' : `/api/products/${initialData.id}`
            const method = isNew ? 'POST' : 'PUT'

            // Prepare the body with numbers, ensuring we don't send NaN
            const productData = {
                name: name.trim(),
                nameJP: nameJP.trim(),
                nameEN: nameEN.trim(),
                barcode: barcode.trim(),
                productCode: productCode.trim(),
                buyPrice: parseFloat(parseNumber(buyPrice)) || 0,
                sellPrice: parseFloat(parseNumber(sellPrice)) || 0,
                onlinePrice: parseFloat(parseNumber(onlinePrice)) || 0,
                jpBuyPrice: parseFloat(parseNumber(jpBuyPrice)) || 0,
                jpSellPrice: parseFloat(parseNumber(jpSellPrice)) || 0,
                krBuyPrice: parseFloat(parseNumber(krBuyPrice)) || 0,
                krSellPrice: parseFloat(parseNumber(krSellPrice)) || 0,
                usBuyPrice: parseFloat(parseNumber(usBuyPrice)) || 0,
                usSellPrice: parseFloat(parseNumber(usSellPrice)) || 0,
                stock: parseInt(parseNumber(stock)) || 0,
                safetyStock: parseInt(parseNumber(safetyStock)) || 0,
                priceA: priceA === "" ? null : parseFloat(parseNumber(priceA)),
                priceB: priceB === "" ? null : parseFloat(parseNumber(priceB)),
                priceC: parseFloat(parseNumber(sellPrice)) || 0, // Always sync C with Wholesale (sellPrice)
                priceD: priceD === "" ? null : parseFloat(parseNumber(priceD)),
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
                if (isNew) {
                    setName('')
                    setNameJP('')
                    setNameEN('')
                    setBuyPrice('')
                    setSellPrice('')
                    setOnlinePrice('')
                    setJpBuyPrice('')
                    setJpSellPrice('')
                    setKrBuyPrice('')
                    setKrSellPrice('')
                    setUsBuyPrice('')
                    setUsSellPrice('')
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
        <div className="fixed inset-0 bg-black/40 z-[99999] flex items-center justify-center p-4 overflow-hidden" onClick={() => setIsOpen(false)}>
            <div
                className="bg-[#f0f0f0] border-2 border-[#808080] w-full max-w-2xl shadow-md animate-in fade-in duration-100 max-h-[95vh] overflow-y-auto relative"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Classic Windows-style Header */}
                <div className="bg-[#000080] text-white px-3 py-2 flex justify-between items-center select-none sticky top-0 z-10">
                    <h3 className="text-sm font-bold tracking-tight">
                        {isCopy ? 'Product Management - Copy & Register Product' : initialData ? 'Product Management - Edit Product' : 'Product Management - New Product Registration'}
                    </h3>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="bg-[#c0c0c0] text-black w-5 h-5 flex items-center justify-center text-xs border-r border-b border-black border-l-[#ffffff] border-t-[#ffffff] active:border-none focus:outline-none"
                    >
                        ✕
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
                    className="p-6 space-y-6"
                >
                    {/* Basic Info Group */}
                    <fieldset className="border border-gray-400 p-4 pt-2">
                        <legend className="px-2 text-xs font-bold text-gray-700">기본 정보 (General Info)</legend>

                        {/* Image Upload Row */}
                        <div className="flex gap-4 mb-4 items-start">
                            <div
                                className="w-20 h-20 bg-white border border-gray-400 flex items-center justify-center shrink-0 cursor-pointer relative group"
                                onClick={() => document.getElementById('image-upload-input')?.click()}
                            >
                                {imageUrl ? (
                                    <>
                                        <img src={imageUrl} alt="Preview" className="w-full h-full object-contain" />
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setImageUrl(null); }}
                                            className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] shadow-md opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            ✕
                                        </button>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center">
                                        <span className="text-[10px] text-gray-400">Click to</span>
                                        <span className="text-[10px] text-gray-400">Upload</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex-1">
                                <label className="block text-[11px] font-bold text-gray-600 mb-1">상품 이미지 선택</label>
                                <input
                                    id="image-upload-input"
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    className="hidden"
                                />
                                <button
                                    type="button"
                                    onClick={() => document.getElementById('image-upload-input')?.click()}
                                    className="text-[11px] bg-white border border-gray-300 px-3 py-1 hover:bg-gray-50 flex items-center gap-1 border-r-2 border-b-2 border-gray-500 active:border-none"
                                >
                                    파일 선택 (Search...)
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-gray-600">상품명 (국문)</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full px-2 py-1.5 bg-white border border-gray-400 outline-none focus:border-blue-600 text-sm"
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-gray-600">상품명 (일문)</label>
                                <input
                                    type="text"
                                    value={nameJP}
                                    onChange={e => setNameJP(e.target.value)}
                                    className="w-full px-2 py-1.5 bg-white border border-gray-400 outline-none focus:border-blue-600 text-sm"
                                    placeholder="JAPANESE NAME"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-gray-600">상품명 (영문)</label>
                                <input
                                    type="text"
                                    value={nameEN}
                                    onChange={e => setNameEN(e.target.value)}
                                    className="w-full px-2 py-1.5 bg-white border border-gray-400 outline-none focus:border-blue-600 text-sm"
                                    placeholder="ENGLISH NAME"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-gray-600">상품 코드 (SKU)</label>
                                <input
                                    type="text"
                                    value={productCode}
                                    onChange={e => setProductCode(e.target.value)}
                                    className="w-full px-2 py-1.5 bg-white border border-gray-400 outline-none focus:border-blue-600 text-sm font-mono uppercase"
                                    placeholder="ITEM CODE"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-gray-600">바코드 번호</label>
                                <input
                                    type="text"
                                    value={barcode}
                                    onChange={e => setBarcode(e.target.value)}
                                    className="w-full px-2 py-1.5 bg-white border border-gray-400 outline-none focus:border-blue-600 text-sm font-mono"
                                    placeholder="BARCODE"
                                />
                            </div>
                        </div>
                    </fieldset>

                    {/* Inventory Group */}
                    <fieldset className="border border-gray-400 p-4 pt-2">
                        <legend className="px-2 text-xs font-bold text-gray-700">재고 및 주문 (Inventory)</legend>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-gray-600">현재고 수량</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={stock}
                                    onChange={e => setStock(formatNumber(e.target.value))}
                                    className={`w-full px-2 py-1.5 bg-white border border-gray-400 outline-none focus:border-blue-600 text-sm text-right font-bold ${parseInt(parseNumber(stock)) <= 0 ? 'text-red-600' : 'text-black'}`}
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-gray-600">안전재고 설정</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={safetyStock}
                                    onChange={e => setSafetyStock(formatNumber(e.target.value))}
                                    className="w-full px-2 py-1.5 bg-white border border-gray-400 outline-none focus:border-blue-600 text-sm text-right font-bold text-orange-700"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-gray-600">최소 주문량</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={minOrderQuantity}
                                    onChange={e => setMinOrderQuantity(formatNumber(e.target.value))}
                                    className="w-full px-2 py-1.5 bg-white border border-gray-400 outline-none focus:border-blue-600 text-sm text-right font-bold text-blue-700"
                                    required
                                />
                            </div>
                        </div>
                    </fieldset>

                    {/* Pricing Group */}
                    <fieldset className="border border-gray-400 p-4 pt-2">
                        <legend className="px-2 text-xs font-bold text-gray-700">단가 설정 (Pricing)</legend>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-gray-600">매입 단가 (Cost)</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={buyPrice}
                                    onChange={e => setBuyPrice(formatNumber(e.target.value))}
                                    className="w-full px-2 py-1.5 bg-white border border-gray-400 outline-none focus:border-blue-600 text-sm text-right"
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-red-700">도매 단가 (Wholesale)</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={sellPrice}
                                    onChange={e => {
                                        const val = formatNumber(e.target.value);
                                        setSellPrice(val);
                                        setPriceC(val);
                                    }}
                                    className="w-full px-2 py-1.5 bg-[#fff8f8] border border-red-300 outline-none focus:border-red-600 text-sm text-right font-bold text-red-700"
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-gray-600">소매 단가 (Retail)</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={onlinePrice}
                                    onChange={e => setOnlinePrice(formatNumber(e.target.value))}
                                    className="w-full px-2 py-1.5 bg-white border border-gray-400 outline-none focus:border-blue-600 text-sm text-right"
                                />
                            </div>
                        </div>

                        {/* Regional Prices Sub-group */}
                        <div className="mt-4 pt-4 border-t border-gray-300">
                            <label className="block text-[10px] font-bold text-gray-500 mb-2">지역별 단가 (Regional Pricing)</label>

                            {/* Japan Pricing */}
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-gray-600">일본 도매가 (JP Wholesale)</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={jpBuyPrice}
                                        onChange={e => setJpBuyPrice(formatNumber(e.target.value))}
                                        className="w-full px-2 py-1.5 bg-white border border-gray-400 outline-none focus:border-blue-600 text-sm text-right"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-gray-600">일본 판매가 (JP Retail)</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={jpSellPrice}
                                        onChange={e => setJpSellPrice(formatNumber(e.target.value))}
                                        className="w-full px-2 py-1.5 bg-white border border-gray-400 outline-none focus:border-blue-600 text-sm text-right"
                                    />
                                </div>
                            </div>

                            {/* Korea Pricing */}
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-gray-600">한국 도매가 (KR Wholesale)</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={krBuyPrice}
                                        onChange={e => setKrBuyPrice(formatNumber(e.target.value))}
                                        className="w-full px-2 py-1.5 bg-white border border-gray-400 outline-none focus:border-blue-600 text-sm text-right"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-gray-600">한국 판매가 (KR Retail)</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={krSellPrice}
                                        onChange={e => setKrSellPrice(formatNumber(e.target.value))}
                                        className="w-full px-2 py-1.5 bg-white border border-gray-400 outline-none focus:border-blue-600 text-sm text-right"
                                    />
                                </div>
                            </div>

                            {/* US Pricing */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-gray-600">미국 도매가 (US Wholesale)</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={usBuyPrice}
                                        onChange={e => setUsBuyPrice(formatNumber(e.target.value))}
                                        className="w-full px-2 py-1.5 bg-white border border-gray-400 outline-none focus:border-blue-600 text-sm text-right"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-gray-600">미국 판매가 (US Retail)</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={usSellPrice}
                                        onChange={e => setUsSellPrice(formatNumber(e.target.value))}
                                        className="w-full px-2 py-1.5 bg-white border border-gray-400 outline-none focus:border-blue-600 text-sm text-right"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-gray-300">
                            <label className="block text-[10px] font-bold text-gray-500 mb-2">등급별 단가 (Special Pricing)</label>
                            <div className="grid grid-cols-4 gap-2">
                                {[
                                    { label: 'A 등급', value: priceA, setter: setPriceA },
                                    { label: 'B 등급', value: priceB, setter: setPriceB },
                                    { label: 'C 등급', value: sellPrice, disabled: true },
                                    { label: 'D 등급', value: priceD, setter: setPriceD },
                                ].map((tier) => (
                                    <div key={tier.label} className="space-y-1">
                                        <label className="text-[10px] text-gray-600 block">{tier.label}</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={tier.value}
                                            disabled={tier.disabled}
                                            onChange={e => tier.setter?.(formatNumber(e.target.value))}
                                            className={`w-full px-1.5 py-1 text-xs text-right border ${tier.disabled ? 'bg-gray-100' : 'bg-white border-gray-300'}`}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </fieldset>

                    <div className="flex gap-2 justify-end pt-4">
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="px-4 py-1.5 text-xs bg-[#c0c0c0] border-r border-b border-black border-l-[#ffffff] border-t-[#ffffff] active:border-none focus:outline-none"
                        >
                            CANCEL
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-8 py-1.5 text-xs bg-[#c0c0c0] border-r border-b border-black border-l-[#ffffff] border-t-[#ffffff] active:border-none font-bold focus:outline-none disabled:opacity-50"
                        >
                            {loading ? 'WAIT...' : isCopy ? 'SAVE COPY' : initialData ? 'UPDATE' : 'SAVE ITEM'}
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
