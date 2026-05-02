import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
    MoinAutomationCanceledError,
    MoinAutomationError,
    fetchMoinRemittanceHistory,
} from '@/lib/moinBizplus'
import { prisma } from '@/lib/prisma'
import {
    extractSummaryAmountFromBlob,
    extractSummaryRateFromBlob,
    formatSummaryAmount,
    normalizeSummaryText,
    parseSummaryAmountByCurrency,
    parseSummaryNumber,
} from '@/lib/wormRemittanceSummary'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const TARGET_RECIPIENT_HINT = 'Shanghai Oikki Trading'

const isUuid = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

const formatKstYmd = (date: Date) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date)
    const year = parts.find((p) => p.type === 'year')?.value ?? '0000'
    const month = parts.find((p) => p.type === 'month')?.value ?? '00'
    const day = parts.find((p) => p.type === 'day')?.value ?? '00'
    return `${year}-${month}-${day}`
}

const isCompleteRemittanceSummary = (
    finalReceiveAmountUsd: number | null,
    sendAmountKrw: number | null,
    totalFeeKrw: number | null,
    exchangeRateNumber: number | null,
) => (
    finalReceiveAmountUsd !== null &&
    sendAmountKrw !== null &&
    totalFeeKrw !== null &&
    exchangeRateNumber !== null &&
    Number.isFinite(finalReceiveAmountUsd) &&
    Number.isFinite(sendAmountKrw) &&
    Number.isFinite(totalFeeKrw) &&
    Number.isFinite(exchangeRateNumber)
)

