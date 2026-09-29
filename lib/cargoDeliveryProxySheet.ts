import { formatProxyDate, formatProxyDateKorean, type CargoProxyDocument } from '@/lib/cargoDeliveryProxy'

// 수입화물 인도 위임장 문서 마크업. 화면 미리보기(ProxySheet.tsx)와 서버 PDF/팩스(cargoDeliveryProxyPdf.ts)가
// 같은 HTML을 쓰도록 순수 문자열로 만든다 (Next 서버 코드에서는 react-dom/server를 쓸 수 없음).

const FONT_LINK =
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700;800&family=Noto+Sans+KR:wght@400;500;700&display=swap">'

const SERIF = '"Nanum Myeongjo", "Batang", "바탕", "Noto Serif KR", "Apple Myungjo", serif'
const SANS = '"Noto Sans KR", "Malgun Gothic", "맑은 고딕", "Apple SD Gothic Neo", sans-serif'

const NAVY = '#1f2340'
const ORANGE = '#e53b19'
const LINE = '#c7cad6'

export const CARGO_PROXY_SHEET_CSS = `
.cargo-proxy-sheet { width: 210mm; min-height: 297mm; padding: 14mm 16mm 30mm; background: #fff; color: #111827;
  font-family: ${SANS}; font-size: 12.5px; line-height: 1.65; position: relative; box-sizing: border-box; word-break: keep-all;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.cargo-proxy-sheet *, .cargo-proxy-sheet *::before, .cargo-proxy-sheet *::after { box-sizing: border-box; }
.cp-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }
.cp-brand { display: flex; align-items: center; gap: 12px; }
.cp-logo { width: 52px; height: 52px; object-fit: contain; }
.cp-corp { font-family: ${SERIF}; font-size: 17px; font-weight: 800; color: ${NAVY}; letter-spacing: -0.3px; line-height: 1.2; }
.cp-corp-en { font-size: 10.5px; color: #6b7280; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 2px; }
.cp-meta { border-collapse: collapse; font-size: 11px; }
.cp-meta th { text-align: left; font-weight: 700; color: #4b5563; padding: 2px 10px 2px 0; white-space: nowrap; }
.cp-meta td { padding: 2px 0; color: #111827; font-variant-numeric: tabular-nums; }
.cp-rule { height: 3px; background: ${NAVY}; margin: 10px 0 0; position: relative; }
.cp-rule::after { content: ""; position: absolute; left: 0; bottom: -5px; width: 100%; height: 1px; background: ${ORANGE}; }
.cp-title { font-family: ${SERIF}; font-size: 30px; font-weight: 800; color: ${NAVY}; text-align: center; letter-spacing: 8px; margin: 24px 0 0; line-height: 1.2; }
.cp-subtitle { text-align: center; font-size: 10.5px; color: #6b7280; letter-spacing: 2.5px; margin-top: 5px; }
.cp-intro { margin: 18px 0 0; font-size: 13px; line-height: 1.8; }
.cp-sec { font-size: 13px; font-weight: 700; color: ${NAVY}; margin: 16px 0 5px; padding-left: 9px; border-left: 3px solid ${ORANGE}; line-height: 1.3; }
.cp-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.cp-table th, .cp-table td { border: 1px solid ${LINE}; padding: 5px 10px; vertical-align: middle; line-height: 1.5; }
.cp-table th { width: 34mm; background: #f3f4f8; font-weight: 700; color: #374151; text-align: left; white-space: nowrap; }
.cp-table td { color: #111827; }
.cp-table td.cp-strong { font-weight: 700; font-size: 13.5px; letter-spacing: 0.3px; font-variant-numeric: tabular-nums; }
.cp-terms { margin: 6px 0 0; padding-left: 20px; font-size: 12.5px; line-height: 1.75; }
.cp-terms li { margin: 2px 0; padding-left: 2px; }
.cp-date { text-align: center; font-family: ${SERIF}; font-size: 14.5px; font-weight: 700; color: #111827; margin: 22px 0 0; letter-spacing: 1px; }
.cp-sign { display: flex; justify-content: flex-end; align-items: flex-end; gap: 22px; margin: 14px 36px 0 0; }
.cp-sign-label { font-size: 12px; color: #6b7280; padding-bottom: 8px; }
.cp-sign-body { text-align: right; }
.cp-sign-corp { font-family: ${SERIF}; font-size: 17px; font-weight: 800; color: ${NAVY}; line-height: 1.3; }
.cp-sign-rep { font-family: ${SERIF}; font-size: 14px; font-weight: 700; color: #111827; margin-top: 6px; line-height: 2; }
.cp-seal-wrap { position: relative; display: inline-block; }
/* 도장은 "(인)" 글자 위에 찍히되, 왼쪽의 이름은 가리지 않도록 오른쪽으로 치우치게 */
.cp-seal { position: absolute; left: 50%; top: 50%; width: 56px; height: 56px; transform: translate(-30%, -50%); object-fit: contain; opacity: 0.88; pointer-events: none; }
.cp-foot { position: absolute; left: 16mm; right: 16mm; bottom: 12mm; border-top: 1px solid ${LINE}; padding-top: 8px; font-size: 9.5px; color: #6b7280; line-height: 1.6; }
.cp-foot-corp { font-weight: 700; color: #374151; }
.cp-foot-note { display: flex; justify-content: space-between; gap: 12px; margin-top: 2px; }
`

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const cell = (value: string) => (value.trim().length > 0 ? escapeHtml(value.trim()) : '&nbsp;')

