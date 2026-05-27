export type UnipassQueryKind = 'cargMtNo' | 'mblNo' | 'hblNo'

export type UnipassQueryAttempt = {
    kind: UnipassQueryKind
    blYy: string | null
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

export function resolveUnipassQueryAttempts(rawBlNo: string, currentYear: number, lookbackYears: number) {
    const blNo = normalizeBlNo(rawBlNo)
    const attempts: UnipassQueryAttempt[] = []

    if (looksLikeCargoManagementNumber(blNo)) {
        attempts.push({ kind: 'cargMtNo', blYy: null })
    }

    const years: number[] = []
    for (let delta = 0; delta < lookbackYears; delta += 1) {
        years.push(currentYear - delta)
    }
    years.push(currentYear + 1)

    for (const year of Array.from(new Set(years))) {
        const blYy = formatBlYear(year)
        attempts.push({ kind: 'mblNo', blYy })
        attempts.push({ kind: 'hblNo', blYy })
    }

    return attempts
}

export function buildUnipassSearchParams(apiKey: string, blNo: string, attempt: UnipassQueryAttempt) {
    const params = new URLSearchParams({
        crkyCn: apiKey,
        [attempt.kind]: blNo,
    })

    if (attempt.blYy) {
        params.set('blYy', attempt.blYy)
    }

    return params
}
