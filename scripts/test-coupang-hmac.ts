import crypto from "crypto";

const ACCESS_KEY = "316ac83a-78d0-48e3-a8fe-41b744bd90fe";
const SECRET_KEY = "75b0b84b0b70cace39e295cdf1eaf224e524c607";
const VENDOR_ID = "A00534715";

function generateHmacAuthHeader(method: string, path: string, query: string = "") {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const day = String(now.getUTCDate()).padStart(2, "0");
    const hour = String(now.getUTCHours()).padStart(2, "0");
    const minute = String(now.getUTCMinutes()).padStart(2, "0");
    const second = String(now.getUTCSeconds()).padStart(2, "0");
    const datetime = `${year}${month}${day}T${hour}${minute}${second}Z`;

    // Important: Coupang requires the query string format to be specifically structured without a leading '?'.
    // If there is no query string, it should be empty.
    const message = datetime + method + path + query;
    const signature = crypto
        .createHmac("sha256", SECRET_KEY)
        .update(message)
        .digest("hex");

    return {
        str: `CEA algorithm=HmacSHA256, access-key=${ACCESS_KEY}, signed-date=${datetime}, signature=${signature}`,
        message: message
    };
}

async function fetchCoupang() {
    const path = `/v2/providers/rg_open_api/apis/api/v1/vendors/${VENDOR_ID}/rg/inventory/summaries`;
    const query = "";

    // Test what Coupang expects exactly. Some docs say the query MUST NOT include the ? mark in the HMAC but NEEDS it in the URL.
    const auth = generateHmacAuthHeader("GET", path, query);
    console.log("Auth string:", auth.str);
    console.log("Message signed:", auth.message);

    try {
        const response = await fetch(`https://api-gateway.coupang.com${path}`, {
            method: "GET",
            headers: {
                "Authorization": auth.str,
                "x-requested-with": "OPENAPI",
                "Content-Type": "application/json",
            },
        });
        const text = await response.text();
        console.log("Response:", response.status, text);
    } catch (e) {
        console.error("Fetch failed:", e);
    }
}

fetchCoupang();
