const crypto = require("crypto");
const https = require("https");
const { HttpsProxyAgent } = require("https-proxy-agent");

require("dotenv").config();

const ACCESS_KEY = process.env.COUPANG_ACCESS_KEY || "316ac83a-78d0-48e3-a8fe-41b744bd90fe";
const SECRET_KEY = process.env.COUPANG_SECRET_KEY || "75b0b84b0b70cace39e295cdf1eaf224e524c607";
const VENDOR_ID = process.env.COUPANG_VENDOR_ID || "A00534715";

function generateHmacAuthHeader(method, path, query = "") {
    const now = new Date();
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

async function fetchProduct(id) {
    // 1. First, search seller-products by sellerProductId
    // or maybe /v2/providers/seller_api/apis/api/v1/marketplace/meta/seller-products
    // Let's try vendorItem API
    // GET /v2/providers/seller_api/apis/api/v1/marketplace/vendor-items/{vendorItemId}
    const path = `/v2/providers/seller_api/apis/api/v1/marketplace/vendor-items/${id}`;

    // The user's externalSkuId is maybe sellerProductId?
    // How about GET /v2/providers/seller_api/apis/api/v1/marketplace/seller-products/${id}
    const pathSellerProduct = `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/${id}`;

    const authorization = generateHmacAuthHeader("GET", pathSellerProduct, "");

    const fetchOptions = {
        method: "GET",
        headers: {
            "Authorization": authorization,
            "x-requested-with": "OPENAPI",
            "Content-Type": "application/json",
        },
    };

    if (process.env.FIXIE_URL) {
        fetchOptions.agent = new HttpsProxyAgent(process.env.FIXIE_URL);
    }

    console.log("Fetching: " + pathSellerProduct);
    const fetchMod = await import("node-fetch");
    const fetch = fetchMod.default;
    const res = await fetch(`https://api-gateway.coupang.com${pathSellerProduct}`, fetchOptions);
    const text = await res.text();
    console.log(`Response for ${id} (seller-product API):`, text);
}

// from the user's error message, these are externalSkuIds: 66063158, 59957899
fetchProduct("66063158");
