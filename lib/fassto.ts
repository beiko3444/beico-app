const FASSTO_API_URL = process.env.FASSTO_API_URL || 'https://fmsapi.fassto.ai'
const FASSTO_API_CD = process.env.FASSTO_API_CD || ''
const FASSTO_API_KEY = process.env.FASSTO_API_KEY || ''
const FASSTO_CST_CD = process.env.FASSTO_CST_CD || ''

let cachedToken: string | null = null
let tokenExpiry: Date | null = null

function parseExpreDatetime(expr: string): Date {
    const y = expr.substring(0, 4)
    const m = expr.substring(4, 6)
    const d = expr.substring(6, 8)
    const h = expr.substring(8, 10)
    const mi = expr.substring(10, 12)
    const s = expr.substring(12, 14)
    return new Date(`${y}-${m}-${d}T${h}:${mi}:${s}`)
}

export async function getAccessToken(): Promise<string> {
    if (cachedToken && tokenExpiry && new Date() < tokenExpiry) {
        return cachedToken
    }

    const url = `${FASSTO_API_URL}/api/v1/auth/connect?apiCd=${encodeURIComponent(FASSTO_API_CD)}&apiKey=${encodeURIComponent(FASSTO_API_KEY)}`
    const res = await fetch(url, { method: 'POST' })
    const json = await res.json()

    if (!res.ok || !json.data?.accessToken) {
        throw new Error(json.errorInfo?.errorMessage || 'Fassto 인증 실패')
    }

    cachedToken = json.data.accessToken
    tokenExpiry = parseExpreDatetime(json.data.expreDatetime)
    return cachedToken!
}

export async function fasstRequest(method: string, path: string, body?: any) {
    const token = await getAccessToken()
    const url = `${FASSTO_API_URL}${path}`

    const res = await fetch(url, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'accessToken': token,
        },
        body: body ? JSON.stringify(body) : undefined,
    })

    const json = await res.json()

    if (!res.ok) {
        throw new Error(json.errorInfo?.errorMessage || json.header?.msg || `Fassto API 오류 (${res.status})`)
    }

    return json
}

export function getCstCd() {
    return FASSTO_CST_CD
}

export async function getStockList() {
    const cstCd = getCstCd()
    return fasstRequest('GET', `/api/v1/stock/list/${cstCd}`)
}

export async function getGoodsList() {
    const cstCd = getCstCd()
    return fasstRequest('GET', `/api/v1/goods/${cstCd}`)
}

export async function createWarehousing(params: any[]) {
    const cstCd = getCstCd()
    return fasstRequest('POST', `/api/v1/warehousing/${cstCd}`, params)
}

export async function getWarehousingList(start: string, end: string) {
    const cstCd = getCstCd()
    return fasstRequest('GET', `/api/v1/warehousing/${cstCd}/${start}/${end}`)
}

export async function getWarehousingDetail(slipNo: string) {
    const cstCd = getCstCd()
    return fasstRequest('GET', `/api/v1/warehousing/detail/${cstCd}/${slipNo}`)
}
