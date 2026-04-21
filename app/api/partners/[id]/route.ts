import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

const partnerResponseSelect = {
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

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params
        const body = await request.json()
        const { username, password, name, contact, email, businessRegNumber, address, grade, representativeName, country } = body

        // Validation
        if (!username || !name) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
        }

        const updateData: any = {
            username,
            name,
            role: body.role || 'PARTNER',
            country,
        }

        if (password && password.trim() !== '') {
            updateData.password = await bcrypt.hash(password, 10)
        }

        const profileData: any = {
            contact,
            email,
            representativeName,
            businessRegNumber,
            address,
            grade: grade || 'C',
        }
        if (Object.prototype.hasOwnProperty.call(body, 'businessRegistrationUrl')) {
            profileData.businessRegistrationUrl = body.businessRegistrationUrl
        }

        const partner = await prisma.user.update({
            where: { id },
            data: {
                ...updateData,
                partnerProfile: {
                    upsert: {
                        create: profileData,
                        update: profileData
                    }
                }
            },
            select: partnerResponseSelect
        })

        return NextResponse.json(partner)
    } catch (error) {
        console.error("Failed to update partner:", error)
        return NextResponse.json({ error: "Failed to update partner" }, { status: 500 })
    }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params

        // Soft-delete: update status to DELETED
        await prisma.user.update({
            where: { id },
            data: { status: 'DELETED' }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Failed to delete partner:", error)
        return NextResponse.json({ error: "Failed to delete partner" }, { status: 500 })
    }
}
