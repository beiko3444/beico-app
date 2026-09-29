import { readFile } from 'fs/promises'
import path from 'path'
import { renderHtmlToPdf } from '@/lib/serverPdf'
import { formatProxyDate, type CargoProxyDocument } from '@/lib/cargoDeliveryProxy'

// 서버(팩스/PDF)용 위임장 HTML. 화면 미리보기(app/admin/cargo-delivery/ProxySheet.tsx)와 같은 레이아웃을
// 문자열 템플릿으로 만든다. Next.js 서버 코드에서는 react-dom/server를 쓸 수 없기 때문.
// 레이아웃을 바꿀 때는 두 파일을 함께 수정할 것.

// 서버에는 한글 폰트가 없으므로 웹폰트를 문서에 포함한다 (Windows/Mac 화면 미리보기는 Batang 사용)
const FONT_LINK = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700;800&display=swap">'
const SHEET_FONT = '"Nanum Myeongjo", "Batang", "바탕", "BatangChe", "Noto Serif KR", "Apple Myungjo", serif'

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const text = (value: string) => (value.trim().length > 0 ? escapeHtml(value) : '&nbsp;')

async function loadSealDataUri() {
  try {
    const file = await readFile(path.join(process.cwd(), 'public', 'seal.png'))
    return `data:image/png;base64,${file.toString('base64')}`
  } catch {
    const base = (process.env.NEXTAUTH_URL || 'https://www.beiko.co.kr').replace(/\/$/, '')
    return `${base}/seal.png`
  }
}

export async function buildCargoProxySheetHtml(doc: CargoProxyDocument) {
  const sealSrc = await loadSealDataUri()
  const indent = 'padding-left:10px'
  const block = 'margin:18px 0 0'

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
${FONT_LINK}
<style>
@page { size: A4 portrait; margin: 0; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; padding: 0; background: #fff; width: 210mm; }
.cargo-proxy-sheet {
  width: 210mm; height: 297mm; overflow: hidden; padding: 28mm 22mm 24mm; background: #fff; color: #111;
  font-family: ${SHEET_FONT}; font-size: 14px; line-height: 1.8; position: relative; word-break: keep-all;
}
.cargo-proxy-sheet h1 { font-size: 26px; font-weight: 900; margin: 0 0 22px; letter-spacing: -0.5px; line-height: 1.3; }
.cargo-proxy-sheet p { margin: 0; }
.seal-row { margin: 18px 0 0; position: relative; display: inline-block; padding-right: 70px; }
.seal-row img { position: absolute; right: 0; top: 50%; height: 64px; width: 64px; transform: translateY(-50%); object-fit: contain; opacity: 0.85; }
.doc-no { position: absolute; right: 22mm; bottom: 12mm; font-size: 10px; color: #888; font-family: sans-serif; }
</style>
</head>
<body>
<div class="cargo-proxy-sheet">
  <h1>수입화물 인도 위임장</h1>

  <p>위임인(수입자) 정보를 아래와 같이 명시합니다.</p>

  <p style="${block}">
    위임인 이름: ${text(doc.principalName)}<br>
    위임인 주소: ${text(doc.principalAddress)}<br>
    위임인 전화번호: ${text(doc.principalPhone)}<br>
    사업자등록번호: ${text(doc.principalBusinessNo)}
  </p>

  <p style="${block}">아래 수입화물의 인도를 대리인에게 위임합니다.</p>

  <p style="${block}">
    화물 정보:<br>
    <span style="${indent}">- B/L 번호(또는 AWB 번호): ${text(doc.blNumber)}</span><br>
    <span style="${indent}">- 화물명: ${text(doc.cargoName)}</span><br>
    <span style="${indent}">- 수량: ${text(doc.quantityText)}</span>
  </p>

  <p style="${block}">
    대리인 정보:<br>
    <span style="${indent}">- 대리인 이름: ${text(doc.driverName)}</span><br>
    <span style="${indent}">- 대리인 연락처: ${text(doc.driverPhone)}</span><br>
    <span style="${indent}">- 대리인 차량정보: ${text(doc.driverVehicle)}</span>
  </p>

  <p style="${block}">
    위임인의 서명 및 확인:<br>
    <span style="${indent}">본인은 상기 화물의 인도 절차를 위임합니다. 대리인이 위임장의 조건에 따라 화물을 수령할 수 있도록 허가합니다.</span>
  </p>

  <div class="seal-row">
    날짜: ${escapeHtml(formatProxyDate(doc.issueDate))}<br>
    위임인 서명: ${text(doc.principalName)}
    <img src="${sealSrc}" alt="인감">
  </div>

  <p style="margin:24px 0 0">본 위임장은 화물 인도 과정에서만 사용되며, 그 외 용도로 사용할 수 없습니다.</p>

  ${doc.documentNo ? `<div class="doc-no">문서번호 ${escapeHtml(doc.documentNo)}</div>` : ''}
</div>
</body>
</html>`
}

export async function renderCargoProxyPdf(doc: CargoProxyDocument) {
  const html = await buildCargoProxySheetHtml(doc)
  return renderHtmlToPdf(html)
}
