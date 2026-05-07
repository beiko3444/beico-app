export type UnipassQueryKind = 'cargMtNo' | 'mblNo' | 'hblNo'

export type UnipassQueryAttempt = {
    kind: UnipassQueryKind
    blYy: string | null
}

export function formatBlYear(year: number) {
    return String(year)
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

    for (let delta = 0; delta < lookbackYears; delta += 1) {
        const blYy = formatBlYear(currentYear - delta)
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
