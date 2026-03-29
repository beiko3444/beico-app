import { ImapFlow } from 'imapflow'
import { simpleParser, type ParsedMail } from 'mailparser'

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

export async function loadWormEmailList(options?: {
  keyword?: string
  scanLimit?: number
  listLimit?: number
}) {
  const keyword = (options?.keyword || 'michael@oikki.com').toLowerCase()
  const keywordBuf = Buffer.from(keyword, 'utf8')
  const scanLimit = Math.max(5, Math.min(80, options?.scanLimit || 20))
  const listLimit = Math.max(1, Math.min(30, options?.listLimit || 10))
  const cacheKey = `${keyword}|${scanLimit}|${listLimit}`

  const cached = getEmailListCache(cacheKey)
  if (cached) return cached

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
      if (!sourceBuf.includes(keywordBuf)) continue

      const subject = msg.envelope?.subject || '(제목 없음)'
      const dateObj = msg.envelope?.date || msg.internalDate || new Date()
      const hasAttachments = hasAttachmentBySource(sourceBuf)

      rows.push({
        uid: String(msg.uid),
        subject,
        date: new Date(dateObj).toISOString(),
        hasAttachments,
      })
    }

    rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    return rows.slice(0, listLimit)
  })

  setEmailListCache(cacheKey, emails)
  return emails
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
  }
}

export async function getWormEmailAttachment(uid: string, index: number) {
  const parsed = await getParsedMailByUid(uid)
  if (!parsed.attachments || parsed.attachments.length <= index || index < 0) {
    throw new Error('해당 첨부파일을 찾을 수 없습니다.')
  }
  return parsed.attachments[index]
}
