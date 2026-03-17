'use client'

import { useMemo, useState } from 'react'

export type PartnerOption = {
    id: string
    name: string
    businessName: string | null
    representativeName: string | null
    email: string | null
    contact: string | null
    address: string | null
}

export type ProductOption = {
    id: string
    name: string
    nameEN: string | null
    nameJP: string | null
    productCode: string | null
    imageUrl: string | null
    usBuyPrice: number
    stock: number
}

type IssuedInvoiceItem = {
    id: string
    productId: string | null
    productName: string
    productNameEN: string | null
    productCode: string | null
    quantity: number
    unitPriceUsd: number
    amountUsd: number
}

export type IssuedInvoice = {
    id: string
    invoiceNumber: string
    issueDate: string
    partnerName: string
    totalUsd: number
    items: IssuedInvoiceItem[]
}

type DraftState = Record<string, { checked: boolean; quantity: number }>

type PreviewInvoice = {
    id: string
    invoiceNumber: string
    issueDate: string
    partnerName: string
    totalUsd: number
    items: IssuedInvoiceItem[]
}

const makeInitialDraftState = (products: ProductOption[]): DraftState =>
    Object.fromEntries(products.map((product) => [product.id, { checked: false, quantity: 1 }]))

const usdFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
})

const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
})

const textOrDash = (value: string | null | undefined) => (value && value.trim().length > 0 ? value : '-')

