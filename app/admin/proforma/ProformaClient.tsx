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
    productionTime: string
    items: IssuedInvoiceItem[]
}

type DraftState = Record<string, { checked: boolean; quantity: number }>

type PreviewInvoice = {
    id: string
    invoiceNumber: string
    issueDate: string
    partnerName: string
    totalUsd: number
    productionTime: string
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
    `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const escapeHtml = (value: string) =>
    value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;')
const slashDate = (date: Date) =>
    `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
const DEFAULT_PRODUCTION_TIME = '3-5 days after receiving the deposit'

const CONSIGNEE_INFO = {
    companyName: 'LODOS BALIKCILIK ITH.IHR.SAN.VE TIC.LTD.STI.',
    addressLine1: 'MAHMUTBEY MAH.2420 SOKAK ISTOC 4.ADA NO:70/76',
    addressLine2: 'BAGCILAR - ISTANBUL, TURKIYE',
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
    const [deletingInvoiceId, setDeletingInvoiceId] = useState<string | null>(null)
    const [draftProductionTime, setDraftProductionTime] = useState(DEFAULT_PRODUCTION_TIME)

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
                productionTime: activeIssuedInvoice.productionTime || DEFAULT_PRODUCTION_TIME,
                items: activeIssuedInvoice.items
            }
        }

        const partnerName = selectedPartner?.businessName || selectedPartner?.name || '-'
        const now = new Date()
        const draftNumber = `PI-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-001`
        return {
            id: 'draft',
            invoiceNumber: draftNumber,
            issueDate: now.toISOString(),
            partnerName,
            totalUsd: draftTotalUsd,
            productionTime: draftProductionTime,
            items: draftItems
        }
    }, [activeIssuedInvoice, selectedPartner, draftTotalUsd, draftItems, draftProductionTime])

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
            const modelCode = (productMeta?.productCode || item.productCode || '').toUpperCase()
            const model = textOrDash(modelCode)
            return {
                id: item.id,
                no: index + 1,
                productName: item.productName,
                productNameEN: item.productNameEN || productMeta?.nameEN || '',
                model,
                imageUrl: productMeta?.imageUrl || null,
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
            productNameEN: '',
            model: '',
            imageUrl: null,
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
        setDraftProductionTime(DEFAULT_PRODUCTION_TIME)
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
                    productionTime: draftProductionTime,
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
                productionTime:
                    typeof data.productionTime === 'string' && data.productionTime.trim().length > 0
                        ? data.productionTime
                        : DEFAULT_PRODUCTION_TIME,
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

    const handleDeleteIssued = async (invoiceId: string) => {
        if (!confirm('선택한 PI 발급건을 삭제하시겠습니까?')) {
            return
        }

        setDeletingInvoiceId(invoiceId)
        try {
            const response = await fetch(`/api/admin/proforma?id=${encodeURIComponent(invoiceId)}`, {
                method: 'DELETE'
            })
            const data: { error?: string } | null = await response.json().catch(() => null)

            if (!response.ok) {
                alert(data?.error || 'PI 삭제에 실패했습니다.')
                return
            }

            const nextInvoices = issuedInvoices.filter((invoice) => invoice.id !== invoiceId)
            setIssuedInvoices(nextInvoices)
            setActiveIssuedId((prev) => (prev === invoiceId ? nextInvoices[0]?.id || null : prev))
            alert('PI 발급건이 삭제되었습니다.')
        } catch (error) {
            console.error(error)
            alert('PI 삭제 중 오류가 발생했습니다.')
        } finally {
            setDeletingInvoiceId(null)
        }
    }

    const handlePrint = () => {
        if (previewInvoice.items.length === 0) {
            alert('출력할 PI 항목이 없습니다.')
            return
        }

        // Build product rows HTML with inline styles
        const rowsHtml = printableRows.map((row) => {
            if (row.isBlank) {
                return `<tr>
                    <td style="border:1px solid #111827;padding:4px 6px;text-align:center;vertical-align:top;height:28px"></td>
                    <td style="border:1px solid #111827;padding:4px 6px;vertical-align:top"></td>
                    <td style="border:1px solid #111827;padding:4px 6px;text-align:right;vertical-align:top"></td>
                    <td style="border:1px solid #111827;padding:4px 6px;text-align:right;vertical-align:top"></td>
                    <td style="border:1px solid #111827;padding:4px 6px;text-align:center;vertical-align:top"></td>
                    <td style="border:1px solid #111827;padding:4px 6px;text-align:center;vertical-align:top"></td>
                </tr>`
            }
            const imgHtml = row.imageUrl
                ? `<img src="${row.imageUrl}" alt="" style="width:32px;height:32px;object-fit:contain;flex-shrink:0">`
                : `<div style="width:32px;height:32px;flex-shrink:0"></div>`
            return `<tr>
                <td style="border:1px solid #111827;padding:4px 6px;text-align:center;vertical-align:top">${row.no}</td>
                <td style="border:1px solid #111827;padding:4px 6px;vertical-align:top">
                    <div style="display:flex;align-items:flex-start;gap:6px">
                        ${imgHtml}
                        <div style="line-height:1.3;text-align:left;word-break:break-word">
                            <div>${row.productName}</div>
                            <div style="font-size:9px;color:#374151">${row.productNameEN || '-'}</div>
                        </div>
                    </div>
                </td>
                <td style="border:1px solid #111827;padding:4px 6px;text-align:center;vertical-align:top;white-space:nowrap">${row.model}</td>
                <td style="border:1px solid #111827;padding:4px 6px;text-align:right;vertical-align:top;white-space:nowrap">${usdText(row.price)}</td>
                <td style="border:1px solid #111827;padding:4px 6px;text-align:center;vertical-align:top;white-space:nowrap">${row.quantity.toLocaleString()}</td>
                <td style="border:1px solid #111827;padding:4px 6px;text-align:right;vertical-align:top;white-space:nowrap">${usdText(row.amount)}</td>
            </tr>`
        }).join('\n')

        const origin = window.location.origin

        const consigneeName = previewInvoice.partnerName || '-'
        const productionTimeText = escapeHtml(previewInvoice.productionTime || DEFAULT_PRODUCTION_TIME)

        const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title></title>
<style>
@page {
    size: A4 portrait;
    margin: 0;
}
* { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { background: white; width: 210mm; }
body {
    padding: 0 15mm 0 12mm;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans CJK KR", "Noto Sans CJK JP", sans-serif;
    color: #22253f; font-size: 11px; line-height: 1.4;
}
table { border-collapse: collapse; width: 100%; }
thead { display: table-header-group; }
tfoot { display: table-footer-group; }

/* Wrapper table for repeating page margins */
.page-wrapper { border: none; width: 100%; }
.page-wrapper > thead td,
.page-wrapper > tfoot td { border: none; padding: 0; }
.page-spacer-top { height: 10mm; }
.page-spacer-bottom { height: 18mm; }

/* Footer text */
.print-footer {
    position: fixed;
    bottom: 4mm;
    left: 12mm;
    right: 15mm;
    text-align: center;
    font-size: 9px;
    color: #666;
    z-index: 10000;
}

/* Right side watermark */
.print-watermark {
    position: fixed;
    top: 10mm;
    right: 2mm;
    bottom: 10mm;
    display: flex;
    align-items: center;
    justify-content: center;
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    font-size: 8px;
    color: #666;
    letter-spacing: 0.3px;
    white-space: nowrap;
    z-index: 10000;
}
</style>
</head>
<body>

<!-- Right side watermark (fixed = repeats on every page) -->
<div class="print-watermark">
    This document is an officially issued Proforma Invoice by beiko Inc. | ${previewInvoice.invoiceNumber} | To: ${consigneeName} | <span class="print-page-number"></span>
</div>

<!-- Footer (fixed = repeats on every page) -->
<div class="print-footer">
    ${previewInvoice.invoiceNumber} — beiko Inc. Proforma Invoice — <span class="print-page-number"></span>
</div>

<!-- Page wrapper: thead/tfoot repeat on every page to create margins -->
<table class="page-wrapper">
<thead><tr><td class="page-spacer-top"></td></tr></thead>
<tfoot><tr><td class="page-spacer-bottom"></td></tr></tfoot>
<tbody><tr><td>

<!-- Top red line -->
<div style="height:4px;width:100%;background:#e53b19;margin-bottom:8px"></div>

<!-- Header -->
<div style="border-bottom:2px solid #e53b19;padding-bottom:8px;text-align:center">
    <h1 style="font-size:24px;font-weight:900;color:#1f2340;letter-spacing:-0.5px;line-height:1;margin:0">beiko Inc.</h1>
    <p style="margin-top:4px;font-size:11px">ADD: 35, Nakdongnam-ro 1013beon-gil, Gangseo-gu, Busan, Korea</p>
    <p style="font-size:11px;margin-top:2px">Mob: +82-10-3444-3467&nbsp;&nbsp; EMAIL: contact@beiko.co.kr</p>
</div>

<!-- Title -->
<h2 style="text-align:center;font-size:20px;font-weight:900;color:#e53b19;margin:8px 0">Proforma Invoice</h2>

<!-- Info table -->
<table style="border-collapse:collapse;width:100%;font-size:11px">
<tbody>
    <tr>
        <td style="border:1px solid #111827;padding:4px 8px;width:80px;font-weight:900">No.:</td>
        <td style="border:1px solid #111827;padding:4px 8px">${previewInvoice.invoiceNumber}</td>
        <td style="border:1px solid #111827;padding:4px 8px;width:80px;font-weight:900">Date:</td>
        <td style="border:1px solid #111827;padding:4px 8px;width:220px">${issueDateText}</td>
    </tr>
    <tr>
        <td style="border:1px solid #111827;padding:4px 8px;font-weight:900">From:</td>
        <td style="border:1px solid #111827;padding:4px 8px">beiko Inc.</td>
        <td style="border:1px solid #111827;padding:4px 8px;font-weight:900">Contact:</td>
        <td style="border:1px solid #111827;padding:4px 8px">Lee Dabin +82-10-3444-3467</td>
    </tr>
    <tr>
        <td style="border:1px solid #111827;padding:4px 8px;font-weight:900">Consignee:</td>
        <td style="border:1px solid #111827;padding:4px 8px">${CONSIGNEE_INFO.companyName}</td>
        <td style="border:1px solid #111827;padding:4px 8px;font-weight:900">Phone:</td>
        <td style="border:1px solid #111827;padding:4px 8px">${CONSIGNEE_INFO.phone}</td>
    </tr>
    <tr>
        <td style="border:1px solid #111827;padding:4px 8px;font-weight:900">Address:</td>
        <td style="border:1px solid #111827;padding:4px 8px">${CONSIGNEE_INFO.addressLine1}</td>
        <td style="border:1px solid #111827;padding:4px 8px;font-weight:900">TAX:</td>
        <td style="border:1px solid #111827;padding:4px 8px">${CONSIGNEE_INFO.tax}</td>
    </tr>
    <tr>
        <td style="border:1px solid #111827;padding:4px 8px;font-weight:900">Address 2:</td>
        <td colspan="3" style="border:1px solid #111827;padding:4px 8px">${CONSIGNEE_INFO.addressLine2}</td>
    </tr>
</tbody>
</table>

<!-- Product table -->
<table style="border-collapse:collapse;width:100%;table-layout:fixed;font-size:10px;margin-top:0">
<colgroup>
    <col style="width:4%">
    <col style="width:48%">
    <col style="width:14%">
    <col style="width:12%">
    <col style="width:5%">
    <col style="width:17%">
</colgroup>
<thead>
    <tr style="background:#f7ebe5;text-align:center;font-weight:900">
        <th style="border:1px solid #111827;padding:4px 6px">No.</th>
        <th style="border:1px solid #111827;padding:4px 6px">Product Name</th>
        <th style="border:1px solid #111827;padding:4px 6px">Model</th>
        <th style="border:1px solid #111827;padding:4px 6px">Unit price <span style="color:#e53b19">FOB</span></th>
        <th style="border:1px solid #111827;padding:4px 6px">Qty</th>
        <th style="border:1px solid #111827;padding:4px 6px">Total price <span style="color:#e53b19">FOB</span></th>
    </tr>
</thead>
<tbody>
${rowsHtml}
    <tr style="font-weight:900">
        <td colspan="4" style="border:1px solid #111827;padding:8px;text-align:center">Total</td>
        <td style="border:1px solid #111827;padding:8px;text-align:center">${totalQuantity.toLocaleString()}</td>
        <td style="border:1px solid #111827;padding:8px;text-align:right">${usdText(grandTotalUsd)}</td>
    </tr>
</tbody>
</table>

<!-- Bottom section -->
<div style="margin-top:12px;display:flex;align-items:flex-start;justify-content:space-between;gap:16px">
    <div style="font-size:10px;line-height:1.6;flex:1">
        <p>1. Price terms: FOB BUSAN</p>
        <p>2. Packaging: by export carton box</p>
        <p>3. Payment Term: 100% deposit by T/T</p>
        <p>4. Production time: ${productionTimeText}</p>
        <p>5. Validity Period: quotation valid for 30 days from invoice date</p>
        <div style="margin-top:12px">
            <p style="color:#e53b19;font-weight:900;font-size:16px;line-height:1">Bank details:</p>
            <p style="margin-top:4px">Payment currency: USD</p>
            <p>BENEFICIARY ACCOUNT NO.: 656-045236-01-013</p>
            <p>SWIFT CODE (BIC): IBKOKRSEXXX</p>
            <p>BENEFICIARY NAME: beiko Inc.</p>
            <p>BANK NAME: INDUSTRIAL BANK OF KOREA</p>
            <p>BANK ADDRESS: EULJI-RO, 82 IBK FINANCE TOWER FLOOR 16, JUNG-GU, SEOUL, REPUBLIC OF KOREA</p>
        </div>
    </div>
    <div style="padding-top:20px;flex-shrink:0">
        <div style="display:grid;grid-template-columns:auto auto;grid-template-rows:auto auto;align-items:end;gap:4px 8px">
            <img src="${origin}/logo.png" alt="BEIKO" style="width:80px;object-fit:contain;grid-row:1;grid-column:1">
            <span style="font-size:14px;font-weight:900;color:#1f2340;line-height:1;grid-row:2;grid-column:1">beiko Inc.</span>
            <img src="${origin}/bko.png" alt="seal" style="width:80px;object-fit:contain;opacity:0.8;grid-row:1/3;grid-column:2;align-self:end">
        </div>
    </div>
</div>

</td></tr></tbody>
</table>

<script>
(function() {
    function setPages() {
        var ph = 297 * 96 / 25.4;
        var total = Math.max(1, Math.ceil(document.body.scrollHeight / ph));
        var els = document.querySelectorAll('.print-page-number');
        for (var i = 0; i < els.length; i++) {
            els[i].textContent = total + ' pages';
        }
    }
    setPages();
    window.addEventListener('beforeprint', setPages);
})();
</script>

</body>
</html>`

        // Use hidden iframe for reliable printing (popup has timing issues)
        const existingFrame = document.getElementById('pi-print-frame')
        if (existingFrame) existingFrame.remove()

        const iframe = document.createElement('iframe')
        iframe.id = 'pi-print-frame'
        iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:210mm;height:297mm;border:none;'
        document.body.appendChild(iframe)

        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
        if (!iframeDoc || !iframe.contentWindow) {
            alert('인쇄 프레임을 생성할 수 없습니다.')
            iframe.remove()
            return
        }

        iframeDoc.open()
        iframeDoc.write(fullHtml)
        iframeDoc.close()

        // Wait for content + images to render, then print
        iframe.onload = () => {
            setTimeout(() => {
                // Temporarily clear parent title to suppress browser header
                const originalTitle = document.title
                document.title = ' '

                iframe.contentWindow?.focus()
                iframe.contentWindow?.print()

                // Restore title after print dialog
                document.title = originalTitle
                // Clean up after print dialog closes
                setTimeout(() => { iframe.remove() }, 2000)
            }, 300)
        }
    }

    return (
        <div className="space-y-6">

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(480px,1fr)_210mm] gap-8 items-start">
                <div className="pi-no-print space-y-6 xl:max-w-none">
                    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div>
                                <h2 className="text-base font-black text-gray-900">P.I발급 관리</h2>
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
                                <span className="text-[11px] text-gray-500">인쇄창에서 머리글/바닥글 해제 시 날짜/URL 표시가 사라집니다.</span>
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
                                    <p className="mt-2 text-[11px] text-gray-500">단가는 상품관리 DB의 `usBuyPrice`를 그대로 불러옵니다.</p>
                                    <div className="mt-3">
                                        <label className="text-xs font-bold text-gray-700">Production time</label>
                                        <input
                                            type="text"
                                            value={draftProductionTime}
                                            onChange={(event) => setDraftProductionTime(event.target.value)}
                                            className="mt-2 w-full bg-white border border-gray-200 rounded-xl p-2.5 text-sm font-medium focus:ring-[#e53b19] focus:border-[#e53b19]"
                                            placeholder="e.g. 3-5 days after receiving the deposit"
                                        />
                                    </div>
                                </div>

                                <div className="overflow-x-auto border border-gray-100 rounded-xl">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 border-b border-gray-100 text-gray-600">
                                            <tr>
                                                <th className="px-3 py-2 text-center">선택</th>
                                                <th className="px-3 py-2 text-center">이미지</th>
                                                <th className="px-3 py-2 text-left">상품</th>
                                                <th className="px-3 py-2 text-center">재고</th>
                                                <th className="px-3 py-2 text-center">단가</th>
                                                <th className="px-3 py-2 text-center">수량</th>
                                                <th className="px-3 py-2 text-center">금액</th>
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
                                                            <div className="text-[10px] text-gray-400 font-mono">{product.productCode ? product.productCode.toUpperCase() : '-'}</div>
                                                        </td>
                                                        <td className="px-3 py-2 text-center text-gray-600">{product.stock.toLocaleString()}</td>
                                                        <td className="px-3 py-2 text-right font-bold text-gray-900">{usdFormatter.format(Number(product.usBuyPrice || 0))}</td>
                                                        <td className="px-3 py-2 text-center">
                                                            <input
                                                                type="number"
                                                                min={1}
                                                                value={rowState.quantity}
                                                                onChange={(event) => updateQuantity(product.id, event.target.value)}
                                                                onFocus={(event) => event.currentTarget.select()}
                                                                onClick={(event) => event.currentTarget.select()}
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
                                                <th className="px-3 py-2 text-center">총가격</th>
                                                <th className="px-3 py-2 text-center">관리</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {issuedInvoices.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="px-3 py-8 text-center text-gray-400">발급된 PI가 없습니다.</td>
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
                                                        <td className="px-3 py-2 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={(event) => {
                                                                    event.stopPropagation()
                                                                    void handleDeleteIssued(invoice.id)
                                                                }}
                                                                disabled={deletingInvoiceId === invoice.id}
                                                                className="px-2 py-1 rounded-md text-[11px] font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                                                            >
                                                                {deletingInvoiceId === invoice.id ? '삭제중...' : '삭제'}
                                                            </button>
                                                        </td>
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

                    <div className="pi-inner-content bg-white border border-gray-300 p-3">
                        <div className="h-1 w-full bg-[#e53b19] mb-2" />
                        <div className="border-b-2 border-[#e53b19] pb-2">
                            <div className="text-center">
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
                                    <td className="border border-gray-900 px-2 py-1 font-black">From:</td>
                                    <td className="border border-gray-900 px-2 py-1">beiko Inc.</td>
                                    <td className="border border-gray-900 px-2 py-1 font-black">Contact:</td>
                                    <td className="border border-gray-900 px-2 py-1">Lee Dabin +82-10-3444-3467</td>
                                </tr>
                                <tr>
                                    <td className="border border-gray-900 px-2 py-1 font-black">Consignee:</td>
                                    <td className="border border-gray-900 px-2 py-1">{CONSIGNEE_INFO.companyName}</td>
                                    <td className="border border-gray-900 px-2 py-1 font-black">Phone:</td>
                                    <td className="border border-gray-900 px-2 py-1">{CONSIGNEE_INFO.phone}</td>
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

                        <table className="w-full table-fixed border-collapse border border-gray-900 mt-0 text-[10px]">
                            <colgroup>
                                <col style={{ width: '4%' }} />
                                <col style={{ width: '48%' }} />
                                <col style={{ width: '14%' }} />
                                <col style={{ width: '12%' }} />
                                <col style={{ width: '5%' }} />
                                <col style={{ width: '17%' }} />
                            </colgroup>
                            <thead className="bg-[#f7ebe5]">
                                <tr className="text-center font-black">
                                    <th className="border border-gray-900 px-1.5 py-1">No.</th>
                                    <th className="border border-gray-900 px-1.5 py-1">Product Name</th>
                                    <th className="border border-gray-900 px-1.5 py-1">Model</th>
                                    <th className="border border-gray-900 px-1.5 py-1">
                                        Unit price <span className="text-[#e53b19]">FOB</span>
                                    </th>
                                    <th className="border border-gray-900 px-1.5 py-1">Qty</th>
                                    <th className="border border-gray-900 px-1.5 py-1">
                                        Total price <span className="text-[#e53b19]">FOB</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {printableRows.map((row) => (
                                    <tr key={row.id} className={row.isBlank ? 'h-7' : ''}>
                                        <td className="border border-gray-900 px-1.5 py-1 text-center align-top">{row.isBlank ? '' : row.no}</td>
                                        <td className="border border-gray-900 px-1.5 py-1 align-top">
                                            {row.isBlank ? (
                                                ''
                                            ) : (
                                                <div className="flex items-start gap-1.5">
                                                    {row.imageUrl ? (
                                                        <img src={row.imageUrl} alt={row.productName} className="w-8 h-8 object-contain shrink-0" />
                                                    ) : (
                                                        <div className="w-8 h-8 shrink-0" />
                                                    )}
                                                    <div className="space-y-0.5 leading-tight text-left break-words">
                                                        <div>{row.productName}</div>
                                                        <div className="text-[9px] text-gray-700">{row.productNameEN || '-'}</div>
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                        <td className="border border-gray-900 px-1.5 py-1 text-center align-top whitespace-nowrap break-keep">{row.isBlank ? '' : row.model}</td>
                                        <td className="border border-gray-900 px-1.5 py-1 text-right align-top whitespace-nowrap">{row.isBlank ? '' : usdText(row.price)}</td>
                                        <td className="border border-gray-900 px-1.5 py-1 text-center align-top whitespace-nowrap">{row.isBlank ? '' : row.quantity.toLocaleString()}</td>
                                        <td className="border border-gray-900 px-1.5 py-1 text-right align-top whitespace-nowrap">{row.isBlank ? '' : usdText(row.amount)}</td>
                                    </tr>
                                ))}
                                <tr className="font-black">
                                    <td colSpan={4} className="border border-gray-900 px-2 py-2 text-center">Total</td>
                                    <td className="border border-gray-900 px-2 py-2 text-center">{totalQuantity.toLocaleString()}</td>
                                    <td className="border border-gray-900 px-2 py-2 text-right">{usdText(grandTotalUsd)}</td>
                                </tr>
                            </tbody>
                        </table>

                        <div className="mt-3 flex items-start justify-between gap-4">
                            <div className="text-[10px] leading-snug flex-1">
                                <p>1. Price terms: FOB BUSAN</p>
                                <p className="mt-1">2. Packaging: by export carton box</p>
                                <p className="mt-1">3. Payment Term: 100% deposit by T/T</p>
                                <p className="mt-1">4. Production time: {previewInvoice.productionTime || DEFAULT_PRODUCTION_TIME}</p>
                                <p className="mt-1">5. Validity Period: quotation valid for 30 days from invoice date</p>
                                <div className="mt-3">
                                    <p className="text-[#e53b19] font-black text-base leading-none">Bank details:</p>
                                    <p className="mt-1">Payment currency: USD</p>
                                    <p>BENEFICIARY ACCOUNT NO.: 656-045236-01-013</p>
                                    <p>SWIFT CODE (BIC): IBKOKRSEXXX</p>
                                    <p>BENEFICIARY NAME: beiko Inc.</p>
                                    <p>BANK NAME: INDUSTRIAL BANK OF KOREA</p>
                                    <p>BANK ADDRESS: EULJI-RO, 82 IBK FINANCE TOWER FLOOR 16, JUNG-GU, SEOUL, REPUBLIC OF KOREA</p>
                                </div>
                            </div>
                            <div className="pt-5 shrink-0">
                                <div className="grid grid-cols-[auto_auto] grid-rows-[auto_auto] items-end gap-x-2 gap-y-1">
                                    <img src="/logo.png" alt="BEIKO" className="w-20 object-contain row-start-1 col-start-1" />
                                    <span className="text-sm font-black text-[#1f2340] leading-none row-start-2 col-start-1">beiko Inc.</span>
                                    <img src="/bko.png" alt="seal" className="w-20 object-contain opacity-80 row-start-1 row-span-2 col-start-2 self-end" />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    )
}
