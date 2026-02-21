const crypto = require("crypto");
const { HttpsProxyAgent } = require("https-proxy-agent");
require("dotenv").config();

const ACCESS_KEY = process.env.COUPANG_ACCESS_KEY || "316ac83a-78d0-48e3-a8fe-41b744bd90fe";
const SECRET_KEY = process.env.COUPANG_SECRET_KEY || "75b0b84b0b70cace39e295cdf1eaf224e524c607";
const VENDOR_ID = process.env.COUPANG_VENDOR_ID || "A00534715";
const FIXIE_URL = process.env.FIXIE_URL || process.env.QUOTAGUARDSTATIC_URL || process.env.HTTP_PROXY || process.env.HTTPS_PROXY;

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

    let allData = [];
    let currentNextToken = "";

    for (let i = 0; i < 15; i++) {
        const path = `/v2/providers/rg_open_api/apis/api/v1/vendors/${VENDOR_ID}/rg/inventory/summaries`;
        const query = currentNextToken ? `nextToken=${currentNextToken}` : "";
        const fullPath = query ? `${path}?${query}` : path;

        console.log("Fetching: " + fullPath);
        const auth = generateHmacAuthHeader("GET", path, query);
        const options = { method: "GET", headers: { "Authorization": auth, "x-requested-with": "OPENAPI" } };
        if (FIXIE_URL) options.agent = new HttpsProxyAgent(FIXIE_URL);

        const res = await fetch(`https://api-gateway.coupang.com${fullPath}`, options);
        if (!res.ok) {
            console.error("Error", res.status, await res.text());
            break;
        }

        const data = await res.json();
        console.log(`Page ${i + 1} item count:`, data?.data?.length);
        if (data?.data && Array.isArray(data.data)) {
            allData = allData.concat(data.data);
        }
        currentNextToken = data?.nextToken;
        if (!currentNextToken) {
            console.log("No nextToken, finished");
            break;
        }
    }

    console.log("Total Fetched:", allData.length);
}
run();
