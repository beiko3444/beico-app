'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, Copy, FileText, Loader2, Minus, Plus, Send, Sparkles, Mail, ScanSearch, Search } from 'lucide-react'
import Tesseract from 'tesseract.js'

type WormSize = {
    id: string
    range: string
}

type WormTypeId = 'blue' | 'red'

type WormType = {
    id: WormTypeId
    label: string
    cardActiveClass: string
    cardActiveBorderClass: string
    cardTagClass: string
}

type AwbCandidate = {
    value: string
    score: number
    source: string
}

type WormEmailAttachment = {
    filename: string
    contentType: string
    size: number
    index: number
}

type WormEmailListItem = {
    uid: string
    subject: string
    date: string
    hasAttachments: boolean
}

type WormEmailDetail = {
    uid: string
    subject: string
    date: string
    text: string
    hasAttachments: boolean
    skmIndices: number[]
    attachments: WormEmailAttachment[]
}

type WormEmailOfflineCache = {
    version: 1
    savedAt: string | null
    hasFetched: boolean
    emails: WormEmailListItem[]
    emailDetails: Record<string, WormEmailDetail>
    selectedEmailUid: string | null
}

type CustomsProgressResult = {
    blNo: string
    query: {
        kind: 'mblNo' | 'hblNo'
        blYy: string
    }
    tCnt: number
    ntceInfo: string
    summaryRecords: Array<Record<string, string>>
    detailRecords: Array<Record<string, string>>
}

const WORM_SIZES: WormSize[] = [
    { id: 'LLLL', range: '160-220 PCs/kilo' },
    { id: 'LLL', range: '240-280 PCs/kilo' },
    { id: 'LL', range: '300-340 PCs/kilo' },
    { id: 'L+', range: '360-400 PCs/kilo' },
    { id: 'L', range: '400-440 PCs/kilo' },
    { id: 'M', range: '440-500 PCs/kilo' },
    { id: 'MS', range: '500-540 PCs/kilo' },
    { id: 'S', range: '540-600 PCs/kilo' },
]

const WORM_TYPES: WormType[] = [
    {
        id: 'blue',
        label: '청갯지렁이',
        cardActiveClass: 'bg-sky-50',
        cardActiveBorderClass: 'border-sky-400',
        cardTagClass: 'bg-sky-100 text-sky-700',
    },
    {
        id: 'red',
        label: '홍갯지렁이',
        cardActiveClass: 'bg-red-50',
        cardActiveBorderClass: 'border-red-400',
        cardTagClass: 'bg-red-100 text-red-700',
    },
]

function createInitialQuantities() {
    return WORM_SIZES.reduce<Record<string, number>>((acc, size) => {
        acc[size.id] = 0
        return acc
    }, {})
}

function createInitialQuantitiesByType() {
    return WORM_TYPES.reduce<Record<WormTypeId, Record<string, number>>>((acc, type) => {
        acc[type.id] = createInitialQuantities()
        return acc
    }, {} as Record<WormTypeId, Record<string, number>>)
}

