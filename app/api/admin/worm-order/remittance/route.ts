import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { MoinAutomationCanceledError, MoinAutomationError, submitMoinRemittance } from '@/lib/moinBizplus'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024
const AUTH_FAILURE_THRESHOLD = 2
const AUTH_LOCK_MINUTES = 15
const AUTH_LOCK_MS = AUTH_LOCK_MINUTES * 60 * 1000
const AUTH_FAILURE_RESET_MS = 60 * 60 * 1000

type RemittanceAuthGuardEntry = {
    failedCount: number
    lastFailedAt: number
    lockedUntil: number | null
}

type RemittanceRunningJob = {
    credentialKey: string
    orderId: string
    startedAt: number
    abortController: AbortController
}

type RemittanceAuthGuardState = {
    inFlight: Set<string>
    failures: Map<string, RemittanceAuthGuardEntry>
    runningJobsByCredential: Map<string, RemittanceRunningJob>
    runningJobsByOrderId: Map<string, RemittanceRunningJob>
}

const globalRemittanceGuard = globalThis as typeof globalThis & {
    wormRemittanceAuthGuard?: RemittanceAuthGuardState
}

const readString = (value: FormDataEntryValue | null) => {
    if (typeof value === 'string') return value.trim()
    return ''
}

const normalizeSummaryText = (value: string) => {
    const normalized = value.trim()
    return normalized ? normalized : null
}

const formatSummaryAmount = (rawAmount: string, currency: 'USD' | 'KRW') => {
    const normalizedNumber = Number(String(rawAmount).replace(/,/g, ''))
    if (!Number.isFinite(normalizedNumber)) return null
    const formatted = currency === 'USD'
        ? normalizedNumber.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : normalizedNumber.toLocaleString('en-US', { maximumFractionDigits: 0 })
    return `${formatted} ${currency}`
}

const extractSummaryAmountFromBlob = (
    blob: string | null,
    pattern: RegExp,
    currency: 'USD' | 'KRW',
) => {
    if (!blob) return null
    const match = blob.match(pattern)
    const rawAmount = match?.[1]
    if (!rawAmount) return null
    return formatSummaryAmount(rawAmount, currency)
}

const extractSummaryRateFromBlob = (blob: string | null) => {
    if (!blob) return null
    const match = blob.match(/1\s*USD\s*=\s*([0-9,]+(?:\.\d+)?)\s*(?:KRW|원)/i)
    const rawAmount = match?.[1]
    if (!rawAmount) return null
    const normalizedNumber = Number(String(rawAmount).replace(/,/g, ''))
    if (!Number.isFinite(normalizedNumber)) return null
    return `1 USD = ${normalizedNumber.toLocaleString('en-US', { maximumFractionDigits: 4 })} KRW`
}

const parseSummaryNumber = (value: string | null, mode: 'default' | 'rate' = 'default') => {
    if (!value) return null
    const matches = value.match(/-?\d[\d,]*(?:\.\d+)?/g)
    if (!matches || matches.length === 0) return null
    const candidate = mode === 'rate' ? matches[matches.length - 1] : matches[0]
    const parsed = Number(candidate.replace(/,/g, ''))
    return Number.isFinite(parsed) ? parsed : null
}

type SummaryCurrency = 'krw' | 'usd' | 'any'

const parseSummaryAmountByCurrency = (value: string | null, currency: SummaryCurrency) => {
    if (!value) return null
    const tokenRegex = /-?\d[\d,]*(?:\.\d+)?/g
    const usdMarkerRegex = /US\$|USD/i
    const krwMarkerRegex = /KRW|\u20A9|\uC6D0/i
    const candidates: Array<{ amount: number; currency: SummaryCurrency }> = []
    let match: RegExpExecArray | null = null

    while ((match = tokenRegex.exec(value)) !== null) {
        const numeric = Number((match[0] || '').replace(/,/g, ''))
        if (!Number.isFinite(numeric)) continue

        const start = match.index
        const end = start + match[0].length
        const contextStart = Math.max(0, start - 8)
        const contextEnd = Math.min(value.length, end + 8)
        const marker = value.slice(contextStart, contextEnd)
        const inferredCurrency: SummaryCurrency =
            usdMarkerRegex.test(marker)
                ? 'usd'
                : krwMarkerRegex.test(marker)
                    ? 'krw'
                    : 'any'

        candidates.push({ amount: numeric, currency: inferredCurrency })
    }

    if (candidates.length === 0) return null
    if (currency === 'any') return candidates[0]?.amount ?? null

    const exact = candidates.find((candidate) => candidate.currency === currency)
    if (exact) return exact.amount
    return null
}

