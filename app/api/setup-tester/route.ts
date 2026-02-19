import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function GET() {
    try {
        const password = await bcrypt.hash('1234', 10)
        const user = await prisma.user.upsert({
            where: { username: 'tester' },
            update: {},
            create: {
                username: 'tester',
                password,
                name: 'Tester Account',
                role: 'PARTNER',
                status: 'APPROVED',
                country: 'KR'
            }
        })
        return NextResponse.json({ success: true, user })
    } catch (error) {
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}
