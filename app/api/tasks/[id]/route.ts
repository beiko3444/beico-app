import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function PUT(req: Request, { params }: { params: { id: string } }) {
    try {
        const { id } = params
        const { completed, title, date } = await req.json()

        const data: any = {}
        if (completed !== undefined) data.completed = completed
        if (title !== undefined) data.title = title
        if (date !== undefined) data.date = new Date(date)

        const task = await prisma.task.update({
            where: { id },
            data
        })
        return NextResponse.json(task)
    } catch (e) {
        return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
    }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    try {
        const { id } = params
        await prisma.task.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch (e) {
        return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
    }
}
