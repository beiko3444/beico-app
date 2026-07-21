import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  cacheWormEmailAttachmentsToR2,
  getParsedMailByUid,
  getWormEmailSnapshotForMatch,
  type WormEmailMatchType,
  upsertWormEmailAwbCache,
  upsertWormOrderEmailMatch,
} from '@/lib/wormOrderMail'
import {
  bestTrustedAwbCandidate,
  extractAwbCandidatesFromText,
  isValidAwbByCheckDigit,
  normalizeOcrDigits,
} from '@/lib/wormAwbExtraction'
import { registerWormAwbCustomsMonitor } from '@/lib/wormCustomsMonitor'

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type InvoiceOcrResult = {
  invoiceUnitPriceUsd: number | null
  invoiceTotalAmountUsd: number | null
  usdKrwRate: number | null
  invoiceUnitPriceKrw: number | null
  invoiceTotalAmountKrw: number | null
  invoiceExtractedAt: string | null
  invoiceSourceFile: string | null
  invoiceOcrError: string | null
}

type AttachmentCacheResult = {
  cachedCount: number
  skippedCount: number
  skippedReason: string | null
  error: string | null
}

type PdfParseModule = typeof import('pdf-parse')
let pdfParseModulePromise: Promise<PdfParseModule> | null = null

async function getPdfParseModule() {
  if (!pdfParseModulePromise) {
    pdfParseModulePromise = (async () => {
      // Polyfill DOMMatrix for pdfjs-dist used by pdf-parse
      const runtimeGlobal = globalThis as unknown as { DOMMatrix?: unknown }
      if (typeof runtimeGlobal.DOMMatrix === 'undefined') {
        try {
          const canvasObj = await import('@napi-rs/canvas')
          if (canvasObj && canvasObj.DOMMatrix) {
            runtimeGlobal.DOMMatrix = canvasObj.DOMMatrix
          }
        } catch {
          // Fallback dummy
          runtimeGlobal.DOMMatrix = class DOMMatrix {}
        }
      }
      return import('pdf-parse')
    })()
  }
  return pdfParseModulePromise
}

async function extractPdfText(buffer: Buffer, first = 12) {
  const { PDFParse } = await getPdfParseModule()
  const parser = new PDFParse({ data: buffer })
  try {
    const result = await parser.getText({ first })
    return typeof result?.text === 'string' ? result.text.trim() : ''
  } finally {
    await parser.destroy().catch(() => undefined)
  }
}

type AwbExtractionResult = {
  status: 'cached' | 'found' | 'fast_scan_required'
  awbNumber: string | null
  attachmentIndexes: number[]
  sourceFile: string | null
}

function scoreAwbPdf(attachment: { filename?: string | null }) {
  const filename = (attachment.filename || '').toLowerCase()
  let score = 0
  if (/air[\s_-]*waybill|awb|mawb|hawb/.test(filename)) score += 20
  if (/document|shipping|shipment|skm/.test(filename)) score += 8
  if (/invoice|packing|remittance/.test(filename)) score -= 8
  return score
}

async function runAwbPdfTextExtraction(uid: string, cachedAwb: string | null): Promise<AwbExtractionResult> {
  const parsed = await getParsedMailByUid(uid)
  const attachments = (parsed.attachments || [])
    .map((attachment, index) => ({ attachment, index }))
    .filter(({ attachment }) => isPdfAttachment(attachment))
    .sort((left, right) => scoreAwbPdf(right.attachment) - scoreAwbPdf(left.attachment) || left.index - right.index)

  const attachmentIndexes = attachments.map(({ index }) => index)
  const normalizedCachedAwb = normalizeOcrDigits(cachedAwb || '')
  if (isValidAwbByCheckDigit(normalizedCachedAwb)) {
    return { status: 'cached', awbNumber: normalizedCachedAwb, attachmentIndexes, sourceFile: null }
  }

  const target = attachments[0]
  if (!target) {
    return { status: 'fast_scan_required', awbNumber: null, attachmentIndexes: [], sourceFile: null }
  }

  try {
    const raw = target.attachment.content
    const buffer = Buffer.isBuffer(raw) ? raw : raw ? Buffer.from(raw) : Buffer.alloc(0)
    if (buffer.length > 0) {
      const text = await extractPdfText(buffer, 1)
      const candidate = bestTrustedAwbCandidate(
        extractAwbCandidatesFromText(text, `server:${target.attachment.filename || target.index}`, 220),
      )
      if (candidate) {
        return {
          status: 'found',
          awbNumber: candidate.value,
          attachmentIndexes,
          sourceFile: target.attachment.filename || `attachment-${target.index}.pdf`,
        }
      }
    }
  } catch (error) {
    console.warn('[AWB] fast PDF text extraction failed', error)
  }

  return {
    status: 'fast_scan_required',
    awbNumber: null,
    attachmentIndexes,
    sourceFile: target.attachment.filename || `attachment-${target.index}.pdf`,
  }
}

