import crypto from "crypto";
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/requireAdmin";

const ACCESS_KEY = process.env.COUPANG_ACCESS_KEY || "";
const SECRET_KEY = process.env.COUPANG_SECRET_KEY || "";
const VENDOR_ID = process.env.COUPANG_VENDOR_ID || "";

function generateHmacAuthHeader(method: string, path: string, query: string = "") {
    const now = new Date();
    const year = String(now.getUTCFullYear()).slice(-2);
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const day = String(now.getUTCDate()).padStart(2, "0");
    const hour = String(now.getUTCHours()).padStart(2, "0");
    const minute = String(now.getUTCMinutes()).padStart(2, "0");
    const second = String(now.getUTCSeconds()).padStart(2, "0");
    const datetime = `${year}${month}${day}T${hour}${minute}${second}Z`;

    const message = datetime + method + path + query;
    const signature = crypto.createHmac("sha256", SECRET_KEY).update(message).digest("hex");
    return `CEA algorithm=HmacSHA256, access-key=${ACCESS_KEY}, signed-date=${datetime}, signature=${signature}`;
}

export async function GET() {
    const { unauthorized } = await requireAdminSession();
    if (unauthorized) return unauthorized;

    try {
        if (!ACCESS_KEY || !SECRET_KEY || !VENDOR_ID) {
            return NextResponse.json(
                { error: "COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY / COUPANG_VENDOR_ID 환경변수가 필요합니다." },
                { status: 500 },
            );
        }

        const path = `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products`;
        const query = `vendorId=${VENDOR_ID}&maxPerPage=10`;
        const fullPath = `${path}?${query}`;

        const authorization = generateHmacAuthHeader("GET", path, query);
        const response = await fetch(`https://api-gateway.coupang.com${fullPath}`, {
            method: "GET",
            headers: {
                "Authorization": authorization,
                "x-requested-with": "OPENAPI",
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            return NextResponse.json({ error: await response.text() }, { status: response.status });
        }
        return NextResponse.json(await response.json());
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
