'use client'

import { useMemo, useState } from 'react'
import { FileText, PackageCheck, Plus, Printer, Trash2 } from 'lucide-react'

export type ExportProductOption = {
  id: string
  name: string
  nameEN: string | null
  nameJP: string | null
  productCode: string | null
  unitPriceUsd: number
  stock: number
}

type ExportDocumentForm = {
  invoiceNo: string
  date: string
  exporter: string
  consignee: string
  notifyParty: string
  buyer: string
  lcNoDate: string
  departureDate: string
  vesselFlight: string
  portOfLoading: string
  portOfDischarge: string
  incoterms: string
  termsDeliveryPayment: string
  shippingMarks: string
  packagesKind: string
  otherReferences: string
  currency: string
  remarks: string
}

type ExportLineItem = {
  id: string
  productId: string
  productName: string
  productNameEN: string
  model: string
  hsCode: string
  origin: string
  quantity: number
  unitPrice: number
  cartons: number
  netWeight: number
  grossWeight: number
  cbm: number
  dimension: string
}

type PreviewMode = 'commercial' | 'packing'
type PrintMode = PreviewMode | 'both'

const todayYmd = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const defaultInvoiceNo = () => todayYmd().replaceAll('-', '')

const createEmptyItem = (): ExportLineItem => ({
  id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now()),
  productId: '',
  productName: '',
  productNameEN: '',
  model: '',
  hsCode: '',
  origin: 'KOREA',
  quantity: 1,
  unitPrice: 0,
  cartons: 1,
  netWeight: 0,
  grossWeight: 0,
  cbm: 0,
  dimension: '',
})

const defaultForm = (): ExportDocumentForm => ({
  invoiceNo: `EXP-${defaultInvoiceNo()}-001`,
  date: todayYmd(),
  exporter: [
    'beiko Inc.',
    '35, Nakdongnam-ro 1013beon-gil, Gangseo-gu, Busan, Korea',
    'TEL: +82-10-3444-3467',
    'EMAIL: contact@beiko.co.kr',
  ].join('\n'),
  consignee: '',
  notifyParty: 'SAME AS CONSIGNEE',
  buyer: 'SAME AS CONSIGNEE',
  lcNoDate: '',
  departureDate: todayYmd(),
  vesselFlight: '',
  portOfLoading: 'BUSAN, KOREA',
  portOfDischarge: '',
  incoterms: 'FOB BUSAN',
  termsDeliveryPayment: 'FOB BUSAN\nT/T IN ADVANCE',
  shippingMarks: 'MADE IN KOREA',
  packagesKind: '',
  otherReferences: 'COUNTRY OF ORIGIN :\nREPUBLIC OF KOREA',
  currency: 'US$',
  remarks: 'Country of Origin: Republic of Korea',
})

const numberFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const intFormatter = new Intl.NumberFormat('en-US')

function parseNumberInput(value: string, fallback = 0) {
  const parsed = Number(value.replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseDimensionCbm(dimension: string, cartons: number) {
  const numbers = dimension
    .replace(/㎝|센티|cm/gi, '')
    .split(/[xX*×,\s/]+/)
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value) && value > 0)

  if (numbers.length < 3) return null

  const [width, depth, height] = numbers
  const cartonCount = Math.max(0, Math.floor(cartons))
  return Number(((width * depth * height * cartonCount) / 1_000_000).toFixed(3))
}

function money(value: number, currency: string) {
  const normalized = currency.trim() || 'US$'
  const separator = normalized.endsWith('$') ? '' : ' '
  return `${normalized}${separator}${numberFormatter.format(value)}`
}

function weight(value: number) {
  return numberFormatter.format(value)
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('\n', '<br>')
}

function lineAmount(item: ExportLineItem) {
  return item.quantity * item.unitPrice
}

function totalCartonsText(items: ExportLineItem[]) {
  const totalCartons = items.reduce((sum, item) => sum + item.cartons, 0)
  return totalCartons > 0 ? `${intFormatter.format(totalCartons)} CT` : ''
}

