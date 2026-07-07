import { ImapFlow } from 'imapflow'
import type { MessageStructureObject } from 'imapflow'
import { simpleParser, type ParsedMail } from 'mailparser'
import { prisma } from '@/lib/prisma'
import { isR2Configured, uploadToR2 } from '@/lib/r2'

type ParsedMailCacheEntry = {
  expiresAt: number
  parsed: ParsedMail
}

type EmailListCacheEntry = {
  key: string
  expiresAt: number
  emails: WormEmailListItem[]
}

const PARSED_MAIL_CACHE_TTL_MS = 5 * 60 * 1000
const EMAIL_LIST_CACHE_TTL_MS = 45 * 1000
const IMAP_CONNECTION_TIMEOUT_MS = 15000
const IMAP_GREETING_TIMEOUT_MS = 12000
const IMAP_SOCKET_TIMEOUT_MS = 45000
const EMAIL_SCAN_SOURCE_PREVIEW_BYTES = 64 * 1024

const globalWormOrderCache = globalThis as unknown as {
  wormParsedMailCache?: Map<string, ParsedMailCacheEntry>
  wormEmailListCache?: EmailListCacheEntry | null
}

const parsedMailCache =
  globalWormOrderCache.wormParsedMailCache || new Map<string, ParsedMailCacheEntry>()
if (!globalWormOrderCache.wormParsedMailCache) {
  globalWormOrderCache.wormParsedMailCache = parsedMailCache
}

if (!globalWormOrderCache.wormEmailListCache) {
  globalWormOrderCache.wormEmailListCache = null
}

export type WormEmailListItem = {
  uid: string
  subject: string
  date: string
  hasAttachments: boolean
  awbNumber: string | null
  matchType?: WormEmailMatchType | null
  matchedOrderId: string | null
  matchedOrderNumber: string | null
  matchedAt: string | null
  invoiceUnitPriceUsd: number | null
  invoiceTotalAmountUsd: number | null
  usdKrwRate: number | null
  invoiceUnitPriceKrw: number | null
  invoiceTotalAmountKrw: number | null
  invoiceExtractedAt: string | null
  invoiceSourceFile: string | null
  invoiceOcrError: string | null
}

export type WormEmailAttachment = {
  filename: string
  contentType: string
  size: number
  index: number
}

export type WormEmailMatchType = 'INVOICE' | 'AWB_DOCUMENT'

export type WormEmailAttachmentSnapshot = WormEmailAttachment & {
  isPdf: boolean
}

export type WormEmailDetail = {
  uid: string
  subject: string
  date: string
  text: string
  hasAttachments: boolean
  skmIndices: number[]
  attachments: WormEmailAttachment[]
  awbNumber: string | null
}

type WormOrderEmailMatchHydrated = {
  matchType: WormEmailMatchType
  orderId: string
  orderNumber: string
  matchedAt: string | null
  awbNumber: string | null
  invoiceUnitPriceUsd: number | null
  invoiceTotalAmountUsd: number | null
  usdKrwRate: number | null
  invoiceUnitPriceKrw: number | null
  invoiceTotalAmountKrw: number | null
  invoiceExtractedAt: string | null
  invoiceSourceFile: string | null
  invoiceOcrError: string | null
}

type WormOrderEmailMatchUpsertResult = {
  uid: string
  matchType: string
  subject: string | null
  emailDate: Date | null
  orderId: string
  matchedAt: Date
  awbNumber: string | null
  emailBodyText: string | null
  attachmentsJson: unknown
  invoiceUnitPriceUsd: number | null
  invoiceTotalAmountUsd: number | null
  usdKrwRate: number | null
  invoiceUnitPriceKrw: number | null
  invoiceTotalAmountKrw: number | null
  invoiceExtractedAt: Date | null
  invoiceSourceFile: string | null
  invoiceOcrError: string | null
  order: {
    orderNumber: string
  }
}

export type WormMatchedEmailRestorePayload = {
  invoiceEmails: WormEmailListItem[]
  invoiceEmailDetails: Record<string, WormEmailDetail>
  awbDocumentEmails: WormEmailListItem[]
  awbDocumentEmailDetails: Record<string, WormEmailDetail>
}

function getDaumImapCredentials() {
  const user = process.env.DAUM_IMAP_USER
  const pass = process.env.DAUM_IMAP_PASS
  if (!user || !pass) {
    throw new Error('DAUM_IMAP_USER 또는 DAUM_IMAP_PASS 환경변수가 없습니다.')
  }
  return { user, pass }
}

function createImapClient() {
  const { user, pass } = getDaumImapCredentials()
  return new ImapFlow({
    host: 'imap.daum.net',
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
    connectionTimeout: IMAP_CONNECTION_TIMEOUT_MS,
    greetingTimeout: IMAP_GREETING_TIMEOUT_MS,
    socketTimeout: IMAP_SOCKET_TIMEOUT_MS,
  })
}

