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
const usdText = (value: number) =>
    `US$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const slashDate = (date: Date) =>
    `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`

const CONSIGNEE_INFO = {
    companyName: 'LODOS BALIKCILIK ITH.IHR.SAN.VE TIC.LTD.STI.',
    addressLine1: 'MAHMUTBEY MAH.2420 SOKAK ISTOC 4.ADA NO:70/76',
    addressLine2: 'BAGCILAR - ISTANBUL, TURKEY',
    phone: '+90 212 6592063',
    tax: 'Gunesli VD.6090890618'
}

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
    const [leftTab, setLeftTab] = useState<'write' | 'issued'>('write')
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
        if (activeIssuedInvoice) {
            return partners.find((partner) => (partner.businessName || partner.name) === activeIssuedInvoice.partnerName) || null
        }
        if (selectedPartner) return selectedPartner
        return null
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
    const issueDateText = useMemo(() => slashDate(issueDate), [issueDate])
    const totalQuantity = useMemo(
        () => previewInvoice.items.reduce((sum, item) => sum + item.quantity, 0),
        [previewInvoice.items]
    )
    const productMap = useMemo(
        () => new Map(products.map((product) => [product.id, product])),
        [products]
    )
    const printableRows = useMemo(() => {
        const baseRows = previewInvoice.items.map((item, index) => {
            const productMeta = item.productId ? productMap.get(item.productId) : undefined
            const model = textOrDash(productMeta?.productCode || item.productCode)
            const specificationLines = [
                `Commodity: ${textOrDash(item.productNameEN || item.productName)}`,
                `Model: ${model}`,
                `Price term: EXW (US$)`,
                `Source price: Product.usBuyPrice`
            ]
            return {
                id: item.id,
                no: index + 1,
                productName: item.productName,
                model,
                imageUrl: productMeta?.imageUrl || null,
                specificationLines,
                price: item.unitPriceUsd,
                quantity: item.quantity,
                amount: item.amountUsd,
                isBlank: false
            }
        })
        const blanks = Array.from({ length: Math.max(0, 5 - baseRows.length) }, (_, idx) => ({
            id: `blank-${idx}`,
            no: baseRows.length + idx + 1,
            productName: '',
            model: '',
            imageUrl: null,
            specificationLines: [] as string[],
            price: 0,
            quantity: 0,
            amount: 0,
            isBlank: true
        }))
        return [...baseRows, ...blanks]
    }, [previewInvoice.items, productMap])
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
        setLeftTab('write')
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
        setLeftTab('write')
    }

    const resetDraft = () => {
        setDraftState(makeInitialDraftState(products))
        setActiveIssuedId(null)
        setLeftTab('write')
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
            setLeftTab('issued')
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
        const printTarget = document.getElementById('pi-print-sheet')
        if (!printTarget) {
            alert('인쇄할 PI 문서를 찾을 수 없습니다.')
            return
        }

        const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1024,height=1400')
        if (!printWindow) {
            alert('팝업이 차단되어 인쇄창을 열 수 없습니다. 팝업 허용 후 다시 시도해주세요.')
            return
        }

        const inheritedStyles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
            .map((node) => node.outerHTML)
            .join('\n')

        const printDoc = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${previewInvoice.invoiceNumber}</title>
  ${inheritedStyles}
  <style>
    @page {
      size: A4;
      margin: 10mm;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    #pi-print-sheet {
      margin: 0 auto !important;
      width: 190mm !important;
      min-height: 277mm !important;
      max-width: 190mm !important;
      box-shadow: none !important;
      border: 0 !important;
      border-radius: 0 !important;
      background: #ffffff !important;
      padding: 6mm 8mm !important;
      overflow: visible !important;
      aspect-ratio: auto !important;
    }
  </style>
</head>
<body>
  ${printTarget.outerHTML}
</body>
</html>`

        printWindow.document.open()
        printWindow.document.write(printDoc)
        printWindow.document.close()

        printWindow.addEventListener(
            'load',
            () => {
                printWindow.focus()
                setTimeout(() => {
                    printWindow.print()
                }, 220)
            },
            { once: true }
        )
        printWindow.onafterprint = () => {
            printWindow.close()
        }
    }

    return (
        <div className="space-y-6">
            <style jsx global>{`
                @page {
                    size: A4;
                    margin: 10mm;
                }
                @media print {
                    html, body {
                        margin: 0 !important;
                        padding: 0 !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                        background: white !important;
                    }
                    body * {
                        visibility: hidden !important;
                    }
                    .pi-no-print {
                        display: none !important;
                    }
                    #pi-print-sheet,
                    #pi-print-sheet * {
                        visibility: visible !important;
                    }
                    #pi-print-sheet {
                        position: fixed !important;
                        left: 0 !important;
                        top: 0 !important;
                        box-shadow: none !important;
                        border: 0 !important;
                        border-radius: 0 !important;
                        margin: 0 !important;
                        padding: 6mm 8mm !important;
                        width: 190mm !important;
                        min-height: 277mm !important;
                        max-height: none !important;
                        overflow: visible !important;
                        aspect-ratio: auto !important;
                        background: white !important;
                    }
                }
            `}</style>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(340px,0.72fr)_minmax(210mm,1fr)] gap-6 items-start xl:justify-center">
                <div className="pi-no-print space-y-6 xl:max-w-[560px]">
                    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div>
                                <h2 className="text-base font-black text-gray-900">프로포마인보이스 관리</h2>
                                <p className="text-xs text-gray-500 mt-1">좌측 탭에서 제품리스트 작성/발급리스트 관리를 분리했습니다.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handlePrint}
                                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[#e53b19] text-white hover:brightness-110 transition-all"
                                >
                                    출력 (PDF 저장/인쇄)
                                </button>
                                {leftTab === 'write' && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={resetDraft}
                                            className="px-3 py-2 rounded-xl text-xs font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
                                        >
                                            초기화
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleIssue}
                                            disabled={isIssuing}
                                            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#e53b19] text-white hover:brightness-110 disabled:opacity-50 transition-all"
                                        >
                                            {isIssuing ? '발행 중...' : '발행하기'}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="inline-flex rounded-xl border border-gray-200 p-1 bg-gray-50">
                            <button
                                type="button"
                                onClick={() => setLeftTab('write')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${leftTab === 'write' ? 'bg-[#e53b19] text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                            >
                                PI 작성
                            </button>
                            <button
                                type="button"
                                onClick={() => setLeftTab('issued')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${leftTab === 'issued' ? 'bg-[#e53b19] text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                            >
                                PI 발급리스트
                            </button>
                        </div>

                        {leftTab === 'write' ? (
                            <div className="space-y-4">
                                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                    <label className="text-xs font-bold text-gray-700">업체 선택</label>
                                    <select
                                        value={selectedPartnerId}
                                        onChange={(event) => {
                                            setSelectedPartnerId(event.target.value)
                                            setActiveIssuedId(null)
                                            setLeftTab('write')
                                        }}
                                        className="mt-2 w-full bg-white border border-gray-200 rounded-xl p-2.5 text-sm font-bold focus:ring-[#e53b19] focus:border-[#e53b19]"
                                    >
                                        <option value="">업체를 선택하세요</option>
                                        {partners.map((partner) => (
                                            <option key={partner.id} value={partner.id}>
                                                {partner.businessName || partner.name}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="mt-2 text-[11px] text-gray-500">USD 단가는 상품관리 DB의 `usBuyPrice`를 그대로 불러옵니다.</p>
                                </div>

                                <div className="overflow-x-auto border border-gray-100 rounded-xl">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 border-b border-gray-100 text-gray-600">
                                            <tr>
                                                <th className="px-3 py-2 text-center">선택</th>
                                                <th className="px-3 py-2 text-center">이미지</th>
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
                                                    <tr key={product.id} className={rowState.checked ? 'bg-[#e53b19]/5' : 'bg-white'}>
                                                        <td className="px-3 py-2 text-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={rowState.checked}
                                                                onChange={() => toggleProduct(product.id)}
                                                                className="h-4 w-4 accent-[#e53b19]"
                                                            />
                                                        </td>
                                                        <td className="px-3 py-2 text-center">
                                                            <div className="mx-auto w-11 h-11 rounded-lg border border-gray-200 bg-white overflow-hidden flex items-center justify-center">
                                                                {product.imageUrl ? (
                                                                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <span className="text-[10px] text-gray-300 font-black">IMG</span>
                                                                )}
                                                            </div>
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
                                                        <td className="px-3 py-2 text-right font-bold text-[#e53b19]">
                                                            {rowState.checked ? usdFormatter.format(amount) : '-'}
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div>
                                    <h3 className="text-sm font-black text-gray-900">PI 발급리스트</h3>
                                    <p className="text-xs text-gray-500 mt-1">발급된 PI를 선택하면 우측 인쇄 미리보기에 즉시 반영됩니다.</p>
                                </div>
                                <div className="max-h-[620px] overflow-auto border border-gray-100 rounded-xl">
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
                                                        className={`cursor-pointer hover:bg-gray-50 ${activeIssuedId === invoice.id ? 'bg-[#e53b19]/5' : ''}`}
                                                        onClick={() => setActiveIssuedId(invoice.id)}
                                                    >
                                                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{dateFormatter.format(new Date(invoice.issueDate))}</td>
                                                        <td className="px-3 py-2 font-bold text-gray-900">{invoice.partnerName}</td>
                                                        <td className="px-3 py-2 text-right font-bold text-[#e53b19]">{usdFormatter.format(invoice.totalUsd)}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </section>
                </div>

                <section
                    id="pi-print-sheet"
                    className="bg-[#f6f3f1] border border-gray-200 shadow-lg p-4 w-full max-w-[560px] aspect-[210/297] overflow-auto mx-auto text-[#22253f] xl:sticky xl:top-24 xl:w-[210mm] xl:max-w-none xl:min-w-[210mm] xl:h-[297mm] xl:min-h-[297mm] xl:aspect-auto"
                >
                    <div className="pi-no-print mb-3 text-xs font-black text-[#e53b19] tracking-wide">실시간 인쇄 미리보기</div>

                    <div className="bg-white border border-gray-300 p-3">
                        <div className="h-1 w-full bg-[#e53b19] mb-2" />
                        <div className="flex items-start gap-2 border-b-2 border-[#e53b19] pb-2">
                            <div className="w-20 pt-1 shrink-0">
                                <img src="/logo.png" alt="BEIKO" className="w-full object-contain" />
                            </div>
                            <div className="flex-1 text-center">
                                <h1 className="text-2xl leading-none font-black tracking-tight text-[#1f2340]">beiko Inc.</h1>
                                <p className="mt-1 text-[11px]">ADD: 35, Nakdongnam-ro 1013beon-gil, Gangseo-gu, Busan, Korea</p>
                                <p className="text-[11px] mt-0.5">Mob: +82-10-3444-3467&nbsp;&nbsp; EMAIL: contact@beiko.co.kr</p>
                            </div>
                        </div>

                        <h2 className="text-center text-xl font-black text-[#e53b19] mt-2 mb-2">Proforma Invoice</h2>

                        <table className="w-full border-collapse border border-gray-900 text-[11px]">
                            <tbody>
                                <tr>
                                    <td className="border border-gray-900 px-2 py-1 w-16 font-black">No.:</td>
                                    <td className="border border-gray-900 px-2 py-1">{previewInvoice.invoiceNumber}</td>
                                    <td className="border border-gray-900 px-2 py-1 w-24 font-black">Date:</td>
                                    <td className="border border-gray-900 px-2 py-1 w-56">{issueDateText}</td>
                                </tr>
                                <tr>
                                    <td className="border border-gray-900 px-2 py-1 font-black">Consignee:</td>
                                    <td className="border border-gray-900 px-2 py-1">{CONSIGNEE_INFO.companyName}</td>
                                    <td className="border border-gray-900 px-2 py-1 font-black">Phone:</td>
                                    <td className="border border-gray-900 px-2 py-1">{CONSIGNEE_INFO.phone}</td>
                                </tr>
                                <tr>
                                    <td className="border border-gray-900 px-2 py-1 font-black">From:</td>
                                    <td className="border border-gray-900 px-2 py-1">beiko Inc.</td>
                                    <td className="border border-gray-900 px-2 py-1 font-black">Contact:</td>
                                    <td className="border border-gray-900 px-2 py-1">Lee Dabin</td>
                                </tr>
                                <tr>
                                    <td className="border border-gray-900 px-2 py-1 font-black">Address:</td>
                                    <td className="border border-gray-900 px-2 py-1">{CONSIGNEE_INFO.addressLine1}</td>
                                    <td className="border border-gray-900 px-2 py-1 font-black">TAX:</td>
                                    <td className="border border-gray-900 px-2 py-1">{CONSIGNEE_INFO.tax}</td>
                                </tr>
                                <tr>
                                    <td className="border border-gray-900 px-2 py-1 font-black">Address 2:</td>
                                    <td colSpan={3} className="border border-gray-900 px-2 py-1">{CONSIGNEE_INFO.addressLine2}</td>
                                </tr>
                            </tbody>
                        </table>

                        <table className="w-full border-collapse border border-gray-900 mt-0 text-[11px]">
                            <thead className="bg-[#f7ebe5]">
                                <tr className="text-center font-black">
                                    <th className="border border-gray-900 px-2 py-1 w-40">Product Name</th>
                                    <th className="border border-gray-900 px-2 py-1 w-24">Model</th>
                                    <th className="border border-gray-900 px-2 py-1 w-44">Picture</th>
                                    <th className="border border-gray-900 px-2 py-1.5">Specification</th>
                                    <th className="border border-gray-900 px-2 py-1 w-32">
                                        Unit price <span className="text-[#e53b19]">EXW</span> (US$)
                                    </th>
                                    <th className="border border-gray-900 px-2 py-1 w-16">Qty<br />(set)</th>
                                    <th className="border border-gray-900 px-2 py-1 w-32">
                                        Total price <span className="text-[#e53b19]">EXW</span> (US$)
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {printableRows.map((row) => (
                                    <tr key={row.id} className={row.isBlank ? 'h-8' : 'h-32 align-top'}>
                                        <td className="border border-gray-900 px-2 py-2 text-center">{row.isBlank ? '' : row.productName}</td>
                                        <td className="border border-gray-900 px-2 py-2 text-center">{row.isBlank ? '' : row.model}</td>
                                        <td className="border border-gray-900 px-2 py-2">
                                            {row.isBlank ? (
                                                <div />
                                            ) : row.imageUrl ? (
                                                <img src={row.imageUrl} alt={row.productName} className="w-full h-24 object-contain bg-white" />
                                            ) : (
                                                <div className="w-full h-24 flex items-center justify-center text-[10px] text-gray-400">No Image</div>
                                            )}
                                        </td>
                                        <td className="border border-gray-900 px-2 py-2 text-[10px] leading-[1.35]">
                                            {row.isBlank ? (
                                                <div />
                                            ) : (
                                                <div className="space-y-0.5">
                                                    {row.specificationLines.map((line, idx) => (
                                                        <div key={`${row.id}-spec-${idx}`} className={idx >= 2 ? 'text-[#e53b19]' : ''}>{line}</div>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                        <td className="border border-gray-900 px-2 py-2 text-center">{row.isBlank ? '' : usdText(row.price)}</td>
                                        <td className="border border-gray-900 px-2 py-2 text-center">{row.isBlank ? '' : row.quantity.toLocaleString()}</td>
                                        <td className="border border-gray-900 px-2 py-2 text-center">{row.isBlank ? '' : usdText(row.amount)}</td>
                                    </tr>
                                ))}
                                <tr className="font-black">
                                    <td colSpan={5} className="border border-gray-900 px-2 py-2 text-center">Total</td>
                                    <td className="border border-gray-900 px-2 py-2 text-center">{totalQuantity.toLocaleString()}</td>
                                    <td className="border border-gray-900 px-2 py-2 text-center">{usdText(grandTotalUsd)}</td>
                                </tr>
                            </tbody>
                        </table>

                        <div className="mt-3 flex items-start justify-between gap-4">
                            <div className="text-[10px] leading-snug flex-1">
                                <p>1. Price terms: EXW BUSAN</p>
                                <p className="mt-1">2. Packaging: by export carton box</p>
                                <p className="mt-1">3. Payment Term: 100% deposit by T/T</p>
                                <p className="mt-1">4. Production time: 3-5 days after receiving the deposit</p>
                                <p className="mt-1">5. Validity Period: quotation valid for 30 days from invoice date</p>
                                <div className="mt-3">
                                    <p className="text-[#e53b19] font-black text-base leading-none">Bank details:</p>
                                    <p className="mt-1">Payment currency: USD</p>
                                    <p className="text-[#e53b19]">Beneficiary account number: 656-045236-01-013</p>
                                    <p className="text-[#e53b19]">SWIFT code: IBKOKRSEXXX</p>
                                    <p>Beneficiary name: beiko Inc.</p>
                                    <p>Beneficiary bank: IBK Industrial Bank of Korea</p>
                                    <p>Beneficiary bank address: Busan, Republic of Korea</p>
                                </div>
                            </div>
                            <div className="w-28 pt-5">
                                <img src="/bko.png" alt="seal" className="w-full object-contain opacity-80" />
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    )
}
