export const SMS_FORWARDER_DEFAULT_FROM_NUMBER = '01081193313'
export const SMS_FORWARDER_DEFAULT_FROM_NUMBER_DISPLAY = '010-8119-3313'

export type SmsForwarderSendParams = {
  fromNumber?: string
  toName: string
  toNumber: string
  contents: string
  refKey: string
}

export type SmsForwarderResult = {
  success: boolean
  resultCode: number
  receiptNum: string
  message: string
  raw?: unknown
}

export function normalizeSmsPhoneNumber(value: string) {
  return value.replace(/\D/g, '')
}

export function buildPickupSmsContents(date: Date, pickupCount: number) {
  const month = date.getMonth() + 1
  const day = date.getDate()

  return [
    '소장님, 엑스트래커 입니다.',
    `${month}/${day}, 출고 ${pickupCount}건 집하부탁드립니다.`,
    '감사합니다.',
  ].join('\n')
}

export function getSmsForwarderSenderInfo() {
  return {
    senderId: 'sms-forwarder',
    defaultFromNumber: SMS_FORWARDER_DEFAULT_FROM_NUMBER,
    fromNumbers: [
      {
        number: SMS_FORWARDER_DEFAULT_FROM_NUMBER,
        validDate: '',
      },
    ],
  }
}

function getForwarderConfig() {
  return {
    url: (process.env.SMS_FORWARDER_URL || '').trim(),
    secret: (process.env.SMS_FORWARDER_SECRET || '').trim(),
  }
}

function extractReceiptNum(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object') return fallback
  const record = payload as Record<string, unknown>
  for (const key of ['receiptNum', 'messageId', 'id', 'requestId', 'refKey']) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return fallback
}

export function buildSmsForwarderPayload(params: SmsForwarderSendParams) {
  return {
    fromNumber: normalizeSmsPhoneNumber(params.fromNumber || SMS_FORWARDER_DEFAULT_FROM_NUMBER),
    toName: params.toName,
    toNumber: normalizeSmsPhoneNumber(params.toNumber),
    message: params.contents,
    contents: params.contents,
    refKey: params.refKey,
  }
}

export async function sendSmsViaForwarder(params: SmsForwarderSendParams): Promise<SmsForwarderResult> {
  const config = getForwarderConfig()
  if (!config.url) {
    throw new Error('SMS_FORWARDER_URL is not configured.')
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (config.secret) {
    headers['X-SMS-Forwarder-Secret'] = config.secret
  }

  const response = await fetch(config.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(buildSmsForwarderPayload(params)),
  })

  const text = await response.text()
  let payload: unknown = null
  if (text.trim()) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = text
    }
  }

  if (!response.ok) {
    const detail = typeof payload === 'string' ? payload : JSON.stringify(payload)
    throw new Error(`SMS forwarder HTTP ${response.status}: ${detail.slice(0, 300)}`)
  }

  return {
    success: true,
    resultCode: 1,
    receiptNum: extractReceiptNum(payload, params.refKey),
    message: 'Message queued by SMS forwarder.',
    raw: payload,
  }
}
