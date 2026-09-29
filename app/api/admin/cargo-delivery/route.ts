import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { Prisma } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CARGO_PROXY_PRINCIPAL, parseDateInput, toProxyRecord } from "@/lib/cargoDeliveryProxy"

const readText = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

const buildDocumentPrefix = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `DA-${year}${month}${day}`
}

const getNextDocumentNo = async (tx: Prisma.TransactionClient, date: Date) => {
    const prefix = buildDocumentPrefix(date)
    const latest = await tx.cargoDeliveryProxy.findFirst({
        where: { documentNo: { startsWith: prefix } },
        orderBy: { documentNo: 'desc' },
        select: { documentNo: true },
    })

    let sequence = 1
    if (latest?.documentNo) {
        const parsed = Number(latest.documentNo.slice(-3))
        if (Number.isFinite(parsed)) {
            sequence = parsed + 1
        }
    }

    return `${prefix}-${String(sequence).padStart(3, '0')}`
}

export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const rows = await prisma.cargoDeliveryProxy.findMany({
            orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
            take: 200,
        })
        return NextResponse.json(rows.map(toProxyRecord))
    } catch (error) {
        console.error('Failed to fetch cargo proxies:', error)
        return NextResponse.json({ error: '위임장 목록을 불러오지 못했습니다.' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>

        const issueDate = parseDateInput(readText(body.issueDate)) ?? new Date()
        const blNumber = readText(body.blNumber)
        const cargoName = readText(body.cargoName)
        const quantityText = readText(body.quantityText)
        const driverId = readText(body.driverId)
        const driverName = readText(body.driverName)
        const driverPhone = readText(body.driverPhone)
        const driverVehicle = readText(body.driverVehicle)

        if (!blNumber) {
            return NextResponse.json({ error: 'B/L 번호(또는 AWB 번호)를 입력하세요.' }, { status: 400 })
        }
        if (!cargoName) {
            return NextResponse.json({ error: '화물명을 입력하세요.' }, { status: 400 })
        }
        if (!driverName) {
            return NextResponse.json({ error: '대리인(기사) 이름을 입력하세요.' }, { status: 400 })
        }

        const created = await prisma.$transaction(async (tx) => {
            // 삭제된 기사 id가 넘어와도 위임장 발행은 막지 않는다
            const driverExists = driverId
                ? await tx.cargoDeliveryDriver.findUnique({ where: { id: driverId }, select: { id: true } })
                : null
            const documentNo = await getNextDocumentNo(tx, issueDate)

            return tx.cargoDeliveryProxy.create({
                data: {
                    documentNo,
                    issueDate,
                    blNumber,
                    cargoName,
                    quantityText,
                    driverId: driverExists?.id ?? null,
                    driverName,
                    driverPhone,
                    driverVehicle,
                    principalName: readText(body.principalName) || CARGO_PROXY_PRINCIPAL.name,
                    principalAddress: readText(body.principalAddress) || CARGO_PROXY_PRINCIPAL.address,
                    principalPhone: readText(body.principalPhone) || CARGO_PROXY_PRINCIPAL.phone,
                    principalBusinessNo: readText(body.principalBusinessNo) || CARGO_PROXY_PRINCIPAL.businessNo,
                },
            })
        })

        return NextResponse.json(toProxyRecord(created))
    } catch (error) {
        console.error('Failed to create cargo proxy:', error)
        return NextResponse.json({ error: '위임장 발행에 실패했습니다.' }, { status: 500 })
    }
}

export async function DELETE(request: Request) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')?.trim() || ''
        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 })
        }

        const deleted = await prisma.cargoDeliveryProxy.delete({
            where: { id },
            select: { id: true },
        })
        return NextResponse.json(deleted)
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return NextResponse.json({ error: '위임장을 찾을 수 없습니다.' }, { status: 404 })
        }
        console.error('Failed to delete cargo proxy:', error)
        return NextResponse.json({ error: '위임장 삭제에 실패했습니다.' }, { status: 500 })
    }
}
