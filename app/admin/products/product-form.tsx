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
    coupangSku?: string | null
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
    regionalPrices?: any
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
    const [coupangSku, setCoupangSku] = useState('')
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
    const [exchangeRates, setExchangeRates] = useState<{ USD: number, JPY: number, CNY: number } | null>(null);

    useEffect(() => {
        // Fetch exchange rates
        fetch('https://open.er-api.com/v6/latest/USD')
            .then(res => res.json())
            .then(data => {
                if (data && data.rates) {
                    const krw = data.rates.KRW;
                    const jpy = data.rates.JPY;
                    const cny = data.rates.CNY;
                    if (krw && jpy && cny) {
                        setExchangeRates({
                            USD: krw,
                            JPY: krw / jpy,
                            CNY: krw / cny
                        });
                    }
                }
            })
            .catch(err => console.error("Failed to fetch exchange rates", err));
    }, []);

    type CountryPrice = { cost: string, wholesale: string, retail: string, moq: string };
    type GradePricing = { KR: CountryPrice, JP: CountryPrice, US: CountryPrice };
    const defaultGradePricing = (): GradePricing => ({
        KR: { cost: '', wholesale: '', retail: '', moq: '1' },
        JP: { cost: '', wholesale: '', retail: '', moq: '1' },
        US: { cost: '', wholesale: '', retail: '', moq: '1' }
    });

    const [regionalPrices, setRegionalPrices] = useState<{ [grade: string]: GradePricing }>({
        A: defaultGradePricing(),
        B: defaultGradePricing(),
        C: defaultGradePricing(),
        D: defaultGradePricing()
    });
    const [activeGradeTab, setActiveGradeTab] = useState('C');

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
            setProductCode(initialData.productCode || '')
            setCoupangSku(initialData.coupangSku || '')
            setStock(formatNumber(initialData.stock || 0))
            setSafetyStock(formatNumber(initialData.safetyStock || 0))
            setImageUrl(initialData.imageUrl || null)
            setMinOrderQuantity(formatNumber(initialData.minOrderQuantity || 1))

            if (initialData.regionalPrices && Object.keys(initialData.regionalPrices).length > 0) {
                // Formatting values when loading from existing JSON
                const formattedPrices = { ...initialData.regionalPrices };
                Object.keys(formattedPrices).forEach(g => {
                    Object.keys(formattedPrices[g]).forEach(c => {
                        formattedPrices[g][c].cost = formatNumber(formattedPrices[g][c].cost);
                        formattedPrices[g][c].wholesale = formatNumber(formattedPrices[g][c].wholesale);
                        formattedPrices[g][c].retail = formatNumber(formattedPrices[g][c].retail);
                        formattedPrices[g][c].moq = formatNumber(formattedPrices[g][c].moq || 1);
                    });
                });
                setRegionalPrices(formattedPrices);
            } else {
                // Fallback from old schema data or defaults
                const fallback = {
                    A: defaultGradePricing(),
                    B: defaultGradePricing(),
                    C: defaultGradePricing(),
                    D: defaultGradePricing()
                };

                // Try to infer old data to C grade
                fallback['C'].KR.cost = formatNumber(initialData.buyPrice || '');
                fallback['C'].KR.wholesale = formatNumber(initialData.krBuyPrice || initialData.sellPrice || '');
                fallback['C'].KR.retail = formatNumber(initialData.krSellPrice || initialData.onlinePrice || '');
                fallback['C'].KR.moq = formatNumber(initialData.minOrderQuantity || 1);

                fallback['C'].JP.cost = formatNumber(initialData.buyPrice || '');
                fallback['C'].JP.wholesale = formatNumber(initialData.jpBuyPrice || '');
                fallback['C'].JP.retail = formatNumber(initialData.jpSellPrice || '');
                fallback['C'].JP.moq = formatNumber(initialData.minOrderQuantity || 1);

                fallback['C'].US.cost = formatNumber(initialData.buyPrice || '');
                fallback['C'].US.wholesale = formatNumber(initialData.usBuyPrice || '');
                fallback['C'].US.retail = formatNumber(initialData.usSellPrice || '');
                fallback['C'].US.moq = formatNumber(initialData.minOrderQuantity || 1);

                setRegionalPrices(fallback);
            }
        } else if (isOpen && !initialData) {
            // Reset for create mode
            setName('')
            setNameJP('')
            setNameEN('')
            setBarcode('')
            setProductCode('')
            setCoupangSku('')
            setStock('0')
            setSafetyStock('0')
            setImageUrl(null)
            setMinOrderQuantity('1')
            setRegionalPrices({
                A: defaultGradePricing(),
                B: defaultGradePricing(),
                C: defaultGradePricing(),
                D: defaultGradePricing()
            });
            setActiveGradeTab('C');
        }
    }, [isOpen, initialData, isCopy])

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
                coupangSku: coupangSku.trim(),
                buyPrice: parseFloat(parseNumber(regionalPrices['C'].KR.cost)) || 0,
                sellPrice: parseFloat(parseNumber(regionalPrices['C'].KR.wholesale)) || 0,
                stock: parseInt(parseNumber(stock)) || 0,
                safetyStock: parseInt(parseNumber(safetyStock)) || 0,
                imageUrl: imageUrl,
                minOrderQuantity: parseInt(parseNumber(minOrderQuantity)) || 1,
                regionalPrices: regionalPrices,
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
                    setBarcode('')
                    setProductCode('')
                    setCoupangSku('')
                    setStock('0')
                    setSafetyStock('0')
                    setImageUrl(null)
                    setMinOrderQuantity('1')
                    setRegionalPrices({
                        A: defaultGradePricing(),
                        B: defaultGradePricing(),
                        C: defaultGradePricing(),
                        D: defaultGradePricing()
                    });
                    setActiveGradeTab('C');
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
        <div className="fixed inset-0 bg-black/40 z-[99999] flex items-center justify-center p-4 overflow-hidden">
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
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-orange-600">쿠팡 연동 바코드 (선택)</label>
                                <input
                                    type="text"
                                    value={coupangSku}
                                    onChange={e => setCoupangSku(e.target.value)}
                                    className="w-full px-2 py-1.5 bg-orange-50/50 border border-orange-200 outline-none focus:border-orange-500 text-sm font-bold text-orange-900"
                                    placeholder="쿠팡 판매자상품코드 (숫자)"
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

                    {/* Regional Pricing Group */}
                    <fieldset className="border border-gray-400 p-4 pt-2 mb-4">
                        <legend className="px-2 text-xs font-bold text-gray-700">지역별 & 등급별 단가 설정 (Regional & Tier Pricing)</legend>

                        {/* Grade Tabs & Real-time Exchange Rates */}
                        <div className="flex gap-2 mb-4 items-center flex-wrap">
                            <div className="flex gap-2">
                                {['A', 'B', 'C', 'D'].map(grade => (
                                    <button
                                        key={grade}
                                        type="button"
                                        onClick={() => setActiveGradeTab(grade)}
                                        className={`px-4 py-1.5 text-xs font-bold border ${activeGradeTab === grade ? 'bg-blue-600 text-white border-blue-600 shadow-inner' : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'}`}
                                    >
                                        {grade} 등급
                                    </button>
                                ))}
                            </div>
                            {exchangeRates && (
                                <div className="ml-auto flex items-center gap-3 text-[11px] bg-[#fff8e7] border border-[#ffcc00] px-3 py-1 rounded-sm shadow-sm border-b-2 border-r-2">
                                    <span className="font-bold text-gray-700">🔴 실시간 환율:</span>
                                    <span className="text-blue-700 font-bold">🇺🇸 ${Number(exchangeRates.USD).toFixed(0)}</span>
                                    <span className="text-red-600 font-bold">🇯🇵(100¥) ₩{Number(exchangeRates.JPY * 100).toFixed(0)}</span>
                                    <span className="text-red-700 font-bold">🇨🇳 ¥{Number(exchangeRates.CNY).toFixed(0)}</span>
                                </div>
                            )}
                        </div>

                        <div className="space-y-6">
                            {(['KR', 'JP', 'US'] as const).map(country => {
                                const labels: Record<string, string> = { KR: '한국 (KR)', JP: '일본 (JP)', US: '미국 (US)' };
                                const prefix: Record<string, string> = { KR: '₩ ', JP: '¥ ', US: '$ ' };
                                const curPrices = regionalPrices[activeGradeTab][country];

                                const costNum = parseFloat(parseNumber(curPrices.cost)) || 0;
                                const wholesaleNum = parseFloat(parseNumber(curPrices.wholesale)) || 0;
                                const retailNum = parseFloat(parseNumber(curPrices.retail)) || 0;

                                const beicoMargin = costNum === 0 && wholesaleNum === 0 ? 0 : wholesaleNum > 0 ? ((wholesaleNum - costNum) / wholesaleNum * 100).toFixed(1) : 0;
                                const wholesalerMargin = wholesaleNum === 0 && retailNum === 0 ? 0 : retailNum > 0 ? ((retailNum - wholesaleNum) / retailNum * 100).toFixed(1) : 0;

                                return (
                                    <div key={country} className="border border-gray-200 p-3 bg-gray-50 relative">
                                        <div className="absolute top-0 left-0 bg-gray-200 text-gray-700 text-[10px] font-black px-2 py-0.5 border-b border-r border-gray-300">
                                            {labels[country]}
                                        </div>
                                        <div className="grid grid-cols-6 gap-3 mt-4">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-gray-600 block h-[15px]">매입단가</label>
                                                <div className="relative">
                                                    <span className="absolute left-2 text-gray-400 text-xs top-1.5">{prefix[country]}</span>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        value={curPrices.cost}
                                                        onChange={e => setRegionalPrices(prev => ({
                                                            ...prev, [activeGradeTab]: { ...prev[activeGradeTab], [country]: { ...prev[activeGradeTab][country], cost: formatNumber(e.target.value) } }
                                                        }))}
                                                        className="w-full pl-6 pr-2 py-1.5 bg-white border border-gray-300 outline-none focus:border-blue-600 text-xs text-right"
                                                    />
                                                </div>
                                                {country !== 'KR' && exchangeRates && curPrices.cost && (
                                                    <div className="text-[10px] text-gray-500 font-bold mt-0.5 text-right tracking-tighter">
                                                        ≈ {formatNumber(Math.round((parseFloat(parseNumber(curPrices.cost)) || 0) * (country === 'US' ? exchangeRates.USD : exchangeRates.JPY)))}원
                                                    </div>
                                                )}
                                                {country === 'KR' && exchangeRates && curPrices.cost && (
                                                    <div className="text-[9px] text-gray-400 font-bold mt-0.5 text-right tracking-tighter leading-tight">
                                                        <div>≈ ¥{formatNumber(Math.round((parseFloat(parseNumber(curPrices.cost)) || 0) / exchangeRates.JPY))}</div>
                                                        <div>≈ ${((parseFloat(parseNumber(curPrices.cost)) || 0) / exchangeRates.USD).toFixed(2)}</div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-red-700 block h-[15px]">도매가</label>
                                                <div className="relative">
                                                    <span className="absolute left-2 text-gray-400 text-xs top-1.5">{prefix[country]}</span>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        value={curPrices.wholesale}
                                                        onChange={e => setRegionalPrices(prev => ({
                                                            ...prev, [activeGradeTab]: { ...prev[activeGradeTab], [country]: { ...prev[activeGradeTab][country], wholesale: formatNumber(e.target.value) } }
                                                        }))}
                                                        className="w-full pl-6 pr-2 py-1.5 bg-[#fff8f8] border border-red-300 outline-none focus:border-red-600 text-xs text-right font-bold text-red-700"
                                                    />
                                                </div>
                                                {country !== 'KR' && exchangeRates && curPrices.wholesale && (
                                                    <div className="text-[10px] text-red-400 font-bold mt-0.5 text-right tracking-tighter">
                                                        ≈ {formatNumber(Math.round((parseFloat(parseNumber(curPrices.wholesale)) || 0) * (country === 'US' ? exchangeRates.USD : exchangeRates.JPY)))}원
                                                    </div>
                                                )}
                                                {country === 'KR' && exchangeRates && curPrices.wholesale && (
                                                    <div className="text-[9px] text-red-400 font-bold mt-0.5 text-right tracking-tighter leading-tight">
                                                        <div>≈ ¥{formatNumber(Math.round((parseFloat(parseNumber(curPrices.wholesale)) || 0) / exchangeRates.JPY))}</div>
                                                        <div>≈ ${((parseFloat(parseNumber(curPrices.wholesale)) || 0) / exchangeRates.USD).toFixed(2)}</div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-blue-700 block h-[15px]">판매가</label>
                                                <div className="relative">
                                                    <span className="absolute left-2 text-gray-400 text-xs top-1.5">{prefix[country]}</span>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        value={curPrices.retail}
                                                        onChange={e => setRegionalPrices(prev => ({
                                                            ...prev, [activeGradeTab]: { ...prev[activeGradeTab], [country]: { ...prev[activeGradeTab][country], retail: formatNumber(e.target.value) } }
                                                        }))}
                                                        className="w-full pl-6 pr-2 py-1.5 bg-[#f8faff] border border-blue-300 outline-none focus:border-blue-600 text-xs text-right font-bold text-blue-700"
                                                    />
                                                </div>
                                                {country !== 'KR' && exchangeRates && curPrices.retail && (
                                                    <div className="text-[10px] text-blue-400 font-bold mt-0.5 text-right tracking-tighter">
                                                        ≈ {formatNumber(Math.round((parseFloat(parseNumber(curPrices.retail)) || 0) * (country === 'US' ? exchangeRates.USD : exchangeRates.JPY)))}원
                                                    </div>
                                                )}
                                                {country === 'KR' && exchangeRates && curPrices.retail && (
                                                    <div className="text-[9px] text-blue-400 font-bold mt-0.5 text-right tracking-tighter leading-tight">
                                                        <div>≈ ¥{formatNumber(Math.round((parseFloat(parseNumber(curPrices.retail)) || 0) / exchangeRates.JPY))}</div>
                                                        <div>≈ ${((parseFloat(parseNumber(curPrices.retail)) || 0) / exchangeRates.USD).toFixed(2)}</div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-gray-600 block h-[15px]">최소수량 (MOQ)</label>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={curPrices.moq}
                                                    onChange={e => setRegionalPrices(prev => ({
                                                        ...prev, [activeGradeTab]: { ...prev[activeGradeTab], [country]: { ...prev[activeGradeTab][country], moq: formatNumber(e.target.value) } }
                                                    }))}
                                                    className="w-full px-2 py-1.5 bg-[#f8f8f8] border border-gray-300 outline-none focus:border-gray-500 text-xs text-right font-bold"
                                                />
                                            </div>

                                            <div className="space-y-1 bg-gray-100 p-1.5 border border-gray-200 text-right flex flex-col justify-center">
                                                <label className="text-[9px] font-bold text-gray-500 block mb-0.5">베이코 마진율</label>
                                                <span className={`text-xs font-black ${Number(beicoMargin) < 0 ? 'text-red-500' : 'text-gray-800'}`}>{beicoMargin}%</span>
                                            </div>

                                            <div className="space-y-1 bg-gray-100 p-1.5 border border-gray-200 text-right flex flex-col justify-center">
                                                <label className="text-[9px] font-bold text-gray-500 block mb-0.5">도매상 마진율</label>
                                                <span className={`text-xs font-black ${Number(wholesalerMargin) < 0 ? 'text-red-500' : 'text-gray-800'}`}>{wholesalerMargin}%</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
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
