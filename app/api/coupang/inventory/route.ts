import crypto from "crypto";
import { NextResponse } from "next/server";

// Using credentials from the user's provided snapshot
const ACCESS_KEY = process.env.COUPANG_ACCESS_KEY || "316ac83a-78d0-48e3-a8fe-41b744bd90fe";
const SECRET_KEY = process.env.COUPANG_SECRET_KEY || "75b0b84b0b70cace39e295cdf1eaf224e524c607";
const VENDOR_ID = process.env.COUPANG_VENDOR_ID || "A00534715";

function generateHmacAuthHeader(method: string, path: string, query: string = "") {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const day = String(now.getUTCDate()).padStart(2, "0");
    const hour = String(now.getUTCHours()).padStart(2, "0");
    const minute = String(now.getUTCMinutes()).padStart(2, "0");
    const second = String(now.getUTCSeconds()).padStart(2, "0");
    const datetime = `${year}${month}${day}T${hour}${minute}${second}Z`;

    const message = datetime + method + path + query;
    const signature = crypto
        .createHmac("sha256", SECRET_KEY)
        .update(message)
        .digest("hex");

    return `CEA algorithm=HmacSHA256, access-key=${ACCESS_KEY}, signed-date=${datetime}, signature=${signature}`;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const nextToken = searchParams.get('nextToken');

        const path = `/v2/providers/rg_open_api/apis/api/v1/vendors/${VENDOR_ID}/rg/inventory/summaries`;
        const query = nextToken ? `nextToken=${nextToken}` : "";
        const fullPath = query ? `${path}?${query}` : path;

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
            const errorText = await response.text();
            console.error("Coupang API Error Response:", response.status, errorText);
            return NextResponse.json(
                { error: "Failed to fetch from Coupang API", details: errorText },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error("Failed to fetch Coupang Inventory:", error);
        return NextResponse.json(
            { error: "Internal Server Error", message: error.message },
            { status: 500 }
        );
    }
}
