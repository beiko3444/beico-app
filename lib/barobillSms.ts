const SOAP_URL = 'https://ws.baroservice.com/SMS.asmx'

function getConfig() {
  return {
    CERTKEY: process.env.BAROBILL_CERTKEY || '',
    CORP_NUM: process.env.BAROBILL_CORP_NUM || '',
    SENDER_ID: process.env.BAROBILL_SMS_SENDER_ID || process.env.BAROBILL_CONTACT_ID || '',
    DEFAULT_FROM: process.env.BAROBILL_SMS_FROM || '',
  }
}

function ensureConfig() {
  const config = getConfig()
  if (!config.CERTKEY) throw new Error('BAROBILL_CERTKEY is not configured.')
  if (!config.CORP_NUM) throw new Error('BAROBILL_CORP_NUM is not configured.')
  if (!config.SENDER_ID) throw new Error('BAROBILL_SMS_SENDER_ID or BAROBILL_CONTACT_ID is not configured.')
  return config
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim()
}

function extractFirstTag(xml: string, tagName: string) {
  const match = xml.match(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, 'i'))
  return match ? decodeXml(match[1]) : ''
}

function extractSoapFault(xml: string) {
  const faultString =
    extractFirstTag(xml, 'faultstring') ||
    extractFirstTag(xml, 'soap:Text') ||
    extractFirstTag(xml, 'Reason')
  return faultString || ''
}

async function callSoapAction(action: string, innerXml: string) {
  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <${action} xmlns="http://ws.baroservice.com/">
      ${innerXml}
    </${action}>
  </soap:Body>
</soap:Envelope>`

  const response = await fetch(SOAP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: `http://ws.baroservice.com/${action}`,
    },
    body: soapBody,
  })

  const text = await response.text()
  const fault = extractSoapFault(text)
  if (fault) {
    throw new Error(`[Barobill SMS] SOAP Fault: ${fault}`)
  }
  if (!response.ok) {
    throw new Error(`[Barobill SMS] HTTP ${response.status}: ${text.slice(0, 300)}`)
  }

  return text
}

export type BarobillSmsFromNumber = {
  number: string
  validDate: string
}

export async function getBarobillSmsFromNumbers() {
  const config = ensureConfig()
  const xml = await callSoapAction(
    'GetSMSFromNumbers',
    `
      <CERTKEY>${escapeXml(config.CERTKEY)}</CERTKEY>
      <CorpNum>${escapeXml(config.CORP_NUM)}</CorpNum>
    `
  )

  const fromNumbers: BarobillSmsFromNumber[] = []
  const matches = xml.matchAll(/<FromNumber>([\s\S]*?)<\/FromNumber>/gi)
  for (const match of matches) {
    const block = match[1]
    const number = extractFirstTag(block, 'Number')
    const validDate = extractFirstTag(block, 'ValidDate')
    if (!number) continue
    fromNumbers.push({ number, validDate })
  }

  const deduped = Array.from(new Map(fromNumbers.map((item) => [item.number, item])).values())

  if (config.DEFAULT_FROM && !deduped.some((item) => item.number === config.DEFAULT_FROM)) {
    deduped.unshift({
      number: config.DEFAULT_FROM,
      validDate: '',
    })
  }

  return {
    senderId: config.SENDER_ID,
    defaultFromNumber: config.DEFAULT_FROM || deduped[0]?.number || '',
    fromNumbers: deduped,
  }
}

export async function getBarobillSmsErrorMessage(resultCode: number) {
  const config = ensureConfig()
  const xml = await callSoapAction(
    'GetErrString',
    `
      <CERTKEY>${escapeXml(config.CERTKEY)}</CERTKEY>
      <ErrCode>${resultCode}</ErrCode>
    `
  )

  return extractFirstTag(xml, 'GetErrStringResult') || `Unknown error (${resultCode})`
}

export type SendBarobillSmsParams = {
  fromNumber: string
  toName: string
  toNumber: string
  contents: string
  sendDT?: string
  refKey?: string
}

export async function sendBarobillMessage(params: SendBarobillSmsParams) {
  const config = ensureConfig()

  const xml = await callSoapAction(
    'SendMessage',
    `
      <CERTKEY>${escapeXml(config.CERTKEY)}</CERTKEY>
      <CorpNum>${escapeXml(config.CORP_NUM)}</CorpNum>
      <SenderID>${escapeXml(config.SENDER_ID)}</SenderID>
      <FromNumber>${escapeXml(params.fromNumber)}</FromNumber>
      <ToName>${escapeXml(params.toName)}</ToName>
      <ToNumber>${escapeXml(params.toNumber)}</ToNumber>
      <Contents>${escapeXml(params.contents)}</Contents>
      <SendDT>${escapeXml(params.sendDT || '')}</SendDT>
      <RefKey>${escapeXml(params.refKey || '')}</RefKey>
    `
  )

  const result = extractFirstTag(xml, 'SendMessageResult')
  if (!result) {
    throw new Error('Barobill SMS response did not include SendMessageResult.')
  }

  if (/^-?\d+$/.test(result)) {
    const numericResult = Number(result)
    if (numericResult <= 0) {
      const message = await getBarobillSmsErrorMessage(numericResult).catch(() => `Error code ${numericResult}`)
      return {
        success: false,
        resultCode: numericResult,
        message,
        receiptNum: '',
      }
    }
  }

  return {
    success: true,
    resultCode: 1,
    message: 'Message sent successfully.',
    receiptNum: result,
  }
}