function parseAmountTokens(line: string) {
  const matches = line.match(/(?:US\$|USD|\$)?\s*-?\d[\d,]*(?:\.\d+)?/gi) || []
  const values: number[] = []

  for (const match of matches) {
    const normalized = match.replace(/[^0-9.\-,]/g, '').replace(/,/g, '').trim()
    if (!normalized) continue
    const parsed = Number(normalized)
    if (Number.isFinite(parsed) && parsed > 0) {
      values.push(parsed)
    }
  }

  return values
}

// $ / USD 접두사가 붙은 금액만 추출 (명시적 통화 표시)
function parseCurrencyAmountTokens(line: string) {
  const matches = line.match(/(?:US\$|USD|\$)\s*\d[\d,]*(?:\.\d+)?/gi) || []
  const values: number[] = []

  for (const match of matches) {
    const normalized = match.replace(/[^0-9.,]/g, '').replace(/,/g, '').trim()
    if (!normalized) continue
    const parsed = Number(normalized)
    if (Number.isFinite(parsed) && parsed > 0) {
      values.push(parsed)
    }
  }

  return values
}

function extractUnitPriceUsd(text: string, totalAmount?: number | null) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  // ── 1단계: 키워드 기반 탐색 (±10줄 범위) ──
  const keywordRegex = /\b(?:UNIT\s*PRICE|U\/?\s*PRICE|PRICE\s*PER\s*(?:UNIT|PC|PIECE|KG|BOX|CTN)|UNIT\s*RATE|PRICE\s*\/\s*(?:BOX|PC|UNIT|KG)|P\s*\/\s*U|단\s*가|단가|单\s*价|单价)\b/i
  const candidates: number[] = []

  for (let i = 0; i < lines.length; i++) {
    if (!keywordRegex.test(lines[i])) continue

    // 같은 줄 또는 이후 10줄 내에서 $ / USD 명시 금액 탐색
    // (PDF 테이블 구조에 따라 헤더-데이터 간격이 크게 달라질 수 있음)
    const windowEnd = Math.min(i + 10, lines.length - 1)
    for (let j = i; j <= windowEnd; j++) {
      // TOTAL / AMOUNT 등 합계 라인은 건너뜀
      if (j > i && /\b(?:TOTAL|AMOUNT\s*DUE|GRAND\s*TOTAL|INVOICE\s*TOTAL)\b/i.test(lines[j])) break
      const currencyValues = parseCurrencyAmountTokens(lines[j])
      if (currencyValues.length > 0) {
        candidates.push(...currencyValues)
        break
      }
    }
  }

  if (candidates.length > 0) {
    const filtered = candidates.filter((v) => v > 0 && v < 100_000)
    if (filtered.length > 0) {
      // totalAmount와 동일한 값은 단가가 아닌 합계일 가능성이 높으므로 제외
      const withoutTotal = totalAmount
        ? filtered.filter((v) => Math.abs(v - totalAmount) > 0.01)
        : filtered
      if (withoutTotal.length > 0) return Math.min(...withoutTotal)
      return Math.min(...filtered)
    }
  }

  // ── 2단계: 전체 문서에서 모든 $ 금액 중 단가 추론 ──
  // 문서 내 모든 명시적 $ 금액을 수집 → totalAmount와 다른 값 중 가장 작은 것
  const allCurrencyValues: number[] = []
  for (const line of lines) {
    allCurrencyValues.push(...parseCurrencyAmountTokens(line))
  }
  if (allCurrencyValues.length > 0) {
    const distinct = [...new Set(allCurrencyValues)].filter((v) => v > 0 && v < 100_000)
    const withoutTotal = totalAmount
      ? distinct.filter((v) => Math.abs(v - totalAmount) > 0.01)
      : distinct
    if (withoutTotal.length > 0) {
      const candidate = Math.min(...withoutTotal)
      // 단가는 보통 총액보다 작고 1 이상
      if (!totalAmount || candidate < totalAmount) return candidate
    }
  }

  // ── 3단계: 총액 ÷ 수량으로 역산 (소수점 포함 수량 지원) ──
  if (totalAmount && totalAmount > 0) {
    const qtyRegex = /(\d[\d,]*(?:\.\d+)?)\s*(?:BOXES?|BOX|CTNS?|CTN|PCS?|PC|KGS?|KG|EA|UNIT)/i
    for (const line of lines) {
      const qtyMatch = line.match(qtyRegex)
      if (!qtyMatch) continue
      const qty = Number(qtyMatch[1].replace(/,/g, ''))
      if (!qty || qty <= 0) continue
      const unitPrice = totalAmount / qty
      if (unitPrice >= 0.01 && unitPrice <= 9999) {
        return Math.round(unitPrice * 100) / 100
      }
    }
  }

  return null
}