async function withInboxLock<T>(work: (client: ImapFlow) => Promise<T>) {
  const client = createImapClient()
  await client.connect()
  const lock = await client.getMailboxLock('INBOX')
  try {
    return await work(client)
  } finally {
    lock.release()
    await client.logout().catch(() => undefined)
  }
}

function toBuffer(source: unknown) {
  if (Buffer.isBuffer(source)) return source
  if (source instanceof Uint8Array) return Buffer.from(source)
  if (typeof source === 'string') return Buffer.from(source)
  return Buffer.from([])
}

function hasAttachmentBySource(sourceBuf: Buffer) {
  return (
    sourceBuf.includes(Buffer.from('Content-Disposition: attachment', 'utf8')) ||
    sourceBuf.includes(Buffer.from('content-disposition: attachment', 'utf8'))
  )
}

function hasAttachmentByBodyStructure(node: MessageStructureObject | undefined): boolean {
  if (!node) return false

  const disposition = String(node.disposition || '').toLowerCase()
  const type = String(node.type || '').toLowerCase()
  if (disposition === 'attachment') return true
  if (node.dispositionParameters?.filename || node.parameters?.name) return true
  if (type && !type.startsWith('text/') && !type.startsWith('multipart/')) return true

  return (node.childNodes || []).some((child) => hasAttachmentByBodyStructure(child))
}

function getEmailListCache(key: string) {
  const entry = globalWormOrderCache.wormEmailListCache
  if (!entry) return null
  if (entry.key !== key) return null
  if (entry.expiresAt < Date.now()) return null
  return entry.emails
}

function setEmailListCache(key: string, emails: WormEmailListItem[]) {
  globalWormOrderCache.wormEmailListCache = {
    key,
    expiresAt: Date.now() + EMAIL_LIST_CACHE_TTL_MS,
    emails,
  }
}

function normalizeAwbNumber(value: string) {
  return value.replace(/\s+/g, '').trim()
}

function normalizeWormEmailMatchType(value: unknown): WormEmailMatchType {
  return value === 'AWB_DOCUMENT' ? 'AWB_DOCUMENT' : 'INVOICE'
}

function inferWormEmailMatchType(input: {
  matchType?: unknown
  subject?: string | null
  awbNumber?: string | null
  invoiceUnitPriceUsd?: number | null
  invoiceTotalAmountUsd?: number | null
  invoiceUnitPriceKrw?: number | null
  invoiceTotalAmountKrw?: number | null
}) {
  const storedType = normalizeWormEmailMatchType(input.matchType)
  if (storedType === 'AWB_DOCUMENT') return storedType

  const subject = (input.subject || '').toLowerCase()
  const hasInvoiceAmount =
    input.invoiceUnitPriceUsd !== null ||
    input.invoiceTotalAmountUsd !== null ||
    input.invoiceUnitPriceKrw !== null ||
    input.invoiceTotalAmountKrw !== null
  if (!hasInvoiceAmount && input.awbNumber && /(document|documets|documents|awb|skm|waybill|shipment\s+arrival|payment\s+invoice)/i.test(subject)) {
    return 'AWB_DOCUMENT'
  }

  return storedType
}

function isPdfAttachmentMeta(attachment: { filename?: string | null; contentType?: string | null }) {
  const fileName = (attachment.filename || '').toLowerCase()
  const contentType = (attachment.contentType || '').toLowerCase()
  return fileName.endsWith('.pdf') || contentType.includes('pdf')
}

function isJpegAttachmentMeta(attachment: { filename?: string | null; contentType?: string | null }) {
  const fileName = (attachment.filename || '').toLowerCase()
  const contentType = (attachment.contentType || '').toLowerCase()
  return fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || contentType === 'image/jpeg' || contentType === 'image/jpg'
}

function toAttachmentSnapshots(attachments: WormEmailAttachment[]): WormEmailAttachmentSnapshot[] {
  return attachments
    .filter((attachment) => !isJpegAttachmentMeta(attachment))
    .map((attachment) => ({
      ...attachment,
      isPdf: isPdfAttachmentMeta(attachment),
    }))
}

function sanitizeAttachmentSnapshots(value: unknown): WormEmailAttachmentSnapshot[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const candidate = item as Partial<WormEmailAttachmentSnapshot>
      if (
        typeof candidate.filename !== 'string' ||
        typeof candidate.contentType !== 'string' ||
        typeof candidate.size !== 'number' ||
        typeof candidate.index !== 'number'
      ) {
        return null
      }
      return {
        filename: candidate.filename,
        contentType: candidate.contentType,
        size: candidate.size,
        index: candidate.index,
        isPdf: candidate.isPdf === true || isPdfAttachmentMeta(candidate),
      }
    })
    .filter((item): item is WormEmailAttachmentSnapshot => item !== null && !isJpegAttachmentMeta(item))
}