function makePrintStyles() {
  return `
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { margin: 0; background: #fff; color: #111827; font-family: Arial, "Noto Sans KR", sans-serif; font-size: 10px; }
    .sheet { width: 190mm; min-height: 277mm; margin: 0 auto; page-break-after: always; }
    .sheet:last-child { page-break-after: auto; }
    .top-line { height: 4px; background: #ef3b2d; margin-bottom: 10px; }
    h1 { margin: 0 0 8px; text-align: center; font-family: Georgia, "Times New Roman", serif; font-size: 25px; font-weight: 500; letter-spacing: .05em; }
    .meta, .items { width: 100%; border-collapse: collapse; }
    .meta td, .items th, .items td { border: 1px solid #111827; padding: 4px 5px; vertical-align: top; }
    .box { height: 22mm; }
    .box-sm { height: 13mm; }
    .box-lg { height: 36mm; }
    .num { font-family: Georgia, "Times New Roman", serif; color: #475569; }
    .box-title { font-family: Georgia, "Times New Roman", serif; font-size: 12px; color: #334155; }
    .box-value { margin-top: 8px; padding-left: 8px; white-space: pre-line; font-family: Georgia, "Times New Roman", serif; font-size: 13px; line-height: 1.28; }
    .items th { font-family: Georgia, "Times New Roman", serif; font-weight: 500; text-align: center; background: #fff; }
    .items td { font-family: Georgia, "Times New Roman", serif; font-size: 13px; line-height: 1.35; }
    .right { text-align: right; }
    .center { text-align: center; }
    .bold { font-weight: 800; }
    .section-title { margin: 10px 0 5px; font-size: 12px; font-weight: 800; color: #ef3b2d; }
    .sign { margin-top: 16px; display: flex; justify-content: flex-end; align-items: end; gap: 14px; }
    .muted { color: #475569; }
    .remarks { min-height: 24px; }
  `
}

function makeCommonHeader(form: ExportDocumentForm, title: string) {
  return `
    <h1>${title}</h1>
    <table class="meta">
      <tbody>
        <tr>
          <td class="box" rowspan="1" style="width:48%">
            <div class="box-title"><span class="num">①</span> Shipper/Seller</div>
            <div class="box-value">${escapeHtml(form.exporter)}</div>
          </td>
          <td class="box-sm">
            <div class="box-title"><span class="num">⑦</span> Invoice No. and date</div>
            <div class="box-value">${escapeHtml(form.invoiceNo)}, ${escapeHtml(form.date)}</div>
          </td>
        </tr>
        <tr>
          <td class="box-lg" rowspan="2">
            <div class="box-title"><span class="num">②</span> Consignee</div>
            <div class="box-value">${escapeHtml(form.consignee)}</div>
          </td>
          <td class="box-sm">
            <div class="box-title"><span class="num">⑧</span> L/C No. and date</div>
            <div class="box-value">${escapeHtml(form.lcNoDate)}</div>
          </td>
        </tr>
        <tr>
          <td class="box">
            <div class="box-title"><span class="num">⑨</span> Buyer(if other than consignee)</div>
            <div class="box-value">${escapeHtml(form.buyer)}</div>
          </td>
        </tr>
        <tr>
          <td class="box-sm">
            <div class="box-title"><span class="num">③</span> Departure date</div>
            <div class="box-value">${escapeHtml(form.departureDate)}</div>
          </td>
          <td class="box">
            <div class="box-title"><span class="num">⑩</span> Other references</div>
            <div class="box-value">${escapeHtml(form.otherReferences)}</div>
          </td>
        </tr>
        <tr>
          <td class="box-sm">
            <div style="display:grid;grid-template-columns:1fr 1fr">
              <div>
                <div class="box-title"><span class="num">④</span> Vessel/flight</div>
                <div class="box-value">${escapeHtml(form.vesselFlight)}</div>
              </div>
              <div>
                <div class="box-title"><span class="num">⑤</span> From</div>
                <div class="box-value">${escapeHtml(form.portOfLoading)}</div>
              </div>
            </div>
            <div style="border-top:1px solid #111827;margin:3px -5px -4px;padding:3px 5px 0">
              <div class="box-title"><span class="num">⑥</span> To</div>
              <div class="box-value" style="margin-top:2px">${escapeHtml(form.portOfDischarge)}</div>
            </div>
          </td>
          <td class="box-sm">
            <div class="box-title"><span class="num">⑪</span> Terms of delivery and payment</div>
            <div class="box-value">${escapeHtml(form.termsDeliveryPayment || form.incoterms)}</div>
          </td>
        </tr>
      </tbody>
    </table>
  `
}

