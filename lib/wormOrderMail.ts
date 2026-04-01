import { ImapFlow } from 'imapflow'
import { simpleParser, type ParsedMail } from 'mailparser'
import { prisma } from '@/lib/prisma'

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
    await client.logout()
  }
}

function toBuffer(source: unknown) {
  if (Buffer.isBuffer(source)) return source
  if (source instanceof Uint8Array) return Buffer.from(source)
  return Buffer.from([])
}

function hasAttachmentBySource(sourceBuf: Buffer) {
  return (
    sourceBuf.includes(Buffer.from('Content-Disposition: attachment', 'utf8')) ||
    sourceBuf.includes(Buffer.from('content-disposition: attachment', 'utf8'))
  )
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
    return new Map<
      string,
      {
        orderId: string
        orderNumber: string
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
    >()
  }

  try {
    const rows = await prisma.wormOrderEmailMatch.findMany({
      where: { uid: { in: normalizedUids } },
      select: {
        uid: true,
        orderId: true,
        matchedAt: true,
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
        {
          orderId: row.orderId,
          orderNumber: row.order?.orderNumber || '',
          matchedAt: row.matchedAt ? row.matchedAt.toISOString() : null,
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
    return new Map<
      string,
      {
        orderId: string
        orderNumber: string
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
    >()
  }
}

async function hydrateEmailsWithAwbCache(emails: WormEmailListItem[]) {
  const awbMap = await getWormEmailAwbCacheMap(emails.map((email) => email.uid))
  const matchMap = await getWormOrderEmailMatchMap(emails.map((email) => email.uid))
  return emails.map((email) => ({
    ...email,
    awbNumber: awbMap.get(email.uid) || email.awbNumber || null,
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

  return prisma.wormEmailAwbCache.upsert({
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
}

export async function upsertWormOrderEmailMatch(input: {
  uid: string
  orderId: string
  subject?: string | null
  date?: string | null
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

  return prisma.wormOrderEmailMatch.upsert({
    where: { uid },
    update: {
      orderId,
      subject: input.subject?.trim() || null,
      emailDate: toOptionalDate(input.date),
      matchedAt: new Date(),
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
      orderId,
      subject: input.subject?.trim() || null,
      emailDate: toOptionalDate(input.date),
      matchedAt: new Date(),
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
      orderId: true,
      matchedAt: true,
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
}

export async function loadWormEmailList(options?: {
  subjectKeyword?: string
  scanLimit?: number
  listLimit?: number
  orderId?: string | null
}) {
  const subjectKeyword = (options?.subjectKeyword || 'invoice').toLowerCase().trim()
  const scanLimit = Math.max(5, Math.min(80, options?.scanLimit || 20))
  const listLimit = Math.max(1, Math.min(30, options?.listLimit || 10))
  const orderId = options?.orderId?.trim() || ''
  const cacheKey = `${subjectKeyword}|${scanLimit}|${listLimit}`

  const cached = getEmailListCache(cacheKey)
  if (cached) return hydrateEmailsWithAwbCache(cached)

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
      source: true,
      internalDate: true,
    })) {
      if (!msg || !msg.source || !msg.uid) continue

      const sourceBuf = toBuffer(msg.source)
      if (sourceBuf.length === 0) continue

      const subject = msg.envelope?.subject || '(제목 없음)'
      if (subjectKeyword && !subject.toLowerCase().includes(subjectKeyword)) {
        continue
      }
      const dateObj = msg.envelope?.date || msg.internalDate || new Date()
      const hasAttachments = hasAttachmentBySource(sourceBuf)

      rows.push({
        uid: String(msg.uid),
        subject,
        date: new Date(dateObj).toISOString(),
        hasAttachments,
        awbNumber: null,
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

export async function getParsedMailByUid(uid: string) {
  const cacheKey = uid.trim()
  const cached = parsedMailCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.parsed
  }

  const parsed = await withInboxLock(async (client) => {
    const message = await client.fetchOne(cacheKey, { source: true }, { uid: true })
    if (!message || !message.source) {
      throw new Error('해당 메일을 찾을 수 없습니다.')
    }
    return simpleParser(message.source)
  })

  parsedMailCache.set(cacheKey, {
    parsed,
    expiresAt: Date.now() + PARSED_MAIL_CACHE_TTL_MS,
  })

  return parsed
}

export async function getWormEmailDetail(uid: string): Promise<WormEmailDetail> {
  const parsed = await getParsedMailByUid(uid)
  const awbCache = await getWormEmailAwbCacheByUid(uid)
  const attachments = (parsed.attachments || []).map((att, idx: number) => ({
    filename: att.filename || `attachment-${idx}`,
    contentType: att.contentType || 'application/octet-stream',
    size: att.size || (att.content?.length ?? 0),
    index: idx,
  }))
  const skmIndices = attachments
    .map((att) => att.filename.toUpperCase().includes('SKM') ? att.index : -1)
    .filter((idx) => idx >= 0)

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

export async function getWormEmailAttachment(uid: string, index: number) {
  const parsed = await getParsedMailByUid(uid)
  if (!parsed.attachments || parsed.attachments.length <= index || index < 0) {
    throw new Error('해당 첨부파일을 찾을 수 없습니다.')
  }
  return parsed.attachments[index]
}
