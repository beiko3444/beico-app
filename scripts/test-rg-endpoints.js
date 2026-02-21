const crypto = require("crypto");
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
    return `CEA algorithm=HmacSHA256, access-key=${ACCESS_KEY}, signed-date=${datetime}, signature=${crypto.createHmac("sha256", SECRET_KEY).update(message).digest("hex")}`;
}

async function run() {
    const fetchMod = await import("node-fetch");
    const fetch = fetchMod.default;
    
    // Test 1: rg products
    const path1 = `/v2/providers/rg_open_api/apis/api/v1/vendors/${VENDOR_ID}/products`;
    const auth1 = generateHmacAuthHeader("GET", path1, "");
    
    console.log("Fetching: " + path1);
    const res1 = await fetch(`https://api-gateway.coupang.com${path1}`, { headers: { "Authorization": auth1 } });
    console.log("Status:", res1.status, await res1.text());
}
run();
