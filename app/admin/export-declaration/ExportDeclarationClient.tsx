'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Copy, FileSpreadsheet, FileText, ListChecks, PackageCheck, Plus, Printer, Save, Trash2 } from 'lucide-react'
import {
  getExportCountryCurrency,
  normalizeExportCountry,
  resolveExportUnitPriceUsd,
  type ExportCountryCode,
  type ExportExchangeRates,
  type ExportProductPriceMap,
} from '@/lib/exportDeclarationPricing'

export type ExportProductOption = {
  id: string
  name: string
  nameEN: string | null
  nameJP: string | null
  productCode: string | null
  prices: ExportProductPriceMap
  unitPriceUsd: number
  stock: number
}

export type ExportDeclarationListItem = {
  id: string
  invoiceNo: string
  status: string
  createdAt: string
  itemCount: number
  totalAmount: number
}

type ExportDeclarationDetail = ExportDeclarationListItem & {
  form?: Partial<ExportDocumentForm>
  items?: Partial<ExportLineItem>[]
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
  exportCountry: ExportCountryCode
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
type WorkTab = 'list' | 'documents' | 'unipass'
type UnipassDeclarationTab = 'common1' | 'common2' | 'items'
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
  exportCountry: 'US',
  incoterms: 'FOB BUSAN',
  termsDeliveryPayment: 'FOB BUSAN\nT/T IN ADVANCE',
  shippingMarks: 'MADE IN KOREA',
  packagesKind: '',
  otherReferences: 'COUNTRY OF ORIGIN :\nREPUBLIC OF KOREA',
  currency: 'US$',
  remarks: 'Country of Origin: Republic of Korea',
})

const normalizeLoadedForm = (value: Partial<ExportDocumentForm> | undefined): ExportDocumentForm => {
  const merged = {
    ...defaultForm(),
    ...(value || {}),
  }
  return {
    ...merged,
    exportCountry: normalizeExportCountry(merged.exportCountry),
    currency: 'US$',
  }
}

const normalizeLoadedItems = (value: Partial<ExportLineItem>[] | undefined): ExportLineItem[] => {
  if (!Array.isArray(value) || value.length === 0) return [createEmptyItem()]

  return value.map((item) => ({
    ...createEmptyItem(),
    ...item,
    id: item.id || (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now())),
    productId: item.productId || '',
    productName: item.productName || '',
    productNameEN: item.productNameEN || '',
    model: item.model || '',
    hsCode: item.hsCode || '',
    origin: item.origin || 'KOREA',
    quantity: Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : 0,
    unitPrice: Number.isFinite(Number(item.unitPrice)) ? Number(item.unitPrice) : 0,
    cartons: Number.isFinite(Number(item.cartons)) ? Number(item.cartons) : 0,
    netWeight: Number.isFinite(Number(item.netWeight)) ? Number(item.netWeight) : 0,
    grossWeight: Number.isFinite(Number(item.grossWeight)) ? Number(item.grossWeight) : 0,
    cbm: Number.isFinite(Number(item.cbm)) ? Number(item.cbm) : 0,
    dimension: item.dimension || '',
  }))
}

const numberFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const intFormatter = new Intl.NumberFormat('en-US')

const exportCountryOptions: Array<{ value: ExportCountryCode; label: string; priceLabel: string }> = [
  { value: 'US', label: '미국 수출', priceLabel: '미국 판매가' },
  { value: 'JP', label: '일본 수출', priceLabel: '일본 판매가' },
  { value: 'KR', label: '한국 기준', priceLabel: '한국 판매가' },
]

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

function formatSavedDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
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
  later,
  children,
}: {
  label: string
  later?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="flex flex-wrap items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-slate-500">
        <span>{label}</span>
        {later ? (
          <span className="rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[9px] font-black tracking-normal text-sky-700">
            EMS 후 입력 가능
          </span>
        ) : null}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

function isMissingRequired(value: string | number | null | undefined) {
  if (typeof value === 'number') return !Number.isFinite(value) || value <= 0
  return String(value ?? '').trim().length === 0
}

function inputToneClass({ later = false, missing = false }: { later?: boolean; missing?: boolean } = {}) {
  if (missing) return 'border-red-400 bg-red-50 text-red-950 focus:border-red-500 focus:ring-red-500/20'
  if (later) return 'border-sky-300 bg-sky-50 text-sky-950 focus:border-sky-500 focus:ring-sky-500/20'
  return 'border-slate-200 bg-white text-slate-900 focus:border-[#EF3B2D] focus:ring-[#EF3B2D]/15'
}

function textInputClass(options?: { later?: boolean; missing?: boolean }) {
  return `h-10 w-full rounded-lg border px-3 text-[13px] font-bold outline-none transition focus:ring-2 ${inputToneClass(options)}`
}

function textAreaClass(options?: { later?: boolean; missing?: boolean }) {
  return `min-h-20 w-full resize-y rounded-lg border px-3 py-2 text-[13px] font-bold outline-none transition focus:ring-2 ${inputToneClass(options)}`
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

type UnipassField = {
  label: string
  value?: string | number
  required?: boolean
  later?: boolean
  suffix?: string
  lookup?: boolean
  select?: boolean
  muted?: boolean
  wide?: boolean
}

function getDeclarationItems(items: ExportLineItem[]) {
  const activeItems = items.filter((item) => item.productName.trim() || item.productNameEN.trim() || item.model.trim())
  return activeItems.length ? activeItems : items
}

function getDeclarationTotals(items: ExportLineItem[]) {
  return {
    qty: items.reduce((sum, item) => sum + item.quantity, 0),
    amount: items.reduce((sum, item) => sum + lineAmount(item), 0),
    cartons: items.reduce((sum, item) => sum + item.cartons, 0),
    net: items.reduce((sum, item) => sum + item.netWeight, 0),
    gross: items.reduce((sum, item) => sum + item.grossWeight, 0),
    cbm: items.reduce((sum, item) => sum + item.cbm, 0),
  }
}

function displayUnipassValue(value: string | number | undefined, later = false) {
  const text = String(value ?? '').trim()
  if (text) return text
  return later ? 'EMS 접수 후 입력' : '확인 필요'
}

function copyUnipassValue(value: string | number | undefined, later = false) {
  navigator.clipboard.writeText(displayUnipassValue(value, later)).catch(() => alert('복사에 실패했습니다.'))
}

function UnipassValue({ field }: { field: UnipassField }) {
  const value = displayUnipassValue(field.value, field.later)
  const needsCheck = value === '확인 필요'
  const requiredMissing = field.required && needsCheck
  const canFillLater = field.later && value === 'EMS 접수 후 입력'

  return (
    <button
      type="button"
      onClick={() => copyUnipassValue(field.value, field.later)}
      className={`flex min-h-[23px] w-full items-center gap-1 rounded-none border px-1.5 text-left text-[12px] font-normal ${
        field.muted
          ? 'border-[#d5d9df] bg-[#e9eaec] text-[#67707d]'
          : canFillLater
            ? 'border-[#9bc7ea] bg-[#eef7ff] text-[#1d5f95]'
          : requiredMissing
            ? 'border-red-400 bg-red-50 text-red-950'
          : needsCheck
            ? 'border-[#d8bd68] bg-[#fff8dd] text-[#8a5a00]'
            : 'border-[#c7cdd5] bg-white text-[#111827]'
      }`}
      title={`${field.label} 복사`}
    >
      <span className="min-w-0 flex-1 truncate">{value}</span>
      {field.suffix ? <span className="shrink-0 text-[11px] text-[#59677a]">{field.suffix}</span> : null}
      {field.later ? <span className="shrink-0 rounded-[1px] border border-sky-200 bg-sky-50 px-1 text-[10px] text-sky-700">나중입력</span> : null}
      {field.lookup ? <span className="shrink-0 rounded-[1px] border border-[#b7c1d0] bg-[#edf2f9] px-1 text-[10px] text-[#3466b7]">조회</span> : null}
      {field.select ? <span className="shrink-0 text-[10px] text-[#59677a]">▼</span> : null}
      <Copy size={10} className="shrink-0 text-[#6a7890]" />
    </button>
  )
}

function UnipassFieldCell({ field }: { field: UnipassField }) {
  return (
    <>
      <th className="border border-[#d8d8d8] bg-[#f2f2f2] px-2 py-1 text-right align-middle text-[12px] font-normal text-[#333333]">
        {field.required ? <span className="mr-0.5 text-[#d22f27]">*</span> : null}
        {field.label}
        {field.later ? <span className="ml-1 text-[10px] font-black text-sky-700">(나중)</span> : null}
      </th>
      <td className="border border-[#d8d8d8] bg-white px-1 py-[3px] align-middle">
        <UnipassValue field={field} />
      </td>
    </>
  )
}

function UnipassRow({ fields }: { fields: UnipassField[] }) {
  if (fields.length === 1 || fields[0]?.wide) {
    const field = fields[0]
    return (
      <tr>
        <th className="w-[142px] border border-[#d8d8d8] bg-[#f2f2f2] px-2 py-1 text-right align-middle text-[12px] font-normal text-[#333333]">
          {field.required ? <span className="mr-0.5 text-[#d22f27]">*</span> : null}
          {field.label}
          {field.later ? <span className="ml-1 text-[10px] font-black text-sky-700">(나중)</span> : null}
        </th>
        <td colSpan={3} className="border border-[#d8d8d8] bg-white px-1 py-[3px] align-middle">
          <UnipassValue field={field} />
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <UnipassFieldCell field={fields[0]} />
      <UnipassFieldCell field={fields[1]} />
    </tr>
  )
}

function UnipassSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <h3 className="border-b border-[#8f8f8f] pb-1 text-[13px] font-black text-[#1f55b5]">*{title}</h3>
      <div className="overflow-x-auto">
        <table className="mt-1 w-[1180px] table-fixed border-collapse text-[12px]">
          <colgroup>
            <col className="w-[142px]" />
            <col />
            <col className="w-[142px]" />
            <col />
          </colgroup>
          <tbody>{children}</tbody>
        </table>
      </div>
    </section>
  )
}

function UnipassDeclarationForm({
  form,
  items,
  onSaveDraft,
  isSavingDraft,
}: {
  form: ExportDocumentForm
  items: ExportLineItem[]
  onSaveDraft: () => void
  isSavingDraft: boolean
}) {
  const [activeDeclarationTab, setActiveDeclarationTab] = useState<UnipassDeclarationTab>('common1')
  const declarationItems = getDeclarationItems(items)
  const totals = getDeclarationTotals(declarationItems)
  const productName = uniqueJoined(declarationItems.map((item) => item.productNameEN || item.productName), '확인 필요')
  const hsCode = uniqueJoined(declarationItems.map((item) => item.hsCode), '확인 필요')
  const origin = uniqueJoined(declarationItems.map((item) => item.origin), 'KOREA')
  const exporter = compactLines(form.exporter) || 'beiko Inc.'
  const buyer = compactLines(form.consignee || form.buyer)
  const totalAmount = money(totals.amount, form.currency)
  const totalGross = totals.gross > 0 ? weight(totals.gross) : ''
  const totalNet = totals.net > 0 ? weight(totals.net) : ''
  const packageText = form.packagesKind || (totals.cartons > 0 ? `${intFormatter.format(totals.cartons)} CT` : '')
  const currencyCode = form.currency.includes('$') ? 'USD' : form.currency.replace(/[^A-Z]/g, '') || 'USD'
  const tabs: Array<{ id: UnipassDeclarationTab; label: string }> = [
    { id: 'common1', label: '공통사항1' },
    { id: 'common2', label: '공통사항2' },
    { id: 'items', label: '란사항' },
  ]

  return (
    <div className="w-full max-w-[1320px] overflow-hidden bg-white text-[#222222]">
      <div className="border-b border-[#d5d5d5] px-0 pb-4 pt-1">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[18px] font-black text-[#1f55b5]">전자상거래 수출신고서 <span className="text-[#d6d6d6]">★</span></h2>
          <div className="hidden text-[11px] font-normal text-[#888888] xl:block">Home &gt; 전자신고 &gt; 신고서작성 &gt; 수출통관 &gt; 전자상거래수출신고서</div>
        </div>
      </div>

      <div className="flex border-b border-[#e5e5e5] bg-white pt-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveDeclarationTab(tab.id)}
            className={`h-[31px] min-w-[110px] border border-[#d8d8d8] px-4 text-[12px] font-bold ${
              activeDeclarationTab === tab.id ? 'border-[#4374d9] bg-[#4374d9] text-white' : 'bg-[#eeeeee] text-[#333333]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="border-b border-[#d8d8d8] bg-[#eef7ff] px-2 py-2 text-[12px] font-bold text-[#1d5f95]">
        <span className="mr-2 rounded-[2px] border border-sky-200 bg-white px-1.5 py-0.5 text-[10px] font-black">나중입력</span>
        EMS 접수 후 송장번호, 특송업체, 신고세관 정보가 확정되면 채워도 되는 항목입니다.
      </div>

      <div className="border-b border-[#d8d8d8] bg-white py-2">
        <div className="overflow-x-auto">
        <table className="w-[1180px] table-fixed border-collapse text-[12px]">
          <tbody>
            <UnipassRow fields={[
              { label: '기존 신고서 조회', value: '', lookup: true, muted: true },
              { label: '수출신고번호', value: 'WC10E - 26 - 채번', required: true, muted: true },
            ]} />
          </tbody>
        </table>
        </div>
      </div>

      <div className="pb-8 pt-2">
        {activeDeclarationTab === 'common1' ? (
          <>
            <UnipassSection title="신고인">
              <UnipassRow fields={[
                { label: '신고인부호', value: 'WC10E', required: true, select: true },
                { label: '제출자구분', value: '전자상거래업체', required: true, select: true },
              ]} />
              <UnipassRow fields={[{ label: '상호', value: '주식회사 베이코', required: true, lookup: true, wide: true }]} />
              <UnipassRow fields={[{ label: '신고인기재란', value: form.remarks, wide: true }]} />
            </UnipassSection>

            <UnipassSection title="수출화주">
              <UnipassRow fields={[
                { label: '상호', value: '주식회사 베이코', required: true, lookup: true },
                { label: '대표자명', value: '확인 필요', required: true },
              ]} />
              <UnipassRow fields={[
                { label: '식별부호구분', value: '통관고유부호', required: true, select: true },
                { label: '식별번호', value: '확인 필요', required: true },
              ]} />
              <UnipassRow fields={[
                { label: '통관고유부호', value: '확인 필요' },
                { label: '사업장일련번호', value: '확인 필요' },
              ]} />
              <UnipassRow fields={[{ label: '소재지주소', value: exporter, required: true, lookup: true, wide: true }]} />
            </UnipassSection>

            <UnipassSection title="수출대행자">
              <UnipassRow fields={[
                { label: '상호', value: '주식회사 베이코', required: true, lookup: true },
                { label: '사업장일련번호', value: '확인 필요' },
              ]} />
              <UnipassRow fields={[{ label: '통관고유부호', value: '확인 필요' }]} />
            </UnipassSection>

            <UnipassSection title="제조자">
              <UnipassRow fields={[
                { label: '상호', value: '주식회사 베이코' },
                { label: '사업자등록번호', value: '확인 필요' },
              ]} />
              <UnipassRow fields={[
                { label: '홈페이지 주소/URL', value: 'https://www.beiko.co.kr' },
                { label: '구매자 상호', value: buyer, required: true },
              ]} />
            </UnipassSection>
          </>
        ) : null}

        {activeDeclarationTab === 'common2' ? (
          <>
            <UnipassSection title="기본 신고사항">
              <UnipassRow fields={[
                { label: '적재항', value: form.portOfLoading, required: true, lookup: true },
                { label: '특송업체부호', value: '', required: true, lookup: true, later: true },
              ]} />
              <UnipassRow fields={[
                { label: '목적국', value: form.portOfDischarge, required: true, lookup: true, later: true },
                { label: '신고세관/과', value: '', required: true, lookup: true, later: true },
              ]} />
              <UnipassRow fields={[
                { label: '총중량', value: totalGross, required: true, suffix: 'KG' },
                { label: '총신고수량', value: totals.qty > 0 ? intFormatter.format(totals.qty) : '', suffix: 'EA' },
              ]} />
              <UnipassRow fields={[
                { label: '통화코드', value: currencyCode, required: true, lookup: true },
                { label: '신고총액', value: totalAmount, required: true },
              ]} />
              <UnipassRow fields={[
                { label: '물품소재지', value: exporter, required: true, lookup: true },
                { label: '인도조건', value: form.incoterms, select: true },
              ]} />
            </UnipassSection>

            <UnipassSection title="주문/배송 관련 정보">
              <UnipassRow fields={[
                { label: '배송번호', value: form.vesselFlight, later: true },
                { label: '주문번호', value: form.invoiceNo, required: true },
              ]} />
              <UnipassRow fields={[
                { label: '결제방법', value: form.termsDeliveryPayment || 'T/T IN ADVANCE', required: true, select: true },
                { label: '결제금액', value: totalAmount, required: true },
              ]} />
              <UnipassRow fields={[
                { label: '조정금액', value: '0' },
                { label: '운임', value: '0' },
              ]} />
            </UnipassSection>
          </>
        ) : null}

        {activeDeclarationTab === 'items' ? (
          <>
            <UnipassSection title="란사항">
              <UnipassRow fields={[
                { label: 'HS부호', value: hsCode, required: true, lookup: true },
                { label: '란번호 / 총란수', value: `001 / ${String(declarationItems.length).padStart(3, '0')}`, muted: true },
              ]} />
              <UnipassRow fields={[{ label: '거래품명', value: productName, required: true, wide: true }]} />
              <UnipassRow fields={[
                { label: '수출자구분', value: '전자상거래 수출업체', required: true, select: true },
                { label: '환급신청인', value: '해당없음', select: true },
              ]} />
              <UnipassRow fields={[
                { label: '제조자 상호', value: '주식회사 베이코', required: true, lookup: true },
                { label: '자동간이정액환급', value: '해당없음', required: true, select: true },
              ]} />
              <UnipassRow fields={[
                { label: '수량', value: totals.qty > 0 ? intFormatter.format(totals.qty) : '', required: true, suffix: 'EA' },
                { label: '신고가격', value: totalAmount, required: true },
              ]} />
              <UnipassRow fields={[
                { label: '순중량', value: totalNet, required: true, suffix: 'KG' },
                { label: '포장개수', value: packageText },
              ]} />
            </UnipassSection>

            <section className="mt-4 overflow-hidden border border-[#c8cdd4]">
              <div className="flex items-center justify-between border-b border-[#d7dce2] bg-white px-2 py-1">
                <h3 className="text-[13px] font-black text-[#2f66b2]">란 목록</h3>
                <div className="text-[11px] font-bold text-[#7b8794]">상품 행을 기준으로 자동 생성</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-[1180px] table-fixed border-collapse text-[12px]">
                  <thead className="bg-[#f3f3f4] text-[#4b5563]">
                    <tr>
                      <th className="w-[56px] border border-[#d7dce2] px-2 py-1">NO</th>
                      <th className="border border-[#d7dce2] px-2 py-1">거래품명</th>
                      <th className="w-[180px] border border-[#d7dce2] px-2 py-1">모델규격</th>
                      <th className="w-[120px] border border-[#d7dce2] px-2 py-1">HS부호</th>
                      <th className="w-[120px] border border-[#d7dce2] px-2 py-1">수량</th>
                      <th className="w-[140px] border border-[#d7dce2] px-2 py-1">단가</th>
                      <th className="w-[150px] border border-[#d7dce2] px-2 py-1">금액</th>
                      <th className="w-[110px] border border-[#d7dce2] px-2 py-1">원산지</th>
                    </tr>
                  </thead>
                  <tbody>
                    {declarationItems.map((item, index) => (
                      <tr key={item.id}>
                        <td className="border border-[#d7dce2] px-2 py-1 text-center">{index + 1}</td>
                        <td className="border border-[#d7dce2] px-2 py-1">
                          <UnipassValue field={{ label: '거래품명', value: item.productNameEN || item.productName }} />
                        </td>
                        <td className="border border-[#d7dce2] px-2 py-1">
                          <UnipassValue field={{ label: '모델규격', value: item.model || item.dimension }} />
                        </td>
                        <td className="border border-[#d7dce2] px-2 py-1">
                          <UnipassValue field={{ label: 'HS부호', value: item.hsCode }} />
                        </td>
                        <td className="border border-[#d7dce2] px-2 py-1">
                          <UnipassValue field={{ label: '수량', value: item.quantity, suffix: 'EA' }} />
                        </td>
                        <td className="border border-[#d7dce2] px-2 py-1">
                          <UnipassValue field={{ label: '단가', value: money(item.unitPrice, form.currency) }} />
                        </td>
                        <td className="border border-[#d7dce2] px-2 py-1">
                          <UnipassValue field={{ label: '금액', value: money(lineAmount(item), form.currency) }} />
                        </td>
                        <td className="border border-[#d7dce2] px-2 py-1">
                          <UnipassValue field={{ label: '원산지', value: item.origin || origin }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}

        <div className="mt-8 flex items-center justify-between border-t border-[#c8cdd4] pt-3">
          <button type="button" className="h-8 rounded-[2px] border border-[#aeb5bf] bg-[#f4f4f4] px-4 text-[12px] font-black text-[#4b5563]">목록</button>
          <div className="flex items-center gap-2">
            <button type="button" className="h-8 rounded-[2px] border border-[#aeb5bf] bg-[#f4f4f4] px-4 text-[12px] font-black text-[#4b5563]">미리보기</button>
            <button
              type="button"
              onClick={onSaveDraft}
              disabled={isSavingDraft}
              className="h-8 rounded-[2px] border border-[#1f55b5] bg-[#1f55b5] px-4 text-[12px] font-black text-white disabled:cursor-wait disabled:opacity-60"
            >
              {isSavingDraft ? '저장 중' : '임시저장'}
            </button>
            <button type="button" className="h-8 rounded-[2px] border border-[#aeb5bf] bg-[#f4f4f4] px-4 text-[12px] font-black text-[#4b5563]">일괄저장</button>
            <button type="button" className="h-8 rounded-[2px] border border-[#6b7280] bg-[#6b7280] px-4 text-[12px] font-black text-white">전송</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ExportDeclarationClient({
  products,
  savedDeclarations: initialSavedDeclarations = [],
}: {
  products: ExportProductOption[]
  savedDeclarations?: ExportDeclarationListItem[]
}) {
  const [form, setForm] = useState<ExportDocumentForm>(() => defaultForm())
  const [items, setItems] = useState<ExportLineItem[]>(() => [createEmptyItem()])
  const [previewMode, setPreviewMode] = useState<PreviewMode>('commercial')
  const [activeWorkTab, setActiveWorkTab] = useState<WorkTab>('list')
  const [selectedDeclarationId, setSelectedDeclarationId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isLoadingDeclaration, setIsLoadingDeclaration] = useState(false)
  const [isUpdatingDeclaration, setIsUpdatingDeclaration] = useState(false)
  const [deletingDeclarationId, setDeletingDeclarationId] = useState<string | null>(null)
  const [savedDeclarations, setSavedDeclarations] = useState<ExportDeclarationListItem[]>(initialSavedDeclarations)
  const [exchangeRates, setExchangeRates] = useState<ExportExchangeRates | null>(null)
  const [exchangeRateStatus, setExchangeRateStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products])
  const selectedExportCountry = normalizeExportCountry(form.exportCountry)
  const selectedCountryOption = exportCountryOptions.find((option) => option.value === selectedExportCountry) || exportCountryOptions[0]

  useEffect(() => {
    let cancelled = false

    async function loadExchangeRates() {
      setExchangeRateStatus('loading')
      try {
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD', { cache: 'no-store' })
        if (!response.ok) throw new Error('exchange rate request failed')
        const data = await response.json()
        const nextRates = {
          KRW: Number(data?.rates?.KRW),
          JPY: Number(data?.rates?.JPY),
        }
        if (!Number.isFinite(nextRates.KRW) || !Number.isFinite(nextRates.JPY) || nextRates.KRW <= 0 || nextRates.JPY <= 0) {
          throw new Error('exchange rate response invalid')
        }
        if (!cancelled) {
          setExchangeRates(nextRates)
          setExchangeRateStatus('ready')
        }
      } catch {
        if (!cancelled) {
          setExchangeRates(null)
          setExchangeRateStatus('error')
        }
      }
    }

    loadExchangeRates()
    return () => {
      cancelled = true
    }
  }, [])

  const resolveProductUnitPrice = (product: ExportProductOption, country: ExportCountryCode = selectedExportCountry) => resolveExportUnitPriceUsd({
    prices: product.prices,
    exportCountry: country,
    exchangeRates,
    fallbackUsd: product.unitPriceUsd,
  })

  const setFormValue = (key: keyof ExportDocumentForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const updateItem = (id: string, patch: Partial<ExportLineItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const repriceSelectedProducts = useCallback((country: ExportCountryCode, rates: ExportExchangeRates | null = exchangeRates) => {
    setItems((prev) => prev.map((item) => {
      if (!item.productId) return item
      const product = productMap.get(item.productId)
      if (!product) return item
      return {
        ...item,
        unitPrice: resolveExportUnitPriceUsd({
          prices: product.prices,
          exportCountry: country,
          exchangeRates: rates,
          fallbackUsd: product.unitPriceUsd,
        }),
      }
    }))
  }, [exchangeRates, productMap])

  const changeExportCountry = (country: ExportCountryCode) => {
    const normalized = normalizeExportCountry(country)
    setForm((prev) => ({ ...prev, exportCountry: normalized, currency: 'US$' }))
    repriceSelectedProducts(normalized)
  }

  useEffect(() => {
    if (!exchangeRates) return
    repriceSelectedProducts(selectedExportCountry, exchangeRates)
  }, [exchangeRates, repriceSelectedProducts, selectedExportCountry])

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
      unitPrice: resolveProductUnitPrice(product),
      origin: 'KOREA',
    })
  }

  const addItem = () => setItems((prev) => [...prev, createEmptyItem()])
  const removeItem = (id: string) => setItems((prev) => (prev.length > 1 ? prev.filter((item) => item.id !== id) : prev))
  const resetForm = () => {
    setForm(defaultForm())
    setItems([createEmptyItem()])
    setPreviewMode('commercial')
    setSelectedDeclarationId(null)
    setActiveWorkTab('list')
  }

  const printableItems = useMemo(
    () => items.filter((item) => item.productName.trim() || item.productNameEN.trim() || item.model.trim()),
    [items],
  )

  const previewItems = printableItems.length ? printableItems : items

  const buildNewDraftForm = () => {
    const draft = defaultForm()
    const prefix = `EXP-${defaultInvoiceNo()}-`
    const nextSequence =
      savedDeclarations.reduce((max, row) => {
        if (!row.invoiceNo.startsWith(prefix)) return max
        const parsed = Number(row.invoiceNo.slice(prefix.length))
        return Number.isFinite(parsed) ? Math.max(max, parsed) : max
      }, 0) + 1

    return { ...draft, invoiceNo: `${prefix}${String(nextSequence).padStart(3, '0')}` }
  }

  const upsertDeclarationList = (row: ExportDeclarationListItem) => {
    setSavedDeclarations((prev) => [row, ...prev.filter((item) => item.id !== row.id)].slice(0, 30))
  }

  const applyDeclaration = (detail: ExportDeclarationDetail, nextWorkTab: WorkTab = 'documents') => {
    setSelectedDeclarationId(detail.id)
    setForm(normalizeLoadedForm(detail.form))
    setItems(normalizeLoadedItems(detail.items))
    setPreviewMode('commercial')
    setActiveWorkTab(nextWorkTab)
    upsertDeclarationList(detail)
  }

  const createDeclaration = async () => {
    const draftForm = buildNewDraftForm()
    const draftItems = [createEmptyItem()]

    setIsCreating(true)
    try {
      const response = await fetch('/api/admin/export-declaration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form: draftForm, items: draftItems }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.error || '신청서 생성에 실패했습니다.')
      }

      applyDeclaration(data as ExportDeclarationDetail)
      alert('새 신청서를 생성했습니다. 이제 내용을 입력한 뒤 작성내용 저장을 누르세요.')
    } catch (error) {
      alert(error instanceof Error ? error.message : '신청서 생성에 실패했습니다.')
    } finally {
      setIsCreating(false)
    }
  }

  const loadDeclaration = async (id: string) => {
    setIsLoadingDeclaration(true)
    try {
      const response = await fetch(`/api/admin/export-declaration?id=${encodeURIComponent(id)}`)
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.error || '신청서를 불러오지 못했습니다.')
      }

      applyDeclaration(data as ExportDeclarationDetail)
    } catch (error) {
      alert(error instanceof Error ? error.message : '신청서를 불러오지 못했습니다.')
    } finally {
      setIsLoadingDeclaration(false)
    }
  }

  const saveDraftDeclaration = async () => {
    setIsUpdatingDeclaration(true)
    try {
      const response = await fetch('/api/admin/export-declaration', {
        method: selectedDeclarationId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedDeclarationId ? { id: selectedDeclarationId, form, items } : { form, items }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.error || '수출신고 내용을 임시저장하지 못했습니다.')
      }

      applyDeclaration(data as ExportDeclarationDetail, selectedDeclarationId ? activeWorkTab : 'documents')
      alert('수출신고 내용을 임시저장했습니다.')
    } catch (error) {
      alert(error instanceof Error ? error.message : '수출신고 내용을 임시저장하지 못했습니다.')
    } finally {
      setIsUpdatingDeclaration(false)
    }
  }

  const deleteDeclaration = async (id: string) => {
    const target = savedDeclarations.find((row) => row.id === id)
    if (!confirm(`${target?.invoiceNo || '선택한 신청서'}를 삭제할까요? 삭제 후 복구할 수 없습니다.`)) {
      return
    }

    setDeletingDeclarationId(id)
    try {
      const response = await fetch(`/api/admin/export-declaration?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.error || '신청서 삭제에 실패했습니다.')
      }

      setSavedDeclarations((prev) => prev.filter((row) => row.id !== id))
      if (selectedDeclarationId === id) {
        setSelectedDeclarationId(null)
        setForm(defaultForm())
        setItems([createEmptyItem()])
        setPreviewMode('commercial')
        setActiveWorkTab('list')
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : '신청서 삭제에 실패했습니다.')
    } finally {
      setDeletingDeclarationId(null)
    }
  }

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
            <button
              type="button"
              onClick={createDeclaration}
              disabled={isCreating}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-950 bg-slate-950 px-4 text-[12px] font-black text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={15} />
              {isCreating ? '생성 중' : '신청서 생성'}
            </button>
            <button
              type="button"
              onClick={saveDraftDeclaration}
              disabled={isUpdatingDeclaration}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#1f55b5] bg-[#1f55b5] px-4 text-[12px] font-black text-white shadow-sm hover:bg-[#17438e] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save size={15} />
              {isUpdatingDeclaration ? '저장 중' : '임시저장'}
            </button>
            <button type="button" onClick={resetForm} className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-black text-slate-600 shadow-sm hover:bg-slate-50">
              초기화
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveWorkTab('list')}
            className={`h-10 rounded-lg px-5 text-[13px] font-black transition ${
              activeWorkTab === 'list' ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            신청서 목록
          </button>
          <button
            type="button"
            onClick={() => setActiveWorkTab('documents')}
            disabled={!selectedDeclarationId}
            className={`h-10 rounded-lg px-5 text-[13px] font-black transition ${
              activeWorkTab === 'documents' ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-50'
            } disabled:cursor-not-allowed disabled:opacity-40`}
          >
            PI / Packing List
          </button>
          <button
            type="button"
            onClick={() => setActiveWorkTab('unipass')}
            disabled={!selectedDeclarationId}
            className={`h-10 rounded-lg px-5 text-[13px] font-black transition ${
              activeWorkTab === 'unipass' ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-50'
            } disabled:cursor-not-allowed disabled:opacity-40`}
          >
            전자상거래 수출신고서
          </button>
        </div>
      </div>

      <section className={activeWorkTab === 'list' ? 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm' : 'hidden'}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-black text-slate-950">신청서 목록</h2>
            <p className="mt-1 text-[12px] font-bold text-slate-500">신청서를 선택하면 하단 작성 화면이 열립니다.</p>
          </div>
          <span className="text-[12px] font-bold text-slate-500">최근 {savedDeclarations.length}건</span>
        </div>
        {savedDeclarations.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {savedDeclarations.slice(0, 30).map((row) => (
              <div
                key={row.id}
                className={`rounded-lg border bg-slate-50 p-3 transition ${
                  selectedDeclarationId === row.id ? 'border-[#1f55b5] bg-sky-50 ring-2 ring-sky-100' : 'border-slate-200'
                }`}
              >
                <button
                  type="button"
                  onClick={() => loadDeclaration(row.id)}
                  disabled={isLoadingDeclaration || deletingDeclarationId === row.id}
                  className="block w-full text-left disabled:cursor-wait"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[12px] font-black text-slate-950">{row.invoiceNo}</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-slate-500">{row.status}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] font-bold text-slate-500">
                    <span>{formatSavedDate(row.createdAt)}</span>
                    <span>{row.itemCount}품목 · {money(row.totalAmount, form.currency)}</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => deleteDeclaration(row.id)}
                  disabled={deletingDeclarationId === row.id}
                  className="mt-3 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-red-100 bg-white text-[11px] font-black text-red-600 hover:bg-red-50 disabled:cursor-wait disabled:opacity-50"
                >
                  <Trash2 size={13} />
                  {deletingDeclarationId === row.id ? '삭제 중' : '삭제'}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-8 text-center text-[12px] font-bold text-slate-500">
            아직 생성된 신청서가 없습니다. 상단의 신청서 생성 버튼으로 새 신청서를 먼저 만드세요.
          </div>
        )}
      </section>

      <div className="space-y-5">
        <div className={activeWorkTab === 'documents' && selectedDeclarationId ? 'grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(520px,0.74fr)] xl:items-start' : 'hidden'}>
          <div className="flex min-w-0 flex-col gap-5">
          <section className="order-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={17} className="text-slate-500" />
                <h2 className="text-sm font-black text-slate-950">PI / Packing List 작성</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${selectedDeclarationId ? 'bg-sky-50 text-sky-700' : 'bg-red-50 text-red-700'}`}>
                  {selectedDeclarationId ? `${form.invoiceNo} 작성 중` : '신규 임시저장 가능'}
                </span>
                <button
                  type="button"
                  onClick={saveDraftDeclaration}
                  disabled={isUpdatingDeclaration}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#1f55b5] bg-[#1f55b5] px-3 text-[12px] font-black text-white shadow-sm hover:bg-[#17438e] disabled:cursor-wait disabled:opacity-60"
                >
                  <Save size={14} />
                  {isUpdatingDeclaration ? '저장 중' : '임시저장'}
                </button>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Invoice No. / 송장번호">
                <input className={textInputClass({ missing: isMissingRequired(form.invoiceNo) })} value={form.invoiceNo} onChange={(event) => setFormValue('invoiceNo', event.target.value)} />
              </Field>
              <Field label="Date / 작성일">
                <input type="date" className={textInputClass({ missing: isMissingRequired(form.date) })} value={form.date} onChange={(event) => setFormValue('date', event.target.value)} />
              </Field>
              <Field label="Departure Date / 출항일" later>
                <input type="date" className={textInputClass({ later: true })} value={form.departureDate} onChange={(event) => setFormValue('departureDate', event.target.value)} />
              </Field>
              <Field label="Vessel / Flight / 선박·항공편" later>
                <input className={textInputClass({ later: true })} value={form.vesselFlight} onChange={(event) => setFormValue('vesselFlight', event.target.value)} />
              </Field>
              <Field label="Incoterms / 거래조건">
                <input className={textInputClass({ missing: isMissingRequired(form.incoterms) })} value={form.incoterms} onChange={(event) => setFormValue('incoterms', event.target.value)} />
              </Field>
              <Field label="Currency / 통화">
                <input className={textInputClass({ missing: isMissingRequired(form.currency) })} value={form.currency} onChange={(event) => setFormValue('currency', event.target.value.toUpperCase())} />
              </Field>
              <Field label="Port of Loading / 선적항">
                <input className={textInputClass({ missing: isMissingRequired(form.portOfLoading) })} value={form.portOfLoading} onChange={(event) => setFormValue('portOfLoading', event.target.value)} />
              </Field>
              <Field label="Port of Discharge / 도착항" later>
                <input className={textInputClass({ later: true })} value={form.portOfDischarge} onChange={(event) => setFormValue('portOfDischarge', event.target.value)} />
              </Field>
              <Field label="Exporter / 수출자">
                <textarea className={textAreaClass({ missing: isMissingRequired(form.exporter) })} value={form.exporter} onChange={(event) => setFormValue('exporter', event.target.value)} />
              </Field>
              <Field label="Consignee / 수입자">
                <textarea className={textAreaClass({ missing: isMissingRequired(form.consignee) })} value={form.consignee} onChange={(event) => setFormValue('consignee', event.target.value)} placeholder="수입자 회사명, 주소, 연락처" />
              </Field>
              <Field label="Buyer / 구매자">
                <textarea className={textAreaClass()} value={form.buyer} onChange={(event) => setFormValue('buyer', event.target.value)} />
              </Field>
              <Field label="L/C No. and Date / 신용장번호·일자" later>
                <textarea className={textAreaClass({ later: true })} value={form.lcNoDate} onChange={(event) => setFormValue('lcNoDate', event.target.value)} />
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

          <section className="order-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-slate-950">상품 / 포장 정보</h2>
                <p className="mt-1 text-[12px] font-bold text-slate-500">관리 상품을 선택하거나 직접 입력 행으로 작성합니다.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 text-[12px] font-black text-slate-700">
                  <span className="text-[11px] text-slate-500">수출국</span>
                  <select
                    className="h-7 bg-transparent text-[12px] font-black text-slate-950 outline-none"
                    value={selectedExportCountry}
                    onChange={(event) => changeExportCountry(normalizeExportCountry(event.target.value))}
                  >
                    {exportCountryOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
                  exchangeRateStatus === 'ready' ? 'bg-emerald-50 text-emerald-700' : exchangeRateStatus === 'error' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'
                }`}>
                  {exchangeRateStatus === 'ready' && exchangeRates
                    ? `${selectedCountryOption.priceLabel}(${getExportCountryCurrency(selectedExportCountry)}) → US$ · 1USD ₩${intFormatter.format(exchangeRates.KRW)} / ¥${numberFormatter.format(exchangeRates.JPY)}`
                    : exchangeRateStatus === 'error'
                      ? '환율 조회 실패'
                      : '환율 조회 중'}
                </span>
                <button type="button" onClick={addItem} className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-950 px-3 text-[12px] font-black text-white hover:bg-slate-800">
                  <Plus size={15} />
                  행 추가
                </button>
              </div>
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
                      <td className="px-2 py-2"><input className={textInputClass({ missing: isMissingRequired(item.productName) })} value={item.productName} onChange={(event) => updateItem(item.id, { productName: event.target.value })} /></td>
                      <td className="px-2 py-2"><input className={textInputClass({ missing: isMissingRequired(item.productNameEN) })} value={item.productNameEN} onChange={(event) => updateItem(item.id, { productNameEN: event.target.value })} /></td>
                      <td className="px-2 py-2"><input className={textInputClass({ missing: isMissingRequired(item.model) })} value={item.model} onChange={(event) => updateItem(item.id, { model: event.target.value.toUpperCase() })} /></td>
                      <td className="px-2 py-2"><input className={textInputClass({ missing: isMissingRequired(item.hsCode) })} value={item.hsCode} onChange={(event) => updateItem(item.id, { hsCode: event.target.value })} /></td>
                      <td className="px-2 py-2"><input className={textInputClass()} value={item.origin} onChange={(event) => updateItem(item.id, { origin: event.target.value.toUpperCase() })} /></td>
                      <td className="px-2 py-2"><input type="number" min={0} className={`${textInputClass({ missing: isMissingRequired(item.quantity) })} text-right`} value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: Math.max(0, Math.floor(parseNumberInput(event.target.value))) })} /></td>
                      <td className="px-2 py-2"><input type="number" min={0} step="0.01" className={`${textInputClass({ missing: isMissingRequired(item.unitPrice) })} text-right`} value={item.unitPrice} onChange={(event) => updateItem(item.id, { unitPrice: parseNumberInput(event.target.value) })} /></td>
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

          <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-28 xl:max-h-[calc(100vh-8rem)] xl:overflow-auto">
            <div className="mb-3 flex items-center gap-2">
              <button type="button" onClick={() => setPreviewMode('commercial')} className={`h-9 rounded-lg px-3 text-[12px] font-black ${previewMode === 'commercial' ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>
                Commercial Invoice
              </button>
              <button type="button" onClick={() => setPreviewMode('packing')} className={`h-9 rounded-lg px-3 text-[12px] font-black ${previewMode === 'packing' ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>
                Packing List
              </button>
            </div>
            <DocumentPreview form={form} items={previewItems} mode={previewMode} />
          </section>
        </div>

        <section className={activeWorkTab === 'unipass' && selectedDeclarationId ? 'min-w-0 max-w-[1360px] rounded-xl border border-slate-200 bg-white p-3 shadow-sm' : 'hidden'}>
          <div className="mb-2 flex items-center gap-2 px-1">
            <ListChecks size={17} className="text-[#2f66b2]" />
            <h2 className="text-sm font-black text-slate-950">전자상거래 수출신고서 자동입력</h2>
          </div>
          <UnipassDeclarationForm
            form={form}
            items={items}
            onSaveDraft={saveDraftDeclaration}
            isSavingDraft={isUpdatingDeclaration}
          />
        </section>
      </div>
    </div>
  )
}
