import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolvePartnerBusinessRegistration } from "@/lib/partner-business-registration-storage"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await context.params
    if (session.user.role !== "ADMIN" && session.user.id !== id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const disposition = new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline"

    try {
        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                partnerProfile: {
                    select: {
                        businessRegistrationUrl: true,
                    },
                },
            },
        })

        const businessRegistrationUrl = user?.partnerProfile?.businessRegistrationUrl || null
        if (!businessRegistrationUrl) {
            return NextResponse.json({ error: "Document not found" }, { status: 404 })
        }

        const resolvedDocument = await resolvePartnerBusinessRegistration(
            {
                userId: id,
                businessRegistrationUrl,
            },
            disposition
        )

        if (!resolvedDocument) {
            return NextResponse.json({ error: "Document not found" }, { status: 404 })
        }

        if (resolvedDocument.migratedAssetUrl && resolvedDocument.migratedAssetUrl !== businessRegistrationUrl) {
            await prisma.partnerProfile.update({
                where: { userId: id },
                data: { businessRegistrationUrl: resolvedDocument.migratedAssetUrl },
            })
        }

        if (resolvedDocument.kind === "redirect") {
            return NextResponse.redirect(new URL(resolvedDocument.location, request.url), 307)
        }

        const responseHeaders: Record<string, string> = {
            "Content-Type": resolvedDocument.contentType,
            "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
        }

        if (disposition === "attachment") {
            responseHeaders["Content-Disposition"] = `attachment; filename="business-registration-${id}"`
        }

        return new NextResponse(Buffer.from(resolvedDocument.body), {
            headers: responseHeaders,
        })
    } catch (error) {
        console.error("Failed to load business registration document:", error)
        return NextResponse.json({ error: "Failed to load business registration document" }, { status: 500 })
    }
}
