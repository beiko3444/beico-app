import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { MoinAutomationError, submitMoinRemittance } from '@/lib/moinBizplus'

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

type RemittanceAuthGuardState = {
    inFlight: Set<string>
    failures: Map<string, RemittanceAuthGuardEntry>
}

const globalRemittanceGuard = globalThis as typeof globalThis & {
    wormRemittanceAuthGuard?: RemittanceAuthGuardState
}

const readString = (value: FormDataEntryValue | null) => {
    if (typeof value === 'string') return value.trim()
    return ''
}

const getRemittanceGuardState = (): RemittanceAuthGuardState => {
    if (!globalRemittanceGuard.wormRemittanceAuthGuard) {
        globalRemittanceGuard.wormRemittanceAuthGuard = {
            inFlight: new Set<string>(),
            failures: new Map<string, RemittanceAuthGuardEntry>(),
        }
    }
    return globalRemittanceGuard.wormRemittanceAuthGuard
}

const normalizeCredentialKey = (loginId: string) => loginId.trim().toLowerCase()

const resolveActiveLock = (entry: RemittanceAuthGuardEntry | undefined, now: number) => {
    if (!entry?.lockedUntil) return null
    if (entry.lockedUntil <= now) return null
    return entry.lockedUntil
}

const isAuthRelatedAutomationError = (error: MoinAutomationError) => {
    const combined = `${error.step} ${error.message}`.toLowerCase()
    return (
        combined.includes('login failed') ||
        combined.includes('비밀번호') ||
        combined.includes('잠금') ||
        combined.includes('계정') ||
        combined.includes('로그인')
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

        guardState.inFlight.add(credentialKey)

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
            })

            clearAuthFailure(guardState, credentialKey)

            return NextResponse.json({
                ok: true,
                message: 'Remittance application completed.',
                result,
            })
        } catch (error) {
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