/** "이다빈 (주식회사 베이코)" -> { representative: '이다빈', company: '주식회사 베이코' } */
export const splitPrincipalName = (name: string) => {
  const match = /^(.*?)\s*[(（](.+?)[)）]\s*$/.exec(name.trim())
  if (match) return { representative: match[1].trim(), company: match[2].trim() }
  return { representative: '', company: name.trim() }
}

export type CargoProxySheetAssets = {
  sealSrc: string
  logoSrc: string
}

export function buildCargoProxySheetMarkup(doc: CargoProxyDocument, assets: CargoProxySheetAssets) {
  const { representative, company } = splitPrincipalName(doc.principalName)
  const companyLabel = company || doc.principalName
  const documentNo = doc.documentNo?.trim() || '(미발행)'

  return `<div class="cargo-proxy-sheet">
${FONT_LINK}
<style>${CARGO_PROXY_SHEET_CSS}</style>
<div class="cp-head">
  <div class="cp-brand">
    <img class="cp-logo" src="${escapeHtml(assets.logoSrc)}" alt="beiko">
    <div>
      <div class="cp-corp">${cell(companyLabel)}</div>
      <div class="cp-corp-en">BEIKO Inc. · Import &amp; Distribution</div>
    </div>
  </div>
  <table class="cp-meta">
    <tr><th>문서번호</th><td>${escapeHtml(documentNo)}</td></tr>
    <tr><th>발행일자</th><td>${escapeHtml(formatProxyDate(doc.issueDate))}</td></tr>
  </table>
</div>
<div class="cp-rule"></div>

<h1 class="cp-title">수입화물 인도 위임장</h1>
<div class="cp-subtitle">LETTER OF AUTHORIZATION FOR CARGO DELIVERY</div>

<p class="cp-intro">아래 위임인(수입자)은 다음 수입화물의 인도(수령) 절차 일체를 아래 대리인에게 위임하며, 이를 증명하기 위하여 본 위임장을 발행합니다.</p>

<h2 class="cp-sec">1. 위임인 (수입자)</h2>
<table class="cp-table">
  <tr><th>상호</th><td>${cell(companyLabel)}</td></tr>
  <tr><th>대표자</th><td>${cell(representative || '-')}</td></tr>
  <tr><th>사업자등록번호</th><td>${cell(doc.principalBusinessNo)}</td></tr>
  <tr><th>주소</th><td>${cell(doc.principalAddress)}</td></tr>
  <tr><th>연락처</th><td>${cell(doc.principalPhone)}</td></tr>
</table>

<h2 class="cp-sec">2. 화물 정보</h2>
<table class="cp-table">
  <tr><th>B/L 번호 (AWB)</th><td class="cp-strong">${cell(doc.blNumber)}</td></tr>
  <tr><th>화물명</th><td>${cell(doc.cargoName)}</td></tr>
  <tr><th>수량</th><td>${cell(doc.quantityText)}</td></tr>
</table>

<h2 class="cp-sec">3. 대리인 (수령인)</h2>
<table class="cp-table">
  <tr><th>성명</th><td class="cp-strong">${cell(doc.driverName)}</td></tr>
  <tr><th>연락처</th><td>${cell(doc.driverPhone)}</td></tr>
  <tr><th>차량번호</th><td>${cell(doc.driverVehicle)}</td></tr>
</table>

<h2 class="cp-sec">4. 위임 사항</h2>
<ol class="cp-terms">
  <li>위임인은 상기 화물의 인도 절차를 위 대리인에게 위임하며, 대리인이 본 위임장의 조건에 따라 화물을 수령할 수 있도록 허가합니다.</li>
  <li>본 위임장은 상기 화물의 인도 과정에서만 사용되며, 그 외 용도로 사용할 수 없습니다.</li>
  <li>대리인은 화물 수령 시 본 위임장과 신분증을 제시하며, 수령 이후의 화물 관리 책임은 위임인에게 있습니다.</li>
</ol>

<div class="cp-date">${escapeHtml(formatProxyDateKorean(doc.issueDate))}</div>

<div class="cp-sign">
  <div class="cp-sign-label">위임인</div>
  <div class="cp-sign-body">
    <div class="cp-sign-corp">${cell(companyLabel)}</div>
    <div class="cp-sign-rep">${representative ? `대표이사 ${cell(representative)}` : cell(doc.principalName)} <span class="cp-seal-wrap">(인)<img class="cp-seal" src="${escapeHtml(assets.sealSrc)}" alt="인감"></span></div>
  </div>
</div>

<div class="cp-foot">
  <div><span class="cp-foot-corp">${cell(companyLabel)}</span> · 사업자등록번호 ${cell(doc.principalBusinessNo)} · ${cell(doc.principalAddress)} · Tel ${cell(doc.principalPhone)}</div>
  <div class="cp-foot-note"><span>본 문서는 ${cell(companyLabel)}에서 발행한 위임장이며, 문서번호로 발행 사실을 확인할 수 있습니다.</span><span>${escapeHtml(documentNo)}</span></div>
</div>
</div>`
}
