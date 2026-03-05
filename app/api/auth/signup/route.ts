import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import nodemailer from 'nodemailer'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_PORT === '465' || !process.env.SMTP_PORT, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
})

export async function POST(req: Request) {
    try {
        const formData = await req.formData()

        const username = formData.get('username') as string
        const password = formData.get('password') as string
        const businessName = formData.get('businessName') as string
        const representativeName = formData.get('representativeName') as string
        const contact = formData.get('contact') as string
        const fax = formData.get('fax') as string
        const email = formData.get('email') as string
        const businessRegNumber = formData.get('businessRegNumber') as string
        const address = formData.get('address') as string
        const country = formData.get('country') as string
        const businessRegistrationDocument = formData.get('businessRegistrationDocument')

        // Basic validation
        if (!username || !password || !businessName || !representativeName || !contact || !email || !businessRegNumber || !address || !country || !businessRegistrationDocument) {
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

        let businessRegistrationUrl = ''
        if (businessRegistrationDocument && typeof businessRegistrationDocument === 'object' && 'arrayBuffer' in businessRegistrationDocument) {
            try {
                // @ts-ignore - businessRegistrationDocument is File-like from FormData
                const bytes = await businessRegistrationDocument.arrayBuffer()
                const buffer = Buffer.from(bytes)

                // Convert directly to base64 to avoid local filesystem issues (Vercel read-only restrictions)
                // @ts-ignore
                const mimeType = businessRegistrationDocument.type || 'application/octet-stream'
                const base64String = `data:${mimeType};base64,${buffer.toString('base64')}`

                businessRegistrationUrl = base64String
            } catch (err) {
                console.warn('File conversion to base64 failed:', err)
            }
        }

        // Create user and profile
        const user = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                name: businessName, // Using business name as display name
                role: 'PARTNER',
                status: 'PENDING',
                country,
                partnerProfile: {
                    create: {
                        businessName,
                        representativeName,
                        contact,
                        fax,
                        email,
                        businessRegNumber,
                        address,
                        businessRegistrationUrl, // Stored as relative URL path
                        grade: 'C' // Default grade
                    }
                }
            }
        })

        // Send email notification to contact@beiko.co.kr
        try {
            if (process.env.SMTP_USER && process.env.SMTP_PASS) {
                await transporter.sendMail({
                    from: `"Beiko Admin" <${process.env.SMTP_USER}>`,
                    to: 'contact@beiko.co.kr',
                    subject: `[신규 파트너 가입] ${businessName} (${representativeName})`,
                    html: `
                        <h2>새로운 파트너(회원) 가입이 접수되었습니다.</h2>
                        <hr />
                        <ul>
                            <li><strong>아이디:</strong> ${username}</li>
                            <li><strong>회사명(상호명):</strong> ${businessName}</li>
                            <li><strong>대표자명:</strong> ${representativeName}</li>
                            <li><strong>국가:</strong> ${country}</li>
                            <li><strong>전화번호:</strong> ${contact}</li>
                            <li><strong>이메일:</strong> ${email}</li>
                            <li><strong>사업자등록번호:</strong> ${businessRegNumber}</li>
                            <li><strong>주소:</strong> ${address}</li>
                        </ul>
                        <br />
                        <p>관리자 페이지에서 확인 후 승인 처리를 진행해주세요.</p>
                    `
                })
            } else {
                console.warn('SMTP credentials not configured in .env. Email notification skipped.')
            }
        } catch (emailError) {
            console.error('Failed to send notification email:', emailError)
            // Error logged, but don't fail the registration process
        }

        return NextResponse.json({
            message: '登録が完了しました。管理者の承認をお待ちください。 / Registration complete. Please wait for admin approval.',
            user: { username: user.username }
        })

    } catch (error) {
        console.error('Signup error:', error)
        const errorMessage = error instanceof Error ? error.message : String(error)
        return NextResponse.json(
            { error: `登録中にエラーが発生しました。 / An error occurred during registration. (詳細 / Detail: ${errorMessage})` },
            { status: 500 }
        )
    }
}
