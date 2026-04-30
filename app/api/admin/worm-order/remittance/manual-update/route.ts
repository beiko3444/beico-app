import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatSummaryAmount } from '@/lib/wormRemittanceSummary'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const isUuid = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

const toFiniteNumber = (value: unknown) => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null
    if (typeof value !== 'string') return null
    const cleaned = value.trim().replace(/[, ₩$₩원]/g, '').replace(/USD$|KRW$/i, '').trim()
    if (!cleaned) return null
    const parsed = Number(cleaned)
    return Number.isFinite(parsed) ? parsed : null
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await request.json().catch(() => ({}))
        const orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : ''
        if (!orderId || !isUuid(orderId)) {
            return NextResponse.json({ error: '유효한 발주 ID를 전달해 주세요.' }, { status: 400 })
        }

        const finalReceiveAmountUsd = toFiniteNumber(body?.finalReceiveAmountUsd)
        const sendAmountKrw = toFiniteNumber(body?.sendAmountKrw)
        const totalFeeKrw = toFiniteNumber(body?.totalFeeKrw)
        const exchangeRate = toFiniteNumber(body?.exchangeRate)
        const appliedAtRaw = typeof body?.appliedAt === 'string' ? body.appliedAt.trim() : ''

        let appliedAt: Date | null = null
        if (appliedAtRaw) {
            const parsed = new Date(appliedAtRaw)
            if (Number.isNaN(parsed.getTime())) {
                return NextResponse.json({ error: '신청시각 형식이 올바르지 않습니다.' }, { status: 400 })
            }
            appliedAt = parsed
        }

        if (
            finalReceiveAmountUsd === null &&
            sendAmountKrw === null &&
            totalFeeKrw === null &&
            exchangeRate === null &&
            !appliedAt
        ) {
            return NextResponse.json(
                { error: '저장할 값이 없습니다. 최소 한 가지 값을 입력해 주세요.' },
                { status: 400 },
            )
        }

        const order = await prisma.wormOrder.findUnique({
            where: { id: orderId },
            select: { id: true },
        })
        if (!order) {
            return NextResponse.json({ error: '발주를 찾을 수 없습니다.' }, { status: 404 })
        }

        const finalReceiveAmountText =
            finalReceiveAmountUsd !== null ? formatSummaryAmount(String(finalReceiveAmountUsd), 'USD') : null
        const sendAmountText = sendAmountKrw !== null ? formatSummaryAmount(String(sendAmountKrw), 'KRW') : null
        const totalFeeText = totalFeeKrw !== null ? formatSummaryAmount(String(totalFeeKrw), 'KRW') : null
        const exchangeRateText =
            exchangeRate !== null
                ? `1 USD = ${exchangeRate.toLocaleString('en-US', { maximumFractionDigits: 4 })} KRW`
                : null

        type Updates = {
            status: string
            remittanceAppliedAt?: Date
            remittanceFinalReceiveAmount?: number
            remittanceFinalReceiveAmountText?: string
            remittanceSendAmount?: number
            remittanceSendAmountText?: string
            remittanceTotalFee?: number
            remittanceTotalFeeText?: string
            remittanceExchangeRate?: number
            remittanceExchangeRateText?: string
        }
        const updates: Updates = { status: 'REMITTANCE_APPLIED' }
        if (appliedAt) updates.remittanceAppliedAt = appliedAt
        else updates.remittanceAppliedAt = new Date()
        if (finalReceiveAmountUsd !== null) {
            updates.remittanceFinalReceiveAmount = finalReceiveAmountUsd
            if (finalReceiveAmountText) updates.remittanceFinalReceiveAmountText = finalReceiveAmountText
        }
        if (sendAmountKrw !== null) {
            updates.remittanceSendAmount = sendAmountKrw
            if (sendAmountText) updates.remittanceSendAmountText = sendAmountText
        }
        if (totalFeeKrw !== null) {
            updates.remittanceTotalFee = totalFeeKrw
            if (totalFeeText) updates.remittanceTotalFeeText = totalFeeText
        }
        if (exchangeRate !== null) {
            updates.remittanceExchangeRate = exchangeRate
            if (exchangeRateText) updates.remittanceExchangeRateText = exchangeRateText
        }

        const updated = await prisma.wormOrder.update({
            where: { id: order.id },
            data: updates,
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

        return NextResponse.json({ ok: true, savedOrder: updated })
    } catch (error) {
        console.error('Failed to manually save worm remittance:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : '직접 입력 저장에 실패했습니다.' },
            { status: 500 },
        )
    }
}
