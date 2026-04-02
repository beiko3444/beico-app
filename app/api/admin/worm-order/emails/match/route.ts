import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getParsedMailByUid, upsertWormOrderEmailMatch } from '@/lib/wormOrderMail'

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

type PdfParseModule = typeof import('pdf-parse')
let pdfParseModulePromise: Promise<PdfParseModule> | null = null

async function getPdfParseModule() {
  if (!pdfParseModulePromise) {
    pdfParseModulePromise = (async () => {
      // Polyfill DOMMatrix for pdfjs-dist used by pdf-parse
      if (typeof (globalThis as any).DOMMatrix === 'undefined') {
        try {
          const canvasObj = await import('@napi-rs/canvas')
          if (canvasObj && canvasObj.DOMMatrix) {
            ;(globalThis as any).DOMMatrix = canvasObj.DOMMatrix as any
          }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_) {
          // Fallback dummy
          ;(globalThis as any).DOMMatrix = class DOMMatrix {} as any
        }
      }
      return import('pdf-parse')
    })()
  }
  return pdfParseModulePromise
}

async function extractPdfText(buffer: Buffer) {
  const { PDFParse } = await getPdfParseModule()
  const parser = new PDFParse({ data: buffer })
  try {
    const result = await parser.getText({ first: 12 })
    return typeof result?.text === 'string' ? result.text.trim() : ''
  } finally {
    await parser.destroy().catch(() => undefined)
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

function extractUnitPriceUsd(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const keywordRegex = /\b(?:UNIT\s*PRICE|U\/?\s*PRICE|PRICE\s*PER\s*UNIT|UNIT\s*RATE)\b/i
  const candidates: number[] = []

  for (const line of lines) {
    if (!keywordRegex.test(line)) continue
    candidates.push(...parseAmountTokens(line))
  }

  if (candidates.length === 0) return null
  const filtered = candidates.filter((value) => value > 0 && value < 1_000_000)
  if (filtered.length === 0) return null
  return Math.min(...filtered)
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

      unitPrice = extractUnitPriceUsd(text)
      totalAmount = extractTotalAmountUsd(text)
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

    let invoiceOcr: InvoiceOcrResult
    try {
      invoiceOcr = await runInvoicePdfOcr(uid)
    } catch (ocrError) {
      const message = ocrError instanceof Error ? ocrError.message : 'unknown OCR error'
      console.error('Invoice OCR failed during email match:', ocrError)
      invoiceOcr = {
        invoiceUnitPriceUsd: null,
        invoiceTotalAmountUsd: null,
        usdKrwRate: null,
        invoiceUnitPriceKrw: null,
        invoiceTotalAmountKrw: null,
        invoiceExtractedAt: null,
        invoiceSourceFile: null,
        invoiceOcrError: `인보이스 OCR 실행 실패: ${message}`,
      }
    }

    const saved = await upsertWormOrderEmailMatch({
      uid,
      orderId,
      subject,
      date,
      invoiceUnitPriceUsd: invoiceOcr.invoiceUnitPriceUsd,
      invoiceTotalAmountUsd: invoiceOcr.invoiceTotalAmountUsd,
      usdKrwRate: invoiceOcr.usdKrwRate,
      invoiceUnitPriceKrw: invoiceOcr.invoiceUnitPriceKrw,
      invoiceTotalAmountKrw: invoiceOcr.invoiceTotalAmountKrw,
      invoiceExtractedAt: invoiceOcr.invoiceExtractedAt,
      invoiceSourceFile: invoiceOcr.invoiceSourceFile,
      invoiceOcrError: invoiceOcr.invoiceOcrError,
    })

    return NextResponse.json({
      ok: true,
      match: {
        uid: saved.uid,
        orderId: saved.orderId,
        orderNumber: saved.order.orderNumber,
        matchedAt: saved.matchedAt.toISOString(),
        invoiceUnitPriceUsd: saved.invoiceUnitPriceUsd,
        invoiceTotalAmountUsd: saved.invoiceTotalAmountUsd,
        usdKrwRate: saved.usdKrwRate,
        invoiceUnitPriceKrw: saved.invoiceUnitPriceKrw,
        invoiceTotalAmountKrw: saved.invoiceTotalAmountKrw,
        invoiceExtractedAt: saved.invoiceExtractedAt ? saved.invoiceExtractedAt.toISOString() : null,
        invoiceSourceFile: saved.invoiceSourceFile,
        invoiceOcrError: saved.invoiceOcrError,
      },
    })
  } catch (error: unknown) {
    console.error('Failed to match worm email to order:', error)
    const message = error instanceof Error ? error.message : '이메일 매칭 처리 중 오류가 발생했습니다.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
