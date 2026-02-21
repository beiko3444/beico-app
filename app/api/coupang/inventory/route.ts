import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Using credentials from the user's provided snapshot
const ACCESS_KEY = process.env.COUPANG_ACCESS_KEY || "316ac83a-78d0-48e3-a8fe-41b744bd90fe";
const SECRET_KEY = process.env.COUPANG_SECRET_KEY || "75b0b84b0b70cace39e295cdf1eaf224e524c607";
const VENDOR_ID = process.env.COUPANG_VENDOR_ID || "A00534715";

function generateHmacAuthHeader(method: string, path: string, query: string = "") {
    const now = new Date();
    // Coupang requires YYMMDD format, not YYYYMMDD
    const year = String(now.getUTCFullYear()).slice(-2);
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
import { HttpsProxyAgent } from "https-proxy-agent";
import fetch from "node-fetch";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        let allData: any[] = [];
        let currentNextToken: string | null = searchParams.get('nextToken');
        let pagesFetched = 0;

        // Loop up to 50 times to prevent infinite loops (max ~2500 items)
        while (pagesFetched < 50) {
            pagesFetched++;
            const path = `/v2/providers/rg_open_api/apis/api/v1/vendors/${VENDOR_ID}/rg/inventory/summaries`;
            const encodedToken = currentNextToken ? encodeURIComponent(currentNextToken) : "";
            const query = encodedToken ? `nextToken=${encodedToken}` : "";
            const fullPath = query ? `${path}?${query}` : path;

            const authorization = generateHmacAuthHeader("GET", path, query);

            const proxyUrl = process.env.QUOTAGUARDSTATIC_URL || process.env.FIXIE_URL || process.env.HTTP_PROXY || process.env.HTTPS_PROXY;

            let fetchOptions: any = {
                method: "GET",
                headers: {
                    "Authorization": authorization,
                    "x-requested-with": "OPENAPI",
                    "Content-Type": "application/json",
                },
            };

            if (proxyUrl) {
                fetchOptions.agent = new HttpsProxyAgent(proxyUrl);
            }

            const response = await fetch(`https://api-gateway.coupang.com${fullPath}`, fetchOptions);

            if (!response.ok) {
                const errorText = await response.text();
                // Record error in DB
                await prisma.coupangSyncHistory.create({
                    data: {
                        status: "ERROR",
                        errorMessage: `Response ${response.status}: ${errorText}`.substring(0, 255)
                    }
                });
                console.error("Coupang API Error Response:", response.status, errorText);
                return NextResponse.json(
                    { error: "Failed to fetch from Coupang API", details: errorText },
                    { status: response.status }
                );
            }

            const dataObj: any = await response.json();

            if (dataObj?.data && Array.isArray(dataObj.data)) {
                allData = allData.concat(dataObj.data);
            }

            currentNextToken = dataObj?.nextToken;
            if (!currentNextToken) {
                break;
            }
        }

        console.log(`[Coupang Sync] Fetched ${pagesFetched} pages, total ${allData.length} items`);
        const data = { data: allData };

        // 향후 쿠팡 API가 아닌, 우리 사이트 DB의 `coupangSku`(신규 추가) 또는 `barcode`를 통해 상품명을 매칭합니다.
        // 쿠팡 옵션 ID에 해당하는 상품명을 DB에서 쉽게 불러오기 위함입니다.
        let itemsFetchedCount = 0;
        if (data?.data && Array.isArray(data.data)) {
            itemsFetchedCount = data.data.length;
            const externalSkus = data.data.map((item: any) => String(item.externalSkuId)).filter(Boolean);

            if (externalSkus.length > 0) {
                // DB에서 coupangSku 가 매칭되거나, barcode 가 매칭되는 상품을 모두 가져옵니다.
                const products = await prisma.product.findMany({
                    where: {
                        OR: [
                            { coupangSku: { in: externalSkus } },
                            { barcode: { in: externalSkus } }
                        ]
                    },
                    select: { coupangSku: true, barcode: true, name: true, nameEN: true }
                });

                const productMap = new Map();
                products.forEach(p => {
                    if (p.coupangSku) {
                        productMap.set(p.coupangSku, p.name || p.nameEN);
                    }
                    if (p.barcode) {
                        productMap.set(p.barcode, p.name || p.nameEN);
                    }
                });

                data.data = data.data.map((item: any) => {
                    const sku = String(item.externalSkuId);
                    item.productName = productMap.get(sku) || "알 수 없는 상품 (매칭 실패)";
                    return item;
                });
            }
        }

        // Record success in DB
        const syncHistory = await prisma.coupangSyncHistory.create({
            data: {
                status: "SUCCESS",
                itemsFetched: itemsFetchedCount
            }
        });

        return NextResponse.json({
            data: data.data,
            lastSyncedAt: syncHistory.createdAt
        });
    } catch (error: any) {
        console.error("Failed to fetch Coupang Inventory:", error);
        return NextResponse.json(
            { error: "Internal Server Error", message: error.message },
            { status: 500 }
        );
    }
}
