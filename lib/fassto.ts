const FASSTO_API_URL = (process.env.FASSTO_API_URL || 'https://fmsapi.fassto.ai').trim()
const FASSTO_API_CD = (process.env.FASSTO_API_CD || '').trim()
const FASSTO_API_KEY = (process.env.FASSTO_API_KEY || '').trim()
const FASSTO_CST_CD = (process.env.FASSTO_CST_CD || '').trim()

type FasstoHeader = {
  code?: string
  dataCount?: number
  msg?: string
}

type FasstoErrorInfo = {
  errorCode?: string
  errorMessage?: string
  errorData?: unknown[]
}

export type FasstoEnvelope<T = unknown> = {
  header?: FasstoHeader
  errorInfo?: FasstoErrorInfo
  data?: T
}

export class FasstoApiError extends Error {
  status: number
  errorCode?: string
  path: string
  method: string
  details?: unknown[]

  constructor(params: {
    message: string
    status: number
    path: string
    method: string
    errorCode?: string
    details?: unknown[]
  }) {
    super(params.message)
    this.name = 'FasstoApiError'
    this.status = params.status
    this.errorCode = params.errorCode
    this.path = params.path
    this.method = params.method
    this.details = params.details
  }
}

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

function isTokenValid() {
  if (!cachedToken || !tokenExpiry) return false
  return Date.now() < tokenExpiry.getTime() - 60_000
}

function assertConfigured() {
  const missing: string[] = []
  if (!FASSTO_API_URL) missing.push('FASSTO_API_URL')
  if (!FASSTO_API_CD) missing.push('FASSTO_API_CD')
  if (!FASSTO_API_KEY) missing.push('FASSTO_API_KEY')
  if (!FASSTO_CST_CD) missing.push('FASSTO_CST_CD')

  if (missing.length > 0) {
    throw new Error(`FASSTO 환경변수가 비어 있습니다: ${missing.join(', ')}`)
  }
}

async function parseJsonSafe<T>(res: Response): Promise<T | null> {
  const text = await res.text()
  if (!text) return null

  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`Fassto 응답 JSON 파싱 실패: ${text.slice(0, 200)}`)
  }
}

function resolveErrorMessage(method: string, path: string, status: number, json: FasstoEnvelope | null) {
  return (
    json?.errorInfo?.errorMessage ||
    json?.header?.msg ||
    `Fassto API 오류 (${method} ${path}, status ${status})`
  )
}

export function isFasstoConfigured() {
  return Boolean(FASSTO_API_URL && FASSTO_API_CD && FASSTO_API_KEY && FASSTO_CST_CD)
}

export function getFasstoConfigSummary() {
  return {
    apiUrl: FASSTO_API_URL,
    cstCd: FASSTO_CST_CD,
    configured: isFasstoConfigured(),
    hasApiCd: Boolean(FASSTO_API_CD),
    hasApiKey: Boolean(FASSTO_API_KEY),
    hasCstCd: Boolean(FASSTO_CST_CD),
  }
}

export function clearFasstoTokenCache() {
  cachedToken = null
  tokenExpiry = null
}

export async function getAccessToken(): Promise<string> {
  assertConfigured()

  if (isTokenValid()) {
    return cachedToken as string
  }

  const path = `/api/v1/auth/connect?apiCd=${encodeURIComponent(FASSTO_API_CD)}&apiKey=${encodeURIComponent(FASSTO_API_KEY)}`
  const url = `${FASSTO_API_URL}${path}`
  const res = await fetch(url, {
    method: 'POST',
    cache: 'no-store',
  })
  const json = await parseJsonSafe<FasstoEnvelope<{ accessToken?: string, expreDatetime?: string }>>(res)

  if (!res.ok || !json?.data?.accessToken || !json.data.expreDatetime) {
    throw new FasstoApiError({
      message: resolveErrorMessage('POST', path, res.status, json),
      status: res.status,
      errorCode: json?.errorInfo?.errorCode,
      details: json?.errorInfo?.errorData,
      path,
      method: 'POST',
    })
  }

  cachedToken = json.data.accessToken
  tokenExpiry = parseExpreDatetime(json.data.expreDatetime)
  return cachedToken
}

export async function fasstRequest<T = unknown>(method: string, path: string, body?: unknown): Promise<FasstoEnvelope<T>> {
  assertConfigured()

  const token = await getAccessToken()
  const url = `${FASSTO_API_URL}${path}`

  const res = await fetch(url, {
    method,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      accessToken: token,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const json = await parseJsonSafe<FasstoEnvelope<T>>(res)
  const hasBusinessError = Boolean(json?.errorInfo?.errorCode)

  if (!res.ok || hasBusinessError) {
    if (res.status === 401 || json?.errorInfo?.errorCode === 'INVALID_ACCESS') {
      clearFasstoTokenCache()
    }

    const error = new FasstoApiError({
      message: resolveErrorMessage(method, path, res.status, json),
      status: res.status,
      errorCode: json?.errorInfo?.errorCode,
      details: json?.errorInfo?.errorData,
      path,
      method,
    })
    console.error('[Fassto]', {
      method,
      path,
      status: res.status,
      errorCode: error.errorCode,
      message: error.message,
      details: error.details,
    })
    throw error
  }

  return json || {}
}

export function getCstCd() {
  assertConfigured()
  return FASSTO_CST_CD
}

export async function getStockList() {
  const cstCd = getCstCd()
  return fasstRequest<any[]>('GET', `/api/v1/stock/list/${cstCd}`)
}

export async function getGoodsList() {
  const cstCd = getCstCd()
  return fasstRequest<any[]>('GET', `/api/v1/goods/${cstCd}`)
}

export async function createGoods(params: any[]) {
  const cstCd = getCstCd()
  return fasstRequest<any>('POST', `/api/v1/goods/${cstCd}`, params)
}

export async function updateGoods(params: any[]) {
  const cstCd = getCstCd()
  return fasstRequest<any>('PATCH', `/api/v1/goods/${cstCd}`, params)
}

export async function getGoodsElements() {
  const cstCd = getCstCd()
  return fasstRequest<any>('GET', `/api/v1/goods/element/${cstCd}`)
}

export async function createWarehousing(params: any[]) {
  const cstCd = getCstCd()
  return fasstRequest<any>('POST', `/api/v1/warehousing/${cstCd}`, params)
}

export async function getWarehousingList(start: string, end: string) {
  const cstCd = getCstCd()
  return fasstRequest<any[]>('GET', `/api/v1/warehousing/${cstCd}/${start}/${end}`)
}

export async function getWarehousingDetail(slipNo: string) {
  const cstCd = getCstCd()
  return fasstRequest<any>('GET', `/api/v1/warehousing/detail/${cstCd}/${slipNo}`)
}

export async function updateWarehousing(params: any[]) {
  const cstCd = getCstCd()
  return fasstRequest<any>('PATCH', `/api/v1/warehousing/${cstCd}`, params)
}

export async function getWarehousingInspection(slipNo: string, whCd: string) {
  const cstCd = getCstCd()
  return fasstRequest<any>('GET', `/api/v1/warehousing/inspec/${cstCd}/${slipNo}/${whCd}`)
}

export async function getDeliveryList(start: string, end: string, status = 'ALL', outDiv = '1') {
  const cstCd = getCstCd()
  return fasstRequest<any[]>('GET', `/api/v1/delivery/${cstCd}/${start}/${end}/${status}/${outDiv}`)
}

export async function getDeliveryDetail(slipNo: string) {
  const cstCd = getCstCd()
  return fasstRequest<any>('GET', `/api/v1/delivery/detail/${cstCd}/${slipNo}`)
}
