import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HttpsProxyAgent } from "https-proxy-agent";
import fetch from "node-fetch";
import { requireAdminSession } from "@/lib/requireAdmin";

const ACCESS_KEY = process.env.COUPANG_ACCESS_KEY || "";
const SECRET_KEY = process.env.COUPANG_SECRET_KEY || "";
const VENDOR_ID = process.env.COUPANG_VENDOR_ID || "";
const COUPANG_CACHE_TTL_MS = 5 * 60 * 1000;

let cachedInventoryResponse: { expiresAt: number; payload: unknown } | null = null;

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

export async function GET(request: Request) {
    const { unauthorized } = await requireAdminSession();
    if (unauthorized) return unauthorized;

    try {
        const { searchParams } = new URL(request.url);
        const forceRefresh = searchParams.get("force") === "1";
        const now = Date.now();

        if (!forceRefresh && cachedInventoryResponse && cachedInventoryResponse.expiresAt > now) {
            return NextResponse.json(cachedInventoryResponse.payload, {
                headers: {
                    "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
                },
            });
        }

        if (!ACCESS_KEY || !SECRET_KEY || !VENDOR_ID) {
            return NextResponse.json(
                { error: "COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY / COUPANG_VENDOR_ID 환경변수가 필요합니다." },
                { status: 500 },
            );
        }

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
                    const mappedData = { name: p.name || p.nameEN, imageUrl: null };
                    if (p.coupangSku) {
                        productMap.set(p.coupangSku, mappedData);
                    }
                    if (p.barcode) {
                        productMap.set(p.barcode, mappedData);
                    }
                });

                data.data = data.data.map((item: any) => {
                    const sku = String(item.externalSkuId);
                    const mapped = productMap.get(sku);
                    item.productName = mapped?.name || "알 수 없는 상품 (매칭 실패)";
                    item.imageUrl = mapped?.imageUrl || null;
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

        const payload = {
            data: data.data,
            lastSyncedAt: syncHistory.createdAt
        };
        cachedInventoryResponse = {
            expiresAt: now + COUPANG_CACHE_TTL_MS,
            payload,
        };

        return NextResponse.json(payload, {
            headers: {
                "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
            },
        });
    } catch (error: any) {
        console.error("Failed to fetch Coupang Inventory:", error);
        return NextResponse.json(
            { error: "Internal Server Error", message: error.message },
            { status: 500 }
        );
    }
}
