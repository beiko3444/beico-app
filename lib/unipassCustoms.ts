export type UnipassQueryKind = 'cargMtNo' | 'mblNo' | 'hblNo'

export type UnipassQueryAttempt = {
    kind: UnipassQueryKind
    blYy: string | null
    value: string
    label: string
}

export function formatBlYear(year: number) {
    return String(year)
}

export function getKoreaCurrentYear(date = new Date()) {
    const year = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
    }).format(date)

    return Number.parseInt(year, 10)
}

export function normalizeBlNo(input: string) {
    return input
        .replace(/\s+/g, '')
        .trim()
        .replace(/[^0-9a-zA-Z]/g, '')
        .toUpperCase()
}

function looksLikeCargoManagementNumber(blNo: string) {
    return /^[0-9A-Z]{15,19}$/.test(blNo)
}

export function looksLikeMasterAirWaybill(blNo: string) {
    return /^\d{11}$/.test(normalizeBlNo(blNo))
}

export function resolveUnipassQueryAttempts(rawBlNo: string, currentYear: number, lookbackYears: number) {
    const blNo = normalizeBlNo(rawBlNo)
    const attempts: UnipassQueryAttempt[] = []

    if (looksLikeCargoManagementNumber(blNo)) {
        attempts.push({ kind: 'cargMtNo', blYy: null, value: blNo, label: 'cargo-management-number' })
    }

    const years: number[] = []
    for (let delta = 0; delta < lookbackYears; delta += 1) {
        years.push(currentYear - delta)
    }
    years.push(currentYear + 1)

    const kinds: UnipassQueryKind[] = looksLikeMasterAirWaybill(blNo)
        ? ['mblNo', 'hblNo']
        : ['hblNo', 'mblNo']

    for (const year of Array.from(new Set(years))) {
        const blYy = formatBlYear(year)
        for (const kind of kinds) {
            attempts.push({
                kind,
                blYy,
                value: blNo,
                label: looksLikeMasterAirWaybill(blNo) ? 'master-air-waybill' : 'normalized',
            })
        }
    }

    return attempts
}

export function buildUnipassSearchParams(apiKey: string, blNo: string, attempt: UnipassQueryAttempt) {
    const params = new URLSearchParams({
        crkyCn: apiKey,
        [attempt.kind]: attempt.value || blNo,
    })

    if (attempt.blYy) {
        params.set('blYy', attempt.blYy)
    }

    return params
}
