#!/usr/bin/env node
import bcrypt from 'bcryptjs'
import { normalizeNaverSalesRows } from './naver-sales-normalize.mjs'

const NAVER_BASE_URL = 'https://api.commerce.naver.com/external'
const TOKEN_URL = `${NAVER_BASE_URL}/v1/oauth2/token`

const env = {
  clientId: process.env.NAVER_COMMERCE_CLIENT_ID || process.env.SMARTSTORE_CLIENT_ID || '',
  clientSecret: process.env.NAVER_COMMERCE_CLIENT_SECRET || process.env.SMARTSTORE_CLIENT_SECRET || '',
  tokenType: (process.env.NAVER_COMMERCE_TOKEN_TYPE || process.env.SMARTSTORE_TOKEN_TYPE || 'SELF').toUpperCase(),
  accountId: process.env.NAVER_COMMERCE_ACCOUNT_ID || '',
  beikoApiUrl: process.env.BEIKO_NAVER_SALES_API_URL || '',
  ingestSecret: process.env.NAVER_SALES_INGEST_SECRET || '',
  sourceDevice: process.env.NAVER_SALES_SOURCE_DEVICE || 'raspberry-pi-naver-sales',
  days: clampInt(process.env.NAVER_SALES_DAYS, 1, 30, 2),
}

async function main() {
  validateEnv()

  const accessToken = await issueAccessToken()
  const channelNo = await fetchPrimaryChannelNo(accessToken)
  const dates = recentDates(env.days)
  const allRows = []

  for (const saleDate of dates) {
    const apiRows = await fetchProductSalesRows(accessToken, channelNo, saleDate)
    const normalized = normalizeNaverSalesRows(saleDate, apiRows)
    allRows.push(...normalized)
    console.log(`[naver-sales] ${saleDate}: fetched ${apiRows.length}, normalized ${normalized.length}`)
  }

  const payload = {
    sourceDevice: env.sourceDevice,
    startDate: dates[0],
    endDate: dates[dates.length - 1],
    saleDate: dates[dates.length - 1],
    fetchedAt: new Date().toISOString(),
    rows: allRows,
  }
  const result = await uploadToBeiko(payload)
  console.log(`[naver-sales] uploaded ${result.rowsUpserted || 0}/${result.rowsReceived || allRows.length} rows`)
}

function validateEnv() {
  const missing = []
  if (!env.clientId) missing.push('NAVER_COMMERCE_CLIENT_ID')
  if (!env.clientSecret) missing.push('NAVER_COMMERCE_CLIENT_SECRET')
  if (!env.beikoApiUrl) missing.push('BEIKO_NAVER_SALES_API_URL')
  if (!env.ingestSecret) missing.push('NAVER_SALES_INGEST_SECRET')
  if (env.tokenType === 'SELLER' && !env.accountId) missing.push('NAVER_COMMERCE_ACCOUNT_ID')
  if (missing.length > 0) {
    throw new Error(`환경변수가 필요합니다: ${missing.join(', ')}`)
  }
}

async function issueAccessToken() {
  const timestamp = Date.now().toString()
  const password = `${env.clientId}_${timestamp}`
  const hashed = bcrypt.hashSync(password, env.clientSecret)
  const signature = Buffer.from(hashed, 'utf-8').toString('base64')
  const body = new URLSearchParams({
    client_id: env.clientId,
    timestamp,
    client_secret_sign: signature,
    grant_type: 'client_credentials',
    type: env.tokenType,
  })
  if (env.tokenType === 'SELLER') body.set('account_id', env.accountId)

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  })
  if (!response.ok) {
    throw new Error(`네이버 토큰 발급 실패: ${await readError(response)}`)
  }
  const data = await response.json()
  if (!data?.access_token) throw new Error('네이버 토큰 응답에 access_token이 없습니다.')
  return data.access_token
}

async function fetchPrimaryChannelNo(accessToken) {
  const response = await fetch(`${NAVER_BASE_URL}/v1/seller/channels`, {
    headers: authHeaders(accessToken),
  })
  if (!response.ok) {
    throw new Error(`네이버 채널 조회 실패: ${await readError(response)}`)
  }
  const payload = await response.json()
  const rows = extractRows(payload)
  rows.sort((a, b) => channelRank(a) - channelRank(b))
  const channelNo = rows[0]?.channelNo
  if (!channelNo) throw new Error('네이버 채널 번호(channelNo)를 찾지 못했습니다.')
  return String(channelNo)
}

async function fetchProductSalesRows(accessToken, channelNo, saleDate) {
  const endpoint = `${NAVER_BASE_URL}/v1/bizdata-stats/channels/${channelNo}/sales/product/detail`
  const formats = [saleDate, saleDate.replaceAll('-', '')]
  const errors = []

  for (const value of formats) {
    const url = new URL(endpoint)
    url.searchParams.set('startDate', value)
    url.searchParams.set('endDate', value)
    const response = await fetch(url, { headers: authHeaders(accessToken) })
    if (!response.ok) {
      errors.push(`${url.toString()} -> ${await readError(response)}`)
      continue
    }
    const body = await response.json()
    return extractRows(body)
  }

  throw new Error(`네이버 판매량 조회 실패\n${errors.join('\n')}`)
}

async function uploadToBeiko(payload) {
  const response = await fetch(env.beikoApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-naver-sales-secret': env.ingestSecret,
    },
    body: JSON.stringify(payload),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(`베이코 업로드 실패: ${body?.error || response.statusText}`)
  }
  return body
}

function authHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
}

function extractRows(payload) {
  if (Array.isArray(payload)) return payload.filter((row) => row && typeof row === 'object')
  if (!payload || typeof payload !== 'object') return []
  for (const key of ['rows', 'data', 'content', 'items', 'channels', 'productUnitReport', 'productReport']) {
    if (Array.isArray(payload[key])) return payload[key].filter((row) => row && typeof row === 'object')
  }
  if (payload.productId || payload.channelNo) return [payload]
  return []
}

function channelRank(row) {
  const type = String(row?.channelType || '').toUpperCase()
  if (type === 'STOREFARM') return 0
  if (type === 'WINDOW') return 1
  return 2
}

function recentDates(days) {
  const dates = []
  const end = new Date()
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(end)
    date.setDate(end.getDate() - offset)
    dates.push(date.toISOString().slice(0, 10))
  }
  return dates
}

function clampInt(value, min, max, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

async function readError(response) {
  const text = await response.text()
  if (!text) return `${response.status} ${response.statusText}`
  try {
    const parsed = JSON.parse(text)
    return parsed?.message || parsed?.error || text.slice(0, 500)
  } catch {
    return text.slice(0, 500)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
