import { createHash } from 'crypto'

export const DEPOSIT_SMS_STATUSES = {
  AUTO_CONFIRMED: 'AUTO_CONFIRMED',
  UNMATCHED: 'UNMATCHED',
  AMBIGUOUS: 'AMBIGUOUS',
  NOT_DEPOSIT: 'NOT_DEPOSIT',
  DUPLICATE_OR_ALREADY_CONFIRMED: 'DUPLICATE_OR_ALREADY_CONFIRMED',
  ERROR: 'ERROR',
} as const

export type DepositSmsStatus = (typeof DEPOSIT_SMS_STATUSES)[keyof typeof DEPOSIT_SMS_STATUSES]

const OUTGOING_KEYWORDS = /(출금|이체출금|자동이체|인출|결제|승인|사용|체크카드|카드)/
const DEPOSIT_KEYWORDS = /(입금|받음|송금|이체)/
const BALANCE_KEYWORDS = /(잔액|잔고|남은금액)/

export function createDepositSmsHash(input: {
  sender: string
  body: string
  receivedAt: string | Date
}) {
  const receivedAt = input.receivedAt instanceof Date ? input.receivedAt.toISOString() : input.receivedAt
  return createHash('sha256')
    .update(`${input.sender.trim()}|${input.body.trim()}|${receivedAt}`)
    .digest('hex')
}

export function parseDepositSms(input: { body: string; amount?: unknown }) {
  const body = String(input.body || '')
  const isOutgoing = OUTGOING_KEYWORDS.test(body)
  const hasDepositKeyword = DEPOSIT_KEYWORDS.test(body)
  const amount = normalizeSmsAmount(input.amount) ?? extractSmsAmount(body)
  const bankName = extractBankName(body)
  const depositorName = extractDepositorName(body)

  return {
    amount,
    isDeposit: Boolean(amount && hasDepositKeyword && !isOutgoing),
    isOutgoing,
    bankName,
    depositorName,
  }
}

export function normalizeSmsAmount(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.round(value)
  if (typeof value !== 'string') return null
  const digits = value.replace(/[^\d]/g, '')
  if (!digits) return null
  const parsed = Number.parseInt(digits, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function extractSmsAmount(body: string) {
  const amountNearDeposit = body.match(/(?:입금|받음|송금|이체)[^\d]{0,24}((?:\d{1,3},)*\d{3,}|\d{4,})\s*(?:원|KRW)?/i)
  if (amountNearDeposit) {
    const amount = normalizeSmsAmount(amountNearDeposit[1])
    if (amount) return amount
  }

  const candidates: number[] = []
  const amountRegex = /(?:KRW|₩)?\s*((?:\d{1,3},)*\d{3,}|\d{4,})\s*(?:원|KRW)?/gi
  for (const match of body.matchAll(amountRegex)) {
    const index = match.index ?? 0
    const prefix = body.slice(Math.max(0, index - 12), index)
    if (BALANCE_KEYWORDS.test(prefix)) continue
    const amount = normalizeSmsAmount(match[1])
    if (amount && amount >= 1000) candidates.push(amount)
  }

  return candidates[0] ?? null
}

function extractBankName(body: string) {
  const bankMatch = body.match(/\[(.*?)\]|(국민|신한|우리|하나|기업|농협|카카오|토스|부산|대구|SC|케이뱅크|새마을|수협|우체국)/i)
  return (bankMatch?.[1] || bankMatch?.[2] || '').trim() || null
}

function extractDepositorName(body: string) {
  const amountNameMatch = body.match(/(?:입금|송금|받음|이체)[\s\S]{0,40}?(?:\d{1,3},)*\d{3,}\s*(?:원|KRW)?\s*([가-힣A-Za-z][가-힣A-Za-z0-9\s._-]{1,24})/)
  const amountName = cleanDepositorName(amountNameMatch?.[1])
  if (amountName) return amountName

  const depositorMatch = body.match(/(?:입금|송금|받음)\s*(?:자|인)?[:\s-]*([가-힣A-Za-z0-9]{2,20})/)
  const value = cleanDepositorName(depositorMatch?.[1])
  if (!value || /^\d+$/.test(value)) return null
  if (/원|KRW|잔액|입금/.test(value)) return null
  return value
}

function cleanDepositorName(value?: string) {
  if (!value) return null
  const cleaned = value
    .replace(/잔액[\s\S]*$/g, '')
    .replace(/입금[\s\S]*$/g, '')
    .replace(/출금[\s\S]*$/g, '')
    .replace(/받음[\s\S]*$/g, '')
    .replace(/송금[\s\S]*$/g, '')
    .trim()
  return cleaned || null
}
