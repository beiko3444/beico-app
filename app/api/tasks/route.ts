import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
    try {
        const tasks = await prisma.task.findMany({
            orderBy: { date: 'asc' }
        })
        return NextResponse.json(tasks)
    } catch (e) {
        return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const { title, date } = await req.json()
        const task = await prisma.task.create({
            data: {
                title,
                date: new Date(date),
                completed: false
            }
        })
        return NextResponse.json(task)
    } catch (e) {
        return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
    }
}
