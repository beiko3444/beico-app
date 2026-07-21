import { request as httpsRequest } from 'node:https'
import {
  buildUnipassSearchParams,
  getKoreaCurrentYear,
  looksLikeMasterAirWaybill,
  normalizeBlNo,
  resolveUnipassQueryAttempts,
  type UnipassQueryAttempt,
} from './unipassCustoms'

const DEFAULT_UNIPASS_API_KEY = 'r290g216h033p330q080i040q6'
const UNIPASS_API_URL = 'https://unipass.customs.go.kr:38010/ext/rest/cargCsclPrgsInfoQry/retrieveCargCsclPrgsInfo'
const LOOKBACK_YEARS = 3
const REQUEST_TIMEOUT_MS = 15 * 1000
const REQUEST_RETRY_COUNT = 2

export type UnipassCustomsProgressPayload = {
  blNo: string
  query: UnipassQueryAttempt
  tCnt: number
  ntceInfo: string
  summaryRecords: Array<Record<string, string>>
  detailRecords: Array<Record<string, string>>
  attempts: Array<UnipassQueryAttempt & { tCnt: number; ntceInfo: string }>
}

export type UnipassCustomsLookupOutcome =
  | { ok: true; status: 200; payload: UnipassCustomsProgressPayload }
  | {
      ok: false
      status: 404 | 502
      payload: {
        error: string
        blNo: string
        attempts: Array<UnipassQueryAttempt & { tCnt: number; ntceInfo: string }>
      }
    }

type ParsedApiResponse = {
  tCnt: number
  ntceInfo: string
  summaryRecords: Array<Record<string, string>>
  detailRecords: Array<Record<string, string>>
}

function resolveApiKeys() {
  const configuredKey = process.env.UNIPASS_API_KEY?.trim()
  return Array.from(new Set([configuredKey, DEFAULT_UNIPASS_API_KEY].filter((key): key is string => Boolean(key))))
}

function decodeXmlValue(input: string) {
  return input
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

function extractTagValue(xml: string, tagName: string) {
  const pattern = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'i')
  return decodeXmlValue(xml.match(pattern)?.[1] || '')
}

function extractRecordBlocks(xml: string, blockTag: string) {
  const records: Array<Record<string, string>> = []
  const blockRegex = new RegExp(`<${blockTag}>([\\s\\S]*?)<\\/${blockTag}>`, 'g')

  for (const blockMatch of xml.matchAll(blockRegex)) {
    const row: Record<string, string> = {}
    const fieldRegex = /<([a-zA-Z0-9_]+)>([\s\S]*?)<\/\1>/g
    for (const fieldMatch of (blockMatch[1] || '').matchAll(fieldRegex)) {
      row[fieldMatch[1]] = decodeXmlValue(fieldMatch[2] || '')
    }
    if (Object.keys(row).length > 0) records.push(row)
  }

  return records
}

function parseApiXml(xml: string): ParsedApiResponse {
  const parsedCount = Number.parseInt(extractTagValue(xml, 'tCnt'), 10)
  return {
    tCnt: Number.isFinite(parsedCount) ? parsedCount : 0,
    ntceInfo: extractTagValue(xml, 'ntceInfo'),
    summaryRecords: extractRecordBlocks(xml, 'cargCsclPrgsInfoQryVo'),
    detailRecords: extractRecordBlocks(xml, 'cargCsclPrgsInfoDtlQryVo'),
  }
}

function formatRequestError(error: unknown) {
  if (!(error instanceof Error)) return String(error)
  const cause = (error as Error & { cause?: unknown }).cause
  if (cause instanceof Error && cause.message && cause.message !== error.message) {
    return `${error.message}: ${cause.message}`
  }
  if (cause && typeof cause === 'object' && 'code' in cause) {
    const code = (cause as { code?: string }).code
    if (code) return `${error.message}: ${code}`
  }
  return error.message
}

function requestXmlWithNodeHttps(url: string) {
  return new Promise<string>((resolve, reject) => {
    const request = httpsRequest(
      url,
      {
        method: 'GET',
        family: 4,
        headers: { Accept: 'application/xml,text/xml,*/*', 'User-Agent': 'beiko-admin/1.0' },
        timeout: REQUEST_TIMEOUT_MS,
      },
      (response) => {
        const chunks: Buffer[] = []
        response.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
        response.on('end', () => {
          const statusCode = response.statusCode || 0
          if (statusCode < 200 || statusCode >= 300) {
            reject(new Error(`UNI-PASS node HTTPS request failed (${statusCode})`))
            return
          }
          resolve(Buffer.concat(chunks).toString('utf8'))
        })
      },
    )
    request.on('timeout', () => request.destroy(new Error('UNI-PASS node HTTPS request timed out')))
    request.on('error', reject)
    request.end()
  })
}

