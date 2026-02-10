import { NextResponse, NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ boardId: string }> }
) {
    const { boardId } = await params;
    try {
        const board = await prisma.mindBoard.findUnique({
            where: { id: boardId }
        })

        if (!board) {
            return new NextResponse("Board not found", { status: 404 })
        }

        return NextResponse.json({
            items: JSON.parse(board.items),
            groups: JSON.parse(board.groups),
            updatedAt: board.updatedAt,
            title: board.title
        })
    } catch (error) {
        console.error("[MINDBOARD_GET]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ boardId: string }> }
) {
    const { boardId } = await params;
    try {
        const body = await request.json()
        const { items, groups, title } = body

        // If title is provided, update title as well
        const data: any = {}
        if (items) data.items = JSON.stringify(items)
        if (groups) data.groups = JSON.stringify(groups)
        if (title) data.title = title

        const board = await prisma.mindBoard.update({
            where: { id: boardId },
            data
        })

        return NextResponse.json(board)
    } catch (error) {
        console.error("[MINDBOARD_UPDATE]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ boardId: string }> }
) {
    const { boardId } = await params;
    try {
        await prisma.mindBoard.delete({
            where: { id: boardId }
        })

        return new NextResponse(null, { status: 204 })
    } catch (error) {
        console.error("[MINDBOARD_DELETE]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
