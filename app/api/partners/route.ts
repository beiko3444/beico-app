import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { normalizeIncomingBusinessRegistration } from "@/lib/partner-business-registration-storage"

const partnerListSelect = {
    id: true,
    username: true,
    name: true,
    role: true,
    status: true,
    country: true,
    createdAt: true,
    updatedAt: true,
    partnerProfile: {
        select: {
            id: true,
            contact: true,
            fax: true,
            email: true,
            businessName: true,
            representativeName: true,
            businessRegNumber: true,
            address: true,
            grade: true,
        },
    },
} as const

export async function GET() {
    try {
        const partners = await prisma.user.findMany({
            where: { role: 'PARTNER' },
            select: partnerListSelect,
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
        const { username, password, name, contact, email, representativeName, country } = body
        const businessRegistrationUrl = await normalizeIncomingBusinessRegistration(body.businessRegistrationUrl)

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
                country,
                partnerProfile: {
                    create: {
                        contact,
                        email,
                        representativeName,
                        businessRegNumber: body.businessRegNumber,
                        address: body.address,
                        businessRegistrationUrl,
                        grade: body.grade || 'C', // Default to C
                    }
                }
            },
            select: partnerListSelect
        })

        revalidatePath('/admin/partners')
        return NextResponse.json(partner)
    } catch (error) {
        return NextResponse.json({ error: "Failed to create partner", details: String(error) }, { status: 500 })
    }
}
