import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function GET() {
    try {
        const partners = await prisma.user.findMany({
            where: { role: 'PARTNER' },
            include: { partnerProfile: true },
            orderBy: { createdAt: 'desc' }
        })
        return NextResponse.json(partners)
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch partners" }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { username, password, name, contact, email, representativeName } = body

        // Validation
        if (!username || !password || !name) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        const partner = await prisma.user.create({
            data: {
                username,
                password: hashedPassword, // Store hashed!
                name,
                role: body.role || 'PARTNER',
                status: 'APPROVED',
                partnerProfile: {
                    create: {
                        contact,
                        email,
                        representativeName,
                        businessRegNumber: body.businessRegNumber,
                        address: body.address,
                        businessRegistrationUrl: body.businessRegistrationUrl,
                        grade: body.grade || 'C', // Default to C
                    }
                }
            },
            include: {
                partnerProfile: true
            }
        })

        return NextResponse.json(partner)
    } catch (error) {
        return NextResponse.json({ error: "Failed to create partner", details: String(error) }, { status: 500 })
    }
}
