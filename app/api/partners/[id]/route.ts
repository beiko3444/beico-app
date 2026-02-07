import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params
        const body = await request.json()
        const { username, password, name, contact, email, businessRegNumber, address, grade, representativeName } = body

        // Validation
        if (!username || !name) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
        }

        const updateData: any = {
            username,
            name,
            role: body.role || 'PARTNER',
        }

        if (password && password.trim() !== '') {
            updateData.password = await bcrypt.hash(password, 10)
        }

        const partner = await prisma.user.update({
            where: { id },
            data: {
                ...updateData,
                partnerProfile: {
                    upsert: {
                        create: {
                            contact,
                            email,
                            representativeName,
                            businessRegNumber,
                            address,
                            businessRegistrationUrl: body.businessRegistrationUrl,
                            grade: grade || 'C',
                        },
                        update: {
                            contact,
                            email,
                            representativeName,
                            businessRegNumber,
                            address,
                            businessRegistrationUrl: body.businessRegistrationUrl,
                            grade: grade || 'C',
                        }
                    }
                }
            },
            include: {
                partnerProfile: true
            }
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

        // Delete related profile first (if cascading is not set up, but let's assume Prisma handles relations or we do it manually)
        // With Prisma SQLite, cascading isn't always automatic unless defined.
        // Let's safe delete: Profile first, then User.

        // First find the user to get the profile ID if needed, but we can delete profile by userId
        try {
            await prisma.partnerProfile.delete({
                where: { userId: id }
            })
        } catch (e) {
            // Check if error is "Record not found" - ignore it
        }

        // Delete User
        await prisma.user.delete({
            where: { id }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Failed to delete partner:", error)
        return NextResponse.json({ error: "Failed to delete partner" }, { status: 500 })
    }
}
