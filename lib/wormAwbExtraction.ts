export type AwbCandidate = {
  value: string
  score: number
  source: string
}

const AWB_KEYWORD_REGEX = /\b(?:AIR\s*WAYBILL|WAYBILL|AWB|MAWB|HAWB)\b/i
const NON_AWB_CONTEXT_REGEX = /\b(?:TEL|PHONE|MOBILE|FAX|EMAIL|E-?MAIL|CONTACT|INVOICE|DATE|TOTAL|QTY|PCS|KILO)\b/i
const PHONE_LIKE_PREFIX_REGEX = /^(010|011|016|017|018|019|070|080)/

export function normalizeOcrPatternText(input: string) {
  return input
    .toUpperCase()
    .replace(/[|IL]/g, '1')
    .replace(/[OQ]/g, '0')
    .replace(/Z/g, '2')
    .replace(/S/g, '5')
    .replace(/B/g, '8')
}

export function normalizeOcrDigits(input: string) {
  return normalizeOcrPatternText(input).replace(/[^\d]/g, '')
}

export function isValidAwbByCheckDigit(awb11: string) {
  if (!/^\d{11}$/.test(awb11)) return false
  const serial7 = Number.parseInt(awb11.slice(3, 10), 10)
  const checkDigit = Number.parseInt(awb11.slice(10), 10)
  return Number.isFinite(serial7) && Number.isFinite(checkDigit) && serial7 % 7 === checkDigit
}

export function mergeAwbCandidate(map: Map<string, AwbCandidate>, candidate: AwbCandidate) {
  const previous = map.get(candidate.value)
  if (!previous || candidate.score > previous.score) map.set(candidate.value, candidate)
}

export function extractAwbCandidatesFromText(text: string, source: string, trustBoost = 0): AwbCandidate[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (lines.length === 0) return []

  const byValue = new Map<string, AwbCandidate>()
  const addCandidate = (value: string, context: string, patternScore: number, lineIndex: number, suffix: string) => {
    const normalized = normalizeOcrDigits(value)
    if (normalized.length !== 11) return

    const upperContext = context.toUpperCase()
    const hasKeyword = AWB_KEYWORD_REGEX.test(upperContext)
    const checkDigitValid = isValidAwbByCheckDigit(normalized)
    let score = trustBoost + patternScore
    if (hasKeyword) score += 180
    if (lineIndex <= Math.max(1, Math.floor(lines.length * 0.4))) score += 35
    if (/^(112|180)/.test(normalized)) score += 20
    if (checkDigitValid) score += 420
    else score -= 180
    if (/^0/.test(normalized)) score -= 200
    if (PHONE_LIKE_PREFIX_REGEX.test(normalized)) score -= 260
    if (!hasKeyword && NON_AWB_CONTEXT_REGEX.test(upperContext)) score -= 70

    mergeAwbCandidate(byValue, { value: normalized, score, source: `${source} (${suffix})` })
  }

  const addFromChunk = (chunk: string, context: string, lineIndex: number, suffix: string) => {
    const upper = chunk.toUpperCase()
    const digitFriendly = normalizeOcrPatternText(upper)
    let match: RegExpExecArray | null

    const airportRegex = /(?:^|[^\d])(\d{3})\s+[A-Z]{3}\s*(\d{4})\s*(\d{4})(?=[^\d]|$)/g
    while ((match = airportRegex.exec(upper)) !== null) {
      addCandidate(`${match[1]}${match[2]}${match[3]}`, context, 300, lineIndex, `${suffix}-airport`)
    }

    const groupedRegex = /(?:^|[^\d])(\d{3})[\s\-_.:/]*(\d{4})[\s\-_.:/]*(\d{4})(?=[^\d]|$)/g
    while ((match = groupedRegex.exec(digitFriendly)) !== null) {
      addCandidate(`${match[1]}${match[2]}${match[3]}`, context, 270, lineIndex, `${suffix}-grouped`)
    }

    const tripleEightRegex = /(?:^|[^\d])(\d{3})[\s\-_.:/]*(\d{8})(?=[^\d]|$)/g
    while ((match = tripleEightRegex.exec(digitFriendly)) !== null) {
      addCandidate(`${match[1]}${match[2]}`, context, 300, lineIndex, `${suffix}-3x8`)
    }

    const compactRegex = /(?:^|[^\d])(\d{11})(?=[^\d]|$)/g
    while ((match = compactRegex.exec(digitFriendly)) !== null) {
      addCandidate(match[1], context, 220, lineIndex, `${suffix}-compact`)
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] || ''
    const previous = lines[index - 1] || ''
    const next = lines[index + 1] || ''
    const context = `${previous} ${line} ${next}`.trim()
    addFromChunk(line, context, index + 1, 'line')
    if (next) addFromChunk(`${line} ${next}`, context, index + 1, 'merged')
  }

  return Array.from(byValue.values()).sort((left, right) => right.score - left.score)
}

export function bestTrustedAwbCandidate(candidates: AwbCandidate[]) {
  return candidates.find((candidate) => isValidAwbByCheckDigit(candidate.value) && candidate.score >= 500) || null
}
