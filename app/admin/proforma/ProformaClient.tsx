'use client'

import { ImageIcon, Printer, Trash2 } from 'lucide-react'

import { useMemo, useState } from 'react'
import Button from '@/components/ui/Button'
import PageHeader from '@/components/ui/PageHeader'
import Tabs from '@/components/ui/Tabs'
import EmptyState from '@/components/ui/EmptyState'
import { fieldClass, labelClass, selectClass } from '@/components/ui/field'
import { formatDate } from '@/lib/format'
import DocumentPreview from './DocumentPreview'

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
    const [productSearch, setProductSearch] = useState('')
    const [selectedOnly, setSelectedOnly] = useState(false)
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

    const visibleProducts = products.filter(product => (!selectedOnly || draftState[product.id]?.checked) && [product.name, product.nameJP, product.nameEN, product.productCode].some(value => value?.toLocaleLowerCase().includes(productSearch.trim().toLocaleLowerCase())))
    const toggleProduct = (productId: string) => {
        if (!(Number(products.find(product => product.id === productId)?.usBuyPrice) > 0)) return
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

        if (draftItems.some(item => !Number.isFinite(item.unitPriceUsd) || item.unitPriceUsd <= 0)) {
            alert('미국 거래 단가가 미설정된 상품이 있습니다. 상품관리에서 단가를 확인해 주세요.')
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
    position: relative;
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

/* Per-page footer (created by JS at each page boundary) */
.page-footer {
    position: absolute;
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
            <img src="${origin}/seal.png" alt="seal" style="width:80px;object-fit:contain;opacity:0.8;grid-row:1/3;grid-column:2;align-self:end">
        </div>
    </div>
</div>

</td></tr></tbody>
</table>

<script>
(function() {
    function createPageFooters() {
        var old = document.querySelectorAll('.page-footer');
        for (var i = 0; i < old.length; i++) old[i].remove();

        var ph = 297 * 96 / 25.4;
        var total = Math.max(1, Math.ceil(document.body.scrollHeight / ph));

        var pnEls = document.querySelectorAll('.print-page-number');
        for (var j = 0; j < pnEls.length; j++) {
            pnEls[j].textContent = total + 'p';
        }

        for (var p = 1; p <= total; p++) {
            var f = document.createElement('div');
            f.className = 'page-footer';
            f.style.top = (p * ph - 42) + 'px';
            f.textContent = '${previewInvoice.invoiceNumber} \u2014 beiko Inc. Proforma Invoice \u2014 Page ' + p + ' / ' + total;
            document.body.appendChild(f);
        }
    }
    createPageFooters();
    window.addEventListener('beforeprint', createPageFooters);
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

    const quantityInputClass = (checked: boolean) =>
        `h-9 w-20 rounded-lg border px-2 text-right text-[13px] tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            checked
                ? 'border-slate-300 bg-white text-slate-900 dark:border-[#3a3a3a] dark:bg-[#1e1e1e] dark:text-white'
                : 'border-transparent bg-slate-50 text-slate-400 dark:bg-[#1a1a1a]'
        }`

    return (
        <div className="min-w-0 space-y-6">
            <PageHeader
                title="PI 발급"
                description="작성 후 발행하면 발급리스트에 저장됩니다. 출력만으로는 발행 기록이 생성되지 않습니다."
                actions={
                    // Both stay in place on the 발급리스트 tab (disabled) so the header doesn't shift; 출력 lives on the preview.
                    <>
                        <Button variant="secondary" onClick={resetDraft} disabled={leftTab !== 'write'}>
                            초기화
                        </Button>
                        <Button data-primary variant="primary" onClick={handleIssue} loading={isIssuing} disabled={leftTab !== 'write'}>
                            {isIssuing ? '발행 중...' : '발행하기'}
                        </Button>
                    </>
                }
            />

            <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,600px)] 2xl:grid-cols-[minmax(0,1fr)_minmax(0,640px)]">
                <div className="pi-no-print min-w-0 space-y-6">
                    <section className="min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2a2a2a] dark:bg-[#1e1e1e] dark:shadow-none sm:p-5">
                        <Tabs
                            aria-label="PI 작업"
                            items={[
                                { key: 'write', label: 'PI 작성' },
                                { key: 'issued', label: 'PI 발급리스트', count: issuedInvoices.length },
                            ]}
                            value={leftTab}
                            onChange={setLeftTab}
                        />

                        {leftTab === 'write' ? (
                            <div className="space-y-4">
                                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                                    <label className="block min-w-0">
                                        <span className={labelClass}>발행 기록용 업체</span>
                                        <select
                                            value={selectedPartnerId}
                                            onChange={(event) => {
                                                setSelectedPartnerId(event.target.value)
                                                setActiveIssuedId(null)
                                                setLeftTab('write')
                                            }}
                                            className={selectClass(!!selectedPartnerId)}
                                        >
                                            <option value="">업체를 선택하세요</option>
                                            {partners.map((partner) => (
                                                <option key={partner.id} value={partner.id}>
                                                    {partner.businessName || partner.name}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="block min-w-0">
                                        <span className={labelClass}>생산 소요기간</span>
                                        <input
                                            type="text"
                                            value={draftProductionTime}
                                            onChange={(event) => setDraftProductionTime(event.target.value)}
                                            className={fieldClass()}
                                            placeholder="예: 3-5 days after receiving the deposit"
                                        />
                                    </label>
                                    <p className="text-[11px] text-slate-500 dark:text-gray-400 sm:col-span-2">
                                        수입자(Consignee)는 PI에 고정으로 인쇄되고, 업체는 발급리스트 기록과 하단 문구에 쓰입니다. 상품관리의 미국 거래 단가(USD)가 적용되며, 단가 미설정 상품은 선택할 수 없습니다.
                                    </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 dark:border-[#2a2a2a]">
                                    <label className="min-w-0 flex-1">
                                        <span className="sr-only">PI 상품 검색</span>
                                        <input type="search" className={fieldClass()} value={productSearch} onChange={event => setProductSearch(event.target.value)} placeholder="상품명·코드 검색" />
                                    </label>
                                    <label className="flex min-h-11 items-center gap-2 text-sm font-bold text-slate-700 dark:text-gray-300">
                                        <input type="checkbox" checked={selectedOnly} onChange={event => setSelectedOnly(event.target.checked)} className="h-5 w-5 accent-brand-orange" />
                                        선택 상품만
                                    </label>
                                </div>

                                {/* Phones: one card per product so price, quantity and amount stay on screen. */}
                                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-[#2a2a2a] dark:border-[#2a2a2a] sm:hidden">
                                    {visibleProducts.map((product) => {
                                        const rowState = draftState[product.id] || { checked: false, quantity: 1 }
                                        const hasPrice = Number(product.usBuyPrice) > 0
                                        const amount = rowState.quantity * Number(product.usBuyPrice || 0)
                                        return (
                                            <li
                                                key={product.id}
                                                className={`space-y-2 px-3 py-3 ${rowState.checked ? 'bg-brand-orange-soft/60 shadow-[inset_3px_0_0_var(--color-brand-orange)] dark:bg-[#2a1d19]' : ''}`}
                                            >
                                                <label className="flex items-start gap-3">
                                                    <input
                                                        type="checkbox"
                                                        disabled={!hasPrice}
                                                        checked={rowState.checked}
                                                        onChange={() => toggleProduct(product.id)}
                                                        className="mt-0.5 h-5 w-5 shrink-0 accent-brand-orange"
                                                    />
                                                    <span className="min-w-0">
                                                        <span className="block break-keep text-sm font-bold text-slate-900 dark:text-white">{product.nameJP || product.name}</span>
                                                        <span className="block break-keep text-[11px] text-slate-500 dark:text-gray-400">{product.nameEN || product.name}</span>
                                                        <span className="block font-mono text-[11px] text-slate-500 dark:text-gray-400">
                                                            {product.productCode ? product.productCode.toUpperCase() : '-'} · 재고 {product.stock.toLocaleString()}
                                                        </span>
                                                    </span>
                                                </label>
                                                {/* 단가 × 수량 = 금액, with small labels so the three numbers don't have to be guessed by position. */}
                                                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto_minmax(0,1fr)] items-end gap-2 pl-8 text-sm">
                                                    <span className="min-w-0">
                                                        <span className="block text-[11px] text-slate-400">단가</span>
                                                        <span className={`block tabular-nums ${hasPrice ? 'text-slate-700 dark:text-gray-300' : 'text-xs text-slate-400'}`}>{hasPrice ? usdFormatter.format(Number(product.usBuyPrice)) : '단가 미설정'}</span>
                                                    </span>
                                                    <span aria-hidden="true" className="pb-2 text-slate-300">×</span>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        aria-label={`${product.nameJP || product.name} 수량`}
                                                        disabled={!hasPrice}
                                                        value={rowState.quantity}
                                                        onChange={(event) => updateQuantity(product.id, event.target.value)}
                                                        onFocus={(event) => event.currentTarget.select()}
                                                        className={quantityInputClass(rowState.checked)}
                                                    />
                                                    <span aria-hidden="true" className="pb-2 text-slate-300">=</span>
                                                    <span className="min-w-0 text-right">
                                                        <span className="block text-[11px] text-slate-400">금액</span>
                                                        <span className={`block tabular-nums ${rowState.checked ? 'font-black text-slate-900 dark:text-white' : 'text-slate-300'}`}>{rowState.checked ? usdFormatter.format(amount) : '-'}</span>
                                                    </span>
                                                </div>
                                            </li>
                                        )
                                    })}
                                </ul>

                                <div className="hidden overflow-x-auto rounded-xl border border-slate-200 dark:border-[#2a2a2a] sm:block">
                                    <table className="w-full min-w-[520px] text-sm">
                                        <thead className="ux-thead">
                                            <tr>
                                                <th className="w-10 text-center">선택</th>
                                                <th className="w-16 text-center xl:hidden 2xl:table-cell">이미지</th>
                                                <th className="min-w-[180px] text-left">상품</th>
                                                <th className="text-right">재고</th>
                                                <th className="text-right">단가</th>
                                                <th className="text-right">수량</th>
                                                <th className="text-right">금액</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-[#2a2a2a]">
                                            {visibleProducts.map((product) => {
                                                const rowState = draftState[product.id] || { checked: false, quantity: 1 }
                                                const hasPrice = Number(product.usBuyPrice) > 0
                                                const amount = rowState.quantity * Number(product.usBuyPrice || 0)
                                                return (
                                                    <tr
                                                        key={product.id}
                                                        className={rowState.checked ? 'bg-brand-orange-soft/60 shadow-[inset_3px_0_0_var(--color-brand-orange)] dark:bg-[#2a1d19]' : 'bg-white dark:bg-[#1e1e1e]'}
                                                    >
                                                        <td className="px-3 py-2 text-center">
                                                            <input
                                                                type="checkbox"
                                                                aria-label={`${product.nameJP || product.name} 선택`}
                                                                disabled={!hasPrice}
                                                                checked={rowState.checked}
                                                                onChange={() => toggleProduct(product.id)}
                                                                className="h-4 w-4 accent-brand-orange"
                                                            />
                                                        </td>
                                                        <td className="px-3 py-2 text-center xl:hidden 2xl:table-cell">
                                                            <div className="mx-auto flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-[#2a2a2a] dark:bg-[#1e1e1e]">
                                                                {product.imageUrl ? (
                                                                    <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                                                                ) : (
                                                                    <ImageIcon size={16} className="text-slate-300" aria-hidden="true" />
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="min-w-[180px] px-3 py-2">
                                                            <div className="break-keep font-bold text-slate-900 dark:text-white">{product.nameJP || product.name}</div>
                                                            <div className="break-keep text-[11px] text-slate-500 dark:text-gray-400">{product.nameEN || product.name}</div>
                                                            <div className="font-mono text-[11px] text-slate-500 dark:text-gray-400">{product.productCode ? product.productCode.toUpperCase() : '-'}</div>
                                                        </td>
                                                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-600 dark:text-gray-400">{product.stock.toLocaleString()}</td>
                                                        <td className={`whitespace-nowrap px-3 py-2 text-right tabular-nums ${hasPrice ? 'font-bold text-slate-900 dark:text-white' : 'text-xs text-slate-400'}`}>
                                                            {hasPrice ? usdFormatter.format(Number(product.usBuyPrice)) : '단가 미설정'}
                                                        </td>
                                                        <td className="px-3 py-2 text-right">
                                                            <input
                                                                type="number"
                                                                min={1}
                                                                aria-label={`${product.nameJP || product.name} 수량`}
                                                                disabled={!hasPrice}
                                                                value={rowState.quantity}
                                                                onChange={(event) => updateQuantity(product.id, event.target.value)}
                                                                onFocus={(event) => event.currentTarget.select()}
                                                                onClick={(event) => event.currentTarget.select()}
                                                                className={quantityInputClass(rowState.checked)}
                                                            />
                                                        </td>
                                                        <td className={`whitespace-nowrap px-3 py-2 text-right tabular-nums ${rowState.checked ? 'font-black text-slate-900 dark:text-white' : 'text-slate-300'}`}>
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
                                <p className="text-xs text-slate-500 dark:text-gray-400">발급된 PI를 선택하면 인쇄 미리보기에 즉시 반영됩니다.</p>
                                <div className="max-h-[620px] overflow-auto rounded-xl border border-slate-200 dark:border-[#2a2a2a]">
                                    <table className="w-full min-w-[420px] text-xs">
                                        <thead className="ux-thead">
                                            <tr>
                                                <th className="text-left">날짜</th>
                                                <th className="text-left">업체명</th>
                                                <th className="text-right">총가격</th>
                                                <th className="text-center">관리</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-[#2a2a2a]">
                                            {issuedInvoices.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4}>
                                                        <EmptyState bare compact title="발급된 PI가 없습니다" description="PI 작성 탭에서 상품을 선택하고 발행하세요." />
                                                    </td>
                                                </tr>
                                            ) : (
                                                issuedInvoices.map((invoice) => (
                                                    <tr
                                                        key={invoice.id}
                                                        aria-selected={activeIssuedId === invoice.id}
                                                        className={`cursor-pointer ${activeIssuedId === invoice.id ? 'bg-brand-orange-soft dark:bg-[#2a1d19]' : 'hover:bg-slate-50 dark:hover:bg-[#252525]'}`}
                                                        onClick={() => setActiveIssuedId(invoice.id)}
                                                    >
                                                        <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-600 dark:text-gray-400">{formatDate(invoice.issueDate)}</td>
                                                        <td className="px-3 py-2 font-bold text-slate-900 dark:text-white">{invoice.partnerName}</td>
                                                        <td className="whitespace-nowrap px-3 py-2 text-right font-black tabular-nums text-slate-900 dark:text-white">{usdFormatter.format(invoice.totalUsd)}</td>
                                                        <td className="px-3 py-2 text-center">
                                                            <Button
                                                                variant="dangerGhost"
                                                                size="icon"
                                                                aria-label={`${invoice.invoiceNumber} 삭제`}
                                                                title="삭제"
                                                                onClick={(event) => {
                                                                    event.stopPropagation()
                                                                    void handleDeleteIssued(invoice.id)
                                                                }}
                                                                loading={deletingInvoiceId === invoice.id}
                                                                icon={deletingInvoiceId === invoice.id ? undefined : <Trash2 size={16} />}
                                                            />
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

                <DocumentPreview
                    title="인쇄 미리보기"
                    meta={activeIssuedInvoice ? `${activeIssuedInvoice.invoiceNumber} · ${activeIssuedInvoice.partnerName}` : '작성 중인 PI'}
                    actions={<Button variant="secondary" size="sm" icon={<Printer size={14} />} onClick={handlePrint}>출력 (PDF)</Button>}
                    footnote="인쇄창에서 머리글/바닥글을 해제하면 날짜/URL 표시가 사라집니다."
                    className="xl:sticky xl:top-[76px]"
                >
                    <div className="pi-inner-content min-h-[297mm] bg-white pb-[18mm] pl-[12mm] pr-[15mm] pt-[10mm] text-[#22253f]">
                        <div className="h-1 w-full bg-brand-orange mb-2" />
                        <div className="border-b-2 border-brand-orange pb-2">
                            <div className="text-center">
                                <p className="text-2xl leading-none font-black tracking-tight text-[#1f2340]">beiko Inc.</p>
                                <p className="mt-1 text-[11px]">ADD: 35, Nakdongnam-ro 1013beon-gil, Gangseo-gu, Busan, Korea</p>
                                <p className="text-[11px] mt-0.5">Mob: +82-10-3444-3467&nbsp;&nbsp; EMAIL: contact@beiko.co.kr</p>
                            </div>
                        </div>

                        <p className="text-center text-xl font-black text-brand-orange mt-2 mb-2">Proforma Invoice</p>

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
                                        Unit price <span className="text-brand-orange">FOB</span>
                                    </th>
                                    <th className="border border-gray-900 px-1.5 py-1">Qty</th>
                                    <th className="border border-gray-900 px-1.5 py-1">
                                        Total price <span className="text-brand-orange">FOB</span>
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
                                    <p className="text-brand-orange font-black text-base leading-none">Bank details:</p>
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
                                    <img src="/seal.png" alt="seal" className="w-20 object-contain opacity-80 row-start-1 row-span-2 col-start-2 self-end" />
                                </div>
                            </div>
                        </div>
                    </div>
                </DocumentPreview>
            </div>
        </div>
    )
}