const pickPlausibleKrwAmount = (
    candidates: Array<number | null>,
    expected: number | null,
) => {
    const normalized = candidates
        .filter((candidate): candidate is number => candidate !== null && Number.isFinite(candidate) && candidate > 0)

    if (normalized.length === 0) return expected
    if (expected === null || !Number.isFinite(expected) || expected <= 0) return normalized[0]

    const plausible = normalized.filter((candidate) => {
        const ratio = candidate / expected
        return ratio >= 0.75 && ratio <= 1.35
    })

    if (plausible.length > 0) {
        return plausible.sort((a, b) => Math.abs(a - expected) - Math.abs(b - expected))[0]
    }

    return expected
}

const getRemittanceGuardState = (): RemittanceAuthGuardState => {
    if (!globalRemittanceGuard.wormRemittanceAuthGuard) {
        globalRemittanceGuard.wormRemittanceAuthGuard = {
            inFlight: new Set<string>(),
            failures: new Map<string, RemittanceAuthGuardEntry>(),
            runningJobsByCredential: new Map<string, RemittanceRunningJob>(),
            runningJobsByOrderId: new Map<string, RemittanceRunningJob>(),
        }
    }
    return globalRemittanceGuard.wormRemittanceAuthGuard
}

const normalizeCredentialKey = (loginId: string) => loginId.trim().toLowerCase()
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

const resolveActiveLock = (entry: RemittanceAuthGuardEntry | undefined, now: number) => {
    if (!entry?.lockedUntil) return null
    if (entry.lockedUntil <= now) return null
    return entry.lockedUntil
}

const isAuthRelatedAutomationError = (error: MoinAutomationError) => {
    const combined = `${error.step} ${error.message}`.toLowerCase()
    return (
        combined.includes('login failed') ||
        combined.includes('password') ||
        combined.includes('account locked') ||
        combined.includes('locked') ||
        combined.includes('credential')
    )
}

const registerAuthFailure = (state: RemittanceAuthGuardState, credentialKey: string, now: number) => {
    const prev = state.failures.get(credentialKey)
    const shouldReset = !prev || now - prev.lastFailedAt > AUTH_FAILURE_RESET_MS

    const nextFailedCount = shouldReset ? 1 : prev.failedCount + 1
    const lockedUntil = nextFailedCount >= AUTH_FAILURE_THRESHOLD ? now + AUTH_LOCK_MS : null
    const entry: RemittanceAuthGuardEntry = {
        failedCount: nextFailedCount,
        lastFailedAt: now,
        lockedUntil,
    }

    state.failures.set(credentialKey, entry)
    return entry
}

const clearAuthFailure = (state: RemittanceAuthGuardState, credentialKey: string) => {
    state.failures.delete(credentialKey)
}

