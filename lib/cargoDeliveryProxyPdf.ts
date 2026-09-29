import { readFile } from 'fs/promises'
import path from 'path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProxySheet } from '@/app/admin/cargo-delivery/ProxySheet'
import { renderHtmlToPdf } from '@/lib/serverPdf'
import type { CargoProxyDocument } from '@/lib/cargoDeliveryProxy'

// 서버에는 한글 폰트가 없으므로 웹폰트를 문서에 포함한다 (Windows/Mac 화면 미리보기는 Batang 사용)
const FONT_LINK = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700;800&display=swap">'

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
  const markup = renderToStaticMarkup(createElement(ProxySheet, { doc, sealSrc }))
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
${FONT_LINK}
<style>
@page { size: A4 portrait; margin: 0; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; padding: 0; background: #fff; width: 210mm; }
.cargo-proxy-sheet { height: 297mm; overflow: hidden; }
</style>
</head>
<body>${markup}</body>
</html>`
}

export async function renderCargoProxyPdf(doc: CargoProxyDocument) {
  const html = await buildCargoProxySheetHtml(doc)
  return renderHtmlToPdf(html)
}
