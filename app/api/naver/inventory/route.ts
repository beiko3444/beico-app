import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { HttpsProxyAgent } from "https-proxy-agent";
import fetch from "node-fetch";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const NAVER_OAUTH_TOKEN_URL = "https://api.commerce.naver.com/external/v1/oauth2/token";
const NAVER_PRODUCT_SEARCH_URL = "https://api.commerce.naver.com/external/v1/products/search";
const DEFAULT_PAGE_SIZE = 200;
const MAX_PAGE_SIZE = 500;
const DEFAULT_MAX_PAGES = 20;
const MAX_FETCH_PAGES = 50;

type NaverProductSearchRequest = {
    page: number;
    size: number;
    orderType: "NO";
};

type NaverChannelProduct = {
    channelProductNo?: number;
    sellerManagementCode?: string;
    name?: string;
    statusType?: string;
    stockQuantity?: number;
    salePrice?: number;
    discountedPrice?: number;
    representativeImage?: {
        url?: string;
    };
};

type NaverProductSearchContent = {
    channelProducts?: NaverChannelProduct[];
};

type NaverProductSearchResponse = {
    contents?: NaverProductSearchContent[];
    page?: number;
    size?: number;
    totalElements?: number;
    totalPages?: number;
    last?: boolean;
};

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

function normalizeCode(value: unknown) {
    if (typeof value !== "string") return "";
    return value.trim().toUpperCase();
}

function clampNumber(value: number, min: number, max: number) {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
}

async function readErrorBody(response: Response) {
    const text = await response.text();
    if (!text) return `${response.status} ${response.statusText}`;

    try {
        const parsed = JSON.parse(text) as { message?: string; code?: string };
        if (parsed?.message) {
            return parsed?.code ? `${parsed.code}: ${parsed.message}` : parsed.message;
        }
    } catch {
        // ignore json parse error
    }

    return text.slice(0, 500);
}

function resolveProxyAgent() {
    const proxyUrl =
        process.env.NAVER_HTTP_PROXY ||
        process.env.QUOTAGUARDSTATIC_URL ||
        process.env.FIXIE_URL ||
        process.env.HTTPS_PROXY ||
        process.env.HTTP_PROXY ||
        "";

    if (!proxyUrl) return undefined;
    return new HttpsProxyAgent(proxyUrl);
}

async function issueNaverAccessToken(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cachedAccessToken && cachedAccessToken.expiresAt - 60_000 > now) {
        return cachedAccessToken.token;
    }

    const clientId = process.env.NAVER_COMMERCE_CLIENT_ID || "";
    const clientSecret = process.env.NAVER_COMMERCE_CLIENT_SECRET || "";
    // Default to SELF so account_id is not mandatory for single-store integrations.
    const tokenType = (process.env.NAVER_COMMERCE_TOKEN_TYPE || "").trim().toUpperCase();
    const accountId = process.env.NAVER_COMMERCE_ACCOUNT_ID || "";
    const resolvedTokenType = tokenType || (accountId ? "SELLER" : "SELF");

    if (!clientId || !clientSecret) {
        throw new Error("NAVER_COMMERCE_CLIENT_ID / NAVER_COMMERCE_CLIENT_SECRET 환경변수가 필요합니다.");
    }
    if (resolvedTokenType === "SELLER" && !accountId) {
        throw new Error("SELLER 토큰 사용 시 NAVER_COMMERCE_ACCOUNT_ID(accountUid) 환경변수가 필요합니다. accountUid가 없으면 NAVER_COMMERCE_TOKEN_TYPE=SELF 로 설정하세요.");
    }

    const timestamp = now.toString();
    const password = `${clientId}_${timestamp}`;
    const hashed = bcrypt.hashSync(password, clientSecret);
    const signature = Buffer.from(hashed, "utf-8").toString("base64");

    const body = new URLSearchParams({
        client_id: clientId,
        timestamp,
        client_secret_sign: signature,
        grant_type: "client_credentials",
        type: resolvedTokenType,
    });
    if (resolvedTokenType === "SELLER") {
        body.set("account_id", accountId);
    }

    const response = await fetch(NAVER_OAUTH_TOKEN_URL, {
        method: "POST",
        agent: resolveProxyAgent(),
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
        },
        body: body.toString(),
    });

    if (!response.ok) {
        const errorBody = await readErrorBody(response);
        throw new Error(`네이버 인증 토큰 발급 실패: ${errorBody}`);
    }

    const data = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!data?.access_token) {
        throw new Error("네이버 인증 토큰 발급 응답에 access_token이 없습니다.");
    }

    const expiresInMs = Math.max(60, Number(data.expires_in || 10_800)) * 1000;
    cachedAccessToken = {
        token: data.access_token,
        expiresAt: now + expiresInMs,
    };

    return data.access_token;
}

