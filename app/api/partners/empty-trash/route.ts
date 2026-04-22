import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function DELETE(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Get all deleted users
        const deletedUsers = await prisma.user.findMany({
            where: { status: 'DELETED' },
            select: { id: true }
        })

        const userIds = deletedUsers.map(u => u.id)

        if (userIds.length > 0) {
            // Must delete profile first due to foreign key constraints if no cascading
            await prisma.partnerProfile.deleteMany({
                where: { userId: { in: userIds } }
            })

            // Or cascade might fail, delete actual users
            await prisma.user.deleteMany({
                where: { status: 'DELETED' }
            })
        }

        revalidatePath('/admin/partners')
        return NextResponse.json({ success: true, count: userIds.length })
    } catch (error) {
        console.error("Failed to empty trash:", error)
        return NextResponse.json({ error: "Failed to empty trash" }, { status: 500 })
    }
}
