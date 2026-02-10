import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
    try {
        const board = await prisma.mindBoard.findUnique({
            where: { id: "default" }
        })

        if (!board) {
            return NextResponse.json({ items: [], groups: [] })
        }

        return NextResponse.json({
            items: JSON.parse(board.items),
            groups: JSON.parse(board.groups),
            updatedAt: board.updatedAt
        })
    } catch (error) {
        console.error("[MINDBOARD_GET]", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const { items, groups } = await request.json()

        const board = await prisma.mindBoard.upsert({
            where: { id: "default" },
            update: {
                items: JSON.stringify(items),
                groups: JSON.stringify(groups)
            },
            create: {
                id: "default",
                items: JSON.stringify(items),
                groups: JSON.stringify(groups)
            }
        })

        return NextResponse.json(board)
    } catch (error) {
        console.error("[MINDBOARD_POST]", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
