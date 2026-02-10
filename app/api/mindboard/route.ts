import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Get List of Boards
export async function GET() {
    try {
        const boards = await prisma.mindBoard.findMany({
            select: {
                id: true,
                title: true,
                updatedAt: true
            },
            orderBy: {
                updatedAt: 'desc'
            }
        })

        // If no boards exist, create a default one if needed? 
        // Or client handles it.Client handles it.

        return NextResponse.json(boards)
    } catch (error) {
        console.error("[MINDBOARD_LIST_GET]", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

// Create New Board
export async function POST(request: Request) {
    try {
        const { title } = await request.json()

        const board = await prisma.mindBoard.create({
            data: {
                title: title || "New Board",
                items: "[]",
                groups: "[]"
            }
        })

        return NextResponse.json(board)
    } catch (error) {
        console.error("[MINDBOARD_CREATE]", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
