import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { Prisma } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const readText = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

const parseDriverBody = (body: unknown) => {
    const record = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
    return {
        id: readText(record.id),
        name: readText(record.name),
        phone: readText(record.phone),
        vehicleNo: readText(record.vehicleNo),
    }
}

const driverSelect = { id: true, name: true, phone: true, vehicleNo: true } as const

export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const drivers = await prisma.cargoDeliveryDriver.findMany({
            orderBy: { createdAt: 'asc' },
            select: driverSelect,
        })
        return NextResponse.json(drivers)
    } catch (error) {
        console.error('Failed to fetch cargo drivers:', error)
        return NextResponse.json({ error: '기사 목록을 불러오지 못했습니다.' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { name, phone, vehicleNo } = parseDriverBody(await request.json().catch(() => null))
        if (!name) {
            return NextResponse.json({ error: '기사 이름을 입력하세요.' }, { status: 400 })
        }

        const driver = await prisma.cargoDeliveryDriver.create({
            data: { name, phone, vehicleNo },
            select: driverSelect,
        })
        return NextResponse.json(driver)
    } catch (error) {
        console.error('Failed to create cargo driver:', error)
        return NextResponse.json({ error: '기사 추가에 실패했습니다.' }, { status: 500 })
    }
}

export async function PUT(request: Request) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { id, name, phone, vehicleNo } = parseDriverBody(await request.json().catch(() => null))
        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 })
        }
        if (!name) {
            return NextResponse.json({ error: '기사 이름을 입력하세요.' }, { status: 400 })
        }

        const driver = await prisma.cargoDeliveryDriver.update({
            where: { id },
            data: { name, phone, vehicleNo },
            select: driverSelect,
        })
        return NextResponse.json(driver)
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return NextResponse.json({ error: '기사를 찾을 수 없습니다.' }, { status: 404 })
        }
        console.error('Failed to update cargo driver:', error)
        return NextResponse.json({ error: '기사 수정에 실패했습니다.' }, { status: 500 })
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

        const deleted = await prisma.cargoDeliveryDriver.delete({
            where: { id },
            select: { id: true },
        })
        return NextResponse.json(deleted)
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return NextResponse.json({ error: '기사를 찾을 수 없습니다.' }, { status: 404 })
        }
        console.error('Failed to delete cargo driver:', error)
        return NextResponse.json({ error: '기사 삭제에 실패했습니다.' }, { status: 500 })
    }
}