function makeCommercialHtml(form: ExportDocumentForm, items: ExportLineItem[]) {
  const totalQty = items.reduce((sum, item) => sum + item.quantity, 0)
  const totalAmount = items.reduce((sum, item) => sum + lineAmount(item), 0)
  return `
    <section class="sheet">
      ${makeCommonHeader(form, 'COMMERCIAL INVOICE')}
      <div class="section-title">Goods</div>
      <table class="items">
        <thead>
          <tr>
            <th style="width:22mm"><span class="num">⑫</span> Shipping Marks</th>
            <th style="width:30mm"><span class="num">⑬</span> No.&kind of packages</th>
            <th><span class="num">⑭</span> Goods description</th>
            <th style="width:24mm"><span class="num">⑮</span> Quantity</th>
            <th style="width:24mm"><span class="num">⑯</span> Unit price</th>
            <th style="width:28mm"><span class="num">⑰</span> Amount</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item, index) => `
            <tr>
              ${index === 0 ? `<td rowspan="${items.length + 1}">${escapeHtml(form.shippingMarks)}</td>` : ''}
              ${index === 0 ? `<td rowspan="${items.length + 1}">${escapeHtml(form.packagesKind || totalCartonsText(items))}</td>` : ''}
              <td><div class="bold">${escapeHtml(item.productNameEN || item.productName)}</div><div class="muted">${escapeHtml(item.model)} ${item.hsCode ? `/ HS ${escapeHtml(item.hsCode)}` : ''}</div></td>
              <td class="right">${intFormatter.format(item.quantity)}</td>
              <td class="right">${money(item.unitPrice, form.currency)}</td>
              <td class="right">${money(lineAmount(item), form.currency)}</td>
            </tr>
          `).join('')}
          <tr>
            <td class="center bold">TOTAL</td>
            <td class="right bold">${intFormatter.format(totalQty)}</td>
            <td></td>
            <td class="right bold">${money(totalAmount, form.currency)}</td>
          </tr>
        </tbody>
      </table>
      <div class="section-title">Remarks</div>
      <div class="remarks">${escapeHtml(form.remarks)}</div>
      <div class="sign">
        <span class="bold">beiko Inc.</span>
        <img src="/seal.png" alt="seal" style="width:72px;height:72px;object-fit:contain">
      </div>
    </section>
  `
}

function makePackingHtml(form: ExportDocumentForm, items: ExportLineItem[]) {
  const totalQty = items.reduce((sum, item) => sum + item.quantity, 0)
  const totalCartons = items.reduce((sum, item) => sum + item.cartons, 0)
  const totalNet = items.reduce((sum, item) => sum + item.netWeight, 0)
  const totalGross = items.reduce((sum, item) => sum + item.grossWeight, 0)
  const totalCbm = items.reduce((sum, item) => sum + item.cbm, 0)

  return `
    <section class="sheet">
      ${makeCommonHeader(form, 'PACKING LIST')}
      <div class="section-title">Packing Details</div>
      <table class="items">
        <thead>
          <tr>
            <th style="width:22mm"><span class="num">⑫</span> Shipping Marks</th>
            <th style="width:30mm"><span class="num">⑬</span> No.&kind of packages</th>
            <th><span class="num">⑭</span> Goods description</th>
            <th style="width:24mm"><span class="num">⑮</span> Quantity or net weight</th>
            <th style="width:24mm"><span class="num">⑯</span> Gross Weight</th>
            <th style="width:24mm"><span class="num">⑰</span> Measurement</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item, index) => `
            <tr>
              ${index === 0 ? `<td rowspan="${items.length + 1}">${escapeHtml(form.shippingMarks)}</td>` : ''}
              ${index === 0 ? `<td rowspan="${items.length + 1}">${escapeHtml(form.packagesKind || `${totalCartons} CT`)}</td>` : ''}
              <td><div class="bold">${escapeHtml(item.productNameEN || item.productName)}</div><div class="muted">${escapeHtml(item.model)}</div></td>
              <td class="right">${weight(item.netWeight)} KG</td>
              <td class="right">${weight(item.grossWeight)} KG</td>
              <td class="right">${item.dimension ? escapeHtml(item.dimension) : weight(item.cbm)}</td>
            </tr>
          `).join('')}
          <tr>
            <td class="center bold">TOTAL</td>
            <td class="right bold">${weight(totalNet)} KG</td>
            <td class="right bold">${weight(totalGross)} KG</td>
            <td class="right bold">${weight(totalCbm)}</td>
          </tr>
        </tbody>
      </table>
      <div class="section-title">Remarks</div>
      <div class="remarks">${escapeHtml(form.remarks)}</div>
      <div class="sign">
        <span class="bold">beiko Inc.</span>
        <img src="/seal.png" alt="seal" style="width:72px;height:72px;object-fit:contain">
      </div>
    </section>
  `
}

