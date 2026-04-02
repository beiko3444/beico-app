import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/requireAdmin";

export async function POST(request: Request) {
    const { unauthorized } = await requireAdminSession();
    if (unauthorized) return unauthorized;

    try {
        const body = await request.json();
        const { externalSkus } = body;

        if (!externalSkus || !Array.isArray(externalSkus)) {
            return NextResponse.json({ error: "Invalid externalSkus array" }, { status: 400 });
        }

        // Prisma expects strings for coupangSku and barcode, but Coupang API may return numbers
        const stringSkus = externalSkus.map(sku => String(sku));

        const products = await prisma.product.findMany({
            where: {
                OR: [
                    { coupangSku: { in: stringSkus } },
                    { barcode: { in: stringSkus } }
                ]
            },
            select: { coupangSku: true, barcode: true, name: true, nameEN: true, imageUrl: true }
        });

        const mapping: Record<string, { name: string; imageUrl: string | null }> = {};

        products.forEach(p => {
            const productName = p.name || p.nameEN || "알 수 없는 상품";
            if (p.coupangSku) {
                mapping[p.coupangSku] = { name: productName, imageUrl: p.imageUrl };
            }
            if (p.barcode) {
                mapping[p.barcode] = { name: productName, imageUrl: p.imageUrl };
            }
        });

        return NextResponse.json({ mapping });
    } catch (error: any) {
        console.error("Failed to match DB for Coupang inventory:", error);
        return NextResponse.json(
            { error: "Internal Server Error", message: error.message },
            { status: 500 }
        );
    }
}
