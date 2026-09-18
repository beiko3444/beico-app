'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { ImagePlus, Plus, X } from 'lucide-react'
import { normalizePartnerProductStatus, type PartnerProductStatus } from '@/lib/partnerProductStatus'
import Button, { buttonClass } from '@/components/ui/Button'
import Tabs from '@/components/ui/Tabs'

type ExchangeRates = { USD: number, JPY: number, CNY: number }
type CountryPrice = { cost: string, wholesale: string, retail: string, moq: string, orderUnit: string }
type GradePricing = { KR: CountryPrice, JP: CountryPrice, US: CountryPrice }
type ProductGrade = 'A' | 'B' | 'C' | 'D'
type ProductCountry = keyof GradePricing
type RegionalPriceSource = Partial<Record<ProductGrade, Partial<Record<ProductCountry, Partial<CountryPrice>>>>>

let cachedExchangeRates: ExchangeRates | null = null
let pendingExchangeRates: Promise<ExchangeRates | null> | null = null

async function loadExchangeRates() {
    if (cachedExchangeRates) return cachedExchangeRates
    if (pendingExchangeRates) return pendingExchangeRates

    pendingExchangeRates = fetch('https://open.er-api.com/v6/latest/USD')
        .then(res => res.json())
        .then(data => {
            const krw = data?.rates?.KRW
            const jpy = data?.rates?.JPY
            const cny = data?.rates?.CNY
            if (!krw || !jpy || !cny) return null

            cachedExchangeRates = {
                USD: krw,
                JPY: krw / jpy,
                CNY: krw / cny,
            }
            return cachedExchangeRates
        })
        .catch(err => {
            console.error("Failed to fetch exchange rates", err)
            return null
        })
        .finally(() => {
            pendingExchangeRates = null
        })

    return pendingExchangeRates
}