function sanitizeR2KeySegment(value: string, fallback: string) {
  const trimmed = value.trim()
  if (!trimmed) return fallback
  return trimmed.replace(/[\\/#?%*:|"<>]/g, '_').slice(0, 180) || fallback
}

function buildWormAttachmentR2Key(uid: string, index: number, filename: string) {
  const safeUid = sanitizeR2KeySegment(uid, 'unknown-uid')
  const safeFilename = sanitizeR2KeySegment(filename, `attachment-${index}`)
  return `worm-invoices/${safeUid}/${index}/${safeFilename}`
}

export async function cacheWormEmailAttachmentsToR2(
  uid: string,
  attachments: Array<{ filename?: string | null; contentType?: string | null; content?: unknown; size?: number | null }>,
  options: { pdfOnly?: boolean } = {},
) {
  const normalizedUid = uid.trim()
  if (!normalizedUid) {
    throw new Error('uid is required.')
  }

  if (!isR2Configured()) {
    return {
      cachedCount: 0,
      skippedCount: attachments.length,
      skippedReason: 'R2_NOT_CONFIGURED',
    }
  }

  const pdfOnly = options.pdfOnly !== false
  let cachedCount = 0
  let skippedCount = 0

  for (const [index, attachment] of attachments.entries()) {
    const filename = attachment.filename?.trim() || `attachment-${index}`
    const contentType = attachment.contentType?.trim() || 'application/octet-stream'

    if (pdfOnly && !isPdfAttachmentMeta({ filename, contentType })) {
      skippedCount += 1
      continue
    }

    const content = toBuffer(attachment.content)
    if (content.length === 0) {
      skippedCount += 1
      continue
    }

    const r2Key = buildWormAttachmentR2Key(normalizedUid, index, filename)
    await uploadToR2(r2Key, new Uint8Array(content), contentType)
    await prisma.wormEmailAttachmentCache.upsert({
      where: { uid_index: { uid: normalizedUid, index } },
      update: {
        r2Key,
        r2Url: r2Key,
        filename,
        contentType,
      },
      create: {
        uid: normalizedUid,
        index,
        r2Key,
        r2Url: r2Key,
        filename,
        contentType,
      },
    })
    cachedCount += 1
  }

  return {
    cachedCount,
    skippedCount,
    skippedReason: null,
  }
}

async function getWormEmailAwbCacheMap(uids: string[]) {
  const normalizedUids = Array.from(new Set(uids.map((uid) => uid.trim()).filter(Boolean)))
  if (normalizedUids.length === 0) return new Map<string, string>()

  try {
    const rows = await prisma.wormEmailAwbCache.findMany({
      where: { uid: { in: normalizedUids } },
      select: { uid: true, awbNumber: true },
    })

    return new Map(rows.map((row) => [row.uid, row.awbNumber]))
  } catch (error) {
    console.error('Failed to load worm AWB cache map:', error)
    return new Map<string, string>()
  }
}

async function getWormOrderEmailMatchMap(uids: string[]) {
  const normalizedUids = Array.from(new Set(uids.map((uid) => uid.trim()).filter(Boolean)))
  if (normalizedUids.length === 0) {
    return new Map<string, WormOrderEmailMatchHydrated>()
  }

  try {
    const rows = await prisma.wormOrderEmailMatch.findMany({
      where: { uid: { in: normalizedUids } },
      select: {
        uid: true,
        matchType: true,
        subject: true,
        orderId: true,
        matchedAt: true,
        awbNumber: true,
        invoiceUnitPriceUsd: true,
        invoiceTotalAmountUsd: true,
        usdKrwRate: true,
        invoiceUnitPriceKrw: true,
        invoiceTotalAmountKrw: true,
        invoiceExtractedAt: true,
        invoiceSourceFile: true,
        invoiceOcrError: true,
        order: {
          select: {
            orderNumber: true,
          },
        },
      },
    })

    return new Map(
      rows.map((row) => [
        row.uid,
        <WormOrderEmailMatchHydrated>{
          matchType: inferWormEmailMatchType(row),
          orderId: row.orderId,
          orderNumber: row.order?.orderNumber || '',
          matchedAt: row.matchedAt ? row.matchedAt.toISOString() : null,
          awbNumber: row.awbNumber || null,
          invoiceUnitPriceUsd: row.invoiceUnitPriceUsd,
          invoiceTotalAmountUsd: row.invoiceTotalAmountUsd,
          usdKrwRate: row.usdKrwRate,
          invoiceUnitPriceKrw: row.invoiceUnitPriceKrw,
          invoiceTotalAmountKrw: row.invoiceTotalAmountKrw,
          invoiceExtractedAt: row.invoiceExtractedAt ? row.invoiceExtractedAt.toISOString() : null,
          invoiceSourceFile: row.invoiceSourceFile || null,
          invoiceOcrError: row.invoiceOcrError || null,
        },
      ]),
    )
  } catch (error) {
    console.error('Failed to load worm email match map:', error)

    // Backward compatibility before DB columns are migrated.
    try {
      const legacyRows = await prisma.wormOrderEmailMatch.findMany({
        where: { uid: { in: normalizedUids } },
        select: {
          uid: true,
          orderId: true,
          matchedAt: true,
          order: {
            select: {
              orderNumber: true,
            },
          },
        },
      })

      return new Map(
        legacyRows.map((row) => [
          row.uid,
          <WormOrderEmailMatchHydrated>{
            matchType: 'INVOICE',
            orderId: row.orderId,
            orderNumber: row.order?.orderNumber || '',
            matchedAt: row.matchedAt ? row.matchedAt.toISOString() : null,
            awbNumber: null,
            invoiceUnitPriceUsd: null,
            invoiceTotalAmountUsd: null,
            usdKrwRate: null,
            invoiceUnitPriceKrw: null,
            invoiceTotalAmountKrw: null,
            invoiceExtractedAt: null,
            invoiceSourceFile: null,
            invoiceOcrError: null,
          },
        ]),
      )
    } catch (legacyError) {
      console.error('Failed to load legacy worm email match map:', legacyError)
      return new Map<string, WormOrderEmailMatchHydrated>()
    }
  }
}

async function hydrateEmailsWithAwbCache(emails: WormEmailListItem[]) {
  const awbMap = await getWormEmailAwbCacheMap(emails.map((email) => email.uid))
  const matchMap = await getWormOrderEmailMatchMap(emails.map((email) => email.uid))
  return emails.map((email) => ({
    ...email,
    awbNumber: awbMap.get(email.uid) || matchMap.get(email.uid)?.awbNumber || email.awbNumber || null,
    matchType: matchMap.get(email.uid)?.matchType || email.matchType || null,
    matchedOrderId: matchMap.get(email.uid)?.orderId || null,
    matchedOrderNumber: matchMap.get(email.uid)?.orderNumber || null,
    matchedAt: matchMap.get(email.uid)?.matchedAt || null,
    invoiceUnitPriceUsd: matchMap.get(email.uid)?.invoiceUnitPriceUsd ?? email.invoiceUnitPriceUsd ?? null,
    invoiceTotalAmountUsd: matchMap.get(email.uid)?.invoiceTotalAmountUsd ?? email.invoiceTotalAmountUsd ?? null,
    usdKrwRate: matchMap.get(email.uid)?.usdKrwRate ?? email.usdKrwRate ?? null,
    invoiceUnitPriceKrw: matchMap.get(email.uid)?.invoiceUnitPriceKrw ?? email.invoiceUnitPriceKrw ?? null,
    invoiceTotalAmountKrw: matchMap.get(email.uid)?.invoiceTotalAmountKrw ?? email.invoiceTotalAmountKrw ?? null,
    invoiceExtractedAt: matchMap.get(email.uid)?.invoiceExtractedAt ?? email.invoiceExtractedAt ?? null,
    invoiceSourceFile: matchMap.get(email.uid)?.invoiceSourceFile ?? email.invoiceSourceFile ?? null,
    invoiceOcrError: matchMap.get(email.uid)?.invoiceOcrError ?? email.invoiceOcrError ?? null,
  }))
}

async function getWormEmailAwbCacheByUid(uid: string) {
  const normalizedUid = uid.trim()
  if (!normalizedUid) return null

  try {
    return await prisma.wormEmailAwbCache.findUnique({
      where: { uid: normalizedUid },
      select: { awbNumber: true },
    })
  } catch (error) {
    console.error('Failed to load worm AWB cache:', error)
    return null
  }
}

function toOptionalDate(value?: string | null) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export async function upsertWormEmailAwbCache(input: {
  uid: string
  subject?: string | null
  date?: string | null
  awbNumber: string
}) {
  const uid = input.uid.trim()
  const awbNumber = normalizeAwbNumber(input.awbNumber)

  if (!uid) {
    throw new Error('uid is required.')
  }

  if (!awbNumber) {
    throw new Error('awbNumber is required.')
  }

  const result = await prisma.wormEmailAwbCache.upsert({
    where: { uid },
    update: {
      subject: input.subject?.trim() || null,
      emailDate: toOptionalDate(input.date),
      awbNumber,
    },
    create: {
      uid,
      subject: input.subject?.trim() || null,
      emailDate: toOptionalDate(input.date),
      awbNumber,
    },
  })

  // AWB 번호가 저장되면 기존 매칭 레코드에도 자동 반영
  try {
    await prisma.wormOrderEmailMatch.updateMany({
      where: { uid },
      data: { awbNumber },
    })
  } catch {
    // 매칭 레코드가 없으면 무시
  }

  return result
}

export async function upsertWormOrderEmailMatch(input: {
  uid: string
  orderId: string
  matchType?: WormEmailMatchType
  subject?: string | null
  date?: string | null
  awbNumber?: string | null
  emailBodyText?: string | null
  attachmentsJson?: WormEmailAttachmentSnapshot[] | null
  invoiceUnitPriceUsd?: number | null
  invoiceTotalAmountUsd?: number | null
  usdKrwRate?: number | null
  invoiceUnitPriceKrw?: number | null
  invoiceTotalAmountKrw?: number | null
  invoiceExtractedAt?: string | null
  invoiceSourceFile?: string | null
  invoiceOcrError?: string | null
}) {
  const uid = input.uid.trim()
  const orderId = input.orderId.trim()

  if (!uid) {
    throw new Error('uid is required.')
  }
  if (!orderId) {
    throw new Error('orderId is required.')
  }

  // AWB 번호: 명시적으로 전달되면 사용, 없으면 AWB 캐시에서 자동 조회
  let awbNumber = input.awbNumber?.replace(/\s+/g, '').trim() || null
  if (!awbNumber) {
    const awbCache = await getWormEmailAwbCacheByUid(uid)
    awbNumber = awbCache?.awbNumber || null
  }
  const matchType = normalizeWormEmailMatchType(input.matchType)
  const attachmentsJson = input.attachmentsJson ? toAttachmentSnapshots(input.attachmentsJson) : []

  try {
    return await prisma.wormOrderEmailMatch.upsert({
      where: { uid },
      update: {
        matchType,
        orderId,
        subject: input.subject?.trim() || null,
        emailDate: toOptionalDate(input.date),
        matchedAt: new Date(),
        awbNumber,
        emailBodyText: input.emailBodyText ?? null,
        attachmentsJson,
        invoiceUnitPriceUsd: input.invoiceUnitPriceUsd ?? null,
        invoiceTotalAmountUsd: input.invoiceTotalAmountUsd ?? null,
        usdKrwRate: input.usdKrwRate ?? null,
        invoiceUnitPriceKrw: input.invoiceUnitPriceKrw ?? null,
        invoiceTotalAmountKrw: input.invoiceTotalAmountKrw ?? null,
        invoiceExtractedAt: toOptionalDate(input.invoiceExtractedAt),
        invoiceSourceFile: input.invoiceSourceFile?.trim() || null,
        invoiceOcrError: input.invoiceOcrError?.trim() || null,
      },
      create: {
        uid,
        matchType,
        orderId,
        subject: input.subject?.trim() || null,
        emailDate: toOptionalDate(input.date),
        matchedAt: new Date(),
        awbNumber,
        emailBodyText: input.emailBodyText ?? null,
        attachmentsJson,
        invoiceUnitPriceUsd: input.invoiceUnitPriceUsd ?? null,
        invoiceTotalAmountUsd: input.invoiceTotalAmountUsd ?? null,
        usdKrwRate: input.usdKrwRate ?? null,
        invoiceUnitPriceKrw: input.invoiceUnitPriceKrw ?? null,
        invoiceTotalAmountKrw: input.invoiceTotalAmountKrw ?? null,
        invoiceExtractedAt: toOptionalDate(input.invoiceExtractedAt),
        invoiceSourceFile: input.invoiceSourceFile?.trim() || null,
        invoiceOcrError: input.invoiceOcrError?.trim() || null,
      },
      select: {
        uid: true,
        matchType: true,
        subject: true,
        emailDate: true,
        orderId: true,
        matchedAt: true,
        awbNumber: true,
        emailBodyText: true,
        attachmentsJson: true,
        invoiceUnitPriceUsd: true,
        invoiceTotalAmountUsd: true,
        usdKrwRate: true,
        invoiceUnitPriceKrw: true,
        invoiceTotalAmountKrw: true,
        invoiceExtractedAt: true,
        invoiceSourceFile: true,
        invoiceOcrError: true,
        order: {
          select: {
            orderNumber: true,
          },
        },
      },
    }) as WormOrderEmailMatchUpsertResult
  } catch (error) {
    // Backward compatibility before DB columns are migrated.
    console.error('Failed to upsert worm email match with invoice fields, retrying legacy:', error)

    const legacy = await prisma.wormOrderEmailMatch.upsert({
      where: { uid },
      update: {
        orderId,
        subject: input.subject?.trim() || null,
        emailDate: toOptionalDate(input.date),
        matchedAt: new Date(),
      },
      create: {
        uid,
        orderId,
        subject: input.subject?.trim() || null,
        emailDate: toOptionalDate(input.date),
        matchedAt: new Date(),
      },
      select: {
        uid: true,
        orderId: true,
        matchedAt: true,
        order: {
          select: {
            orderNumber: true,
          },
        },
      },
    })

    return {
      ...legacy,
      matchType,
      subject: input.subject?.trim() || null,
      emailDate: toOptionalDate(input.date),
      awbNumber,
      emailBodyText: input.emailBodyText ?? null,
      attachmentsJson,
      invoiceUnitPriceUsd: null,
      invoiceTotalAmountUsd: null,
      usdKrwRate: null,
      invoiceUnitPriceKrw: null,
      invoiceTotalAmountKrw: null,
      invoiceExtractedAt: null,
      invoiceSourceFile: null,
      invoiceOcrError: input.invoiceOcrError?.trim() || 'DB 컬럼 미적용 상태로 인보이스 OCR 결과를 저장하지 못했습니다.',
    } as WormOrderEmailMatchUpsertResult
  }
}

export async function deleteWormOrderEmailMatch(uid: string) {
  const trimmedUid = uid.trim()
  if (!trimmedUid) throw new Error('uid is required.')

  try {
    await prisma.wormOrderEmailMatch.delete({ where: { uid: trimmedUid } })
    return { ok: true, uid: trimmedUid }
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2025') {
      return { ok: true, uid: trimmedUid }
    }
    throw error
  }
}

export async function loadWormEmailList(options?: {
  subjectKeyword?: string
  scanLimit?: number
  listLimit?: number
  orderId?: string | null
  senderEmail?: string | null
  keywordMatchInSource?: boolean
  includeAllFromSender?: boolean
  forceRefresh?: boolean
}) {
  const rawKeyword = (options?.subjectKeyword || 'invoice').toLowerCase().trim()
  const keywords = rawKeyword.split(',').map(k => k.trim()).filter(Boolean)
  const scanLimit = Math.max(5, Math.min(80, options?.scanLimit || 20))
  const listLimit = Math.max(1, Math.min(30, options?.listLimit || 10))
  const orderId = options?.orderId?.trim() || ''
  const senderEmail = (options?.senderEmail || '').trim().toLowerCase()
  const keywordMatchInSource = options?.keywordMatchInSource === true
  const includeAllFromSender = options?.includeAllFromSender === true
  const forceRefresh = options?.forceRefresh === true
  const cacheKey = `${rawKeyword}|${scanLimit}|${listLimit}|${senderEmail}|${keywordMatchInSource ? 'source' : 'subject'}|${includeAllFromSender ? 'sender-all' : 'keyword'}`

  if (!forceRefresh) {
    const cached = getEmailListCache(cacheKey)
    if (cached) return hydrateEmailsWithAwbCache(cached)
  }

  const emails = await withInboxLock(async (client) => {
    const status = await client.status('INBOX', { messages: true })
    const total = typeof status.messages === 'number' ? status.messages : 0
    if (total === 0) return [] as WormEmailListItem[]

    const startSeq = Math.max(1, total - scanLimit + 1)
    const seqRange = `${startSeq}:*`
    const rows: WormEmailListItem[] = []

    for await (const msg of client.fetch(seqRange, {
      uid: true,
      envelope: true,
      source: keywordMatchInSource ? { maxLength: EMAIL_SCAN_SOURCE_PREVIEW_BYTES } : false,
      bodyStructure: true,
      internalDate: true,
    })) {
      if (!msg || !msg.uid) continue

      const sourceBuf = toBuffer(msg.source)

      const subject = msg.envelope?.subject || '(제목 없음)'
      const subjectLower = subject.toLowerCase()
      const fromAddresses = (msg.envelope?.from || [])
        .map((from) => (typeof from?.address === 'string' ? from.address.trim().toLowerCase() : ''))
        .filter(Boolean)
      const isFromRequestedSender = Boolean(senderEmail && fromAddresses.includes(senderEmail))
      if (senderEmail && !fromAddresses.includes(senderEmail)) {
        continue
      }

      const sourceLower = keywordMatchInSource ? sourceBuf.toString('utf8').toLowerCase() : ''
      const keywordMatched =
        keywords.length === 0 ||
        keywords.some((kw) => subjectLower.includes(kw) || (keywordMatchInSource && sourceLower.includes(kw)))
      if (
        !keywordMatched &&
        !(includeAllFromSender && isFromRequestedSender)
      ) {
        continue
      }
      const dateObj = msg.envelope?.date || msg.internalDate || new Date()
      const hasAttachments = hasAttachmentByBodyStructure(msg.bodyStructure) || hasAttachmentBySource(sourceBuf)

      rows.push({
        uid: String(msg.uid),
        subject,
        date: new Date(dateObj).toISOString(),
        hasAttachments,
        awbNumber: null,
        matchType: null,
        matchedOrderId: null,
        matchedOrderNumber: null,
        matchedAt: null,
        invoiceUnitPriceUsd: null,
        invoiceTotalAmountUsd: null,
        usdKrwRate: null,
        invoiceUnitPriceKrw: null,
        invoiceTotalAmountKrw: null,
        invoiceExtractedAt: null,
        invoiceSourceFile: null,
        invoiceOcrError: null,
      })
    }

    rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    return rows.slice(0, listLimit)
  })

  setEmailListCache(cacheKey, emails)
  const hydrated = await hydrateEmailsWithAwbCache(emails)
  return hydrated.filter((email) => {
    if (!email.matchedOrderId) return true
    if (!orderId) return false
    return email.matchedOrderId === orderId
  })
}

export async function getParsedMailsByUids(uids: string[]) {
  const normalizedUids = Array.from(new Set(uids.map((uid) => uid.trim()).filter(Boolean)))
  const now = Date.now()
  const result = new Map<string, ParsedMail>()
  const missingUids: string[] = []

  for (const uid of normalizedUids) {
    const cached = parsedMailCache.get(uid)
    if (cached && cached.expiresAt > now) {
      result.set(uid, cached.parsed)
      continue
    }
    missingUids.push(uid)
  }

  if (missingUids.length > 0) {
    const fetched = await withInboxLock(async (client) => {
      const entries: Array<{ uid: string; parsed: ParsedMail }> = []
      for (const uid of missingUids) {
        const message = await client.fetchOne(uid, { source: true }, { uid: true })
        if (!message || !message.source) {
          throw new Error(`해당 메일을 찾을 수 없습니다. (uid: ${uid})`)
        }
        const parsed = await simpleParser(message.source)
        entries.push({ uid, parsed })
      }
      return entries
    })

    for (const entry of fetched) {
      parsedMailCache.set(entry.uid, {
        parsed: entry.parsed,
        expiresAt: Date.now() + PARSED_MAIL_CACHE_TTL_MS,
      })
      result.set(entry.uid, entry.parsed)
    }
  }

  return result
}

export async function getParsedMailByUid(uid: string) {
  const normalizedUid = uid.trim()
  const parsedMap = await getParsedMailsByUids([normalizedUid])
  const parsed = parsedMap.get(normalizedUid)
  if (!parsed) {
    throw new Error('해당 메일을 찾을 수 없습니다.')
  }

  return parsed
}

async function getMatchedWormEmailDetailSnapshot(uid: string): Promise<WormEmailDetail | null> {
  const normalizedUid = uid.trim()
  if (!normalizedUid) return null

  try {
    const row = await prisma.wormOrderEmailMatch.findUnique({
      where: { uid: normalizedUid },
      select: {
        uid: true,
        subject: true,
        emailDate: true,
        matchedAt: true,
        emailBodyText: true,
        attachmentsJson: true,
        awbNumber: true,
      },
    })

    if (!row) return null

    const attachments = sanitizeAttachmentSnapshots(row.attachmentsJson)
    if (!row.emailBodyText && attachments.length === 0) return null

    const date = (row.emailDate || row.matchedAt || new Date()).toISOString()
    return {
      uid: row.uid,
      subject: row.subject || '(제목 없음)',
      date,
      text: row.emailBodyText || '',
      hasAttachments: attachments.length > 0,
      skmIndices: attachments.filter((attachment) => attachment.isPdf).map((attachment) => attachment.index),
      attachments: attachments.map(({ isPdf: _isPdf, ...attachment }) => attachment),
      awbNumber: row.awbNumber || null,
    }
  } catch (error) {
    console.error('Failed to load matched worm email detail snapshot:', error)
    return null
  }
}

export async function getWormEmailDetail(uid: string): Promise<WormEmailDetail> {
  const matchedSnapshot = await getMatchedWormEmailDetailSnapshot(uid)
  if (matchedSnapshot) return matchedSnapshot

  const parsed = await getParsedMailByUid(uid)
  const awbCache = await getWormEmailAwbCacheByUid(uid)
  const attachments = (parsed.attachments || []).map((att, idx: number) => ({
    filename: att.filename || `attachment-${idx}`,
    contentType: att.contentType || 'application/octet-stream',
    size: att.size || (att.content?.length ?? 0),
    index: idx,
  }))
  const isPdfAttachment = (att: WormEmailAttachment) => {
    const fileName = att.filename.toLowerCase()
    const contentType = att.contentType.toLowerCase()
    return fileName.endsWith('.pdf') || contentType.includes('pdf')
  }

  const awbLikelyKeywordRegex = /(?:SKM|AWB|AIR\s*WAYBILL|WAYBILL|MAWB|HAWB|HBL|MBL|B\/L|BL|BILL\s*OF\s*LADING|DOCUM)/i
  let skmIndices = attachments
    .filter((att) => isPdfAttachment(att) && awbLikelyKeywordRegex.test(att.filename))
    .map((att) => att.index)

  // Fallback: if no keyword-matched file, OCR all PDF attachments.
  if (skmIndices.length === 0) {
    skmIndices = attachments
      .filter((att) => isPdfAttachment(att))
      .map((att) => att.index)
  }

  return {
    uid,
    subject: parsed.subject || '(제목 없음)',
    date: parsed.date ? new Date(parsed.date).toISOString() : new Date().toISOString(),
    text: parsed.html || parsed.textAsHtml || parsed.text || '',
    hasAttachments: attachments.length > 0,
    skmIndices,
    attachments,
    awbNumber: awbCache?.awbNumber || null,
  }
}

export async function getWormEmailSnapshotForMatch(uid: string) {
  const detail = await getWormEmailDetail(uid)
  return {
    detail,
    emailBodyText: detail.text,
    attachmentsJson: toAttachmentSnapshots(detail.attachments),
  }
}

export async function loadMatchedWormOrderEmails(orderId: string): Promise<WormMatchedEmailRestorePayload> {
  const normalizedOrderId = orderId.trim()
  if (!normalizedOrderId) {
    return {
      invoiceEmails: [],
      invoiceEmailDetails: {},
      awbDocumentEmails: [],
      awbDocumentEmailDetails: {},
    }
  }

  const rows = await prisma.wormOrderEmailMatch.findMany({
    where: { orderId: normalizedOrderId },
    orderBy: { matchedAt: 'desc' },
    select: {
      uid: true,
      matchType: true,
      subject: true,
      emailDate: true,
      matchedAt: true,
      awbNumber: true,
      emailBodyText: true,
      attachmentsJson: true,
      invoiceUnitPriceUsd: true,
      invoiceTotalAmountUsd: true,
      usdKrwRate: true,
      invoiceUnitPriceKrw: true,
      invoiceTotalAmountKrw: true,
      invoiceExtractedAt: true,
      invoiceSourceFile: true,
      invoiceOcrError: true,
      orderId: true,
      order: {
        select: { orderNumber: true },
      },
    },
  })

  const payload: WormMatchedEmailRestorePayload = {
    invoiceEmails: [],
    invoiceEmailDetails: {},
    awbDocumentEmails: [],
    awbDocumentEmailDetails: {},
  }

  for (const row of rows) {
    const matchType = inferWormEmailMatchType(row)
    const attachments = sanitizeAttachmentSnapshots(row.attachmentsJson)
    const date = (row.emailDate || row.matchedAt || new Date()).toISOString()
    const subject = row.subject || '(제목 없음)'
    const listItem: WormEmailListItem = {
      uid: row.uid,
      subject,
      date,
      hasAttachments: attachments.length > 0,
      awbNumber: row.awbNumber || null,
      matchType,
      matchedOrderId: row.orderId,
      matchedOrderNumber: row.order?.orderNumber || '',
      matchedAt: row.matchedAt ? row.matchedAt.toISOString() : null,
      invoiceUnitPriceUsd: row.invoiceUnitPriceUsd,
      invoiceTotalAmountUsd: row.invoiceTotalAmountUsd,
      usdKrwRate: row.usdKrwRate,
      invoiceUnitPriceKrw: row.invoiceUnitPriceKrw,
      invoiceTotalAmountKrw: row.invoiceTotalAmountKrw,
      invoiceExtractedAt: row.invoiceExtractedAt ? row.invoiceExtractedAt.toISOString() : null,
      invoiceSourceFile: row.invoiceSourceFile || null,
      invoiceOcrError: row.invoiceOcrError || null,
    }
    const detail: WormEmailDetail = {
      uid: row.uid,
      subject,
      date,
      text: row.emailBodyText || '',
      hasAttachments: attachments.length > 0,
      skmIndices: attachments.filter((attachment) => attachment.isPdf).map((attachment) => attachment.index),
      attachments: attachments.map(({ isPdf: _isPdf, ...attachment }) => attachment),
      awbNumber: row.awbNumber || null,
    }

    if (matchType === 'AWB_DOCUMENT') {
      payload.awbDocumentEmails.push(listItem)
      payload.awbDocumentEmailDetails[row.uid] = detail
    } else {
      payload.invoiceEmails.push(listItem)
      payload.invoiceEmailDetails[row.uid] = detail
    }
  }

  return payload
}

export async function getWormEmailAttachment(uid: string, index: number) {
  const parsed = await getParsedMailByUid(uid)
  if (!parsed.attachments || parsed.attachments.length <= index || index < 0) {
    throw new Error('해당 첨부파일을 찾을 수 없습니다.')
  }
  return parsed.attachments[index]
}
