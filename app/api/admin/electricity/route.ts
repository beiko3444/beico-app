import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminSession } from "@/lib/requireAdmin"

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    const { unauthorized } = await requireAdminSession()
    if (unauthorized) return unauthorized

    try {
        const { searchParams } = new URL(request.url)
        const year = parseInt(searchParams.get('year') || '')
        const month = parseInt(searchParams.get('month') || '')

        if (!year || !month) {
            return NextResponse.json({ error: "Missing year or month" }, { status: 400 })
        }

        const usage = await prisma.electricityUsage.findUnique({
            where: {
                year_month: {
                    year,
                    month
                }
            }
        })

        return NextResponse.json(usage || { message: "No data found" })
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch electricity usage" }, { status: 500 })
    }
}

export async function POST(request: Request) {
    const { unauthorized } = await requireAdminSession()
    if (unauthorized) return unauthorized

    try {
        const body = await request.json()
        const { year, month } = body

        if (!year || !month) {
            return NextResponse.json({ error: "Missing year or month" }, { status: 400 })
        }

        // Filter out null/undefined from body to avoid overwriting or creating with invalid values
        const baseData = Object.fromEntries(
            Object.entries(body).filter(([k, v]) => v !== null && v !== undefined && k !== 'id' && k !== 'meterPhotoUploadedAt')
        );

        const existingUsage = await prisma.electricityUsage.findUnique({
            where: {
                year_month: {
                    year,
                    month
                }
            },
            select: {
                meterPhotoUrl: true,
                meterPhotoUploadedAt: true
            }
        })

        const hasPhotoInput = typeof body.meterPhotoUrl === 'string' && body.meterPhotoUrl.length > 0
        const photoRemoved = body.meterPhotoUrl === null && Boolean(existingUsage?.meterPhotoUrl)
        const photoChanged = hasPhotoInput && body.meterPhotoUrl !== existingUsage?.meterPhotoUrl
        const photoUploadedAt = photoChanged ? new Date() : undefined
        const billDataRemoved = body.rawBillData === null

        const usage = await prisma.electricityUsage.upsert({
            where: {
                year_month: {
                    year,
                    month
                }
            },
            update: {
                ...baseData,
                year,
                month,
                ...(photoRemoved ? { meterPhotoUrl: null, meterPhotoUploadedAt: null } : {}),
                ...(photoUploadedAt ? { meterPhotoUploadedAt: photoUploadedAt } : {}),
                ...(billDataRemoved ? {
                    readingDate: "-",
                    usagePeriod: "-",
                    meterCurrent: "0",
                    meterPrevious: "0",
                    totalUsage: 0,
                    totalAmount: 0,
                    rawBillData: "{}",
                    rawText: null,
                    extractionHistory: null
                } : {}),
                updatedAt: new Date()
            },
            create: {
                // Required fields default values if not provided in baseData
                year,
                month,
                readingDate: body.readingDate || "-",
                usagePeriod: body.usagePeriod || "-",
                meterCurrent: body.meterCurrent || "0",
                meterPrevious: body.meterPrevious || "0",
                totalUsage: body.totalUsage || 0,
                totalAmount: body.totalAmount || 0,
                rawBillData: body.rawBillData || "{}",
                ...(hasPhotoInput ? { meterPhotoUploadedAt: photoUploadedAt || new Date() } : {}),
                ...baseData
            }
        })

        return NextResponse.json(usage)
    } catch (error) {
        console.error("Failed to save electricity usage:", error)
        return NextResponse.json({ error: "Failed to save electricity usage", details: String(error) }, { status: 500 })
    }
}
