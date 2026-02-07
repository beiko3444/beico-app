import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
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
    try {
        const body = await request.json()
        const { year, month } = body

        if (!year || !month) {
            return NextResponse.json({ error: "Missing year or month" }, { status: 400 })
        }

        const usage = await prisma.electricityUsage.upsert({
            where: {
                year_month: {
                    year,
                    month
                }
            },
            update: {
                ...body,
                updatedAt: new Date()
            },
            create: {
                ...body
            }
        })

        return NextResponse.json(usage)
    } catch (error) {
        console.error("Failed to save electricity usage:", error)
        return NextResponse.json({ error: "Failed to save electricity usage", details: String(error) }, { status: 500 })
    }
}