function formatYmdOrYmdHm(value?: string) {
    if (!value) return '-'
    if (/^\d{8}$/.test(value)) {
        return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
    }
    if (/^\d{12,14}$/.test(value)) {
        return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)} ${value.slice(8, 10)}:${value.slice(10, 12)}`
    }
    return value
}

const AWB_KEYWORD_REGEX = /\b(?:AIR\s*WAYBILL|WAYBILL|AWB|MAWB|HAWB)\b/i
const NON_AWB_CONTEXT_REGEX = /\b(?:TEL|PHONE|MOBILE|FAX|EMAIL|E-?MAIL|CONTACT|INVOICE|DATE|TOTAL|QTY|PCS|KILO)\b/i
const PHONE_LIKE_PREFIX_REGEX = /^(010|011|016|017|018|019|070|080)/
const WORM_EMAIL_CACHE_STORAGE_KEY = 'beico-worm-order-email-cache-v1'
const WORM_EMAIL_CACHE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000

function sanitizeWormEmailListItem(value: unknown): WormEmailListItem | null {
    if (!value || typeof value !== 'object') return null

    const candidate = value as Partial<WormEmailListItem>
    if (
        typeof candidate.uid !== 'string' ||
        typeof candidate.subject !== 'string' ||
        typeof candidate.date !== 'string' ||
        typeof candidate.hasAttachments !== 'boolean'
    ) {
        return null
    }

    return {
        uid: candidate.uid,
        subject: candidate.subject,
        date: candidate.date,
        hasAttachments: candidate.hasAttachments,
    }
}

function sanitizeWormEmailAttachment(value: unknown): WormEmailAttachment | null {
    if (!value || typeof value !== 'object') return null

    const candidate = value as Partial<WormEmailAttachment>
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
    }
}

function sanitizeWormEmailDetail(value: unknown): WormEmailDetail | null {
    if (!value || typeof value !== 'object') return null

    const candidate = value as Partial<WormEmailDetail>
    if (
        typeof candidate.uid !== 'string' ||
        typeof candidate.subject !== 'string' ||
        typeof candidate.date !== 'string' ||
        typeof candidate.text !== 'string' ||
        typeof candidate.hasAttachments !== 'boolean' ||
        !Array.isArray(candidate.skmIndices) ||
        !Array.isArray(candidate.attachments)
    ) {
        return null
    }

    const skmIndices = candidate.skmIndices.filter((index): index is number => typeof index === 'number')
    const attachments = candidate.attachments
        .map((attachment) => sanitizeWormEmailAttachment(attachment))
        .filter((attachment): attachment is WormEmailAttachment => attachment !== null)

    return {
        uid: candidate.uid,
        subject: candidate.subject,
        date: candidate.date,
        text: candidate.text,
        hasAttachments: candidate.hasAttachments,
        skmIndices,
        attachments,
    }
}

function pruneEmailDetails(
    details: Record<string, WormEmailDetail>,
    emails: WormEmailListItem[],
) {
    const allowedUids = new Set(emails.map((email) => email.uid))
    return Object.fromEntries(
        Object.entries(details).filter(([uid]) => allowedUids.has(uid)),
    ) as Record<string, WormEmailDetail>
}

function readWormEmailOfflineCache(): WormEmailOfflineCache | null {
    if (typeof window === 'undefined') return null

    try {
        const raw = window.localStorage.getItem(WORM_EMAIL_CACHE_STORAGE_KEY)
        if (!raw) return null

        const parsed = JSON.parse(raw) as Partial<WormEmailOfflineCache> & {
            emails?: unknown[]
            emailDetails?: Record<string, unknown>
        }

        if (parsed.version !== 1) return null

        const savedAt = typeof parsed.savedAt === 'string' ? parsed.savedAt : null
        if (savedAt) {
            const savedAtMs = new Date(savedAt).getTime()
            if (Number.isFinite(savedAtMs) && Date.now() - savedAtMs > WORM_EMAIL_CACHE_MAX_AGE_MS) {
                window.localStorage.removeItem(WORM_EMAIL_CACHE_STORAGE_KEY)
                return null
            }
        }

        const emails = Array.isArray(parsed.emails)
            ? parsed.emails
                .map((email) => sanitizeWormEmailListItem(email))
                .filter((email): email is WormEmailListItem => email !== null)
            : []

        const rawDetails =
            parsed.emailDetails && typeof parsed.emailDetails === 'object'
                ? parsed.emailDetails
                : {}

        const emailDetails = Object.fromEntries(
            Object.entries(rawDetails)
                .map(([uid, detail]) => {
                    const sanitized = sanitizeWormEmailDetail(detail)
                    if (!sanitized || sanitized.uid !== uid) return null
                    return [uid, sanitized] as const
                })
                .filter((entry): entry is readonly [string, WormEmailDetail] => entry !== null),
        ) as Record<string, WormEmailDetail>

        const selectedEmailUid =
            typeof parsed.selectedEmailUid === 'string' && emails.some((email) => email.uid === parsed.selectedEmailUid)
                ? parsed.selectedEmailUid
                : emails[0]?.uid || null

        return {
            version: 1,
            savedAt,
            hasFetched: Boolean(parsed.hasFetched),
            emails,
            emailDetails: pruneEmailDetails(emailDetails, emails),
            selectedEmailUid,
        }
    } catch (error) {
        console.error('Failed to restore worm inbox cache', error)
        return null
    }
}

function writeWormEmailOfflineCache(cache: WormEmailOfflineCache) {
    if (typeof window === 'undefined') return

    try {
        window.localStorage.setItem(WORM_EMAIL_CACHE_STORAGE_KEY, JSON.stringify(cache))
    } catch (error) {
        console.error('Failed to persist worm inbox cache', error)
    }
}

function normalizeOcrPatternText(input: string) {
    return input
        .toUpperCase()
        .replace(/[|IL]/g, '1')
        .replace(/[OQ]/g, '0')
        .replace(/Z/g, '2')
        .replace(/S/g, '5')
        .replace(/B/g, '8')
}

function normalizeOcrDigits(input: string) {
    return normalizeOcrPatternText(input).replace(/[^\d]/g, '')
}

function isValidAwbByCheckDigit(awb11: string) {
    if (!/^\d{11}$/.test(awb11)) return false
    const serial7 = parseInt(awb11.slice(3, 10), 10)
    const checkDigit = parseInt(awb11.slice(10), 10)
    if (!Number.isFinite(serial7) || !Number.isFinite(checkDigit)) return false
    return serial7 % 7 === checkDigit
}

function mergeAwbCandidate(map: Map<string, AwbCandidate>, candidate: AwbCandidate) {
    const prev = map.get(candidate.value)
    if (!prev || candidate.score > prev.score) {
        map.set(candidate.value, candidate)
    }
}

function createCanvasFromSource(source: HTMLCanvasElement) {
    const canvas = document.createElement('canvas')
    canvas.width = source.width
    canvas.height = source.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(source, 0, 0)
    return canvas
}

function createTopCropCanvas(source: HTMLCanvasElement, topRatio: number) {
    const cropHeight = Math.max(1, Math.floor(source.height * topRatio))
    const canvas = document.createElement('canvas')
    canvas.width = source.width
    canvas.height = cropHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(source, 0, 0, source.width, cropHeight, 0, 0, source.width, cropHeight)
    return canvas
}

function applyBinaryThreshold(canvas: HTMLCanvasElement, threshold: number) {
    const ctx = canvas.getContext('2d')!
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imgData.data
    for (let i = 0; i < data.length; i += 4) {
        const brightness = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
        const color = brightness < threshold ? 0 : 255
        data[i] = color
        data[i + 1] = color
        data[i + 2] = color
    }
    ctx.putImageData(imgData, 0, 0)
}

function extractAwbCandidatesFromText(ocrText: string, source: string, trustBoost = 0): AwbCandidate[] {
    const lines = ocrText
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)

    if (lines.length === 0) return []

    const byValue = new Map<string, AwbCandidate>()

    const addCandidate = (value: string, context: string, patternScore: number, lineIndex: number, sourceSuffix: string) => {
        const normalized = normalizeOcrDigits(value)
        if (normalized.length !== 11) return

        const upperContext = context.toUpperCase()
        const hasKeyword = AWB_KEYWORD_REGEX.test(upperContext)
        const checkDigitValid = isValidAwbByCheckDigit(normalized)

        let score = trustBoost + patternScore
        if (hasKeyword) score += 180
        if (lineIndex <= Math.max(1, Math.floor(lines.length * 0.4))) score += 35
        if (/^(112|180)/.test(normalized)) score += 20
        if (checkDigitValid) score += 420
        else score -= 180
        if (/^0/.test(normalized)) score -= 200
        if (PHONE_LIKE_PREFIX_REGEX.test(normalized)) score -= 260
        if (!hasKeyword && NON_AWB_CONTEXT_REGEX.test(upperContext)) score -= 70

        mergeAwbCandidate(byValue, {
            value: normalized,
            score,
            source: `${source} (${sourceSuffix})`,
        })
    }

    const addCandidatesFromChunk = (chunk: string, context: string, lineIndex: number, sourceSuffix: string) => {
        const upper = chunk.toUpperCase()
        const digitFriendly = normalizeOcrPatternText(upper)

        const airportRegex = /(?:^|[^\d])(\d{3})\s+[A-Z]{3}\s*(\d{4})\s*(\d{4})(?=[^\d]|$)/g
        let match: RegExpExecArray | null
        while ((match = airportRegex.exec(upper)) !== null) {
            addCandidate(`${match[1]}${match[2]}${match[3]}`, context, 300, lineIndex, `${sourceSuffix}-airport`)
        }

        const groupedRegex = /(?:^|[^\d])(\d{3})[\s\-_.:/]*(\d{4})[\s\-_.:/]*(\d{4})(?=[^\d]|$)/g
        while ((match = groupedRegex.exec(digitFriendly)) !== null) {
            addCandidate(`${match[1]}${match[2]}${match[3]}`, context, 270, lineIndex, `${sourceSuffix}-grouped`)
        }

        const compactRegex = /(?:^|[^\d])(\d{11})(?=[^\d]|$)/g
        while ((match = compactRegex.exec(digitFriendly)) !== null) {
            addCandidate(match[1], context, 220, lineIndex, `${sourceSuffix}-compact`)
        }
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] || ''
        const prevLine = lines[i - 1] || ''
        const nextLine = lines[i + 1] || ''
        const merged = `${line} ${nextLine}`.trim()
        const context = `${prevLine} ${line} ${nextLine}`.trim()

        addCandidatesFromChunk(line, context, i + 1, 'line')
        if (nextLine) addCandidatesFromChunk(merged, context, i + 1, 'merged')
    }

    return Array.from(byValue.values()).sort((a, b) => b.score - a.score)
}

export default function WormOrderPage() {
    const today = new Date().toISOString().split('T')[0]
    const [quantitiesByType, setQuantitiesByType] = useState<Record<WormTypeId, Record<string, number>>>(createInitialQuantitiesByType)
    const [receiveDate, setReceiveDate] = useState(today)
    const [generatedMessage, setGeneratedMessage] = useState('')
    const [validationError, setValidationError] = useState('')
    const [copied, setCopied] = useState(false)
    const [moinLoginId, setMoinLoginId] = useState(process.env.NEXT_PUBLIC_MOIN_ID || '')
    const [moinPassword, setMoinPassword] = useState(process.env.NEXT_PUBLIC_MOIN_PW || '')
    const [transferAmountUsd, setTransferAmountUsd] = useState('')
    const [invoicePdf, setInvoicePdf] = useState<File | null>(null)
    const [remittanceError, setRemittanceError] = useState('')
    const [remittanceSuccess, setRemittanceSuccess] = useState('')
    const [remittanceSubmitting, setRemittanceSubmitting] = useState(false)
    const [blNumberQuery, setBlNumberQuery] = useState('')
    const [customsProgressResult, setCustomsProgressResult] = useState<CustomsProgressResult | null>(null)
    const [customsProgressError, setCustomsProgressError] = useState('')
    const [customsProgressLoading, setCustomsProgressLoading] = useState(false)
    const dateInputRef = useRef<HTMLInputElement>(null)

    const [emails, setEmails] = useState<WormEmailListItem[]>([])
    const [emailDetails, setEmailDetails] = useState<Record<string, WormEmailDetail>>({})
    const [loadingEmails, setLoadingEmails] = useState(false)
    const [loadingEmailDetail, setLoadingEmailDetail] = useState(false)
    const [emailError, setEmailError] = useState('')
    const [hasFetched, setHasFetched] = useState(false)
    const [selectedEmailUid, setSelectedEmailUid] = useState<string | null>(null)
    const [emailCacheSavedAt, setEmailCacheSavedAt] = useState<string | null>(null)
    const [usingOfflineEmailCache, setUsingOfflineEmailCache] = useState(false)
    const hasHydratedEmailCacheRef = useRef(false)
    const skipEmailCachePersistRef = useRef(false)

    const persistEmailOfflineCache = useCallback(() => {
        if (!hasHydratedEmailCacheRef.current) return

        if (!hasFetched && emails.length === 0 && Object.keys(emailDetails).length === 0 && !selectedEmailUid) {
            if (typeof window !== 'undefined') {
                window.localStorage.removeItem(WORM_EMAIL_CACHE_STORAGE_KEY)
            }
            return
        }

        const normalizedSelectedEmailUid =
            selectedEmailUid && emails.some((email) => email.uid === selectedEmailUid)
                ? selectedEmailUid
                : emails[0]?.uid || null

        writeWormEmailOfflineCache({
            version: 1,
            savedAt: emailCacheSavedAt,
            hasFetched,
            emails,
            emailDetails: pruneEmailDetails(emailDetails, emails),
            selectedEmailUid: normalizedSelectedEmailUid,
        })
    }, [emailCacheSavedAt, emailDetails, emails, hasFetched, selectedEmailUid])

    useEffect(() => {
        const restoredCache = readWormEmailOfflineCache()
        hasHydratedEmailCacheRef.current = true

        if (!restoredCache) return

        skipEmailCachePersistRef.current = true
        setEmails(restoredCache.emails)
        setEmailDetails(restoredCache.emailDetails)
        setHasFetched(restoredCache.hasFetched)
        setSelectedEmailUid(restoredCache.selectedEmailUid)
        setEmailCacheSavedAt(restoredCache.savedAt)
        setUsingOfflineEmailCache(
            restoredCache.hasFetched &&
            (restoredCache.emails.length > 0 || Object.keys(restoredCache.emailDetails).length > 0),
        )
    }, [])

    useEffect(() => {
        if (!hasHydratedEmailCacheRef.current) return

        if (skipEmailCachePersistRef.current) {
            skipEmailCachePersistRef.current = false
            return
        }

        persistEmailOfflineCache()
    }, [persistEmailOfflineCache])

    // ── AWB OCR 관련 State ──
    const [awbNumber, setAwbNumber] = useState<string | null>(null)
    const [awbLoading, setAwbLoading] = useState(false)
    const [awbError, setAwbError] = useState('')
    const [awbCandidates, setAwbCandidates] = useState<AwbCandidate[]>([])

    // ── 관세사 메일 전달 관련 State ──
    const [forwardEmail, setForwardEmail] = useState('')
    const [forwarding, setForwarding] = useState(false)
    const [forwardError, setForwardError] = useState('')
    const [forwardSuccess, setForwardSuccess] = useState('')

    const handleForwardEmail = async (uid: string) => {
        if (!forwardEmail) {
            setForwardError('받을 이메일 주소를 입력해주세요.')
            return
        }
        setForwarding(true)
        setForwardError('')
        setForwardSuccess('')

        try {
            const res = await fetch('/api/admin/worm-order/emails/forward', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid, toEmail: forwardEmail })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || '이메일 전달 실패')
            setForwardSuccess('메일과 첨부파일이 지정된 주소로 성공적으로 전달되었습니다.')
            setTimeout(() => setForwardSuccess(''), 5000)
            setForwardEmail('')
        } catch (err: any) {
            setForwardError(err.message)
        } finally {
            setForwarding(false)
        }
    }

    // ── 자동 페치 & 게이지 관련 State ──
    const [fetchProgress, setFetchProgress] = useState(0)

    // ── 메일 선택 시 SKM 첨부파일 OCR 자동 실행 ──
    const ocrOnePdf = useCallback(async (uid: string, attIndex: number): Promise<AwbCandidate[]> => {
        const res = await fetch(`/api/admin/worm-order/emails/attachment?uid=${uid}&index=${attIndex}`)
        if (!res.ok) return []
        const blob = await res.blob()

        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
        const arrayBuffer = await blob.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

        const byValue = new Map<string, AwbCandidate>()
        const worker = await Tesseract.createWorker('eng', 1, { logger: () => {} })
        await worker.setParameters({
            tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
            preserve_interword_spaces: '1',
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._:/ ',
        } as any)

        try {
            // 모든 페이지 시도 (최대 5페이지)
            const totalPages = pdf.numPages
            for (let pageNum = 1; pageNum <= Math.min(totalPages, 5); pageNum++) {
                const page = await pdf.getPage(pageNum)

                // 먼저 PDF 텍스트 레이어를 추출 시도 (가능한 경우 OCR보다 정확)
                try {
                    const textContent = await page.getTextContent()
                    const pageText = (textContent.items || [])
                        .map((item: any) => item?.str || '')
                        .filter(Boolean)
                        .join('\n')
                    const textCandidates = extractAwbCandidatesFromText(
                        pageText,
                        `file=${attIndex},page=${pageNum},text`,
                        130,
                    )
                    for (const c of textCandidates) {
                        mergeAwbCandidate(byValue, c)
                    }
                } catch (err) {
                    console.warn(`[AWB OCR] text-layer parse failed file=${attIndex},page=${pageNum}`, err)
                }

                const viewport = page.getViewport({ scale: 3.2 })
                const canvas = document.createElement('canvas')
                canvas.width = viewport.width
                canvas.height = viewport.height
                const ctx = canvas.getContext('2d')!
                await page.render({ canvasContext: ctx, viewport } as any).promise

                const fullRaw = canvas
                const fullBinary = createCanvasFromSource(canvas)
                applyBinaryThreshold(fullBinary, 165)
                const topRaw = createTopCropCanvas(canvas, 0.42)
                const topBinary = createCanvasFromSource(topRaw)
                applyBinaryThreshold(topBinary, 165)

                const variants: Array<{ name: string; canvas: HTMLCanvasElement; boost: number }> = [
                    { name: 'ocr-full-raw', canvas: fullRaw, boost: 30 },
                    { name: 'ocr-full-binary', canvas: fullBinary, boost: 60 },
                    { name: 'ocr-top-raw', canvas: topRaw, boost: 100 },
                    { name: 'ocr-top-binary', canvas: topBinary, boost: 140 },
                ]

                for (const variant of variants) {
                    const result = await worker.recognize(variant.canvas)
                    const ocrText = result.data.text || ''
                    console.log(`[AWB OCR] file=${attIndex}, page=${pageNum}, variant=${variant.name}`, ocrText)

                    const candidates = extractAwbCandidatesFromText(
                        ocrText,
                        `file=${attIndex},page=${pageNum},${variant.name}`,
                        variant.boost,
                    )
                    for (const c of candidates) {
                        mergeAwbCandidate(byValue, c)
                    }
                }
            }
        } finally {
            await worker.terminate()
        }

        return Array.from(byValue.values()).sort((a, b) => b.score - a.score)
    }, [])

    const runAwbOcr = useCallback(async (uid: string, skmIndices: number[]) => {
        setAwbNumber(null)
        setAwbLoading(true)
        setAwbError('')
        setAwbCandidates([])
        try {
            const byValue = new Map<string, AwbCandidate>()

            // 모든 SKM 파일을 순차적으로 시도해서 점수가 가장 높은 후보를 채택
            for (const idx of skmIndices) {
                const foundList = await ocrOnePdf(uid, idx)
                for (const c of foundList) {
                    mergeAwbCandidate(byValue, c)
                }
            }

            const ranked = Array.from(byValue.values()).sort((a, b) => b.score - a.score)
            setAwbCandidates(ranked.slice(0, 6))

            if (ranked.length > 0) {
                setAwbNumber(ranked[0].value)
                if (ranked[0].score < 350) {
                    setAwbError('OCR 신뢰도가 낮습니다. 아래 대안 후보에서 번호를 직접 선택해주세요.')
                }
                return
            }

            setAwbError('모든 SKM 문서에서 운송장 번호를 찾지 못했습니다. 브라우저 콘솔(F12)에서 OCR 원문을 확인해주세요.')
        } catch (err: any) {
            console.error('AWB OCR Error:', err)
            setAwbError(err.message || 'OCR 처리 실패')
        } finally {
            setAwbLoading(false)
        }
    }, [ocrOnePdf])

    const fetchEmailDetail = useCallback(async (uid: string): Promise<WormEmailDetail | null> => {
        if (emailDetails[uid]) return emailDetails[uid]

        setLoadingEmailDetail(true)
        try {
            const res = await fetch(`/api/admin/worm-order/emails/detail?uid=${encodeURIComponent(uid)}`)
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || '메일 상세 조회 실패')

            setEmailError('')
            setUsingOfflineEmailCache(false)
            setEmailCacheSavedAt(new Date().toISOString())
            setEmailDetails(prev => ({ ...prev, [uid]: data }))
            return data
        } catch (err: any) {
            setEmailError(err.message || '메일 상세 조회 실패')
            return null
        } finally {
            setLoadingEmailDetail(false)
        }
    }, [emailDetails])

    const handleRunSelectedAwbOcr = useCallback(async () => {
        if (!selectedEmailUid) return
        const detail = emailDetails[selectedEmailUid] || await fetchEmailDetail(selectedEmailUid)
        if (!detail) return
        if (!detail.skmIndices || detail.skmIndices.length === 0) {
            setAwbError('선택한 메일에 SKM 첨부파일이 없어 OCR을 실행할 수 없습니다.')
            return
        }
        runAwbOcr(selectedEmailUid, detail.skmIndices)
    }, [selectedEmailUid, emailDetails, fetchEmailDetail, runAwbOcr])

    useEffect(() => {
        if (!selectedEmailUid) return
        setAwbNumber(null)
        setAwbCandidates([])
        setAwbLoading(false)
        setAwbError('')
        fetchEmailDetail(selectedEmailUid)
    }, [selectedEmailUid, fetchEmailDetail])

    useEffect(() => {
        // fetchEmails() // Removed auto fetch
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const fetchEmails = async () => {
        setLoadingEmails(true)
        setEmailError('')
        setFetchProgress(0)

        // 가짜(Fake) 프로그레스 메이커 (로딩 중일 때 90%까지 꾸준히 증가)
        let currentProgress = 0
        const interval = setInterval(() => {
            currentProgress += Math.random() * 15
            if (currentProgress > 90) currentProgress = 90
            setFetchProgress(currentProgress)
        }, 400)

        try {
            const res = await fetch('/api/admin/worm-order/emails')
            clearInterval(interval)
            setFetchProgress(100) // 100% 꽉 채우기

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to fetch emails')
            
            const fetchedEmails: WormEmailListItem[] = Array.isArray(data.emails)
                ? data.emails
                    .map((email: unknown) => sanitizeWormEmailListItem(email))
                    .filter((email: WormEmailListItem | null): email is WormEmailListItem => email !== null)
                : []
            const nextSelectedEmailUid =
                selectedEmailUid && fetchedEmails.some((email) => email.uid === selectedEmailUid)
                    ? selectedEmailUid
                    : fetchedEmails[0]?.uid || null

            setEmails(fetchedEmails)
            setEmailDetails((prev) => pruneEmailDetails(prev, fetchedEmails))
            setSelectedEmailUid(nextSelectedEmailUid)
            setHasFetched(true)
            setUsingOfflineEmailCache(false)
            setEmailCacheSavedAt(new Date().toISOString())
            
            // 0.5초 뒤 게이지 숨김
            setTimeout(() => setFetchProgress(0), 500)
        } catch (err: any) {
            clearInterval(interval)
            setFetchProgress(0)
            const message = err.message || 'Failed to fetch emails'
            const hasCachedEmails = emails.length > 0 || Object.keys(emailDetails).length > 0
            setEmailError(hasCachedEmails ? `${message} Showing saved email cache.` : message)
            setHasFetched(true)
            setUsingOfflineEmailCache(hasCachedEmails)
        } finally {
            setLoadingEmails(false)
        }
    }

    const selectedOrders = useMemo(() => {
        return WORM_TYPES.flatMap((wormType) =>
            WORM_SIZES
                .map((size) => ({
                    ...size,
                    wormTypeId: wormType.id,
                    wormTypeLabel: wormType.label,
                    boxes: quantitiesByType[wormType.id]?.[size.id] || 0,
                }))
                .filter((size) => size.boxes > 0)
        )
    }, [quantitiesByType])

    const totalBoxes = useMemo(() => {
        return selectedOrders.reduce((sum, item) => sum + item.boxes, 0)
    }, [selectedOrders])

    const handleQuantityChange = (wormTypeId: WormTypeId, sizeId: string, nextValue: number) => {
        setCopied(false)
        setQuantitiesByType((prev) => ({
            ...prev,
            [wormTypeId]: {
                ...prev[wormTypeId],
                [sizeId]: Math.max(0, nextValue),
            },
        }))
    }

    const handleGenerate = () => {
        setCopied(false)

        if (!receiveDate) {
            setValidationError('Please choose a receiving date.')
            return
        }

        if (selectedOrders.length === 0) {
            setValidationError('Please choose at least one worm size and box quantity.')
            return
        }

        setValidationError('')

        const receiveDateText = new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long',
        }).format(new Date(`${receiveDate}T00:00:00`))

        const lines = selectedOrders
            .map((item) => {
                const boxLabel = item.boxes > 1 ? 'boxes' : 'box'
                return `- [${item.wormTypeLabel}] ${item.id} (${item.range}): ${item.boxes} ${boxLabel}`
            })
            .join('\n')

        const totalLabel = totalBoxes > 1 ? 'boxes' : 'box'

        const message = [
            'Hi Michael,',
            '',
            `Please send the following worm order to arrive by ${receiveDateText}.`,
            `Total requested: ${totalBoxes} ${totalLabel}.`,
            '',
            lines,
            '',
            'Thanks.',
        ].join('\n')

        setGeneratedMessage(message)
    }

    const handleCopy = async () => {
        if (!generatedMessage) return

        try {
            await navigator.clipboard.writeText(generatedMessage)
            setCopied(true)
        } catch {
            setCopied(false)
            alert('Copy failed. Please copy the message manually.')
        }
    }

    const handleRemittanceApply = async () => {
        setRemittanceError('')
        setRemittanceSuccess('')

        if (!moinLoginId.trim() || !moinPassword.trim()) {
            setRemittanceError('Please enter MOIN login ID and password.')
            return
        }

        const normalizedAmount = transferAmountUsd.replace(/,/g, '').trim()
        const parsedAmount = Number(normalizedAmount)
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            setRemittanceError('Please enter a valid USD amount.')
            return
        }

        if (!invoicePdf) {
            setRemittanceError('Please upload an invoice PDF file.')
            return
        }

        const isPdf = invoicePdf.type === 'application/pdf' || invoicePdf.name.toLowerCase().endsWith('.pdf')
        if (!isPdf) {
            setRemittanceError('Only PDF files are allowed.')
            return
        }

        setRemittanceSubmitting(true)
        try {
            const submitData = new FormData()
            submitData.append('moinLoginId', moinLoginId.trim())
            submitData.append('moinPassword', moinPassword)
            submitData.append('amountUsd', parsedAmount.toFixed(2))
            submitData.append('invoicePdf', invoicePdf)

            const response = await fetch('/api/admin/worm-order/remittance', {
                method: 'POST',
                body: submitData,
            })
            const result = await response.json()

            if (!response.ok) {
                throw new Error(typeof result?.error === 'string' ? result.error : 'Failed to submit remittance.')
            }

            setRemittanceSuccess('Remittance application completed on MOIN BizPlus.')
            setMoinPassword('')
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to submit remittance.'
            if (message.toLowerCase().includes('playwright')) {
                setRemittanceError(`${message} (Install deps and redeploy: npm install playwright-core @sparticuz/chromium)`)
            } else {
                setRemittanceError(message)
            }
        } finally {
            setRemittanceSubmitting(false)
        }
    }

    const handleCustomsProgressSearch = async () => {
        const blNo = blNumberQuery.replace(/\s+/g, '').trim()
        setCustomsProgressError('')
        setCustomsProgressResult(null)

        if (!blNo) {
            setCustomsProgressError('B/L 번호를 입력해주세요.')
            return
        }

        setCustomsProgressLoading(true)
        try {
            const response = await fetch(`/api/admin/worm-order/customs-progress?blNo=${encodeURIComponent(blNo)}`, {
                method: 'GET',
                cache: 'no-store',
            })
            const result = await response.json()

            if (!response.ok) {
                throw new Error(typeof result?.error === 'string' ? result.error : '화물통관 진행정보 조회에 실패했습니다.')
            }

            setCustomsProgressResult(result as CustomsProgressResult)
        } catch (error) {
            const message = error instanceof Error ? error.message : '화물통관 진행정보 조회에 실패했습니다.'
            setCustomsProgressError(message)
        } finally {
            setCustomsProgressLoading(false)
        }
    }

    useEffect(() => {
        const input = dateInputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null
        if (!input?.showPicker) return

        const timer = window.setTimeout(() => {
            try {
                input.showPicker?.()
            } catch {
                // Ignore browsers that block programmatic picker open.
            }
        }, 120)

        return () => window.clearTimeout(timer)
    }, [])

    const firstSummary = customsProgressResult?.summaryRecords?.[0] || null
    const detailRows = customsProgressResult?.detailRecords || []

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-10">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl md:text-4xl font-black text-[#111827] tracking-tight">Worm Order</h1>
                <p className="text-sm text-gray-500 uppercase tracking-wider">Choose boxes by size, then pick receiving date</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <div className="flex flex-col md:flex-row md:items-end gap-4">
                    <div className="min-w-0">
                        <label htmlFor="receiveDate" className="block text-xs font-black text-gray-600 uppercase tracking-[0.15em] mb-2">
                            Receiving Date
                        </label>
                        <div
                            className="relative w-full md:w-[260px]"
                            onClick={() => {
                                const input = dateInputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null
                                try {
                                    input?.showPicker?.()
                                } catch {
                                    // Ignore unsupported browser behavior.
                                }
                            }}
                        >
                            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                ref={dateInputRef}
                                id="receiveDate"
                                type="date"
                                value={receiveDate}
                                onChange={(event) => {
                                    setCopied(false)
                                    setReceiveDate(event.target.value)
                                }}
                                min={today}
                                className="w-full h-11 pl-10 pr-3 rounded-lg border border-gray-300 text-[#111827] font-medium"
                            />
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleGenerate}
                        className="h-11 px-6 bg-[#e34219] hover:bg-[#cd3b17] text-white rounded-lg font-bold text-sm tracking-wide w-full md:w-auto"
                    >
                        Generate Message
                    </button>
                </div>
                {validationError && (
                    <p className="text-sm font-semibold text-[#e34219] mt-3">{validationError}</p>
                )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-[#fff7f3] flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-bold text-[#e34219] uppercase tracking-[0.2em]">WORM ORDER SHEET</p>
                        <h2 className="text-lg font-black text-[#1f2937]">How many boxes do you want to order?</h2>
                    </div>
                    <Sparkles size={18} className="text-[#e34219]" />
                </div>

                <div className="p-4 md:p-6 space-y-5">
                    {WORM_TYPES.map((wormType) => (
                        <section key={wormType.id} className="space-y-3">
                            <div className="flex items-center gap-2">
                                <span className={`inline-flex h-7 items-center rounded-full px-3 text-sm font-black ${wormType.cardTagClass}`}>
                                    {wormType.label}
                                </span>
                                <span className="text-xs text-gray-500 font-semibold">사이즈별 박스 수량 입력</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                                {WORM_SIZES.map((size) => {
                                    const current = quantitiesByType[wormType.id]?.[size.id] || 0
                                    const isSelected = current > 0

                                    return (
                                        <div
                                            key={`${wormType.id}-${size.id}`}
                                            className={`flex flex-col gap-2.5 justify-between border rounded-xl p-3.5 transition-all duration-200 ${
                                                isSelected
                                                    ? `${wormType.cardActiveBorderClass} ${wormType.cardActiveClass} shadow-sm`
                                                    : 'border-gray-200 bg-white hover:border-gray-300'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between px-0.5">
                                                <div className="text-[16px] font-black text-[#111827] leading-none">{size.id}</div>
                                                <div className="text-[11px] tracking-tight text-gray-500 font-medium">{size.range}</div>
                                            </div>

                                            <div className="flex items-center rounded-lg border border-gray-300 overflow-hidden w-full transition-colors bg-white">
                                                <button
                                                    type="button"
                                                    onClick={() => handleQuantityChange(wormType.id, size.id, current - 1)}
                                                    className="w-10 h-[36px] flex items-center justify-center text-gray-600 hover:bg-gray-50 flex-shrink-0"
                                                    aria-label={`${wormType.label} ${size.id} decrease`}
                                                >
                                                    <Minus size={15} />
                                                </button>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={current}
                                                    onChange={(event) => {
                                                        const next = Number(event.target.value)
                                                        handleQuantityChange(wormType.id, size.id, Number.isFinite(next) ? next : 0)
                                                    }}
                                                    className="flex-1 min-w-0 h-[36px] text-center font-black text-[#111827] outline-none text-[15px]"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleQuantityChange(wormType.id, size.id, current + 1)}
                                                    className="w-10 h-[36px] flex items-center justify-center text-gray-600 hover:bg-gray-50 flex-shrink-0"
                                                    aria-label={`${wormType.label} ${size.id} increase`}
                                                >
                                                    <Plus size={15} />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </section>
                    ))}
                </div>
            </div>

            {generatedMessage && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-3">
                    <textarea
                        readOnly
                        value={generatedMessage}
                        className="w-full h-60 border border-gray-300 rounded-xl p-4 text-sm leading-6 text-gray-800 bg-gray-50"
                    />
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="inline-flex items-center gap-2 h-10 px-4 border border-gray-300 rounded-lg font-semibold text-sm text-gray-700 hover:bg-gray-50"
                    >
                        <Copy size={15} />
                        {copied ? 'Copied' : 'Copy Message'}
                    </button>
                </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-[11px] font-bold text-[#e34219] uppercase tracking-[0.2em]">MOIN BIZPLUS</p>
                        <h3 className="text-lg font-black text-[#111827]">Auto Remittance Application</h3>
                        <p className="text-xs text-gray-500 mt-1">
                            Fill amount + invoice PDF, then click apply to complete transfer submission automatically.
                        </p>
                    </div>
                    <Send size={18} className="text-[#e34219] mt-1" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-600 uppercase tracking-[0.12em]">
                            MOIN Login ID
                        </label>
                        <input
                            type="text"
                            value={moinLoginId}
                            onChange={(event) => setMoinLoginId(event.target.value)}
                            className="w-full h-11 px-3 rounded-lg border border-gray-300 text-[#111827] font-medium"
                            placeholder="Enter MOIN login ID"
                            autoComplete="username"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-600 uppercase tracking-[0.12em]">
                            MOIN Password
                        </label>
                        <input
                            type="password"
                            value={moinPassword}
                            onChange={(event) => setMoinPassword(event.target.value)}
                            className="w-full h-11 px-3 rounded-lg border border-gray-300 text-[#111827] font-medium"
                            placeholder="Enter MOIN password"
                            autoComplete="current-password"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-600 uppercase tracking-[0.12em]">
                            Transfer Amount (USD)
                        </label>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={transferAmountUsd}
                            onChange={(event) => {
                                const cleaned = event.target.value.replace(/[^0-9.,]/g, '')
                                setTransferAmountUsd(cleaned)
                            }}
                            className="w-full h-11 px-3 rounded-lg border border-gray-300 text-[#111827] font-medium"
                            placeholder="Ex. 1250.50"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-600 uppercase tracking-[0.12em]">
                            Invoice PDF
                        </label>
                        <label className="h-11 px-3 rounded-lg border border-dashed border-gray-300 text-[#111827] font-medium flex items-center justify-between cursor-pointer hover:bg-gray-50">
                            <div className="flex items-center gap-2 min-w-0">
                                <FileText size={16} className="shrink-0 text-gray-500" />
                                <span className="text-sm truncate">{invoicePdf?.name || 'Upload invoice PDF'}</span>
                            </div>
                            <span className="text-[11px] text-gray-500 font-bold uppercase">PDF</span>
                            <input
                                type="file"
                                accept=".pdf,application/pdf"
                                className="hidden"
                                onChange={(event) => {
                                    setRemittanceError('')
                                    setRemittanceSuccess('')
                                    const file = event.target.files?.[0] || null
                                    setInvoicePdf(file)
                                }}
                            />
                        </label>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                        The automation will log in, select Shanghai Oikki Trading Co.,Ltd, upload your PDF, check consent, and complete submission.
                    </p>
                    <button
                        type="button"
                        onClick={handleRemittanceApply}
                        disabled={remittanceSubmitting}
                        className="h-11 px-6 bg-[#111827] hover:bg-black text-white rounded-lg font-bold text-sm tracking-wide disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                    >
                        {remittanceSubmitting ? (
                            <>
                                <Loader2 size={15} className="animate-spin" />
                                Applying...
                            </>
                        ) : (
                            '신청하기'
                        )}
                    </button>
                </div>

                {remittanceError && (
                    <p className="text-sm font-semibold text-[#e34219]">{remittanceError}</p>
                )}
                {remittanceSuccess && (
                    <p className="text-sm font-semibold text-green-600">{remittanceSuccess}</p>
                )}
            </div>

            {/* ── 최근 메일 조회 (INBOX) ── */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden relative">
                
                {/* 상단 프로그레스 게이지 바 */}
                {fetchProgress > 0 && (
                    <div className="absolute top-0 left-0 w-full h-[4px] bg-slate-100 z-10 overflow-hidden">
                        <div 
                            className="h-full bg-orange-500 transition-all duration-300 ease-out"
                            style={{ width: `${fetchProgress}%` }}
                        />
                    </div>
                )}

                <div className="px-6 py-4 border-b border-gray-100 bg-[#f8fafc] flex items-center justify-between mt-[2px]">
                    <div>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.2em] relative">INBOX
                            {loadingEmails && <span className="absolute -top-1 -right-3 flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span></span>}
                        </p>
                        <h2 className="text-lg font-black text-[#1f2937] flex items-center gap-2">
                            <Mail size={18} className="text-slate-500" /> Documents
                        </h2>
                        {emailCacheSavedAt && (
                            <p className={`mt-1 text-[11px] font-medium ${usingOfflineEmailCache ? 'text-amber-600' : 'text-slate-500'}`}>
                                {usingOfflineEmailCache ? 'Offline cache active' : 'Last cached'} / {new Date(emailCacheSavedAt).toLocaleString()}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={fetchEmails}
                        disabled={loadingEmails}
                        className="h-9 px-4 bg-slate-800 text-white rounded-lg text-sm font-bold shadow hover:bg-slate-700 disabled:opacity-50 flex items-center gap-2 cursor-pointer transition-colors relative overflow-hidden"
                    >
                        {loadingEmails && <Loader2 size={14} className="animate-spin relative z-10" />}
                        <span className="relative z-10">{loadingEmails ? '스캔 중...' : 'Fetch Emails'}</span>
                    </button>
                </div>
                <div className="flex flex-col md:flex-row min-h-[500px] border-t border-gray-100">
                    {/* 좌측 리스트 패널 */}
                    <div className="w-full md:w-[35%] bg-white border-r border-gray-100 overflow-y-auto max-h-[600px] relative">
                        {emailError && <div className="p-4 text-sm text-red-500 font-medium text-center">{emailError}</div>}
                        
                        {loadingEmails && (
                            <div className="p-10 flex flex-col items-center justify-center gap-4 text-slate-400 h-full mt-20">
                                <span className="text-[13px] font-bold text-orange-500 tracking-wider">스캔 진행률 {Math.round(fetchProgress)}%</span>
                                <div className="w-[120px] h-[3px] bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-orange-500 transition-all duration-300 ease-out" style={{ width: `${fetchProgress}%` }} />
                                </div>
                                <span className="text-[12px] font-medium text-slate-400 animate-pulse mt-1">
                                    Daum 서버 메일 및 SKM 첨부문서를 자동 스캔 중입니다...
                                </span>
                            </div>
                        )}

                        {hasFetched && !loadingEmails && emails.length === 0 && !emailError && (
                            <div className="p-10 text-center text-[13px] font-medium text-gray-500 bg-gray-50/50 mt-10">
                                메일 본문에 <span className="font-bold text-gray-700">'michael@oikki.com'</span>이 포함된<br />최근 메일이 없습니다.
                            </div>
                        )}

                        {!loadingEmails && emails.length > 0 && (
                            <div className="divide-y divide-gray-100">
                                {emails.map((email) => {
                                    const isSelected = selectedEmailUid === email.uid
                                    return (
                                        <button
                                            key={email.uid}
                                            onClick={() => setSelectedEmailUid(email.uid)}
                                            className={`w-full text-left p-4 hover:bg-slate-50 transition-colors ${
                                                isSelected ? 'bg-orange-50/50 border-l-[3px] border-orange-500 pl-[13px]' : 'border-l-[3px] border-transparent pl-4'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <span className={`text-[11px] font-bold ${isSelected ? 'text-orange-500' : 'text-gray-400'}`}>
                                                    {new Date(email.date).toLocaleDateString()}
                                                </span>
                                                {email.hasAttachments && <span className="text-[11px]">📎</span>}
                                            </div>
                                            <h3 className={`text-[14px] font-bold leading-snug line-clamp-2 ${isSelected ? 'text-gray-900' : 'text-gray-600'}`}>
                                                {email.subject}
                                            </h3>
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* 우측 본문 렌더링 패널 */}
                    <div className="w-full md:w-[65%] bg-gray-50/30 flex flex-col">
                        {!selectedEmailUid ? (
                            <div className="flex-1 flex items-center justify-center p-10 text-[13px] text-gray-400 font-medium">
                                {emails.length > 0 ? "좌측에서 메일을 선택하시면 내용이 표시됩니다." : ""}
                            </div>
                        ) : (() => {
                            const selectedEmailBase = emails.find(e => e.uid === selectedEmailUid)
                            const selectedEmailDetail = selectedEmailUid ? emailDetails[selectedEmailUid] : null
                            if (!selectedEmailBase) return null

                            const selectedEmail = {
                                uid: selectedEmailBase.uid,
                                subject: selectedEmailDetail?.subject || selectedEmailBase.subject,
                                date: selectedEmailDetail?.date || selectedEmailBase.date,
                                text: selectedEmailDetail?.text || '',
                                hasAttachments: selectedEmailDetail?.hasAttachments ?? selectedEmailBase.hasAttachments,
                                skmIndices: selectedEmailDetail?.skmIndices || [],
                                attachments: selectedEmailDetail?.attachments || [],
                            }
                            return (
                                <div className="flex flex-col h-full max-h-[600px]">
                                    {/* 상세 헤더 */}
                                    <div className="p-6 bg-white border-b border-gray-100 shrink-0">
                                        <h2 className="text-[18px] font-black text-gray-900 leading-tight mb-2 pr-4">{selectedEmail.subject}</h2>
                                        <div className="flex items-center gap-3 text-[12px] text-gray-500 font-medium tracking-tight">
                                            <span>수신일시: {new Date(selectedEmail.date).toLocaleString()}</span>
                                        </div>

                                        <div className="mt-4 flex items-center gap-2">
                                            <button
                                                onClick={handleRunSelectedAwbOcr}
                                                disabled={loadingEmailDetail || awbLoading || selectedEmail.skmIndices.length === 0}
                                                className="h-9 px-3 rounded-lg bg-slate-800 text-white text-[12px] font-bold disabled:opacity-50"
                                            >
                                                {awbLoading ? 'OCR 실행중...' : 'AWB OCR 실행'}
                                            </button>
                                            {loadingEmailDetail ? (
                                                <span className="text-[12px] text-slate-500 font-medium">메일 상세를 불러오는 중입니다...</span>
                                            ) : (
                                                <span className="text-[12px] text-slate-500 font-medium">
                                                    {selectedEmail.skmIndices.length > 0
                                                        ? `SKM 첨부파일 ${selectedEmail.skmIndices.length}개`
                                                        : 'SKM 첨부파일이 없습니다.'}
                                                </span>
                                            )}
                                        </div>
                                        
                                        {/* AIR WAYBILL OCR 결과 */}
                                        {(awbLoading || awbNumber || awbError || awbCandidates.length > 0) && (
                                            <div className={`mt-5 p-4 rounded-xl border flex flex-col gap-2 ${
                                                awbLoading
                                                    ? 'border-orange-100 bg-orange-50/50'
                                                    : awbError
                                                    ? (awbNumber ? 'border-amber-100 bg-amber-50/60' : 'border-red-100 bg-red-50/50')
                                                    : awbNumber
                                                    ? 'border-blue-100 bg-blue-50/50'
                                                    : 'border-orange-100 bg-orange-50/50'
                                            }`}>
                                                {awbLoading && (
                                                    <div className="flex items-center gap-2 text-orange-600">
                                                        <ScanSearch size={16} className="animate-pulse" />
                                                        <span className="text-[13px] font-bold">SKM 문서에서 Air Waybill 번호를 OCR 스캔 중...</span>
                                                        <Loader2 size={14} className="animate-spin ml-auto" />
                                                    </div>
                                                )}
                                                {awbNumber && !awbLoading && (
                                                    <>
                                                        <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                                                            <Sparkles size={14} className="text-blue-500" />
                                                            Air Waybill Extracted (OCR from SKM doc)
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[20px] font-black text-blue-900 tracking-tight leading-none">{awbNumber}</span>
                                                            <button 
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(awbNumber)
                                                                    alert('운송장 번호 ' + awbNumber + ' 이(가) 복사되었습니다.')
                                                                }}
                                                                className="h-9 px-4 bg-blue-600 text-white font-bold text-[13px] rounded-lg hover:bg-blue-700 transition flex items-center justify-center shrink-0"
                                                            >
                                                                복사하기
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                                {awbCandidates.length > 1 && !awbLoading && (
                                                    <div className="mt-1 pt-2 border-t border-blue-100/70 flex flex-wrap items-center gap-2">
                                                        <span className="text-[11px] font-bold text-slate-500">대안 후보</span>
                                                        {awbCandidates.slice(1, 6).map((candidate) => (
                                                            <button
                                                                key={`${candidate.value}-${candidate.source}`}
                                                                onClick={() => {
                                                                    setAwbNumber(candidate.value)
                                                                    setAwbError('')
                                                                }}
                                                                className="h-7 px-2.5 rounded-md border border-slate-200 bg-white text-[11px] font-bold text-slate-700 hover:border-blue-300 hover:text-blue-700 transition-colors"
                                                                title={`source: ${candidate.source}, score: ${candidate.score}`}
                                                            >
                                                                {candidate.value}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                                {awbError && !awbLoading && (
                                                    <div className={`text-[12px] font-bold flex items-center gap-1.5 ${
                                                        awbNumber ? 'text-amber-700' : 'text-red-600'
                                                    }`}>
                                                        <ScanSearch size={14} />
                                                        {awbError}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* 첨부파일 다운로드 */}
                                        {selectedEmail.attachments.length > 0 && (
                                            <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-2">
                                                {selectedEmail.attachments.map((att) => (
                                                    <a
                                                        key={att.index}
                                                        href={`/api/admin/worm-order/emails/attachment?uid=${selectedEmail.uid}&index=${att.index}`}
                                                        className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#e34219] bg-[#fff7f3] hover:bg-[#ffeadd] px-3 py-1.5 rounded-lg border border-[#ffeadd] transition-colors"
                                                        title="새 탭에서 열거나 다운로드하려면 클릭하세요"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                    >
                                                        📎 {att.filename} <span className="font-normal text-[10px] text-orange-400 opacity-80 ml-0.5">({Math.round(att.size / 1024)}KB)</span>
                                                    </a>
                                                ))}
                                            </div>
                                        )}

                                        {/* ── [NEW] 관세사 메일 전달 영역 ── */}
                                        <div className="mt-5 p-4 rounded-xl border border-orange-100 bg-orange-50/50 flex flex-col gap-3">
                                            <label className="text-[13px] font-bold text-gray-800 flex items-center gap-1.5 focus-within:text-orange-600 transition-colors">
                                                <Send size={15} className="text-orange-600" />
                                                이 메일의 첨부파일을 지정된 이메일로 바로 전달하기
                                            </label>
                                            <div className="flex gap-2 w-full">
                                                <input 
                                                    type="email"
                                                    value={forwardEmail}
                                                    onChange={(e) => setForwardEmail(e.target.value)}
                                                    placeholder="수신자 이메일 주소 (예: customs@example.com)" 
                                                    className="flex-1 px-3 h-10 rounded-lg border border-gray-300 text-[13px] outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-shadow bg-white"
                                                    disabled={forwarding}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && forwardEmail && !forwarding) {
                                                            handleForwardEmail(selectedEmail.uid)
                                                        }
                                                    }}
                                                />
                                                <button
                                                    onClick={() => handleForwardEmail(selectedEmail.uid)}
                                                    disabled={forwarding || !forwardEmail.includes('@')}
                                                    className="px-5 h-10 rounded-lg bg-orange-600 text-white font-bold text-[13px] hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm whitespace-nowrap"
                                                >
                                                    {forwarding ? <Loader2 size={14} className="animate-spin" /> : null}
                                                    {forwarding ? '전송중...' : '해당 양식으로 전달'}
                                                </button>
                                            </div>
                                            {forwardError && <p className="text-[12px] font-bold text-red-500">{forwardError}</p>}
                                            {forwardSuccess && <p className="text-[12px] font-bold text-emerald-600">{forwardSuccess}</p>}
                                        </div>
                                    </div>
                                    {/* 메일 본문 내용 */}
                                    <div className="p-6 overflow-y-auto bg-white flex-1 text-[14px]">
                                        {loadingEmailDetail && !selectedEmail.text ? (
                                            <div className="w-full h-full min-h-[220px] flex items-center justify-center text-slate-400 font-medium">
                                                <Loader2 size={16} className="animate-spin mr-2" />
                                                메일 본문을 불러오는 중...
                                            </div>
                                        ) : (
                                            <div 
                                                className="w-full text-gray-800 break-words leading-relaxed max-w-none"
                                                style={{ whiteSpace: selectedEmail.text.includes('<html') ? 'normal' : 'pre-wrap' }}
                                                dangerouslySetInnerHTML={{ __html: selectedEmail.text || '' }} 
                                            />
                                        )}
                                    </div>
                                </div>
                            )
                        })()}
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-[11px] font-bold text-[#e34219] uppercase tracking-[0.2em]">UNI-PASS API001</p>
                        <h3 className="text-lg font-black text-[#111827]">화물통관진행정보 조회 (B/L)</h3>
                        <p className="text-xs text-gray-500 mt-1">
                            B/L 번호만 입력하면 MBL/HBL + 최근 3개년을 자동으로 시도해 조회합니다.
                        </p>
                    </div>
                    <Search size={18} className="text-[#e34219] mt-1" />
                </div>

                <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <input
                        type="text"
                        value={blNumberQuery}
                        onChange={(event) => setBlNumberQuery(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' && !customsProgressLoading) {
                                handleCustomsProgressSearch()
                            }
                        }}
                        placeholder="B/L 번호 입력 (예: 94000499505)"
                        className="flex-1 h-11 px-3 rounded-lg border border-gray-300 text-[#111827] font-medium"
                    />
                    <button
                        type="button"
                        onClick={handleCustomsProgressSearch}
                        disabled={customsProgressLoading}
                        className="h-11 px-6 bg-[#e34219] hover:bg-[#cd3b17] text-white rounded-lg font-bold text-sm tracking-wide disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                    >
                        {customsProgressLoading ? (
                            <>
                                <Loader2 size={15} className="animate-spin" />
                                조회중...
                            </>
                        ) : (
                            '조회하기'
                        )}
                    </button>
                </div>

                {customsProgressError && (
                    <p className="text-sm font-semibold text-[#e34219]">{customsProgressError}</p>
                )}

                {customsProgressResult && (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-4">
                        <div className="text-xs text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                            <span><span className="font-bold text-gray-800">B/L:</span> {customsProgressResult.blNo}</span>
                            <span><span className="font-bold text-gray-800">조회조건:</span> {customsProgressResult.query.kind} / {customsProgressResult.query.blYy}</span>
                            <span><span className="font-bold text-gray-800">결과건수(tCnt):</span> {customsProgressResult.tCnt}</span>
                        </div>

                        {customsProgressResult.ntceInfo && (
                            <p className="text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
                                {customsProgressResult.ntceInfo}
                            </p>
                        )}

                        {firstSummary && (
                            <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
                                <h4 className="text-sm font-black text-[#111827]">요약정보</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                    <div><span className="font-bold text-gray-700">화물관리번호:</span> {firstSummary.cargMtNo || '-'}</div>
                                    <div><span className="font-bold text-gray-700">진행상태:</span> {firstSummary.prgsStts || '-'}</div>
                                    <div><span className="font-bold text-gray-700">통관진행상태:</span> {firstSummary.csclPrgsStts || '-'}</div>
                                    <div><span className="font-bold text-gray-700">처리일시:</span> {formatYmdOrYmdHm(firstSummary.prcsDttm)}</div>
                                    <div><span className="font-bold text-gray-700">MBL:</span> {firstSummary.mblNo || '-'}</div>
                                    <div><span className="font-bold text-gray-700">HBL:</span> {firstSummary.hblNo || '-'}</div>
                                    <div><span className="font-bold text-gray-700">양륙항:</span> {firstSummary.dsprNm || '-'}</div>
                                    <div><span className="font-bold text-gray-700">입항일자:</span> {formatYmdOrYmdHm(firstSummary.etprDt)}</div>
                                    <div><span className="font-bold text-gray-700">선박/항공편:</span> {firstSummary.shipNm || '-'}</div>
                                    <div><span className="font-bold text-gray-700">품명:</span> {firstSummary.prnm || '-'}</div>
                                </div>
                            </div>
                        )}

                        {detailRows.length > 0 && (
                            <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
                                <h4 className="text-sm font-black text-[#111827]">진행이력</h4>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-xs">
                                        <thead>
                                            <tr className="bg-gray-100 text-gray-700">
                                                <th className="text-left px-2 py-2 font-bold">처리일시</th>
                                                <th className="text-left px-2 py-2 font-bold">처리구분</th>
                                                <th className="text-left px-2 py-2 font-bold">반출입내용</th>
                                                <th className="text-left px-2 py-2 font-bold">신고번호</th>
                                                <th className="text-left px-2 py-2 font-bold">장치장</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {detailRows.map((row, index) => (
                                                <tr key={`${row.prcsDttm || 'row'}-${index}`} className="border-t border-gray-100 text-gray-800">
                                                    <td className="px-2 py-2">{formatYmdOrYmdHm(row.prcsDttm)}</td>
                                                    <td className="px-2 py-2">{row.cargTrcnRelaBsopTpcd || '-'}</td>
                                                    <td className="px-2 py-2">{row.rlbrCn || '-'}</td>
                                                    <td className="px-2 py-2">{row.dclrNo || '-'}</td>
                                                    <td className="px-2 py-2">{row.shedNm || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