async function requestProductPage(accessToken: string, payload: NaverProductSearchRequest) {
    const response = await fetch(NAVER_PRODUCT_SEARCH_URL, {
        method: "POST",
        agent: resolveProxyAgent(),
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify(payload),
    });

    return response;
}

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const url = new URL(request.url);
        const pageSize = clampNumber(
            Number.parseInt(url.searchParams.get("size") || `${DEFAULT_PAGE_SIZE}`, 10),
            1,
            MAX_PAGE_SIZE,
        );
        const maxPages = clampNumber(
            Number.parseInt(url.searchParams.get("maxPages") || `${DEFAULT_MAX_PAGES}`, 10),
            1,
            MAX_FETCH_PAGES,
        );

        let accessToken = await issueNaverAccessToken();
        let currentPage = 1;
        let totalPages = 1;
        const flattenedProducts: NaverChannelProduct[] = [];

        while (currentPage <= totalPages && currentPage <= maxPages) {
            const payload: NaverProductSearchRequest = { page: currentPage, size: pageSize, orderType: "NO" };
            let response = await requestProductPage(accessToken, payload);

            if (response.status === 401) {
                accessToken = await issueNaverAccessToken(true);
                response = await requestProductPage(accessToken, payload);
            }

            if (!response.ok) {
                if (response.status === 404) {
                    break;
                }
                const errorBody = await readErrorBody(response);
                throw new Error(`네이버 상품 목록 조회 실패(page:${currentPage}): ${errorBody}`);
            }

            const pageData = (await response.json()) as NaverProductSearchResponse;
            const contents = Array.isArray(pageData.contents) ? pageData.contents : [];

            for (const content of contents) {
                const channelProducts = Array.isArray(content.channelProducts) ? content.channelProducts : [];
                flattenedProducts.push(...channelProducts);
            }

            const parsedTotalPages = Number(pageData.totalPages);
            if (Number.isFinite(parsedTotalPages) && parsedTotalPages > 0) {
                totalPages = parsedTotalPages;
            }

            if (pageData.last || contents.length === 0) {
                break;
            }

            currentPage += 1;
        }

        const sellerCodes = Array.from(
            new Set(flattenedProducts.map((product) => normalizeCode(product.sellerManagementCode)).filter(Boolean)),
        );

        const dbProductMap = new Map<string, { name: string | null; nameEN: string | null; imageUrl: string | null; productCode: string | null }>();
        if (sellerCodes.length > 0) {
            const dbProducts = await prisma.product.findMany({
                where: {
                    OR: [
                        { productCode: { in: sellerCodes } },
                        { barcode: { in: sellerCodes } },
                    ],
                },
                select: {
                    productCode: true,
                    barcode: true,
                    name: true,
                    nameEN: true,
                    imageUrl: true,
                },
            });

            for (const product of dbProducts) {
                const mapValue = {
                    name: product.name,
                    nameEN: product.nameEN,
                    imageUrl: product.imageUrl,
                    productCode: product.productCode ? String(product.productCode).toUpperCase() : null,
                };
                if (product.productCode) {
                    dbProductMap.set(normalizeCode(product.productCode), mapValue);
                }
                if (product.barcode) {
                    dbProductMap.set(normalizeCode(product.barcode), mapValue);
                }
            }
        }

        const inventory = flattenedProducts.map((product) => {
            const normalizedSellerCode = normalizeCode(product.sellerManagementCode);
            const matched = normalizedSellerCode ? dbProductMap.get(normalizedSellerCode) : undefined;

            return {
                channelProductNo: Number.isFinite(Number(product.channelProductNo)) ? Number(product.channelProductNo) : null,
                sellerManagementCode: product.sellerManagementCode || "",
                productName: product.name || "",
                dbProductName: matched?.name || matched?.nameEN || null,
                dbProductCode: matched?.productCode || null,
                imageUrl: matched?.imageUrl || product.representativeImage?.url || null,
                stockQuantity: Number.isFinite(Number(product.stockQuantity)) ? Number(product.stockQuantity) : 0,
                statusType: product.statusType || "",
                salePrice: Number.isFinite(Number(product.salePrice)) ? Number(product.salePrice) : null,
                discountedPrice: Number.isFinite(Number(product.discountedPrice)) ? Number(product.discountedPrice) : null,
            };
        });

        return NextResponse.json({
            data: inventory,
            fetchedAt: new Date().toISOString(),
            paging: {
                requestedPageSize: pageSize,
                fetchedPages: Math.min(currentPage, maxPages),
                totalPages,
                totalItems: inventory.length,
            },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Internal Server Error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