function extractTotalAmountUsd(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const totalRegex = /\b(?:TOTAL(?:\s*AMOUNT)?|INVOICE\s*TOTAL|AMOUNT\s*DUE|GRAND\s*TOTAL)\b/i
  const noiseRegex = /\b(?:QTY|PCS|KILO|KG|WEIGHT)\b/i
  const candidates: number[] = []

  for (const line of lines) {
    if (!totalRegex.test(line)) continue
    if (noiseRegex.test(line)) continue
    candidates.push(...parseAmountTokens(line))
  }

  if (candidates.length > 0) {
    const filtered = candidates.filter((value) => value > 0 && value < 100_000_000)
    if (filtered.length > 0) {
      return Math.max(...filtered)
    }
  }

  const usdLines = lines.filter((line) => /\b(?:USD|US\$)\b/i.test(line))
  const usdCandidates = usdLines.flatMap((line) => parseAmountTokens(line)).filter((value) => value > 0)
  if (usdCandidates.length > 0) {
    return Math.max(...usdCandidates)
  }

  return null
}

async function fetchUsdKrwRate() {
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' })
    if (!response.ok) {
      throw new Error(`rate status ${response.status}`)
    }
    const payload = await response.json() as { rates?: { KRW?: unknown } }
    const rate = Number(payload?.rates?.KRW)
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error('invalid KRW rate')
    }
    return rate
  } catch (error) {
    console.error('Failed to fetch USD/KRW rate:', error)
    return null
  }
}

function isPdfAttachment(attachment: { filename?: string | null; contentType?: string | null }) {
  const fileName = (attachment.filename || '').toLowerCase()
  const contentType = (attachment.contentType || '').toLowerCase()
  return fileName.endsWith('.pdf') || contentType.includes('pdf')
}

function scoreInvoicePdf(attachment: { filename?: string | null }) {
  const fileName = (attachment.filename || '').toLowerCase()
  let score = 0
  if (fileName.includes('invoice')) score += 10
  if (fileName.includes('inv')) score += 4
  if (fileName.includes('pi')) score += 2
  if (fileName.includes('proforma')) score += 2
  return score
}

