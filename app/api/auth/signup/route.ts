import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const {
            username,
            password,
            businessName,
            representativeName,
            contact,
            fax,
            email,
            businessRegNumber,
            address
        } = body

        // Basic validation
        if (!username || !password || !businessName || !representativeName || !contact || !email || !businessRegNumber || !address) {
            return NextResponse.json(
                { error: '필수 항목을 모두 입력해주세요.' },
                { status: 400 }
            )
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
            where: { username }
        })

        if (existingUser) {
            return NextResponse.json(
                { error: '이미 존재하는 아이디입니다.' },
                { status: 409 }
            )
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12)

        // Create user and profile
        const user = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                name: businessName, // Using business name as display name
                role: 'PARTNER',
                status: 'PENDING',
                partnerProfile: {
                    create: {
                        businessName,
                        representativeName,
                        contact,
                        fax,
                        email,
                        businessRegNumber,
                        address,
                        grade: 'C' // Default grade
                    }
                }
            }
        })

        return NextResponse.json({
            message: '회원가입이 완료되었습니다. 관리자 승인 후 이용 가능합니다.',
            user: { username: user.username }
        })

    } catch (error) {
        console.error('Signup error:', error)
        return NextResponse.json(
            { error: '회원가입 처리 중 오류가 발생했습니다.' },
            { status: 500 }
        )
    }
}