export async function POST(request: Request) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const moinLoginId = (process.env.MOIN_BIZPLUS_LOGIN_ID || '').trim()
    const moinPassword = process.env.MOIN_BIZPLUS_LOGIN_PASSWORD || ''
    if (!moinLoginId || !moinPassword) {
        return NextResponse.json(
            { error: 'Server is not configured: set MOIN_BIZPLUS_LOGIN_ID and MOIN_BIZPLUS_LOGIN_PASSWORD.' },
            { status: 500 },
        )
    }

    const url = new URL(request.url)
    const debug = url.searchParams.get('debug') === '1' || process.env.NODE_ENV !== 'production'

    try {
        const body = await request.json().catch(() => ({}))
        const orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : ''
        const targetDateInput = typeof body?.targetDate === 'string' ? body.targetDate.trim() : ''
        const transactionIdInput = typeof body?.transactionId === 'string' ? body.transactionId.trim() : ''

        if (!orderId || !isUuid(orderId)) {
            return NextResponse.json({ error: '유효한 발주 ID를 전달해 주세요.' }, { status: 400 })
        }

        const order = await prisma.wormOrder.findUnique({
            where: { id: orderId },
            select: {
                id: true,
                orderNumber: true,
                status: true,
                receiveDate: true,
                createdAt: true,
            },
        })

        if (!order) {
            return NextResponse.json({ error: '발주를 찾을 수 없습니다.' }, { status: 404 })
        }

        const targetDate = targetDateInput || formatKstYmd(order.receiveDate || order.createdAt)

        const result = await fetchMoinRemittanceHistory({
            loginId: moinLoginId,
            loginPassword: moinPassword,
            targetDate,
            recipientHint: TARGET_RECIPIENT_HINT,
            targetTransactionId: transactionIdInput || null,
            headless: process.env.MOIN_BIZPLUS_HEADLESS !== 'false',
        })

        if (!result.matched || !result.matchedSummary) {
            return NextResponse.json(
                {
                    ok: false,
                    error: '일치하는 송금 내역을 자동으로 찾지 못했습니다. 아래 후보에서 직접 선택하거나 직접 입력 버튼으로 등록해 주세요.',
                    items: result.items,
                    steps: debug ? result.steps : undefined,
                    diagnostic: debug ? result.diagnostic : undefined,
                    matchStrategy: result.matchStrategy,
                },
                { status: 404 },
            )
        }

        const summary = result.matchedSummary
        const pricingBlob = [summary.finalReceiveAmount, summary.sendAmount, summary.totalFee, summary.exchangeRate]
            .map((value) => String(value || '').trim())
            .filter(Boolean)
            .join(' ')

        const extractedFinalReceiveAmountText = extractSummaryAmountFromBlob(
            pricingBlob,
            /([0-9,]+(?:\.\d+)?)\s*(?:USD|US\$)/i,
            'USD',
        )
        const extractedSendAmountText = extractSummaryAmountFromBlob(
            pricingBlob,
            /([0-9,]+(?:\.\d+)?)\s*(?:KRW|원)/i,
            'KRW',
        )
        const extractedTotalFeeText = extractSummaryAmountFromBlob(
            pricingBlob,
            /수수료\s*([0-9,]+(?:\.\d+)?)\s*(?:KRW|원)/i,
            'KRW',
        )
        const extractedExchangeRateText = extractSummaryRateFromBlob(pricingBlob)

        const finalReceiveAmountText = normalizeSummaryText(
            extractedFinalReceiveAmountText || summary.finalReceiveAmount || '',
        )
        const sendAmountText = normalizeSummaryText(extractedSendAmountText || summary.sendAmount || '')
        const totalFeeText = normalizeSummaryText(extractedTotalFeeText || summary.totalFee || '')
        const exchangeRateText = normalizeSummaryText(extractedExchangeRateText || summary.exchangeRate || '')

        const exchangeRateNumber = parseSummaryNumber(exchangeRateText, 'rate')
        const finalReceiveAmountUsd =
            parseSummaryAmountByCurrency(finalReceiveAmountText, 'usd') ??
            parseSummaryNumber(finalReceiveAmountText, 'default')
        const sendAmountKrw = parseSummaryAmountByCurrency(sendAmountText, 'krw')
        const totalFeeKrw = parseSummaryAmountByCurrency(totalFeeText, 'krw')

        const normalizedSendAmountText =
            sendAmountKrw !== null ? formatSummaryAmount(String(sendAmountKrw), 'KRW') : sendAmountText
        const normalizedTotalFeeText =
            totalFeeKrw !== null ? formatSummaryAmount(String(totalFeeKrw), 'KRW') : totalFeeText
        const normalizedFinalReceiveAmountText =
            finalReceiveAmountUsd !== null
                ? formatSummaryAmount(String(finalReceiveAmountUsd), 'USD')
                : finalReceiveAmountText

        if (!isCompleteRemittanceSummary(finalReceiveAmountUsd, sendAmountKrw, totalFeeKrw, exchangeRateNumber)) {
            return NextResponse.json(
                {
                    ok: false,
                    error: '송금 내역에서 총 송금액, 총 송금 한화, 총 수수료, 환율정보를 모두 가져오지 못했습니다. 다시 자동 가져오기를 시도하거나 후보 선택/직접 입력으로 보완해 주세요.',
                    incomplete: true,
                    missingFields: {
                        finalReceiveAmount: finalReceiveAmountUsd === null,
                        sendAmount: sendAmountKrw === null,
                        totalFee: totalFeeKrw === null,
                        exchangeRate: exchangeRateNumber === null,
                    },
                    parsedSummary: {
                        finalReceiveAmount: normalizedFinalReceiveAmountText,
                        sendAmount: normalizedSendAmountText,
                        totalFee: normalizedTotalFeeText,
                        exchangeRate: exchangeRateText,
                    },
                    items: result.items,
                    steps: debug ? result.steps : undefined,
                    diagnostic: debug ? result.diagnostic : undefined,
                    matchStrategy: result.matchStrategy,
                },
                { status: 422 },
            )
        }

        const remittanceAppliedAt = result.matchedAppliedAtIso
            ? new Date(result.matchedAppliedAtIso)
            : new Date()

        const updated = await prisma.wormOrder.update({
            where: { id: order.id },
            data: {
                status: 'REMITTANCE_APPLIED',
                remittanceAppliedAt,
                remittanceFinalReceiveAmount: finalReceiveAmountUsd,
                remittanceFinalReceiveAmountText: normalizedFinalReceiveAmountText,
                remittanceSendAmount: sendAmountKrw,
                remittanceSendAmountText: normalizedSendAmountText,
                remittanceTotalFee: totalFeeKrw,
                remittanceTotalFeeText: normalizedTotalFeeText,
                remittanceExchangeRate: exchangeRateNumber,
                remittanceExchangeRateText: exchangeRateText,
            },
            select: {
                id: true,
                orderNumber: true,
                status: true,
                remittanceAppliedAt: true,
                remittanceFinalReceiveAmount: true,
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

        return NextResponse.json({
            ok: true,
            message: '모인 거래내역에서 송금 정보를 가져와 저장했습니다.',
            savedOrder: updated,
            matched: result.matched,
            matchStrategy: result.matchStrategy,
            steps: debug ? result.steps : undefined,
        })
    } catch (error) {
        if (error instanceof MoinAutomationCanceledError) {
            return NextResponse.json(
                { error: '송금 정보 가져오기가 취소되었습니다.' },
                { status: 409 },
            )
        }
        if (error instanceof MoinAutomationError) {
            return NextResponse.json(
                { error: `${error.step}: ${error.message}` },
                { status: 502 },
            )
        }
        console.error('Failed to import worm remittance history:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to import remittance history' },
            { status: 500 },
        )
    }
}
