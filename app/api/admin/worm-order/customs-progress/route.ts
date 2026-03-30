import { NextRequest, NextResponse } from 'next/server'

const DEFAULT_UNIPASS_API_KEY = 'r290g216h033p330q080i040q6'
const UNIPASS_API_URL = 'https://unipass.customs.go.kr:38010/ext/rest/cargCsclPrgsInfoQry/retrieveCargCsclPrgsInfo'
const LOOKBACK_YEARS = 3

type QueryKind = 'mblNo' | 'hblNo'

type Api001ParseResult = {
    tCnt: number
    ntceInfo: string
    summaryRecords: Array<Record<string, string>>
    detailRecords: Array<Record<string, string>>
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
    const matched = xml.match(pattern)
    return matched?.[1] ? decodeXmlValue(matched[1]) : ''
}

function extractRecordBlocks(xml: string, blockTag: string) {
    const records: Array<Record<string, string>> = []
    const blockRegex = new RegExp(`<${blockTag}>([\\s\\S]*?)<\\/${blockTag}>`, 'g')

    for (const blockMatch of xml.matchAll(blockRegex)) {
        const blockContent = blockMatch[1] || ''
        const row: Record<string, string> = {}
        const fieldRegex = /<([a-zA-Z0-9_]+)>([\s\S]*?)<\/\1>/g

        for (const fieldMatch of blockContent.matchAll(fieldRegex)) {
            const key = fieldMatch[1]
            const value = decodeXmlValue(fieldMatch[2] || '')
            row[key] = value
        }

        if (Object.keys(row).length > 0) {
            records.push(row)
        }
    }

    return records
}

function parseApi001Xml(xml: string): Api001ParseResult {
    const tCntRaw = extractTagValue(xml, 'tCnt')
    const parsedCount = Number.parseInt(tCntRaw, 10)
    const tCnt = Number.isFinite(parsedCount) ? parsedCount : 0
    const ntceInfo = extractTagValue(xml, 'ntceInfo')
    const summaryRecords = extractRecordBlocks(xml, 'cargCsclPrgsInfoQryVo')
    const detailRecords = extractRecordBlocks(xml, 'cargCsclPrgsInfoDtlQryVo')

    return { tCnt, ntceInfo, summaryRecords, detailRecords }
}

async function requestApi001(apiKey: string, blNo: string, blYy: string, kind: QueryKind) {
    const params = new URLSearchParams({
        crkyCn: apiKey,
        blYy,
        [kind]: blNo,
    })

    const response = await fetch(`${UNIPASS_API_URL}?${params.toString()}`, {
        method: 'GET',
        headers: {
            Accept: 'application/xml,text/xml,*/*',
        },
        cache: 'no-store',
    })

    const rawXml = await response.text()
    if (!response.ok) {
        throw new Error(`UNI-PASS 요청 실패 (${response.status})`)
    }

    return parseApi001Xml(rawXml)
}

export async function GET(request: NextRequest) {
    const apiKey = process.env.UNIPASS_API_KEY || DEFAULT_UNIPASS_API_KEY
    const rawBlNo = request.nextUrl.searchParams.get('blNo') || ''
    const blNo = rawBlNo.replace(/\s+/g, '').trim()

    if (!blNo) {
        return NextResponse.json({ error: 'B/L 번호를 입력해주세요.' }, { status: 400 })
    }

    if (blNo.length < 6) {
        return NextResponse.json({ error: 'B/L 번호 형식이 너무 짧습니다.' }, { status: 400 })
    }

    const currentYear = new Date().getFullYear()
    const attempts: Array<{ kind: QueryKind; blYy: string; tCnt: number; ntceInfo: string }> = []

    for (let delta = 0; delta < LOOKBACK_YEARS; delta += 1) {
        const blYy = String(currentYear - delta)

        for (const kind of ['mblNo', 'hblNo'] as const) {
            try {
                const parsed = await requestApi001(apiKey, blNo, blYy, kind)
                attempts.push({ kind, blYy, tCnt: parsed.tCnt, ntceInfo: parsed.ntceInfo })

                const hasData = parsed.tCnt > 0 || parsed.summaryRecords.length > 0 || parsed.detailRecords.length > 0
                const looksLikeListMode = parsed.ntceInfo.startsWith('[N00]')
                if (hasData || looksLikeListMode) {
                    return NextResponse.json({
                        blNo,
                        query: { kind, blYy },
                        tCnt: parsed.tCnt,
                        ntceInfo: parsed.ntceInfo,
                        summaryRecords: parsed.summaryRecords,
                        detailRecords: parsed.detailRecords,
                        attempts,
                    })
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : '조회 중 오류가 발생했습니다.'
                attempts.push({ kind, blYy, tCnt: -1, ntceInfo: message })
            }
        }
    }

    return NextResponse.json(
        {
            error: '조회 결과가 없습니다. B/L 번호를 다시 확인해주세요.',
            blNo,
            attempts,
        },
        { status: 404 },
    )
}