async function requestXml(url: string) {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/xml,text/xml,*/*', 'User-Agent': 'beiko-admin/1.0' },
        cache: 'no-store',
        signal: controller.signal,
      })
      const xml = await response.text()
      if (!response.ok) throw new Error(`UNI-PASS fetch request failed (${response.status})`)
      return xml
    } finally {
      clearTimeout(timeout)
    }
  } catch (fetchError) {
    try {
      return await requestXmlWithNodeHttps(url)
    } catch (nodeError) {
      throw new Error(`fetch: ${formatRequestError(fetchError)}; node:https: ${formatRequestError(nodeError)}`)
    }
  }
}

async function requestAttempt(apiKey: string, blNo: string, attempt: UnipassQueryAttempt) {
  const url = `${UNIPASS_API_URL}?${buildUnipassSearchParams(apiKey, blNo, attempt).toString()}`
  let lastError: unknown = null

  for (let index = 0; index <= REQUEST_RETRY_COUNT; index += 1) {
    try {
      return parseApiXml(await requestXml(url))
    } catch (error) {
      lastError = error
      if (index < REQUEST_RETRY_COUNT) await new Promise((resolve) => setTimeout(resolve, 300 * (index + 1)))
    }
  }

  throw new Error(`UNI-PASS request failed: ${formatRequestError(lastError)}`)
}

export function isImportDeclarationAccepted(payload: UnipassCustomsProgressPayload) {
  const records = [...payload.summaryRecords, ...payload.detailRecords]
  return records.some((record) =>
    Object.values(record).some((value) => value.replace(/\s+/g, '').includes('수입신고수리')),
  )
}

export function customsProgressLabel(payload: UnipassCustomsProgressPayload) {
  const summary = payload.summaryRecords[0]
  return summary?.csclPrgsStts || summary?.prgsStts || payload.detailRecords.at(-1)?.prgsStts || '통관 진행 중'
}

export async function lookupUnipassCustomsProgress(rawBlNo: string): Promise<UnipassCustomsLookupOutcome> {
  const blNo = normalizeBlNo(rawBlNo)
  const currentYear = getKoreaCurrentYear()
  const attempts: Array<UnipassQueryAttempt & { tCnt: number; ntceInfo: string }> = []

  for (const apiKey of resolveApiKeys()) {
    for (const attempt of resolveUnipassQueryAttempts(blNo, currentYear, LOOKBACK_YEARS)) {
      try {
        const parsed = await requestAttempt(apiKey, blNo, attempt)
        attempts.push({ ...attempt, tCnt: parsed.tCnt, ntceInfo: parsed.ntceInfo })
        const hasData = parsed.tCnt > 0 || parsed.summaryRecords.length > 0 || parsed.detailRecords.length > 0
        const looksLikeListMode = parsed.ntceInfo.startsWith('[N00]')
        if (hasData || looksLikeListMode) {
          return {
            ok: true,
            status: 200,
            payload: { blNo, query: attempt, ...parsed, attempts },
          }
        }
      } catch (error) {
        attempts.push({
          ...attempt,
          tCnt: -1,
          ntceInfo: error instanceof Error ? error.message : '조회 중 오류가 발생했습니다.',
        })
      }
    }
  }

  const onlyFailures = attempts.length > 0 && attempts.every((attempt) => attempt.tCnt === -1)
  const currentYearFailure = attempts.some((attempt) => attempt.blYy === String(currentYear) && attempt.tCnt === -1)
  const onlyZeroAfterFailure = attempts.some((attempt) => attempt.tCnt >= 0) && attempts.every((attempt) => attempt.tCnt <= 0)
  const requestFailed = onlyFailures || (currentYearFailure && onlyZeroAfterFailure)
  const notFoundMessage = looksLikeMasterAirWaybill(blNo)
    ? `유니패스 통관 DB에 아직 조회 결과가 없습니다. ${blNo.slice(0, 3)}-${blNo.slice(3)} AWB가 실제 운송장이어도 한국 도착 전이거나 적하목록 전송 전이면 조회되지 않을 수 있습니다.`
    : '조회 결과가 없습니다. H B/L 또는 M B/L 번호와 입항연도를 확인해주세요.'

  return {
    ok: false,
    status: requestFailed ? 502 : 404,
    payload: {
      error: requestFailed ? '유니패스 서버 요청이 실패했습니다. 잠시 후 다시 조회해주세요.' : notFoundMessage,
      blNo,
      attempts,
    },
  }
}
