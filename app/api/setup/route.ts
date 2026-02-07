import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function GET() {
    try {
        const hashedPassword = await bcrypt.hash('admin123', 10)

        const admin = await prisma.user.upsert({
            where: { username: 'admin' },
            update: {},
            create: {
                username: 'admin',
                password: hashedPassword,
                name: 'Beico Admin',
                role: 'ADMIN',
            },
        })

        return NextResponse.json({ success: true, admin })
    } catch (error) {
        console.error(error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}
