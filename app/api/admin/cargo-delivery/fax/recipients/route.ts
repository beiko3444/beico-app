import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { Prisma } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { normalizeFaxNumber } from "@/lib/barobillFax"

const readText = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
const recipientSelect = { id: true, name: true, faxNumber: true } as const

export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const recipients = await prisma.cargoFaxRecipient.findMany({
            orderBy: { createdAt: 'asc' },
            select: recipientSelect,
        })
        return NextResponse.json(recipients)
    } catch (error) {
        console.error('Failed to fetch fax recipients:', error)
        return NextResponse.json({ error: '수신처 목록을 불러오지 못했습니다.' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>
        const name = readText(body.name)
        const faxNumber = readText(body.faxNumber)
        if (!name) {
            return NextResponse.json({ error: '수신처 이름을 입력하세요.' }, { status: 400 })
        }
        if (normalizeFaxNumber(faxNumber).length < 8) {
            return NextResponse.json({ error: '팩스번호를 확인하세요.' }, { status: 400 })
        }

        const recipient = await prisma.cargoFaxRecipient.create({
            data: { name, faxNumber },
            select: recipientSelect,
        })
        return NextResponse.json(recipient)
    } catch (error) {
        console.error('Failed to create fax recipient:', error)
        return NextResponse.json({ error: '수신처 추가에 실패했습니다.' }, { status: 500 })
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

        const deleted = await prisma.cargoFaxRecipient.delete({ where: { id }, select: { id: true } })
        return NextResponse.json(deleted)
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return NextResponse.json({ error: '수신처를 찾을 수 없습니다.' }, { status: 404 })
        }
        console.error('Failed to delete fax recipient:', error)
        return NextResponse.json({ error: '수신처 삭제에 실패했습니다.' }, { status: 500 })
    }
}