async function runInvoicePdfOcr(uid: string): Promise<InvoiceOcrResult> {
  const parsed = await getParsedMailByUid(uid)
  const attachments = (parsed.attachments || [])
    .map((attachment, index) => ({ attachment, index }))
    .filter(({ attachment }) => isPdfAttachment(attachment))
    .sort((a, b) => scoreInvoicePdf(b.attachment) - scoreInvoicePdf(a.attachment) || a.index - b.index)

  if (attachments.length === 0) {
    return {
      invoiceUnitPriceUsd: null,
      invoiceTotalAmountUsd: null,
      usdKrwRate: null,
      invoiceUnitPriceKrw: null,
      invoiceTotalAmountKrw: null,
      invoiceExtractedAt: null,
      invoiceSourceFile: null,
      invoiceOcrError: '인보이스 PDF 첨부파일을 찾지 못했습니다.',
    }
  }

  let unitPrice: number | null = null
  let totalAmount: number | null = null
  let sourceFile: string | null = null
  const parseErrors: string[] = []

  for (const { attachment, index } of attachments) {
    try {
      const raw = attachment.content
      const buffer = Buffer.isBuffer(raw) ? raw : raw ? Buffer.from(raw) : Buffer.alloc(0)
      if (buffer.length === 0) {
        parseErrors.push(`${attachment.filename || `attachment-${index}`}: empty`)
        continue
      }

      const text = await extractPdfText(buffer)

      if (!text) {
        parseErrors.push(`${attachment.filename || `attachment-${index}`}: no text`)
        continue
      }

      // 디버그: 추출된 전체 텍스트 로그 출력 (유닛프라이스 파싱 실패 원인 파악용)
      console.log(`[InvoiceOCR] ${attachment.filename} text preview:\n${text.slice(0, 1200)}`)

      totalAmount = extractTotalAmountUsd(text)
      // totalAmount를 먼저 구한 후 단가 역산에도 활용
      unitPrice = extractUnitPriceUsd(text, totalAmount)
      sourceFile = attachment.filename || `attachment-${index}.pdf`

      if (unitPrice !== null || totalAmount !== null) {
        break
      }

      parseErrors.push(`${sourceFile}: unit/total not found`)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown parse error'
      parseErrors.push(`${attachment.filename || `attachment-${index}`}: ${reason}`)
    }
  }

  const usdKrwRate = await fetchUsdKrwRate()
  const unitPriceKrw =
    unitPrice !== null && usdKrwRate !== null ? Math.round(unitPrice * usdKrwRate) : null
  const totalAmountKrw =
    totalAmount !== null && usdKrwRate !== null ? Math.round(totalAmount * usdKrwRate) : null

  const hasAnyAmount = unitPrice !== null || totalAmount !== null

  return {
    invoiceUnitPriceUsd: unitPrice,
    invoiceTotalAmountUsd: totalAmount,
    usdKrwRate,
    invoiceUnitPriceKrw: unitPriceKrw,
    invoiceTotalAmountKrw: totalAmountKrw,
    invoiceExtractedAt: hasAnyAmount ? new Date().toISOString() : null,
    invoiceSourceFile: sourceFile,
    invoiceOcrError: hasAnyAmount
      ? null
      : parseErrors.length > 0
        ? `OCR 추출 실패: ${parseErrors.join(' | ')}`
        : 'OCR 추출에 실패했습니다.',
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const uid = typeof body?.uid === 'string' ? body.uid.trim() : ''
    const orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : ''
    const subject = typeof body?.subject === 'string' ? body.subject : ''
    const date = typeof body?.date === 'string' ? body.date : ''
    const matchType: WormEmailMatchType = body?.matchType === 'AWB_DOCUMENT' ? 'AWB_DOCUMENT' : 'INVOICE'
    const rawBodyAwbNumber = typeof body?.awbNumber === 'string' ? normalizeOcrDigits(body.awbNumber) : ''
    const bodyAwbNumber = isValidAwbByCheckDigit(rawBodyAwbNumber) ? rawBodyAwbNumber : ''

    if (!uid) {
      return NextResponse.json({ error: 'uid is required.' }, { status: 400 })
    }
    if (!orderId || !isUuid(orderId)) {
      return NextResponse.json({ error: '유효한 orderId가 필요합니다.' }, { status: 400 })
    }

    const order = await prisma.wormOrder.findUnique({
      where: { id: orderId },
      select: { id: true, orderNumber: true },
    })
    if (!order) {
      return NextResponse.json({ error: '매칭할 발주를 찾을 수 없습니다.' }, { status: 404 })
    }

    const snapshot = await getWormEmailSnapshotForMatch(uid)
    const snapshotAwbNumber = normalizeOcrDigits(snapshot.detail.awbNumber || '')
    const trustedSnapshotAwbNumber = isValidAwbByCheckDigit(snapshotAwbNumber) ? snapshotAwbNumber : ''
    const emptyInvoiceOcr: InvoiceOcrResult = {
      invoiceUnitPriceUsd: null,
      invoiceTotalAmountUsd: null,
      usdKrwRate: null,
      invoiceUnitPriceKrw: null,
      invoiceTotalAmountKrw: null,
      invoiceExtractedAt: null,
      invoiceSourceFile: null,
      invoiceOcrError: null,
    }

    // The parsed email is now cached. Run independent PDF work together so
    // matching does not wait for extraction and R2 upload sequentially.
    const awbExtractionPromise = matchType === 'AWB_DOCUMENT'
      ? runAwbPdfTextExtraction(uid, bodyAwbNumber || trustedSnapshotAwbNumber)
      : Promise.resolve(null)
    const invoiceOcrPromise = matchType === 'INVOICE'
      ? runInvoicePdfOcr(uid).catch((ocrError): InvoiceOcrResult => {
          const message = ocrError instanceof Error ? ocrError.message : 'unknown OCR error'
          console.error('Invoice OCR failed during email match:', ocrError)
          return {
            ...emptyInvoiceOcr,
            invoiceOcrError: `인보이스 OCR 실행 실패: ${message}`,
          }
        })
      : Promise.resolve(emptyInvoiceOcr)
    const attachmentCachePromise = getParsedMailByUid(uid)
      .then((parsedForCache) => cacheWormEmailAttachmentsToR2(
        uid,
        parsedForCache.attachments || [],
        { pdfOnly: true },
      ))
      .then((cacheResult): AttachmentCacheResult => ({ ...cacheResult, error: null }))
      .catch((cacheError): AttachmentCacheResult => {
        const message = cacheError instanceof Error ? cacheError.message : 'unknown attachment cache error'
        console.error('Worm email attachment R2 cache failed during match:', cacheError)
        return {
          cachedCount: 0,
          skippedCount: 0,
          skippedReason: null,
          error: message,
        }
      })

    const [awbExtraction, invoiceOcr, attachmentCache] = await Promise.all([
      awbExtractionPromise,
      invoiceOcrPromise,
      attachmentCachePromise,
    ])

    const saved = await upsertWormOrderEmailMatch({
      uid,
      orderId,
      matchType,
      subject: snapshot.detail.subject || subject,
      date: snapshot.detail.date || date,
      awbNumber: awbExtraction?.awbNumber || bodyAwbNumber || trustedSnapshotAwbNumber,
      emailBodyText: snapshot.emailBodyText,
      attachmentsJson: snapshot.attachmentsJson,
      invoiceUnitPriceUsd: invoiceOcr.invoiceUnitPriceUsd,
      invoiceTotalAmountUsd: invoiceOcr.invoiceTotalAmountUsd,
      usdKrwRate: invoiceOcr.usdKrwRate,
      invoiceUnitPriceKrw: invoiceOcr.invoiceUnitPriceKrw,
      invoiceTotalAmountKrw: invoiceOcr.invoiceTotalAmountKrw,
      invoiceExtractedAt: invoiceOcr.invoiceExtractedAt,
      invoiceSourceFile: invoiceOcr.invoiceSourceFile,
      invoiceOcrError: invoiceOcr.invoiceOcrError,
    })

    if (matchType === 'AWB_DOCUMENT' && saved.awbNumber) {
      await upsertWormEmailAwbCache({
        uid: saved.uid,
        subject: saved.subject,
        date: saved.emailDate?.toISOString() || date,
        awbNumber: saved.awbNumber,
      })
      await registerWormAwbCustomsMonitor({
        awbNumber: saved.awbNumber,
        emailUid: saved.uid,
        sourceSubject: saved.subject,
      })
    }

    return NextResponse.json({
      ok: true,
      awbExtraction,
      match: {
        uid: saved.uid,
        matchType: saved.matchType,
        subject: saved.subject,
        date: saved.emailDate ? saved.emailDate.toISOString() : null,
        orderId: saved.orderId,
        orderNumber: saved.order.orderNumber,
        matchedAt: saved.matchedAt.toISOString(),
        awbNumber: saved.awbNumber,
        emailBodyText: saved.emailBodyText,
        attachmentsJson: saved.attachmentsJson,
        invoiceUnitPriceUsd: saved.invoiceUnitPriceUsd,
        invoiceTotalAmountUsd: saved.invoiceTotalAmountUsd,
        usdKrwRate: saved.usdKrwRate,
        invoiceUnitPriceKrw: saved.invoiceUnitPriceKrw,
        invoiceTotalAmountKrw: saved.invoiceTotalAmountKrw,
        invoiceExtractedAt: saved.invoiceExtractedAt ? saved.invoiceExtractedAt.toISOString() : null,
        invoiceSourceFile: saved.invoiceSourceFile,
        invoiceOcrError: saved.invoiceOcrError,
        attachmentCache,
      },
    })
  } catch (error: unknown) {
    console.error('Failed to match worm email to order:', error)
    const message = error instanceof Error ? error.message : '이메일 매칭 처리 중 오류가 발생했습니다.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