export default function ProformaClient({
    partners,
    products,
    initialIssuedInvoices
}: {
    partners: PartnerOption[]
    products: ProductOption[]
    initialIssuedInvoices: IssuedInvoice[]
}) {
    const [selectedPartnerId, setSelectedPartnerId] = useState('')
    const [draftState, setDraftState] = useState<DraftState>(() => makeInitialDraftState(products))
    const [issuedInvoices, setIssuedInvoices] = useState<IssuedInvoice[]>(initialIssuedInvoices)
    const [activeIssuedId, setActiveIssuedId] = useState<string | null>(initialIssuedInvoices[0]?.id || null)
    const [isIssuing, setIsIssuing] = useState(false)

    const selectedPartner = useMemo(
        () => partners.find((partner) => partner.id === selectedPartnerId) || null,
        [partners, selectedPartnerId]
    )

    const draftItems = useMemo<IssuedInvoiceItem[]>(() => {
        return products
            .filter((product) => draftState[product.id]?.checked)
            .map((product) => {
                const quantity = Math.max(1, draftState[product.id]?.quantity || 1)
                const unitPriceUsd = Number(product.usBuyPrice || 0)
                return {
                    id: `draft-${product.id}`,
                    productId: product.id,
                    productName: product.nameJP || product.name,
                    productNameEN: product.nameEN,
                    productCode: product.productCode,
                    quantity,
                    unitPriceUsd,
                    amountUsd: unitPriceUsd * quantity
                }
            })
    }, [products, draftState])

    const draftTotalUsd = useMemo(
        () => draftItems.reduce((sum, item) => sum + item.amountUsd, 0),
        [draftItems]
    )

    const activeIssuedInvoice = useMemo(
        () => issuedInvoices.find((invoice) => invoice.id === activeIssuedId) || null,
        [issuedInvoices, activeIssuedId]
    )

    const previewPartner = useMemo(() => {
        if (selectedPartner) return selectedPartner
        if (!activeIssuedInvoice) return null
        return partners.find((partner) => (partner.businessName || partner.name) === activeIssuedInvoice.partnerName) || null
    }, [selectedPartner, activeIssuedInvoice, partners])

    const previewInvoice = useMemo<PreviewInvoice>(() => {
        if (activeIssuedInvoice) {
            return {
                id: activeIssuedInvoice.id,
                invoiceNumber: activeIssuedInvoice.invoiceNumber,
                issueDate: activeIssuedInvoice.issueDate,
                partnerName: activeIssuedInvoice.partnerName,
                totalUsd: activeIssuedInvoice.totalUsd,
                items: activeIssuedInvoice.items
            }
        }

        const partnerName = selectedPartner?.businessName || selectedPartner?.name || '-'
        return {
            id: 'draft',
            invoiceNumber: 'DRAFT-PI',
            issueDate: new Date().toISOString(),
            partnerName,
            totalUsd: draftTotalUsd,
            items: draftItems
        }
    }, [activeIssuedInvoice, selectedPartner, draftTotalUsd, draftItems])

    const issueDate = useMemo(() => new Date(previewInvoice.issueDate), [previewInvoice.issueDate])
    const dueDate = useMemo(() => {
        const date = new Date(previewInvoice.issueDate)
        date.setDate(date.getDate() + 30)
        return date
    }, [previewInvoice.issueDate])
    const estShipDate = useMemo(() => {
        const date = new Date(previewInvoice.issueDate)
        date.setDate(date.getDate() + 7)
        return date
    }, [previewInvoice.issueDate])
    const totalQuantity = useMemo(
        () => previewInvoice.items.reduce((sum, item) => sum + item.quantity, 0),
        [previewInvoice.items]
    )
    const printableRows = useMemo(() => {
        const baseRows = previewInvoice.items.map((item, index) => ({
            id: item.id,
            no: index + 1,
            description: item.productName,
            price: item.unitPriceUsd,
            quantity: item.quantity,
            amount: item.amountUsd
        }))
        const blanks = Array.from({ length: Math.max(0, 5 - baseRows.length) }, (_, idx) => ({
            id: `blank-${idx}`,
            no: baseRows.length + idx + 1,
            description: '',
            price: 0,
            quantity: 0,
            amount: 0
        }))
        return [...baseRows, ...blanks]
    }, [previewInvoice.items])
    const subtotalUsd = previewInvoice.totalUsd
    const taxUsd = 0
    const shippingUsd = 0
    const grandTotalUsd = subtotalUsd + taxUsd + shippingUsd

    const toggleProduct = (productId: string) => {
        setDraftState((prev) => ({
            ...prev,
            [productId]: {
                checked: !prev[productId]?.checked,
                quantity: Math.max(1, prev[productId]?.quantity || 1)
            }
        }))
        setActiveIssuedId(null)
    }

    const updateQuantity = (productId: string, value: string) => {
        const parsed = Number(value.replace(/[^0-9]/g, ''))
        const safeQuantity = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1

        setDraftState((prev) => ({
            ...prev,
            [productId]: {
                checked: true,
                quantity: safeQuantity
            }
        }))
        setActiveIssuedId(null)
    }

    const resetDraft = () => {
        setDraftState(makeInitialDraftState(products))
        setActiveIssuedId(null)
    }

    const handleIssue = async () => {
        if (!selectedPartnerId) {
            alert('업체를 먼저 선택해주세요.')
            return
        }
        if (draftItems.length === 0) {
            alert('상품을 1개 이상 선택해주세요.')
            return
        }

        setIsIssuing(true)
        try {
            const response = await fetch('/api/admin/proforma', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    partnerId: selectedPartnerId,
                    items: draftItems.map((item) => ({
                        productId: item.productId,
                        quantity: item.quantity
                    }))
                })
            })

            const data = await response.json()
            if (!response.ok) {
                alert(data?.error || 'PI 발행에 실패했습니다.')
                return
            }

            const created: IssuedInvoice = {
                id: data.id,
                invoiceNumber: data.invoiceNumber,
                issueDate: data.issueDate,
                partnerName: data.partnerName,
                totalUsd: data.totalUsd,
                items: (Array.isArray(data.items) ? data.items : []).map((item: unknown) => {
                    const typed = item as Record<string, unknown>
                    return {
                        id: typeof typed.id === 'string' ? typed.id : '',
                        productId: typeof typed.productId === 'string' ? typed.productId : null,
                        productName: typeof typed.productName === 'string' ? typed.productName : '',
                        productNameEN: typeof typed.productNameEN === 'string' ? typed.productNameEN : null,
                        productCode: typeof typed.productCode === 'string' ? typed.productCode : null,
                        quantity: Number(typed.quantity || 0),
                        unitPriceUsd: Number(typed.unitPriceUsd || 0),
                        amountUsd: Number(typed.amountUsd || 0)
                    }
                })
            }

            setIssuedInvoices((prev) => [created, ...prev])
            setActiveIssuedId(created.id)
            alert('PI가 발행되어 발급리스트에 저장되었습니다.')
        } catch (error) {
            console.error(error)
            alert('PI 발행 중 오류가 발생했습니다.')
        } finally {
            setIsIssuing(false)
        }
    }

    const handlePrint = () => {
        if (previewInvoice.items.length === 0) {
            alert('출력할 PI 항목이 없습니다.')
            return
        }
        window.print()
    }

    return (
        <div className="space-y-6">
            <style jsx global>{`
                @page {
                    size: A4;
                    margin: 10mm;
                }
                @media print {
                    body {
                        margin: 0;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                        background: white;
                    }
                    .pi-no-print {
                        display: none !important;
                    }
                    #pi-print-sheet {
                        box-shadow: none !important;
                        border: 0 !important;
                        margin: 0 auto !important;
                        width: 190mm !important;
                        min-height: 277mm !important;
                    }
                }
            `}</style>

            <div className="pi-no-print grid grid-cols-1 xl:grid-cols-3 gap-6">
                <section className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div>
                            <h2 className="text-base font-black text-gray-900">PI 작성</h2>
                            <p className="text-xs text-gray-500 mt-1">업체를 선택하고 상품을 체크하면 USD 단가 기준으로 PI 견적리스트가 생성됩니다.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={resetDraft}
                                className="px-3 py-2 rounded-xl text-xs font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
                            >
                                초기화
                            </button>
                            <button
                                type="button"
                                onClick={handlePrint}
                                className="px-4 py-2 rounded-xl text-xs font-bold bg-gray-900 text-white hover:bg-black transition-all"
                            >
                                출력 (PDF 저장/인쇄)
                            </button>
                            <button
                                type="button"
                                onClick={handleIssue}
                                disabled={isIssuing}
                                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#d9361b] text-white hover:brightness-110 disabled:opacity-50 transition-all"
                            >
                                {isIssuing ? '발행 중...' : '발행하기'}
                            </button>
                        </div>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                        <label className="text-xs font-bold text-gray-700">업체 선택</label>
                        <select
                            value={selectedPartnerId}
                            onChange={(event) => {
                                setSelectedPartnerId(event.target.value)
                                setActiveIssuedId(null)
                            }}
                            className="mt-2 w-full bg-white border border-gray-200 rounded-xl p-2.5 text-sm font-bold focus:ring-[#d9361b] focus:border-[#d9361b]"
                        >
                            <option value="">업체를 선택하세요</option>
                            {partners.map((partner) => (
                                <option key={partner.id} value={partner.id}>
                                    {partner.businessName || partner.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="overflow-x-auto border border-gray-100 rounded-xl">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-100 text-gray-600">
                                <tr>
                                    <th className="px-3 py-2 text-center">선택</th>
                                    <th className="px-3 py-2 text-left">상품</th>
                                    <th className="px-3 py-2 text-center">재고</th>
                                    <th className="px-3 py-2 text-right">USD 단가</th>
                                    <th className="px-3 py-2 text-center">수량</th>
                                    <th className="px-3 py-2 text-right">금액(USD)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {products.map((product) => {
                                    const rowState = draftState[product.id] || { checked: false, quantity: 1 }
                                    const amount = rowState.quantity * Number(product.usBuyPrice || 0)
                                    return (
                                        <tr key={product.id} className={rowState.checked ? 'bg-[#d9361b]/5' : 'bg-white'}>
                                            <td className="px-3 py-2 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={rowState.checked}
                                                    onChange={() => toggleProduct(product.id)}
                                                    className="h-4 w-4 accent-[#d9361b]"
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="font-bold text-gray-900">{product.nameJP || product.name}</div>
                                                <div className="text-[11px] text-gray-500">{product.nameEN || product.name}</div>
                                                <div className="text-[10px] text-gray-400 font-mono">{product.productCode || '-'}</div>
                                            </td>
                                            <td className="px-3 py-2 text-center text-gray-600">{product.stock.toLocaleString()}</td>
                                            <td className="px-3 py-2 text-right font-bold text-gray-900">{usdFormatter.format(Number(product.usBuyPrice || 0))}</td>
                                            <td className="px-3 py-2 text-center">
                                                <input
                                                    type="number"
                                                    min={1}
                                                    value={rowState.quantity}
                                                    onChange={(event) => updateQuantity(product.id, event.target.value)}
                                                    className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-center font-bold"
                                                />
                                            </td>
                                            <td className="px-3 py-2 text-right font-bold text-[#d9361b]">
                                                {rowState.checked ? usdFormatter.format(amount) : '-'}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                    <div>
                        <h2 className="text-base font-black text-gray-900">PI 발급리스트</h2>
                        <p className="text-xs text-gray-500 mt-1">날짜, 업체명, 총가격 기준으로 확인할 수 있습니다.</p>
                    </div>

                    <div className="max-h-[520px] overflow-auto border border-gray-100 rounded-xl">
                        <table className="w-full text-xs">
                            <thead className="bg-gray-50 text-gray-600 border-b border-gray-100">
                                <tr>
                                    <th className="px-3 py-2 text-left">날짜</th>
                                    <th className="px-3 py-2 text-left">업체명</th>
                                    <th className="px-3 py-2 text-right">총가격</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {issuedInvoices.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="px-3 py-8 text-center text-gray-400">발급된 PI가 없습니다.</td>
                                    </tr>
                                ) : (
                                    issuedInvoices.map((invoice) => (
                                        <tr
                                            key={invoice.id}
                                            className={`cursor-pointer hover:bg-gray-50 ${activeIssuedId === invoice.id ? 'bg-[#d9361b]/5' : ''}`}
                                            onClick={() => setActiveIssuedId(invoice.id)}
                                        >
                                            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{dateFormatter.format(new Date(invoice.issueDate))}</td>
                                            <td className="px-3 py-2 font-bold text-gray-900">{invoice.partnerName}</td>
                                            <td className="px-3 py-2 text-right font-bold text-[#d9361b]">{usdFormatter.format(invoice.totalUsd)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>

            <section id="pi-print-sheet" className="bg-[#f3f4f8] rounded-2xl border border-gray-200 shadow-lg p-8 max-w-[210mm] mx-auto text-[#22253f]">
                <div className="bg-[#6f1d91] text-white -mx-8 -mt-8 px-8 pt-6 pb-5 rounded-t-2xl">
                    <div className="flex items-start justify-between gap-4">
                        <div className="w-20 text-center">
                            <div className="mx-auto w-12 h-12 rounded-full border border-white/60 flex items-center justify-center text-xl font-black">$</div>
                            <div className="text-[10px] font-bold mt-2 tracking-wider">BEIKO TRADING</div>
                        </div>
                        <div className="flex-1 text-center">
                            <h1 className="text-[42px] leading-none font-black tracking-tight">PROFORMA INVOICE</h1>
                            <p className="mt-2 text-sm font-bold">BEIKO Co., Ltd.</p>
                            <p className="text-xs mt-1">35, Nakdongnam-ro 1013beon-gil, Gangseo-gu, Busan</p>
                            <p className="text-xs mt-0.5">+82-10-8119-3313 · contact@beiko.co.kr</p>
                        </div>
                        <div className="w-20" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="border border-[#6f1d91]/20 bg-white">
                        <div className="bg-[#6f1d91] text-white px-3 py-1.5 font-black text-sm">Bill To</div>
                        <div className="p-3 space-y-2 text-sm">
                            <div className="grid grid-cols-[82px_1fr] gap-2"><span className="font-black">Name</span><span>{textOrDash(previewPartner?.businessName || previewPartner?.name || previewInvoice.partnerName)}</span></div>
                            <div className="grid grid-cols-[82px_1fr] gap-2"><span className="font-black">Email</span><span>{textOrDash(previewPartner?.email)}</span></div>
                            <div className="grid grid-cols-[82px_1fr] gap-2"><span className="font-black">Phone</span><span>{textOrDash(previewPartner?.contact)}</span></div>
                            <div className="grid grid-cols-[82px_1fr] gap-2"><span className="font-black">Address</span><span>{textOrDash(previewPartner?.address)}</span></div>
                        </div>
                    </div>
                    <div className="border border-[#6f1d91]/20 bg-white">
                        <div className="bg-[#6f1d91] text-white px-3 py-1.5 font-black text-sm">Ship To</div>
                        <div className="p-3 space-y-2 text-sm">
                            <div className="grid grid-cols-[82px_1fr] gap-2"><span className="font-black">Name</span><span>{textOrDash(previewPartner?.representativeName || previewPartner?.businessName || previewPartner?.name || previewInvoice.partnerName)}</span></div>
                            <div className="grid grid-cols-[82px_1fr] gap-2"><span className="font-black">Email</span><span>{textOrDash(previewPartner?.email)}</span></div>
                            <div className="grid grid-cols-[82px_1fr] gap-2"><span className="font-black">Phone</span><span>{textOrDash(previewPartner?.contact)}</span></div>
                            <div className="grid grid-cols-[82px_1fr] gap-2"><span className="font-black">Address</span><span>{textOrDash(previewPartner?.address)}</span></div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="border border-[#6f1d91]/20 bg-white">
                        <div className="bg-[#6f1d91] text-white px-3 py-1.5 font-black text-sm">Shipping Details</div>
                        <div className="p-3 space-y-2 text-sm">
                            <div className="grid grid-cols-[122px_1fr] gap-2"><span className="font-black">Est. Ship Date</span><span>{dateFormatter.format(estShipDate)}</span></div>
                            <div className="grid grid-cols-[122px_1fr] gap-2"><span className="font-black">Est. Weight (kg)</span><span>{totalQuantity.toLocaleString()}</span></div>
                            <div className="grid grid-cols-[122px_1fr] gap-2"><span className="font-black">Transportation</span><span>Air</span></div>
                            <div className="grid grid-cols-[122px_1fr] gap-2"><span className="font-black">Carrier</span><span>-</span></div>
                        </div>
                    </div>
                    <div className="border border-[#6f1d91]/20 bg-white">
                        <div className="bg-[#6f1d91] text-white px-3 py-1.5 font-black text-sm">Invoice Details</div>
                        <div className="p-3 space-y-2 text-sm">
                            <div className="grid grid-cols-[98px_1fr] gap-2"><span className="font-black">Invoice #</span><span>{previewInvoice.invoiceNumber}</span></div>
                            <div className="grid grid-cols-[98px_1fr] gap-2"><span className="font-black">Invoice Date</span><span>{dateFormatter.format(issueDate)}</span></div>
                            <div className="grid grid-cols-[98px_1fr] gap-2"><span className="font-black">Due Date</span><span>{dateFormatter.format(dueDate)}</span></div>
                        </div>
                    </div>
                </div>

                <div className="h-[3px] bg-[#6f1d91] mt-4 mb-3" />

                <table className="w-full text-sm border-collapse border border-[#cdcfdb] bg-white">
                    <thead className="bg-[#e7e7f1] text-[#2b2f4c]">
                        <tr>
                            <th className="border border-[#cdcfdb] px-2 py-2 text-left w-12">#</th>
                            <th className="border border-[#cdcfdb] px-2 py-2 text-left">Description</th>
                            <th className="border border-[#cdcfdb] px-2 py-2 text-right w-32">Price ($)</th>
                            <th className="border border-[#cdcfdb] px-2 py-2 text-right w-24">Quantity</th>
                            <th className="border border-[#cdcfdb] px-2 py-2 text-right w-32">Amount ($)</th>
                        </tr>
                    </thead>
                    <tbody className="text-[#4d5168]">
                        {printableRows.map((row) => (
                            <tr key={row.id}>
                                <td className="border border-[#cdcfdb] px-2 py-2 text-left font-black">{row.no}</td>
                                <td className="border border-[#cdcfdb] px-2 py-2">{row.description || '-'}</td>
                                <td className="border border-[#cdcfdb] px-2 py-2 text-right">{row.description ? usdFormatter.format(row.price) : '-'}</td>
                                <td className="border border-[#cdcfdb] px-2 py-2 text-right">{row.quantity > 0 ? row.quantity.toLocaleString() : '-'}</td>
                                <td className="border border-[#cdcfdb] px-2 py-2 text-right">{row.description ? usdFormatter.format(row.amount) : usdFormatter.format(0)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="grid grid-cols-2 gap-5 mt-4 text-sm">
                    <div className="space-y-4">
                        <div className="grid grid-cols-[130px_1fr] gap-2">
                            <span className="font-black">Payment Method</span>
                            <span>Bank Transfer</span>
                        </div>
                        <div className="flex items-start gap-2 text-[#5a5f79]">
                            <span className="mt-0.5">☑</span>
                            <p>I acknowledge that the information above is accurate and true.</p>
                        </div>
                        <div className="space-y-2">
                            <div className="grid grid-cols-[130px_1fr] gap-2"><span className="font-black">Shipper Name</span><span>{textOrDash(previewPartner?.representativeName || previewPartner?.name)}</span></div>
                            <div className="grid grid-cols-[130px_1fr] gap-2 items-end">
                                <span className="font-black">Shipper Signature</span>
                                <div className="h-8 border-b border-[#a7aac0]" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="grid grid-cols-[1fr_auto] gap-2"><span className="font-black">Subtotal</span><span>{usdFormatter.format(subtotalUsd)}</span></div>
                        <div className="grid grid-cols-[1fr_auto] gap-2"><span className="font-black">Tax ($)</span><span>{usdFormatter.format(taxUsd)}</span></div>
                        <div className="grid grid-cols-[1fr_auto] gap-2"><span className="font-black">Shipping ($)</span><span>{usdFormatter.format(shippingUsd)}</span></div>
                        <div className="grid grid-cols-[1fr_auto] gap-2 bg-[#dfd3e9] px-3 py-2 font-black text-base">
                            <span>Total Amount</span>
                            <span>{usdFormatter.format(grandTotalUsd)}</span>
                        </div>
                    </div>
                </div>

                <div className="mt-6 text-xs text-[#6f748f]">
                    Notes: This invoice is in USD. Total payment due is 30 days.
                </div>
            </section>
        </div>
    )
}
