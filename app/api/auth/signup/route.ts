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
                { error: '必須項目をすべて入力してください。 / Please fill in all required fields.' },
                { status: 400 }
            )
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
            where: { username }
        })

        if (existingUser) {
            return NextResponse.json(
                { error: 'このユーザーIDは既に存在します。 / This User ID already exists.' },
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
            message: '登録が完了しました。管理者の承認をお待ちください。 / Registration complete. Please wait for admin approval.',
            user: { username: user.username }
        })

    } catch (error) {
        console.error('Signup error:', error)
        return NextResponse.json(
            { error: '登録中にエラーが発生しました。 / An error occurred during registration.' },
            { status: 500 }
        )
    }
}
