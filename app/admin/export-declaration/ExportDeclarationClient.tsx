'use client'

import { Fragment, useMemo, useState } from 'react'
import { AlertTriangle, Copy, FileSpreadsheet, FileText, ListChecks, PackageCheck, Plus, Printer, Trash2 } from 'lucide-react'

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
type WorkTab = 'unipass' | 'documents'
type GuideStatus = 'ready' | 'check'

type GuideField = {
  label: string
  value: string
  source: string
  note: string
  status?: GuideStatus
}

type GuideSection = {
  title: string
  description: string
  fields: GuideField[]
}

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

function compactLines(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' / ')
}

function uniqueJoined(values: string[], fallback = '확인 필요') {
  const unique = Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
  return unique.length ? unique.join(', ') : fallback
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

function buildUnipassGuide(form: ExportDocumentForm, items: ExportLineItem[]): GuideSection[] {
  const activeItems = items.filter((item) => item.productName.trim() || item.productNameEN.trim() || item.model.trim())
  const guideItems = activeItems.length ? activeItems : items
  const totalQty = guideItems.reduce((sum, item) => sum + item.quantity, 0)
  const totalAmount = guideItems.reduce((sum, item) => sum + lineAmount(item), 0)
  const totalCartons = guideItems.reduce((sum, item) => sum + item.cartons, 0)
  const totalNet = guideItems.reduce((sum, item) => sum + item.netWeight, 0)
  const totalGross = guideItems.reduce((sum, item) => sum + item.grossWeight, 0)
  const firstItem = guideItems[0]
  const hsCodes = guideItems.map((item) => item.hsCode)
  const origins = guideItems.map((item) => item.origin)
  const productNames = guideItems.map((item) => item.productNameEN || item.productName)

  return [
    {
      title: '공통사항 1',
      description: '신고 기본정보와 거래 당사자 정보를 먼저 입력합니다.',
      fields: [
        { label: '수출신고번호', value: '채번 클릭 후 자동 생성', source: '유니패스 채번', note: '신고서 작성 시작 시 유니패스에서 채번합니다.' },
        { label: '전송구분', value: '신규', source: '일반 수출신고', note: '정정·취하가 아닌 최초 신고 기준입니다.' },
        { label: '신고구분', value: '수출신고', source: '일반 수출신고', note: '일반 자가 수출이면 수출신고로 진행합니다.' },
        { label: '수출대행자', value: compactLines(form.exporter) || 'beiko Inc.', source: 'Exporter', note: '자가 수출이면 수출화주와 동일하게 입력합니다.' },
        { label: '수출화주', value: compactLines(form.exporter) || 'beiko Inc.', source: 'Exporter', note: '물품 소유자이자 수출자 정보입니다.' },
        { label: '구매자/수입자', value: compactLines(form.consignee || form.buyer) || '확인 필요', source: 'Consignee / Buyer', note: '상대 회사명, 주소, 연락처를 송장 기준으로 입력합니다.', status: form.consignee.trim() ? 'ready' : 'check' },
        { label: '송품장번호', value: form.invoiceNo || '확인 필요', source: 'Invoice No.', note: 'Commercial Invoice 번호와 동일하게 입력합니다.', status: form.invoiceNo.trim() ? 'ready' : 'check' },
        { label: '신고일자', value: form.date || '확인 필요', source: 'Date', note: '작성일 또는 실제 신고일 기준으로 맞춥니다.', status: form.date ? 'ready' : 'check' },
      ],
    },
    {
      title: '공통사항 2',
      description: '운송, 결제, 포장, 금액 정보를 송장과 패킹리스트에서 옮깁니다.',
      fields: [
        { label: '거래구분', value: '일반형태 수출', source: '일반 수출신고', note: '특수 거래가 아니면 일반형태로 봅니다.' },
        { label: '결제방법', value: form.termsDeliveryPayment || 'T/T IN ADVANCE', source: 'Terms of Delivery and Payment', note: '송장 결제조건과 동일하게 입력합니다.' },
        { label: '인도조건', value: form.incoterms || 'FOB BUSAN', source: 'Incoterms', note: 'FOB/CIF 등 송장 기준입니다.' },
        { label: '적재항', value: form.portOfLoading || 'BUSAN, KOREA', source: 'Port of Loading', note: '선적항을 입력합니다.' },
        { label: '목적국/도착항', value: form.portOfDischarge || '확인 필요', source: 'Port of Discharge', note: '수입국 도착항을 입력합니다.', status: form.portOfDischarge.trim() ? 'ready' : 'check' },
        { label: '선박/항공편', value: form.vesselFlight || '확인 필요', source: 'Vessel / Flight', note: '선적 스케줄 확정 후 입력합니다.', status: form.vesselFlight.trim() ? 'ready' : 'check' },
        { label: '출항예정일', value: form.departureDate || '확인 필요', source: 'Departure Date', note: 'B/L 또는 선적 일정과 맞춥니다.', status: form.departureDate ? 'ready' : 'check' },
        { label: '포장개수', value: form.packagesKind || (totalCartons > 0 ? `${intFormatter.format(totalCartons)} CT` : '확인 필요'), source: 'Packing List Carton', note: '총 카톤 수와 포장 종류를 입력합니다.', status: form.packagesKind || totalCartons > 0 ? 'ready' : 'check' },
        { label: '총중량', value: totalGross > 0 ? `${weight(totalGross)} KG` : '확인 필요', source: 'Packing List Gross Weight', note: '총중량 합계입니다.', status: totalGross > 0 ? 'ready' : 'check' },
        { label: '결제금액', value: money(totalAmount, form.currency), source: 'Commercial Invoice Total', note: '송장 총액과 통화를 그대로 입력합니다.' },
      ],
    },
    {
      title: '란사항',
      description: '품목별 세번, 수량, 금액, 원산지를 입력합니다.',
      fields: [
        { label: '수출물품명', value: uniqueJoined(productNames), source: 'Goods description', note: '영문 품명 우선, 없으면 관리 상품명을 사용합니다.', status: productNames.some(Boolean) ? 'ready' : 'check' },
        { label: '모델규격', value: firstItem?.model || '확인 필요', source: 'Model', note: '상품코드 또는 규격을 입력합니다.', status: firstItem?.model ? 'ready' : 'check' },
        { label: 'HS Code', value: uniqueJoined(hsCodes), source: 'HS Code', note: '세번부호는 실제 품목 기준으로 최종 확인이 필요합니다.', status: hsCodes.some((code) => code.trim()) ? 'ready' : 'check' },
        { label: '원산지', value: uniqueJoined(origins, 'KOREA'), source: 'Origin', note: '한국산이면 KOREA/KR 기준으로 입력합니다.' },
        { label: '수량', value: totalQty > 0 ? intFormatter.format(totalQty) : '확인 필요', source: 'Invoice Quantity', note: '송장 수량 합계입니다.', status: totalQty > 0 ? 'ready' : 'check' },
        { label: '단가', value: firstItem ? money(firstItem.unitPrice, form.currency) : '확인 필요', source: 'Unit price', note: '품목별 단가입니다.', status: firstItem && firstItem.unitPrice > 0 ? 'ready' : 'check' },
        { label: '금액', value: money(totalAmount, form.currency), source: 'Amount', note: '품목별 금액 합계입니다.' },
        { label: '순중량', value: totalNet > 0 ? `${weight(totalNet)} KG` : '확인 필요', source: 'Packing List Net Weight', note: '순중량 합계입니다.', status: totalNet > 0 ? 'ready' : 'check' },
        { label: '첨부서류', value: 'Commercial Invoice, Packing List', source: '작성 문서 탭', note: 'PI/Packing List 탭에서 출력한 문서를 첨부합니다.' },
      ],
    },
  ]
}

function UnipassGuideTable({ sections }: { sections: GuideSection[] }) {
  const copyValue = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      alert('복사에 실패했습니다.')
    }
  }

  const checkCount = sections.reduce(
    (sum, section) => sum + section.fields.filter((field) => field.status === 'check' || field.value === '확인 필요').length,
    0,
  )

  const rowsFor = (fields: GuideField[]) => {
    const rows: GuideField[][] = []
    for (let index = 0; index < fields.length; index += 2) {
      rows.push(fields.slice(index, index + 2))
    }
    return rows
  }

  return (
    <div className="rounded-sm border border-[#aeb8c4] bg-[#eef3f8] text-[#1f2937] shadow-sm">
      <div className="border-b border-[#b7c1cd] bg-[#dce8f5] px-3 py-2">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[11px] font-bold text-[#52657a]">UNI-PASS &gt; 수출신고 &gt; 신고서 작성</div>
            <h2 className="mt-0.5 text-[16px] font-black text-[#17365d]">수출신고서 입력 화면</h2>
          </div>
          <div className="flex items-center gap-2 rounded-sm border border-[#e3c467] bg-[#fff8d8] px-2 py-1 text-[12px] font-bold text-[#765600]">
            <AlertTriangle size={14} />
            확인 필요 {checkCount}개
          </div>
        </div>
      </div>

      <div className="border-b border-[#d0d7df] bg-[#fff9df] px-3 py-2 text-[12px] font-bold text-[#6b5600]">
        PI / Packing List 탭의 값을 기준으로 유니패스 입력칸 순서에 맞춰 배치했습니다. 노란 칸은 실제 서류 또는 유니패스 코드 확인 후 입력하세요.
      </div>

      <div className="space-y-3 p-3">
        {sections.map((section) => (
          <section key={section.title} className="overflow-hidden border border-[#b7c1cd] bg-white">
            <div className="flex items-center justify-between border-b border-[#b7c1cd] bg-[#e7f0fa] px-3 py-2">
              <div>
                <h3 className="text-[14px] font-black text-[#17365d]">{section.title}</h3>
                <p className="mt-0.5 text-[11px] font-bold text-[#65758a]">{section.description}</p>
              </div>
              <span className="rounded-sm border border-[#b7c1cd] bg-white px-2 py-1 text-[10px] font-black text-[#52657a]">
                {section.fields.length} items
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] table-fixed border-collapse text-[12px]">
                <colgroup>
                  <col className="w-[150px]" />
                  <col />
                  <col className="w-[150px]" />
                  <col />
                </colgroup>
                <tbody>
                  {rowsFor(section.fields).map((row, rowIndex) => (
                    <tr key={`${section.title}-${rowIndex}`} className="align-stretch">
                      {row.map((field) => {
                        const needsCheck = field.status === 'check' || field.value === '확인 필요'
                        return (
                          <Fragment key={`${section.title}-${field.label}`}>
                            <th className="border border-[#c9d2dc] bg-[#f1f4f7] px-2 py-2 text-left align-middle text-[12px] font-black text-[#27384c]">
                              <div className="flex items-center gap-1">
                                <span className="text-[#bf2d18]">*</span>
                                <span>{field.label}</span>
                              </div>
                            </th>
                            <td className="border border-[#c9d2dc] bg-white p-1.5 align-top">
                              <button
                                type="button"
                                onClick={() => copyValue(field.value)}
                                className={`group flex min-h-10 w-full items-start justify-between gap-2 rounded-sm border px-2 py-1.5 text-left shadow-inner transition hover:border-[#2b6cb0] ${
                                  needsCheck
                                    ? 'border-[#e6cf82] bg-[#fffaf0]'
                                    : 'border-[#bfc8d2] bg-[#fbfdff]'
                                }`}
                                title={`${field.label} 복사`}
                              >
                                <span className="min-w-0 flex-1">
                                  <span className="block whitespace-pre-wrap break-words text-[12px] font-black leading-5 text-[#111827]">{field.value}</span>
                                  <span className="mt-1 block text-[10px] font-bold leading-4 text-[#718096]">
                                    {field.source} · {field.note}
                                  </span>
                                </span>
                                <span className={`mt-0.5 inline-flex h-5 shrink-0 items-center gap-1 rounded-sm border px-1.5 text-[10px] font-black ${
                                  needsCheck
                                    ? 'border-[#e2bd46] bg-[#fff3bf] text-[#7a5200]'
                                    : 'border-[#a7d8c2] bg-[#e8fff3] text-[#047857]'
                                }`}>
                                  <Copy size={11} />
                                  {needsCheck ? '확인' : '복사'}
                                </span>
                              </button>
                            </td>
                          </Fragment>
                        )
                      })}
                      {row.length === 1 ? (
                        <>
                          <th className="border border-[#c9d2dc] bg-[#f1f4f7]" />
                          <td className="border border-[#c9d2dc] bg-white" />
                        </>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

export default function ExportDeclarationClient({ products }: { products: ExportProductOption[] }) {
  const [form, setForm] = useState<ExportDocumentForm>(() => defaultForm())
  const [items, setItems] = useState<ExportLineItem[]>(() => [createEmptyItem()])
  const [previewMode, setPreviewMode] = useState<PreviewMode>('commercial')
  const [activeTab, setActiveTab] = useState<WorkTab>('unipass')

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

  const guideSections = useMemo(() => buildUnipassGuide(form, items), [form, items])

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
        <div className="mt-4 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('unipass')}
            className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-[13px] font-black transition ${activeTab === 'unipass' ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <ListChecks size={16} />
            유니패스 입력 가이드
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('documents')}
            className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-[13px] font-black transition ${activeTab === 'documents' ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <FileSpreadsheet size={16} />
            PI / Packing List
          </button>
        </div>
      </div>

      {activeTab === 'unipass' ? <UnipassGuideTable sections={guideSections} /> : null}

      <div className={activeTab === 'documents' ? 'grid gap-5 xl:grid-cols-[minmax(740px,1fr)_minmax(520px,760px)]' : 'hidden'}>
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
