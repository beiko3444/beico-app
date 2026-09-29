import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { toFaxLogRecord, toProxyRecord } from "@/lib/cargoDeliveryProxy"
import { renderCargoProxyPdf } from "@/lib/cargoDeliveryProxyPdf"
import {
    checkBarobillFaxFtp,
    describeBarobillFaxState,
    getBarobillFaxFromNumbers,
    getBarobillFaxMessage,
    isBarobillFaxFinalState,
    normalizeFaxNumber,
    resolveBarobillFaxFromNumber,
    sendBarobillFaxFromFtp,
    uploadBarobillFaxFile,
} from "@/lib/barobillFax"

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const readText = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

const serialize = (row: Parameters<typeof toFaxLogRecord>[0]) => toFaxLogRecord(row, describeBarobillFaxState)

/** 아직 최종 상태가 아닌 전송건은 바로빌에서 상태를 다시 읽어 갱신 */
const refreshPendingLogs = async (rows: Parameters<typeof toFaxLogRecord>[0][]) => {
    const pending = rows.filter((row) => row.sendKey && !row.error && !isBarobillFaxFinalState(row.sendState))
    if (pending.length === 0) return rows

    const updates = await Promise.all(
        pending.map(async (row) => {
            try {
                const message = await getBarobillFaxMessage(row.sendKey as string)
                return prisma.cargoDeliveryFaxLog.update({
                    where: { id: row.id },
                    data: {
                        sendState: message.sendState,
                        sendResult: message.sendResult || null,
                        sendPageCount: message.sendPageCount,
                        successPageCount: message.successPageCount,
                    },
                })
            } catch (error) {
                console.error('Failed to refresh fax state:', row.id, error)
                return row
            }
        })
    )

    const byId = new Map(updates.map((row) => [row.id, row]))
    return rows.map((row) => byId.get(row.id) ?? row)
}

export async function GET(request: Request) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)

    // 설정 점검: 발신번호 + FTP 접속
    if (searchParams.get('check') === '1') {
        const [fromNumbers, ftp] = await Promise.all([
            getBarobillFaxFromNumbers().then(
                (numbers) => ({ ok: true as const, numbers }),
                (error: unknown) => ({ ok: false as const, numbers: [], message: getErrorMessage(error) })
            ),
            checkBarobillFaxFtp().catch((error: unknown) => ({ ok: false as const, host: '', user: '', message: getErrorMessage(error) })),
        ])
        return NextResponse.json({ fromNumbers, ftp })
    }

    try {
        const proxyId = searchParams.get('proxyId')?.trim() || ''
        const refresh = searchParams.get('refresh') === '1'

        let rows = await prisma.cargoDeliveryFaxLog.findMany({
            where: proxyId ? { proxyId } : undefined,
            orderBy: { createdAt: 'desc' },
            take: 200,
        })
        if (refresh) {
            rows = await refreshPendingLogs(rows)
        }
        return NextResponse.json(rows.map(serialize))
    } catch (error) {
        console.error('Failed to fetch fax logs:', error)
        return NextResponse.json({ error: '팩스 전송 내역을 불러오지 못했습니다.' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>
    const proxyId = readText(body.proxyId)
    const toName = readText(body.toName)
    const toNumber = normalizeFaxNumber(readText(body.toNumber))

    if (!proxyId) {
        return NextResponse.json({ error: '발행된 위임장을 선택하세요.' }, { status: 400 })
    }
    if (toNumber.length < 8) {
        return NextResponse.json({ error: '수신 팩스번호를 확인하세요.' }, { status: 400 })
    }

    const proxyRow = await prisma.cargoDeliveryProxy.findUnique({ where: { id: proxyId } })
    if (!proxyRow) {
        return NextResponse.json({ error: '위임장을 찾을 수 없습니다.' }, { status: 404 })
    }
    const proxy = toProxyRecord(proxyRow)

    let fromNumber = ''
    try {
        fromNumber = await resolveBarobillFaxFromNumber()
    } catch (error) {
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 })
    }

    const fileName = `${proxy.documentNo}_${Date.now()}.pdf`
    const log = await prisma.cargoDeliveryFaxLog.create({
        data: {
            proxyId: proxy.id,
            documentNo: proxy.documentNo,
            toName: toName || '-',
            toNumber,
            fromNumber,
            fileName,
        },
    })

    try {
        const pdf = await renderCargoProxyPdf(proxy)
        const uploadedName = await uploadBarobillFaxFile(fileName, pdf)
        const result = await sendBarobillFaxFromFtp({
            fileName: uploadedName,
            fromNumber,
            toNumber,
            receiveCorp: toName || '',
            receiveName: toName || '',
            refKey: log.id,
        })

        const updated = await prisma.cargoDeliveryFaxLog.update({
            where: { id: log.id },
            data: result.success
                ? { sendKey: result.sendKey, sendState: 0 }
                : { error: `[${result.resultCode}] ${result.message}` },
        })

        if (!result.success) {
            return NextResponse.json({ error: `팩스 접수 실패: ${result.message}`, log: serialize(updated) }, { status: 502 })
        }
        return NextResponse.json(serialize(updated))
    } catch (error) {
        const message = getErrorMessage(error)
        console.error('Failed to send cargo proxy fax:', error)
        const updated = await prisma.cargoDeliveryFaxLog.update({
            where: { id: log.id },
            data: { error: message },
        })
        return NextResponse.json({ error: message, log: serialize(updated) }, { status: 500 })
    }
}

export async function DELETE(request: Request) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')?.trim() || ''
    if (!id) {
        return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    try {
        const deleted = await prisma.cargoDeliveryFaxLog.delete({ where: { id }, select: { id: true } })
        return NextResponse.json(deleted)
    } catch (error) {
        console.error('Failed to delete fax log:', error)
        return NextResponse.json({ error: '전송 내역 삭제에 실패했습니다.' }, { status: 500 })
    }
}
