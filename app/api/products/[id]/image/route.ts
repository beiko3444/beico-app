import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveProductImage } from "@/lib/product-image-storage"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await context.params

    try {
        const product = await prisma.product.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                imageUrl: true,
            },
        })

        if (!product?.imageUrl) {
            return NextResponse.json({ error: "Image not found" }, { status: 404 })
        }

        const resolvedImage = await resolveProductImage(product)
        if (!resolvedImage) {
            return NextResponse.json({ error: "Image not found" }, { status: 404 })
        }

        if (resolvedImage.migratedImageUrl && resolvedImage.migratedImageUrl !== product.imageUrl) {
            await prisma.product.update({
                where: { id: product.id },
                data: { imageUrl: resolvedImage.migratedImageUrl },
            })
        }

        if (resolvedImage.kind === "redirect") {
            return NextResponse.redirect(new URL(resolvedImage.location, request.url), 307)
        }

        return new NextResponse(Buffer.from(resolvedImage.body), {
            headers: {
                "Content-Type": resolvedImage.contentType,
                "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
            },
        })
    } catch (error) {
        console.error("Failed to load product image:", error)
        return NextResponse.json({ error: "Failed to load product image" }, { status: 500 })
    }
}
