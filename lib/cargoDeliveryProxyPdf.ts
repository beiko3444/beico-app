import { readFile } from 'fs/promises'
import path from 'path'
import { renderHtmlToPdf } from '@/lib/serverPdf'
import { buildCargoProxySheetMarkup } from '@/lib/cargoDeliveryProxySheet'
import type { CargoProxyDocument } from '@/lib/cargoDeliveryProxy'

// 서버(팩스/PDF)용 위임장 문서. 마크업은 화면 미리보기와 lib/cargoDeliveryProxySheet.ts 를 공유한다.
// 서버에는 한글 폰트가 없으므로 마크업에 포함된 웹폰트 링크에 의존한다.

async function loadPublicImageDataUri(fileName: string, mime: string) {
  try {
    const file = await readFile(path.join(process.cwd(), 'public', fileName))
    return `data:${mime};base64,${file.toString('base64')}`
  } catch {
    const base = (process.env.NEXTAUTH_URL || 'https://www.beiko.co.kr').replace(/\/$/, '')
    return `${base}/${fileName}`
  }
}

export async function buildCargoProxySheetHtml(doc: CargoProxyDocument) {
  const [sealSrc, logoSrc] = await Promise.all([
    loadPublicImageDataUri('seal.png', 'image/png'),
    loadPublicImageDataUri('logo.png', 'image/png'),
  ])
  const markup = buildCargoProxySheetMarkup(doc, { sealSrc, logoSrc })
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<style>
@page { size: A4 portrait; margin: 0; }
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
