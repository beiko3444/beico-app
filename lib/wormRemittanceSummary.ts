export const normalizeSummaryText = (value: string) => {
    const normalized = value.trim()
    return normalized ? normalized : null
}

export const formatSummaryAmount = (rawAmount: string, currency: 'USD' | 'KRW') => {
    const normalizedNumber = Number(String(rawAmount).replace(/,/g, ''))
    if (!Number.isFinite(normalizedNumber)) return null
    const formatted = currency === 'USD'
        ? normalizedNumber.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : normalizedNumber.toLocaleString('en-US', { maximumFractionDigits: 0 })
    return `${formatted} ${currency}`
}

export const extractSummaryAmountFromBlob = (
    blob: string | null,
    pattern: RegExp,
    currency: 'USD' | 'KRW',
) => {
    if (!blob) return null
    const match = blob.match(pattern)
    const rawAmount = match?.[1]
    if (!rawAmount) return null
    return formatSummaryAmount(rawAmount, currency)
}

export const extractSummaryRateFromBlob = (blob: string | null) => {
    if (!blob) return null
    const match = blob.match(/1\s*USD\s*=\s*([0-9,]+(?:\.\d+)?)\s*(?:KRW|원)/i)
    const rawAmount = match?.[1]
    if (!rawAmount) return null
    const normalizedNumber = Number(String(rawAmount).replace(/,/g, ''))
    if (!Number.isFinite(normalizedNumber)) return null
    return `1 USD = ${Math.round(normalizedNumber).toLocaleString('en-US')} KRW`
}

export const parseSummaryNumber = (value: string | null, mode: 'default' | 'rate' = 'default') => {
    if (!value) return null
    const matches = value.match(/-?\d[\d,]*(?:\.\d+)?/g)
    if (!matches || matches.length === 0) return null
    const candidate = mode === 'rate' ? matches[matches.length - 1] : matches[0]
    const parsed = Number(candidate.replace(/,/g, ''))
    return Number.isFinite(parsed) ? parsed : null
}

export type SummaryCurrency = 'krw' | 'usd' | 'any'

export const parseSummaryAmountByCurrency = (value: string | null, currency: SummaryCurrency) => {
    if (!value) return null
    const tokenRegex = /-?\d[\d,]*(?:\.\d+)?/g
    const usdMarkerRegex = /US\$|USD/i
    const krwMarkerRegex = /KRW|₩|원/i
    const candidates: Array<{ amount: number; currency: SummaryCurrency }> = []
    let match: RegExpExecArray | null = null

    while ((match = tokenRegex.exec(value)) !== null) {
        const numeric = Number((match[0] || '').replace(/,/g, ''))
        if (!Number.isFinite(numeric)) continue

        const start = match.index
        const end = start + match[0].length
        const contextStart = Math.max(0, start - 8)
        const contextEnd = Math.min(value.length, end + 8)
        const marker = value.slice(contextStart, contextEnd)
        const inferredCurrency: SummaryCurrency =
            usdMarkerRegex.test(marker)
                ? 'usd'
                : krwMarkerRegex.test(marker)
                    ? 'krw'
                    : 'any'

        candidates.push({ amount: numeric, currency: inferredCurrency })
    }

    if (candidates.length === 0) return null
    if (currency === 'any') return candidates[0]?.amount ?? null

    const exact = candidates.find((candidate) => candidate.currency === currency)
    if (exact) return exact.amount
    return null
}

export const pickPlausibleKrwAmount = (
    candidates: Array<number | null>,
    expected: number | null,
) => {
    const normalized = candidates
        .filter((candidate): candidate is number => candidate !== null && Number.isFinite(candidate) && candidate > 0)

    if (normalized.length === 0) return expected
    if (expected === null || !Number.isFinite(expected) || expected <= 0) return normalized[0]

    const plausible = normalized.filter((candidate) => {
        const ratio = candidate / expected
        return ratio >= 0.75 && ratio <= 1.35
    })

    if (plausible.length > 0) {
        return plausible.sort((a, b) => Math.abs(a - expected) - Math.abs(b - expected))[0]
    }

    return expected
}
