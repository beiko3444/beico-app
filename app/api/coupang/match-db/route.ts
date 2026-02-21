import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { externalSkus } = body;

        if (!externalSkus || !Array.isArray(externalSkus)) {
            return NextResponse.json({ error: "Invalid externalSkus array" }, { status: 400 });
        }

        const products = await prisma.product.findMany({
            where: {
                OR: [
                    { coupangSku: { in: externalSkus } },
                    { barcode: { in: externalSkus } }
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