export type Product = {
    id: string
    productNumber: number
    name: string
    nameJP?: string | null
    nameEN?: string | null
    barcode?: string | null
    productCode?: string | null
    groupName?: string | null
    autoGroupingDisabled?: boolean
    hsCode?: string | null
    japanHsCode?: string | null
    coupangSku?: string | null
    buyPrice: number
    cnyBuyPrice?: number | null
    usdPurchasePrice?: number | null
    purchaseCurrency?: string | null
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
    wholesaleAvailable?: boolean
    partnerSaleStatus?: string | null
    imageUrl?: string | null
    regionalPrices?: unknown
    stock?: number | null
    safetyStock?: number | null
    minOrderQuantity: number
    orderUnit?: number
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
    const [groupName, setGroupName] = useState('')
    const [hsCode, setHsCode] = useState('')
    const [japanHsCode, setJapanHsCode] = useState('')
    const [coupangSku, setCoupangSku] = useState('')
    const [partnerSaleStatus, setPartnerSaleStatus] = useState<PartnerProductStatus>('VISIBLE')
    const [imageUrl, setImageUrl] = useState<string | null>(null)
    const [stock, setStock] = useState('0')
    const [minOrderQuantity, setMinOrderQuantity] = useState('1')
    const [orderUnit, setOrderUnit] = useState('1')
    const [preserveUngroupedState, setPreserveUngroupedState] = useState(false)
    const [hasImageChanged, setHasImageChanged] = useState(false)
    const [loading, setLoading] = useState(false)
    const [exchangeRates, setExchangeRates] = useState<ExchangeRates | null>(cachedExchangeRates);

    useEffect(() => {
        if (!isOpen) return
        if (cachedExchangeRates) {
            setExchangeRates(cachedExchangeRates)
            return
        }

        let cancelled = false
        loadExchangeRates().then(rates => {
            if (!cancelled && rates) setExchangeRates(rates)
        })
        return () => {
            cancelled = true
        }
    }, [isOpen]);

    const defaultGradePricing = (): GradePricing => ({
        KR: { cost: '', wholesale: '', retail: '', moq: '1', orderUnit: '1' },
        JP: { cost: '', wholesale: '', retail: '', moq: '1', orderUnit: '1' },
        US: { cost: '', wholesale: '', retail: '', moq: '1', orderUnit: '1' }
    });

    const createDefaultRegionalPrices = () => ({
        A: defaultGradePricing(),
        B: defaultGradePricing(),
        C: defaultGradePricing(),
        D: defaultGradePricing()
    });

    const [regionalPrices, setRegionalPrices] = useState<{ [grade: string]: GradePricing }>(createDefaultRegionalPrices());
    const [activeGradeTab, setActiveGradeTab] = useState('C');

    const normalizeProductCode = (value: string) => value.toUpperCase();
    const normalizeHsCode = (value: string) => value.replace(/[^0-9.-]/g, '');

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

    const normalizeRegionalPrices = (source: unknown, fallbackOrderUnit: number | string = 1) => {
        const next = createDefaultRegionalPrices();
        const priceSource = source && typeof source === 'object'
            ? source as RegionalPriceSource
            : {};

        (['A', 'B', 'C', 'D'] as const).forEach(grade => {
            (['KR', 'JP', 'US'] as const).forEach(country => {
                const current = priceSource[grade]?.[country] || {};
                next[grade][country] = {
                    cost: formatNumber(current.cost || ''),
                    wholesale: formatNumber(current.wholesale || ''),
                    retail: formatNumber(current.retail || ''),
                    moq: formatNumber(current.moq || 1),
                    orderUnit: formatNumber(current.orderUnit || fallbackOrderUnit || 1),
                };
            });
        });

        return next;
    };

    // Initialize form when opening if initialData exists
    useEffect(() => {
        if (isOpen && initialData) {
            setName(isCopy ? `${initialData.name} (복사)` : initialData.name)
            setNameJP(initialData.nameJP || '')
            setNameEN(initialData.nameEN || '')
            setBarcode(isCopy ? '' : (initialData.barcode || ''))
            setProductCode((initialData.productCode || '').toUpperCase())
            setGroupName(initialData.groupName || '')
            setPreserveUngroupedState(!isCopy && initialData.autoGroupingDisabled === true)
            setHsCode(initialData.hsCode || '')
            setJapanHsCode(initialData.japanHsCode || '')
            setCoupangSku(initialData.coupangSku || '')
            setPartnerSaleStatus(normalizePartnerProductStatus(initialData.partnerSaleStatus, initialData.wholesaleAvailable))
            setImageUrl(initialData.imageUrl || null)
            setHasImageChanged(false)
            setStock(formatNumber(isCopy ? 0 : (initialData.stock ?? 0)))
            setMinOrderQuantity(formatNumber(initialData.minOrderQuantity || 1))
            setOrderUnit(formatNumber(initialData.orderUnit || 1))

            if (initialData.regionalPrices && Object.keys(initialData.regionalPrices).length > 0) {
                setRegionalPrices(normalizeRegionalPrices(initialData.regionalPrices, initialData.orderUnit || 1));
            } else {
                // Fallback from old schema data or defaults
                const fallback = createDefaultRegionalPrices();

                // Try to infer old data to C grade
                fallback['C'].KR.cost = formatNumber(initialData.buyPrice || '');
                fallback['C'].KR.wholesale = formatNumber(initialData.krBuyPrice || initialData.sellPrice || '');
                fallback['C'].KR.retail = formatNumber(initialData.krSellPrice || initialData.onlinePrice || '');
                fallback['C'].KR.moq = formatNumber(initialData.minOrderQuantity || 1);
                fallback['C'].KR.orderUnit = formatNumber(initialData.orderUnit || 1);

                fallback['C'].JP.cost = formatNumber(initialData.buyPrice || '');
                fallback['C'].JP.wholesale = formatNumber(initialData.jpBuyPrice || '');
                fallback['C'].JP.retail = formatNumber(initialData.jpSellPrice || '');
                fallback['C'].JP.moq = formatNumber(initialData.minOrderQuantity || 1);
                fallback['C'].JP.orderUnit = formatNumber(initialData.orderUnit || 1);

                fallback['C'].US.cost = formatNumber(initialData.buyPrice || '');
                fallback['C'].US.wholesale = formatNumber(initialData.usBuyPrice || '');
                fallback['C'].US.retail = formatNumber(initialData.usSellPrice || '');
                fallback['C'].US.moq = formatNumber(initialData.minOrderQuantity || 1);
                fallback['C'].US.orderUnit = formatNumber(initialData.orderUnit || 1);

                setRegionalPrices(fallback);
            }
        } else if (isOpen && !initialData) {
            // Reset for create mode
            setName('')
            setNameJP('')
            setNameEN('')
            setBarcode('')
            setProductCode('')
            setGroupName('')
            setPreserveUngroupedState(false)
            setHsCode('')
            setJapanHsCode('')
            setCoupangSku('')
            setPartnerSaleStatus('VISIBLE')
            setImageUrl(null)
            setHasImageChanged(false)
            setStock('0')
            setMinOrderQuantity('1')
            setOrderUnit('1')
            setRegionalPrices(createDefaultRegionalPrices());
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
                    setHasImageChanged(true)
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
            const productData: Record<string, unknown> = {
                name: name.trim(),
                nameJP: nameJP.trim(),
                nameEN: nameEN.trim(),
                barcode: barcode.trim(),
                productCode: normalizeProductCode(productCode.trim()),
                groupName: groupName.trim(),
                autoGroupingDisabled: groupName.trim() ? false : preserveUngroupedState,
                hsCode: normalizeHsCode(hsCode.trim()),
                japanHsCode: normalizeHsCode(japanHsCode.trim()),
                coupangSku: coupangSku.trim(),
                buyPrice: parseFloat(parseNumber(regionalPrices['C'].KR.cost)) || 0,
                cnyBuyPrice: initialData?.cnyBuyPrice ?? 0,
                usdPurchasePrice: initialData?.usdPurchasePrice ?? 0,
                purchaseCurrency: initialData?.purchaseCurrency === 'USD' ? 'USD' : 'CNY',
                sellPrice: parseFloat(parseNumber(regionalPrices['C'].KR.wholesale)) || 0,
                onlinePrice: parseFloat(parseNumber(regionalPrices['C'].KR.retail)) || 0,
                jpBuyPrice: parseFloat(parseNumber(regionalPrices['C'].JP.wholesale)) || 0,
                jpSellPrice: parseFloat(parseNumber(regionalPrices['C'].JP.retail)) || 0,
                krBuyPrice: parseFloat(parseNumber(regionalPrices['C'].KR.wholesale)) || 0,
                krSellPrice: parseFloat(parseNumber(regionalPrices['C'].KR.retail)) || 0,
                usBuyPrice: parseFloat(parseNumber(regionalPrices['C'].US.wholesale)) || 0,
                usSellPrice: parseFloat(parseNumber(regionalPrices['C'].US.retail)) || 0,
                partnerSaleStatus,
                wholesaleAvailable: partnerSaleStatus === 'VISIBLE',
                stock: Math.max(0, Math.round(parseFloat(parseNumber(stock)) || 0)),
                minOrderQuantity: parseInt(parseNumber(minOrderQuantity)) || 1,
                orderUnit: parseInt(parseNumber(orderUnit)) || 1,
                regionalPrices: regionalPrices,
            }

            if (!initialData) {
                if (imageUrl) {
                    productData.imageUrl = imageUrl
                }
            } else if (isCopy) {
                if (hasImageChanged) {
                    productData.imageUrl = imageUrl
                } else if (initialData.imageUrl) {
                    productData.copyImageFromProductId = initialData.id
                } else {
                    productData.imageUrl = null
                }
            } else if (hasImageChanged) {
                productData.imageUrl = imageUrl
            }

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
                    setGroupName('')
                    setHsCode('')
                    setJapanHsCode('')
                    setCoupangSku('')
                    setPartnerSaleStatus('VISIBLE')
                    setImageUrl(null)
                    setHasImageChanged(false)
                    setStock('0')
                    setMinOrderQuantity('1')
                    setOrderUnit('1')
                    setRegionalPrices(createDefaultRegionalPrices());
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

    const inputClass = 'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 transition focus:border-brand-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40'
    const numberInputClass = `${inputClass} text-right font-bold tabular-nums`
    const priceInputClass = 'h-10 w-full rounded-xl border border-slate-200 bg-white pl-7 pr-2 text-right text-xs font-bold tabular-nums text-slate-900 transition focus:border-brand-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40'
    const labelClass = 'text-[11px] font-bold text-slate-600'
    const conversionClass = 'mt-0.5 text-right text-[11px] font-bold leading-tight text-slate-500'
    const modalTitle = isCopy ? '상품 복사 등록' : initialData ? '상품 수정' : '상품 등록'
    const submitLabel = loading ? '저장 중…' : isCopy ? '복사 저장' : '저장'

    const modalContent = (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center overflow-hidden bg-slate-950/45 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={modalTitle}>
            <div
                className="relative flex h-[100dvh] max-h-[100dvh] w-full max-w-5xl flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[95vh] sm:rounded-2xl sm:border sm:border-slate-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
                    <div className="min-w-0">
                        <h3 className="truncate text-lg font-black text-slate-950">{modalTitle}</h3>
                        {initialData ? <p className="truncate text-[11px] font-bold text-slate-500">{initialData.name}</p> : null}
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className={buttonClass('ghost', 'sm', 'h-9 w-9 px-0')}
                        aria-label="닫기"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form
                    onSubmit={handleSubmit}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            const target = e.target as HTMLElement;
                            if (target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'file') {
                                e.preventDefault();
                                e.currentTarget.requestSubmit();
                            }
                        }
                    }}
                    className="flex min-h-0 flex-1 flex-col [&_input:not([type='file'])]:min-h-10 [&_select]:min-h-10"
                >
                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
                        <section className="rounded-2xl border border-slate-200 p-4">
                            <h4 className="mb-3 text-[13px] font-black text-slate-900">기본 정보</h4>

                            <div className="mb-4 flex items-start gap-4">
                                <div
                                    className="group relative flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                                    onClick={() => document.getElementById('image-upload-input')?.click()}
                                >
                                    {imageUrl ? (
                                        <>
                                            <img src={imageUrl} alt="상품 이미지 미리보기" className="h-full w-full object-contain" />
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setHasImageChanged(true)
                                                    setImageUrl(null)
                                                }}
                                                className={buttonClass('danger', 'sm', 'absolute right-1 top-1 h-6 w-6 rounded-full px-0 opacity-100 transition-opacity md:opacity-0 group-hover:opacity-100')}
                                                aria-label="이미지 삭제"
                                            >
                                                <X size={12} />
                                            </button>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center gap-1 text-slate-400">
                                            <ImagePlus size={18} />
                                            <span className="text-[11px] font-bold">이미지 업로드</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <label className={`${labelClass} mb-1 block`}>상품 이미지 선택</label>
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
                                        className={buttonClass('secondary', 'sm')}
                                    >
                                        파일 선택
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                                <div className="space-y-1">
                                    <label className={labelClass}>상품명 (국문)</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        className={inputClass}
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className={labelClass}>상품명 (일문)</label>
                                    <input
                                        type="text"
                                        value={nameJP}
                                        onChange={e => setNameJP(e.target.value)}
                                        className={inputClass}
                                        placeholder="일본어 상품명"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className={labelClass}>상품명 (영문)</label>
                                    <input
                                        type="text"
                                        value={nameEN}
                                        onChange={e => setNameEN(e.target.value)}
                                        className={inputClass}
                                        placeholder="영문 상품명"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className={labelClass}>상품 코드 (SKU)</label>
                                    <input
                                        type="text"
                                        value={productCode}
                                        onChange={e => setProductCode(normalizeProductCode(e.target.value))}
                                        className={`${inputClass} font-mono uppercase`}
                                        placeholder="예: QB-V3-01"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className={labelClass}>상품 그룹명</label>
                                    <input
                                        type="text"
                                        value={groupName}
                                        onChange={e => setGroupName(e.target.value)}
                                        className={inputClass}
                                        placeholder="예: 퀵베이트 V3"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className={labelClass}>관리용 재고</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={stock}
                                        onChange={e => setStock(formatNumber(e.target.value))}
                                        className={`${numberInputClass} font-black`}
                                        placeholder="도매 발주와 무관"
                                    />
                                    <p className="text-[11px] font-bold text-slate-500">관리자가 보는 내부 재고입니다. 파트너 발주 가능 여부와 별도로 관리됩니다.</p>
                                </div>
                                <div className="space-y-1">
                                    <label className={labelClass}>HS Code / 세번부호</label>
                                    <input
                                        type="text"
                                        value={hsCode}
                                        onChange={e => setHsCode(normalizeHsCode(e.target.value))}
                                        className={`${inputClass} font-mono`}
                                        placeholder="예: 9507.90"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className={labelClass}>Japan HS Code / 일본세번</label>
                                    <input
                                        type="text"
                                        value={japanHsCode}
                                        onChange={e => setJapanHsCode(normalizeHsCode(e.target.value))}
                                        className={`${inputClass} font-mono`}
                                        placeholder="예: 9507.90"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className={labelClass}>바코드 번호</label>
                                    <input
                                        type="text"
                                        value={barcode}
                                        onChange={e => setBarcode(e.target.value)}
                                        className={`${inputClass} font-mono`}
                                        placeholder="바코드 번호"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className={labelClass}>쿠팡 연동 바코드 (선택)</label>
                                    <input
                                        type="text"
                                        value={coupangSku}
                                        onChange={e => setCoupangSku(e.target.value)}
                                        className={`${inputClass} font-bold`}
                                        placeholder="쿠팡 판매자상품코드 (숫자)"
                                    />
                                </div>
                            </div>
                        </section>

                        <section className="rounded-2xl border border-slate-200 p-4">
                            <h4 className="mb-3 text-[13px] font-black text-slate-900">발주 설정</h4>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                <div className="space-y-1">
                                    <label className={labelClass}>파트너 노출 상태</label>
                                    <select
                                        value={partnerSaleStatus}
                                        onChange={e => setPartnerSaleStatus(e.target.value as PartnerProductStatus)}
                                        className={`${inputClass} font-bold ${partnerSaleStatus === 'VISIBLE' ? 'text-emerald-700' : partnerSaleStatus === 'SOLD_OUT' ? 'text-amber-700' : 'text-slate-500'}`}
                                    >
                                        <option value="VISIBLE">노출</option>
                                        <option value="HIDDEN">비노출</option>
                                        <option value="SOLD_OUT">품절</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className={labelClass}>최소 주문량</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={minOrderQuantity}
                                        onChange={e => setMinOrderQuantity(formatNumber(e.target.value))}
                                        className={numberInputClass}
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className={labelClass}>주문 단위</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={orderUnit}
                                        onChange={e => setOrderUnit(formatNumber(e.target.value))}
                                        className={numberInputClass}
                                        required
                                    />
                                </div>
                            </div>
                        </section>

                        <section className="rounded-2xl border border-slate-200 p-4">
                            <h4 className="mb-3 text-[13px] font-black text-slate-900">지역별·등급별 단가</h4>

                            <div className="mb-4 flex flex-wrap items-center gap-2">
                                <Tabs
                                    aria-label="가격 등급"
                                    items={['A', 'B', 'C', 'D'].map(grade => ({ key: grade, label: `${grade} 등급` }))}
                                    value={activeGradeTab}
                                    onChange={setActiveGradeTab}
                                />
                                {exchangeRates && (
                                    <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-600 sm:ml-auto sm:w-auto">
                                        <span>실시간 환율</span>
                                        <span className="inline-flex items-center gap-1">
                                            <span className="rounded-full bg-slate-200 px-1.5 py-0.5 font-black text-slate-600">USD</span>
                                            <span className="font-black tabular-nums text-slate-900">₩{Number(exchangeRates.USD).toFixed(0)}</span>
                                        </span>
                                        <span className="inline-flex items-center gap-1">
                                            <span className="rounded-full bg-slate-200 px-1.5 py-0.5 font-black text-slate-600">JPY 100¥</span>
                                            <span className="font-black tabular-nums text-slate-900">₩{Number(exchangeRates.JPY * 100).toFixed(0)}</span>
                                        </span>
                                        <span className="inline-flex items-center gap-1">
                                            <span className="rounded-full bg-slate-200 px-1.5 py-0.5 font-black text-slate-600">CNY</span>
                                            <span className="font-black tabular-nums text-slate-900">₩{Number(exchangeRates.CNY).toFixed(0)}</span>
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
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
                                        <div key={country} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                            <div className="mb-2 inline-flex rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-black text-slate-700">
                                                {labels[country]}
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-7">
                                                <div className="space-y-1">
                                                    <label className={`${labelClass} block h-[15px]`}>매입단가</label>
                                                    <div className="relative">
                                                        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">{prefix[country]}</span>
                                                        <input
                                                            type="text"
                                                            inputMode="numeric"
                                                            value={curPrices.cost}
                                                            onChange={e => setRegionalPrices(prev => ({
                                                                ...prev, [activeGradeTab]: { ...prev[activeGradeTab], [country]: { ...prev[activeGradeTab][country], cost: formatNumber(e.target.value) } }
                                                            }))}
                                                            className={priceInputClass}
                                                        />
                                                    </div>
                                                    {country !== 'KR' && exchangeRates && curPrices.cost && (
                                                        <div className={conversionClass}>
                                                            ≈ {formatNumber(Math.round((parseFloat(parseNumber(curPrices.cost)) || 0) * (country === 'US' ? exchangeRates.USD : exchangeRates.JPY)))}원
                                                        </div>
                                                    )}
                                                    {country === 'KR' && exchangeRates && curPrices.cost && (
                                                        <div className={conversionClass}>
                                                            <div>≈ ¥{formatNumber(Math.round((parseFloat(parseNumber(curPrices.cost)) || 0) / exchangeRates.JPY))}</div>
                                                            <div>≈ ${((parseFloat(parseNumber(curPrices.cost)) || 0) / exchangeRates.USD).toFixed(2)}</div>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="space-y-1">
                                                    <label className={`${labelClass} block h-[15px]`}>도매가</label>
                                                    <div className="relative">
                                                        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">{prefix[country]}</span>
                                                        <input
                                                            type="text"
                                                            inputMode="numeric"
                                                            value={curPrices.wholesale}
                                                            onChange={e => setRegionalPrices(prev => ({
                                                                ...prev, [activeGradeTab]: { ...prev[activeGradeTab], [country]: { ...prev[activeGradeTab][country], wholesale: formatNumber(e.target.value) } }
                                                            }))}
                                                            className={priceInputClass}
                                                        />
                                                    </div>
                                                    {country !== 'KR' && exchangeRates && curPrices.wholesale && (
                                                        <div className={conversionClass}>
                                                            ≈ {formatNumber(Math.round((parseFloat(parseNumber(curPrices.wholesale)) || 0) * (country === 'US' ? exchangeRates.USD : exchangeRates.JPY)))}원
                                                        </div>
                                                    )}
                                                    {country === 'KR' && exchangeRates && curPrices.wholesale && (
                                                        <div className={conversionClass}>
                                                            <div>≈ ¥{formatNumber(Math.round((parseFloat(parseNumber(curPrices.wholesale)) || 0) / exchangeRates.JPY))}</div>
                                                            <div>≈ ${((parseFloat(parseNumber(curPrices.wholesale)) || 0) / exchangeRates.USD).toFixed(2)}</div>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="space-y-1">
                                                    <label className={`${labelClass} block h-[15px]`}>판매가</label>
                                                    <div className="relative">
                                                        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">{prefix[country]}</span>
                                                        <input
                                                            type="text"
                                                            inputMode="numeric"
                                                            value={curPrices.retail}
                                                            onChange={e => setRegionalPrices(prev => ({
                                                                ...prev, [activeGradeTab]: { ...prev[activeGradeTab], [country]: { ...prev[activeGradeTab][country], retail: formatNumber(e.target.value) } }
                                                            }))}
                                                            className={priceInputClass}
                                                        />
                                                    </div>
                                                    {country !== 'KR' && exchangeRates && curPrices.retail && (
                                                        <div className={conversionClass}>
                                                            ≈ {formatNumber(Math.round((parseFloat(parseNumber(curPrices.retail)) || 0) * (country === 'US' ? exchangeRates.USD : exchangeRates.JPY)))}원
                                                        </div>
                                                    )}
                                                    {country === 'KR' && exchangeRates && curPrices.retail && (
                                                        <div className={conversionClass}>
                                                            <div>≈ ¥{formatNumber(Math.round((parseFloat(parseNumber(curPrices.retail)) || 0) / exchangeRates.JPY))}</div>
                                                            <div>≈ ${((parseFloat(parseNumber(curPrices.retail)) || 0) / exchangeRates.USD).toFixed(2)}</div>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="space-y-1">
                                                    <label className={`${labelClass} block h-[15px]`}>최소수량 (MOQ)</label>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        value={curPrices.moq}
                                                        onChange={e => setRegionalPrices(prev => ({
                                                            ...prev, [activeGradeTab]: { ...prev[activeGradeTab], [country]: { ...prev[activeGradeTab][country], moq: formatNumber(e.target.value) } }
                                                        }))}
                                                        className={`${numberInputClass} px-2 text-xs`}
                                                    />
                                                </div>

                                                <div className="space-y-1">
                                                    <label className={`${labelClass} block h-[15px]`}>주문단위</label>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        value={curPrices.orderUnit}
                                                        onChange={e => setRegionalPrices(prev => ({
                                                            ...prev, [activeGradeTab]: { ...prev[activeGradeTab], [country]: { ...prev[activeGradeTab][country], orderUnit: formatNumber(e.target.value) } }
                                                        }))}
                                                        className={`${numberInputClass} px-2 text-xs`}
                                                    />
                                                </div>

                                                <div className="flex flex-col justify-center rounded-xl border border-slate-200 bg-slate-100 p-1.5 text-right">
                                                    <label className="mb-0.5 block text-[11px] font-bold text-slate-500">베이코 마진율</label>
                                                    <span className={`text-xs font-black ${Number(beicoMargin) < 0 ? 'text-red-500' : 'text-slate-900'}`}>{beicoMargin}%</span>
                                                </div>

                                                <div className="flex flex-col justify-center rounded-xl border border-slate-200 bg-slate-100 p-1.5 text-right">
                                                    <label className="mb-0.5 block text-[11px] font-bold text-slate-500">도매상 마진율</label>
                                                    <span className={`text-xs font-black ${Number(wholesalerMargin) < 0 ? 'text-red-500' : 'text-slate-900'}`}>{wholesalerMargin}%</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    </div>

                    <div className="sticky bottom-0 z-10 flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
                        <Button variant="secondary" onClick={() => setIsOpen(false)} className="flex-1 sm:flex-none">
                            취소
                        </Button>
                        <Button type="submit" variant="primary" loading={loading} className="flex-[2] sm:flex-none">
                            {submitLabel}
                        </Button>
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
                        <Button variant="primary" icon={<Plus size={15} />}>
                            새 상품 추가
                        </Button>
                    )}
                </div>
            )}
            {isOpen && mounted && createPortal(modalContent, document.body)}
        </>
    )
}
