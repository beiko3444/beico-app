import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const { productIds } = await req.json()

        // Update sortOrder for each product in the array
        // productIds is an array of IDs in the new order
        await prisma.$transaction(
            productIds.map((id: string, index: number) =>
                prisma.product.update({
                    where: { id },
                    data: { sortOrder: index }
                })
            )
        )

        return NextResponse.json({ success: true })
    } catch (e) {
        console.error(e)
        return NextResponse.json({ error: "Failed to reorder products" }, { status: 500 })
    }
}