function makePrintHtml(form: ExportDocumentForm, items: ExportLineItem[], mode: PrintMode) {
  const sheets = [
    mode === 'commercial' || mode === 'both' ? makeCommercialHtml(form, items) : '',
    mode === 'packing' || mode === 'both' ? makePackingHtml(form, items) : '',
  ].join('')

  return `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${escapeHtml(form.invoiceNo)} export documents</title>
        <style>${makePrintStyles()}</style>
      </head>
      <body>${sheets}</body>
    </html>`
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

function textInputClass() {
  return 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-bold text-slate-900 outline-none transition focus:border-[#EF3B2D] focus:ring-2 focus:ring-[#EF3B2D]/15'
}

function textAreaClass() {
  return 'min-h-20 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-bold text-slate-900 outline-none transition focus:border-[#EF3B2D] focus:ring-2 focus:ring-[#EF3B2D]/15'
}

function DocumentPreview({
  form,
  items,
  mode,
}: {
  form: ExportDocumentForm
  items: ExportLineItem[]
  mode: PreviewMode
}) {
  const documentHtml = mode === 'commercial' ? makeCommercialHtml(form, items) : makePackingHtml(form, items)
  const previewHtml = `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          ${makePrintStyles()}
          @media screen {
            body { background: #f1f5f9; padding: 12px; }
            .sheet { background: #fff; box-shadow: 0 12px 30px rgba(15, 23, 42, .12); page-break-after: auto; }
          }
        </style>
      </head>
      <body>${documentHtml}</body>
    </html>`

  return (
    <iframe
      title={`${mode} preview`}
      className="h-[760px] w-full rounded-xl border border-slate-200 bg-slate-100"
      srcDoc={previewHtml}
    />
  )
}

export default function ExportDeclarationClient({ products }: { products: ExportProductOption[] }) {
  const [form, setForm] = useState<ExportDocumentForm>(() => defaultForm())
  const [items, setItems] = useState<ExportLineItem[]>(() => [createEmptyItem()])
  const [previewMode, setPreviewMode] = useState<PreviewMode>('commercial')

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products])

  const setFormValue = (key: keyof ExportDocumentForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const updateItem = (id: string, patch: Partial<ExportLineItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const updateCartons = (id: string, value: string) => {
    setItems((prev) => prev.map((item) => {
      if (item.id !== id) return item
      const cartons = Math.max(0, Math.floor(parseNumberInput(value)))
      const calculatedCbm = parseDimensionCbm(item.dimension, cartons)
      return { ...item, cartons, cbm: calculatedCbm ?? item.cbm }
    }))
  }

  const updateDimension = (id: string, dimension: string) => {
    setItems((prev) => prev.map((item) => {
      if (item.id !== id) return item
      const calculatedCbm = parseDimensionCbm(dimension, item.cartons)
      return { ...item, dimension, cbm: calculatedCbm ?? item.cbm }
    }))
  }

  const applyProduct = (rowId: string, productId: string) => {
    const product = productMap.get(productId)
    if (!product) {
      updateItem(rowId, { productId })
      return
    }
    updateItem(rowId, {
      productId,
      productName: product.nameJP || product.name,
      productNameEN: product.nameEN || product.name,
      model: product.productCode || '',
      unitPrice: product.unitPriceUsd,
      origin: 'KOREA',
    })
  }

  const addItem = () => setItems((prev) => [...prev, createEmptyItem()])
  const removeItem = (id: string) => setItems((prev) => (prev.length > 1 ? prev.filter((item) => item.id !== id) : prev))
  const resetForm = () => {
    setForm(defaultForm())
    setItems([createEmptyItem()])
    setPreviewMode('commercial')
  }

  const printableItems = useMemo(
    () => items.filter((item) => item.productName.trim() || item.productNameEN.trim() || item.model.trim()),
    [items],
  )

  const printDocuments = (mode: PrintMode) => {
    if (!printableItems.length) {
      alert('출력할 상품 행이 없습니다.')
      return
    }

    const frame = document.createElement('iframe')
    frame.style.position = 'fixed'
    frame.style.right = '0'
    frame.style.bottom = '0'
    frame.style.width = '0'
    frame.style.height = '0'
    frame.style.border = '0'
    document.body.appendChild(frame)

    const doc = frame.contentDocument || frame.contentWindow?.document
    if (!doc) {
      frame.remove()
      return
    }

    doc.open()
    doc.write(makePrintHtml(form, printableItems, mode))
    doc.close()

    window.setTimeout(() => {
      frame.contentWindow?.focus()
      frame.contentWindow?.print()
      window.setTimeout(() => frame.remove(), 1000)
    }, 250)
  }

  return (
    <div className="space-y-5">
      <div className="sticky top-0 z-40 -mx-4 border-b border-slate-200 bg-[#F7F7F8]/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[#EF3B2D]">Export Documents</div>
            <h1 className="mt-1 text-[26px] font-black tracking-tight text-slate-950">수출신고</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => printDocuments('commercial')} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-black text-slate-700 shadow-sm hover:bg-slate-50">
              <FileText size={15} />
              Commercial Invoice 인쇄
            </button>
            <button type="button" onClick={() => printDocuments('packing')} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-black text-slate-700 shadow-sm hover:bg-slate-50">
              <PackageCheck size={15} />
              Packing List 인쇄
            </button>
            <button type="button" onClick={() => printDocuments('both')} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#EF3B2D] bg-[#EF3B2D] px-4 text-[12px] font-black text-white shadow-sm hover:bg-[#d83326]">
              <Printer size={15} />
              두 문서 연속 인쇄
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(740px,1fr)_minmax(520px,760px)]">
        <div className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-sm font-black text-slate-950">문서 기본정보</h2>
              <button type="button" onClick={resetForm} className="h-8 rounded-lg border border-slate-200 px-3 text-[12px] font-black text-slate-600 hover:bg-slate-50">
                초기화
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Invoice No. / 송장번호">
                <input className={textInputClass()} value={form.invoiceNo} onChange={(event) => setFormValue('invoiceNo', event.target.value)} />
              </Field>
              <Field label="Date / 작성일">
                <input type="date" className={textInputClass()} value={form.date} onChange={(event) => setFormValue('date', event.target.value)} />
              </Field>
              <Field label="Departure Date / 출항일">
                <input type="date" className={textInputClass()} value={form.departureDate} onChange={(event) => setFormValue('departureDate', event.target.value)} />
              </Field>
              <Field label="Vessel / Flight / 선박·항공편">
                <input className={textInputClass()} value={form.vesselFlight} onChange={(event) => setFormValue('vesselFlight', event.target.value)} />
              </Field>
              <Field label="Incoterms / 거래조건">
                <input className={textInputClass()} value={form.incoterms} onChange={(event) => setFormValue('incoterms', event.target.value)} />
              </Field>
              <Field label="Currency / 통화">
                <input className={textInputClass()} value={form.currency} onChange={(event) => setFormValue('currency', event.target.value.toUpperCase())} />
              </Field>
              <Field label="Port of Loading / 선적항">
                <input className={textInputClass()} value={form.portOfLoading} onChange={(event) => setFormValue('portOfLoading', event.target.value)} />
              </Field>
              <Field label="Port of Discharge / 도착항">
                <input className={textInputClass()} value={form.portOfDischarge} onChange={(event) => setFormValue('portOfDischarge', event.target.value)} />
              </Field>
              <Field label="Exporter / 수출자">
                <textarea className={textAreaClass()} value={form.exporter} onChange={(event) => setFormValue('exporter', event.target.value)} />
              </Field>
              <Field label="Consignee / 수입자">
                <textarea className={textAreaClass()} value={form.consignee} onChange={(event) => setFormValue('consignee', event.target.value)} placeholder="수입자 회사명, 주소, 연락처" />
              </Field>
              <Field label="Buyer / 구매자">
                <textarea className={textAreaClass()} value={form.buyer} onChange={(event) => setFormValue('buyer', event.target.value)} />
              </Field>
              <Field label="L/C No. and Date / 신용장번호·일자">
                <textarea className={textAreaClass()} value={form.lcNoDate} onChange={(event) => setFormValue('lcNoDate', event.target.value)} />
              </Field>
              <Field label="Other References / 참고사항">
                <textarea className={textAreaClass()} value={form.otherReferences} onChange={(event) => setFormValue('otherReferences', event.target.value)} />
              </Field>
              <Field label="Terms of Delivery and Payment / 인도·결제조건">
                <textarea className={textAreaClass()} value={form.termsDeliveryPayment} onChange={(event) => setFormValue('termsDeliveryPayment', event.target.value)} />
              </Field>
              <Field label="Shipping Marks / 화인">
                <textarea className={textAreaClass()} value={form.shippingMarks} onChange={(event) => setFormValue('shippingMarks', event.target.value)} />
              </Field>
              <Field label="No. and Kind of Packages / 포장수량·종류">
                <textarea className={textAreaClass()} value={form.packagesKind} onChange={(event) => setFormValue('packagesKind', event.target.value)} placeholder="예: 10 CT" />
              </Field>
              <Field label="Remarks / 비고">
                <textarea className={textAreaClass()} value={form.remarks} onChange={(event) => setFormValue('remarks', event.target.value)} />
              </Field>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-slate-950">상품 / 포장 정보</h2>
                <p className="mt-1 text-[12px] font-bold text-slate-500">관리 상품을 선택하거나 직접 입력 행으로 작성합니다.</p>
              </div>
              <button type="button" onClick={addItem} className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-950 px-3 text-[12px] font-black text-white hover:bg-slate-800">
                <Plus size={15} />
                행 추가
              </button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-[1380px] table-fixed text-[12px]">
                <thead className="bg-slate-50 text-[11px] font-black text-slate-500">
                  <tr>
                    <th className="w-[160px] px-2 py-2 text-left">관리상품</th>
                    <th className="w-[210px] px-2 py-2 text-left">상품명</th>
                    <th className="w-[210px] px-2 py-2 text-left">영문명</th>
                    <th className="w-[110px] px-2 py-2 text-left">Model<br /><span className="text-[10px] text-slate-400">모델</span></th>
                    <th className="w-[110px] px-2 py-2 text-left">HS Code<br /><span className="text-[10px] text-slate-400">세번부호</span></th>
                    <th className="w-[90px] px-2 py-2 text-left">Origin<br /><span className="text-[10px] text-slate-400">원산지</span></th>
                    <th className="w-[80px] px-2 py-2 text-right">Qty<br /><span className="text-[10px] text-slate-400">수량</span></th>
                    <th className="w-[110px] px-2 py-2 text-right">Unit<br /><span className="text-[10px] text-slate-400">단가</span></th>
                    <th className="w-[110px] px-2 py-2 text-right">Amount<br /><span className="text-[10px] text-slate-400">금액</span></th>
                    <th className="w-[80px] px-2 py-2 text-right">Carton<br /><span className="text-[10px] text-slate-400">박스수</span></th>
                    <th className="w-[95px] px-2 py-2 text-right">Net KG<br /><span className="text-[10px] text-slate-400">순중량</span></th>
                    <th className="w-[95px] px-2 py-2 text-right">Gross KG<br /><span className="text-[10px] text-slate-400">총중량</span></th>
                    <th className="w-[85px] px-2 py-2 text-right">CBM<br /><span className="text-[10px] text-slate-400">부피</span></th>
                    <th className="w-[130px] px-2 py-2 text-left">규격<br /><span className="text-[10px] text-slate-400">cm</span></th>
                    <th className="w-[54px] px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.id} className="align-top">
                      <td className="px-2 py-2">
                        <select className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-[12px] font-bold outline-none" value={item.productId} onChange={(event) => applyProduct(item.id, event.target.value)}>
                          <option value="">직접입력</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>{product.nameJP || product.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2"><input className={textInputClass()} value={item.productName} onChange={(event) => updateItem(item.id, { productName: event.target.value })} /></td>
                      <td className="px-2 py-2"><input className={textInputClass()} value={item.productNameEN} onChange={(event) => updateItem(item.id, { productNameEN: event.target.value })} /></td>
                      <td className="px-2 py-2"><input className={textInputClass()} value={item.model} onChange={(event) => updateItem(item.id, { model: event.target.value.toUpperCase() })} /></td>
                      <td className="px-2 py-2"><input className={textInputClass()} value={item.hsCode} onChange={(event) => updateItem(item.id, { hsCode: event.target.value })} /></td>
                      <td className="px-2 py-2"><input className={textInputClass()} value={item.origin} onChange={(event) => updateItem(item.id, { origin: event.target.value.toUpperCase() })} /></td>
                      <td className="px-2 py-2"><input type="number" min={0} className={`${textInputClass()} text-right`} value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: Math.max(0, Math.floor(parseNumberInput(event.target.value))) })} /></td>
                      <td className="px-2 py-2"><input type="number" min={0} step="0.01" className={`${textInputClass()} text-right`} value={item.unitPrice} onChange={(event) => updateItem(item.id, { unitPrice: parseNumberInput(event.target.value) })} /></td>
                      <td className="px-2 py-2 text-right font-black text-slate-950">{money(lineAmount(item), form.currency)}</td>
                      <td className="px-2 py-2"><input type="number" min={0} className={`${textInputClass()} text-right`} value={item.cartons} onChange={(event) => updateCartons(item.id, event.target.value)} /></td>
                      <td className="px-2 py-2"><input type="number" min={0} step="0.01" className={`${textInputClass()} text-right`} value={item.netWeight} onChange={(event) => updateItem(item.id, { netWeight: parseNumberInput(event.target.value) })} /></td>
                      <td className="px-2 py-2"><input type="number" min={0} step="0.01" className={`${textInputClass()} text-right`} value={item.grossWeight} onChange={(event) => updateItem(item.id, { grossWeight: parseNumberInput(event.target.value) })} /></td>
                      <td className="px-2 py-2"><input type="number" min={0} step="0.001" className={`${textInputClass()} text-right`} value={item.cbm} onChange={(event) => updateItem(item.id, { cbm: parseNumberInput(event.target.value) })} /></td>
                      <td className="px-2 py-2"><input className={textInputClass()} value={item.dimension} onChange={(event) => updateDimension(item.id, event.target.value)} placeholder="50x40x30cm" /></td>
                      <td className="px-2 py-2 text-center">
                        <button type="button" onClick={() => removeItem(item.id)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-600" title="행 삭제">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:overflow-auto">
          <div className="mb-3 flex items-center gap-2">
            <button type="button" onClick={() => setPreviewMode('commercial')} className={`h-9 rounded-lg px-3 text-[12px] font-black ${previewMode === 'commercial' ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>
              Commercial Invoice
            </button>
            <button type="button" onClick={() => setPreviewMode('packing')} className={`h-9 rounded-lg px-3 text-[12px] font-black ${previewMode === 'packing' ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>
              Packing List
            </button>
          </div>
          <DocumentPreview form={form} items={printableItems.length ? printableItems : items} mode={previewMode} />
        </section>
      </div>
    </div>
  )
}