export async function DELETE(request: Request) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const guardState = getRemittanceGuardState()
    const { searchParams } = new URL(request.url)
    const orderIdRaw = readString(searchParams.get('orderId'))
    const moinLoginId = (process.env.MOIN_BIZPLUS_LOGIN_ID || '').trim()

    let runningJob: RemittanceRunningJob | null = null
    if (orderIdRaw && isUuid(orderIdRaw)) {
        runningJob = guardState.runningJobsByOrderId.get(orderIdRaw) || null
    }

    if (!runningJob && moinLoginId) {
        const credentialKey = normalizeCredentialKey(moinLoginId)
        runningJob = guardState.runningJobsByCredential.get(credentialKey) || null
    }

    if (!runningJob) {
        return NextResponse.json({
            ok: true,
            canceled: false,
            message: '현재 진행 중인 송금 신청이 없습니다.',
        })
    }

    runningJob.abortController.abort()
    return NextResponse.json({
        ok: true,
        canceled: true,
        message: '송금 신청 취소 요청을 접수했습니다.',
        orderId: runningJob.orderId,
    })
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const formData = await request.formData()

        const moinLoginId = (process.env.MOIN_BIZPLUS_LOGIN_ID || '').trim()
        const moinPassword = process.env.MOIN_BIZPLUS_LOGIN_PASSWORD || ''
        const amountRaw = readString(formData.get('amountUsd'))
        const orderIdRaw = readString(formData.get('orderId'))
        const invoicePdf = formData.get('invoicePdf')

        if (!moinLoginId || !moinPassword) {
            return NextResponse.json(
                { error: 'Server is not configured: set MOIN_BIZPLUS_LOGIN_ID and MOIN_BIZPLUS_LOGIN_PASSWORD.' },
                { status: 500 }
            )
        }

        if (moinPassword.startsWith(' ') || moinPassword.endsWith(' ')) {
            return NextResponse.json(
                { error: 'Password has leading or trailing spaces. Please remove them and try again.' },
                { status: 400 }
            )
        }

        const parsedAmount = Number(amountRaw.replace(/,/g, ''))
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            return NextResponse.json({ error: 'Valid USD amount is required.' }, { status: 400 })
        }

        if (!(invoicePdf instanceof File)) {
            return NextResponse.json({ error: 'Invoice PDF file is required.' }, { status: 400 })
        }

        const isPdf = invoicePdf.type === 'application/pdf' || invoicePdf.name.toLowerCase().endsWith('.pdf')
        if (!isPdf) {
            return NextResponse.json({ error: 'Only PDF file is supported for invoice.' }, { status: 400 })
        }

        if (invoicePdf.size > MAX_PDF_SIZE_BYTES) {
            return NextResponse.json(
                { error: 'Invoice PDF is too large. Maximum size is 10MB.' },
                { status: 400 }
            )
        }

        if (!orderIdRaw || !isUuid(orderIdRaw)) {
            return NextResponse.json(
                { error: '발주리스트에서 유효한 발주를 선택한 뒤 다시 시도해 주세요.' },
                { status: 400 }
            )
        }

        let targetOrder:
            | {
                id: string
                orderNumber: string
                status: string
                remittanceAppliedAt: Date | null
                remittanceFinalReceiveAmountText: string | null
                remittanceSendAmountText: string | null
                remittanceTotalFeeText: string | null
                remittanceExchangeRateText: string | null
              }
            | null = null

        targetOrder = await prisma.wormOrder.findUnique({
            where: { id: orderIdRaw },
            select: {
                id: true,
                orderNumber: true,
                status: true,
                remittanceAppliedAt: true,
                remittanceFinalReceiveAmountText: true,
                remittanceSendAmountText: true,
                remittanceTotalFeeText: true,
                remittanceExchangeRateText: true,
            },
        })

        if (!targetOrder) {
            return NextResponse.json(
                { error: '송금 신청 대상 발주를 찾지 못했습니다. 발주리스트에서 다시 선택해 주세요.' },
                { status: 400 }
            )
        }

        if (targetOrder.status === 'REMITTANCE_APPLIED' || targetOrder.remittanceAppliedAt) {
            return NextResponse.json(
                {
                    error: `이미 송금 신청이 완료된 발주입니다 (${targetOrder.orderNumber}).`,
                    alreadyApplied: true,
                    order: targetOrder,
                },
                { status: 409 }
            )
        }

        const guardState = getRemittanceGuardState()
        const credentialKey = normalizeCredentialKey(moinLoginId)
        const now = Date.now()
        const existingEntry = guardState.failures.get(credentialKey)
        const activeLock = resolveActiveLock(existingEntry, now)
        if (activeLock) {
            return NextResponse.json(
                {
                    error: `Temporary lock is active for this account due to repeated login failures. Retry after ${new Date(activeLock).toLocaleString('ko-KR')}.`,
                    authFailure: true,
                    locked: true,
                    lockedUntil: new Date(activeLock).toISOString(),
                },
                { status: 429 }
            )
        }

        if (guardState.inFlight.has(credentialKey)) {
            return NextResponse.json(
                { error: 'A remittance request is already in progress for this login ID. Please wait.' },
                { status: 409 }
            )
        }

        const runningByOrder = guardState.runningJobsByOrderId.get(targetOrder.id)
        if (runningByOrder) {
            return NextResponse.json(
                { error: `해당 발주는 이미 송금 신청이 진행 중입니다. (${targetOrder.orderNumber})` },
                { status: 409 }
            )
        }

        const runningJob: RemittanceRunningJob = {
            credentialKey,
            orderId: targetOrder.id,
            startedAt: Date.now(),
            abortController: new AbortController(),
        }

        guardState.inFlight.add(credentialKey)
        guardState.runningJobsByCredential.set(credentialKey, runningJob)
        guardState.runningJobsByOrderId.set(targetOrder.id, runningJob)

        const invoiceBuffer = Buffer.from(await invoicePdf.arrayBuffer())
        try {
            const result = await submitMoinRemittance({
                loginId: moinLoginId,
                loginPassword: moinPassword,
                amountUsd: parsedAmount.toFixed(2),
                invoiceFileName: invoicePdf.name || 'invoice.pdf',
                invoiceMimeType: invoicePdf.type || 'application/pdf',
                invoiceBuffer,
                headless: process.env.MOIN_BIZPLUS_HEADLESS !== 'false',
                abortSignal: runningJob.abortController.signal,
            })

            clearAuthFailure(guardState, credentialKey)

            const pricingSummary = result.pricingSummary
            let savedOrder:
                | {
                    id: string
                    orderNumber: string
                    status: string
                    remittanceAppliedAt: Date | null
                    remittanceFinalReceiveAmountText: string | null
                    remittanceSendAmount: number | null
                    remittanceSendAmountText: string | null
                    remittanceTotalFee: number | null
                    remittanceTotalFeeText: string | null
                    remittanceExchangeRate: number | null
                    remittanceExchangeRateText: string | null
                    updatedAt: Date
                  }
                | null = null
            let saveWarning: string | null = null

            try {
                const pricingBlob = [
                    pricingSummary?.finalReceiveAmount || '',
                    pricingSummary?.sendAmount || '',
                    pricingSummary?.totalFee || '',
                    pricingSummary?.exchangeRate || '',
                ]
                    .map((value) => String(value || '').trim())
                    .filter(Boolean)
                    .join(' ')

                const extractedFinalReceiveAmountText = extractSummaryAmountFromBlob(
                    pricingBlob,
                    /([0-9,]+(?:\.\d+)?)\s*(?:USD|US\$)\s*보내는\s*돈/i,
                    'USD'
                )
                const extractedSendAmountText = extractSummaryAmountFromBlob(
                    pricingBlob,
                    /보내는\s*돈\s*([0-9,]+(?:\.\d+)?)\s*(?:KRW|원)/i,
                    'KRW'
                )
                const extractedTotalFeeText = extractSummaryAmountFromBlob(
                    pricingBlob,
                    /총\s*수수료\s*([0-9,]+(?:\.\d+)?)\s*(?:KRW|원)/i,
                    'KRW'
                )
                const extractedExchangeRateText = extractSummaryRateFromBlob(pricingBlob)

                const finalReceiveAmountText = normalizeSummaryText(
                    extractedFinalReceiveAmountText || pricingSummary?.finalReceiveAmount || ''
                )
                const sendAmountText = normalizeSummaryText(
                    extractedSendAmountText || pricingSummary?.sendAmount || ''
                )
                const totalFeeText = normalizeSummaryText(
                    extractedTotalFeeText || pricingSummary?.totalFee || ''
                )
                const exchangeRateText = normalizeSummaryText(
                    extractedExchangeRateText || pricingSummary?.exchangeRate || ''
                )
                const exchangeRateNumber = parseSummaryNumber(exchangeRateText, 'rate')
                const normalizedFinalReceiveAmountText = finalReceiveAmountText || `${parsedAmount.toFixed(2)} USD`
                const expectedOriginKrw =
                    exchangeRateNumber && exchangeRateNumber > 0
                        ? Math.round(parsedAmount * exchangeRateNumber)
                        : null
                const sendAmountKrw =
                    parseSummaryAmountByCurrency(sendAmountText, 'krw') ??
                    pickPlausibleKrwAmount([], expectedOriginKrw)
                const totalFeeKrw = parseSummaryAmountByCurrency(totalFeeText, 'krw')

                const normalizedSendAmountText = sendAmountKrw !== null
                    ? formatSummaryAmount(String(sendAmountKrw), 'KRW')
                    : sendAmountText
                const normalizedTotalFeeText = totalFeeKrw !== null
                    ? formatSummaryAmount(String(totalFeeKrw), 'KRW')
                    : totalFeeText

                savedOrder = await prisma.wormOrder.update({
                    where: { id: targetOrder.id },
                    data: {
                        status: 'REMITTANCE_APPLIED',
                        remittanceAppliedAt: new Date(result.completedAt),
                        remittanceFinalReceiveAmountText: normalizedFinalReceiveAmountText,
                        remittanceFinalReceiveAmount: parseSummaryAmountByCurrency(normalizedFinalReceiveAmountText, 'usd') ?? parseSummaryNumber(normalizedFinalReceiveAmountText, 'default'),
                        remittanceSendAmountText: normalizedSendAmountText,
                        remittanceSendAmount: sendAmountKrw,
                        remittanceTotalFeeText: normalizedTotalFeeText,
                        remittanceTotalFee: totalFeeKrw,
                        remittanceExchangeRateText: exchangeRateText,
                        remittanceExchangeRate: exchangeRateNumber,
                    },
                    select: {
                        id: true,
                        orderNumber: true,
                        status: true,
                        remittanceAppliedAt: true,
                        remittanceFinalReceiveAmountText: true,
                        remittanceSendAmount: true,
                        remittanceSendAmountText: true,
                        remittanceTotalFee: true,
                        remittanceTotalFeeText: true,
                        remittanceExchangeRate: true,
                        remittanceExchangeRateText: true,
                        updatedAt: true,
                    },
                })
            } catch (saveError) {
                console.error('Failed to persist worm remittance summary:', saveError)
                saveWarning = '송금 신청은 완료되었지만 발주 DB 저장에 실패했습니다.'
            }

            return NextResponse.json({
                ok: true,
                message: 'Remittance application completed.',
                result,
                savedOrder,
                saveWarning,
            })
        } catch (error) {
            if (error instanceof MoinAutomationCanceledError) {
                return NextResponse.json(
                    {
                        error: '송금 신청이 사용자 요청으로 취소되었습니다.',
                        canceled: true,
                    },
                    { status: 409 }
                )
            }

            if (error instanceof MoinAutomationError) {
                if (isAuthRelatedAutomationError(error)) {
                    const failure = registerAuthFailure(guardState, credentialKey, Date.now())
                    const attemptsRemaining = Math.max(0, AUTH_FAILURE_THRESHOLD - failure.failedCount)
                    const lockActive = typeof failure.lockedUntil === 'number' && failure.lockedUntil > Date.now()

                    return NextResponse.json(
                        {
                            error: `${error.step}: ${error.message}`,
                            authFailure: true,
                            attemptsRemaining,
                            locked: lockActive,
                            lockedUntil: lockActive ? new Date(failure.lockedUntil!).toISOString() : null,
                        },
                        { status: lockActive ? 429 : 401 }
                    )
                }

                return NextResponse.json(
                    {
                        error: `${error.step}: ${error.message}`,
                    },
                    { status: 502 }
                )
            }

            console.error('Failed to apply MOIN remittance:', error)
            const detail = error instanceof Error ? error.message : 'Unknown error'
            return NextResponse.json(
                {
                    error: `Failed to complete remittance automation: ${detail}`,
                },
                { status: 500 }
            )
        } finally {
            guardState.runningJobsByCredential.delete(credentialKey)
            guardState.runningJobsByOrderId.delete(targetOrder.id)
            guardState.inFlight.delete(credentialKey)
        }
    } catch (error) {
        console.error('Failed to apply MOIN remittance:', error)
        const detail = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json(
            {
                error: `Failed to complete remittance automation: ${detail}`,
            },
            { status: 500 }
        )
    }
}
