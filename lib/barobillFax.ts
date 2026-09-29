import { Client as FtpClient } from 'basic-ftp'
import { Readable } from 'stream'

// 바로빌 팩스 API. 파일을 바로빌 FTP(root)에 올린 뒤 SendFaxFromFTP로 전송하는 구조.
// 문서: https://dev.barobill.co.kr/docs/guides/팩스-전송하기 , /docs/references/팩스전송-API
//  - FTP: ftp.barobill.co.kr:9030 (Passive), 계정 = 바로빌 회원 아이디/비밀번호, root 경로에 업로드
//  - 전송 성공 시 FTP에 올린 파일은 바로빌이 삭제
const SOAP_URL = 'https://ws.baroservice.com/FAX.asmx'

function getConfig() {
  const senderId = process.env.BAROBILL_FAX_SENDER_ID || process.env.BAROBILL_CONTACT_ID || ''
  return {
    CERTKEY: process.env.BAROBILL_CERTKEY || '',
    CORP_NUM: (process.env.BAROBILL_CORP_NUM || '').replace(/-/g, ''),
    SENDER_ID: senderId,
    DEFAULT_FROM: process.env.BAROBILL_FAX_FROM || '',
    FTP_HOST: process.env.BAROBILL_FAX_FTP_HOST || 'ftp.barobill.co.kr',
    FTP_PORT: Number(process.env.BAROBILL_FAX_FTP_PORT || 9030),
    FTP_USER: process.env.BAROBILL_FAX_FTP_USER || senderId,
    FTP_PASSWORD: process.env.BAROBILL_FAX_FTP_PASSWORD || '',
    FTP_DIR: process.env.BAROBILL_FAX_FTP_DIR || '',
    FTP_SECURE: (process.env.BAROBILL_FAX_FTP_SECURE || '').toLowerCase() === 'true',
  }
}

function ensureConfig() {
  const config = getConfig()
  if (!config.CERTKEY) throw new Error('BAROBILL_CERTKEY is not configured.')
  if (!config.CORP_NUM) throw new Error('BAROBILL_CORP_NUM is not configured.')
  if (!config.SENDER_ID) throw new Error('BAROBILL_FAX_SENDER_ID or BAROBILL_CONTACT_ID is not configured.')
  return config
}

function ensureFtpConfig() {
  const config = ensureConfig()
  if (!config.FTP_USER) throw new Error('BAROBILL_FAX_FTP_USER is not configured.')
  if (!config.FTP_PASSWORD) throw new Error('BAROBILL_FAX_FTP_PASSWORD is not configured.')
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
  return (
    extractFirstTag(xml, 'faultstring') ||
    extractFirstTag(xml, 'soap:Text') ||
    extractFirstTag(xml, 'Reason') ||
    ''
  )
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
    throw new Error(`[Barobill FAX] SOAP Fault: ${fault}`)
  }
  if (!response.ok) {
    throw new Error(`[Barobill FAX] HTTP ${response.status}: ${text.slice(0, 300)}`)
  }

  return text
}

/** 숫자만 남긴 전화/팩스 번호 */
export function normalizeFaxNumber(value: string) {
  return value.replace(/[^0-9]/g, '')
}

export type BarobillFaxFromNumber = {
  number: string
  validDate: string
}

export async function getBarobillFaxFromNumbers() {
  const config = ensureConfig()
  const xml = await callSoapAction(
    'GetFaxFromNumbers',
    `
      <CERTKEY>${escapeXml(config.CERTKEY)}</CERTKEY>
      <CorpNum>${escapeXml(config.CORP_NUM)}</CorpNum>
    `
  )

  const fromNumbers: BarobillFaxFromNumber[] = []
  for (const match of xml.matchAll(/<FromNumber>([\s\S]*?)<\/FromNumber>/gi)) {
    const block = match[1]
    const number = extractFirstTag(block, 'Number')
    if (number) {
      fromNumbers.push({ number, validDate: extractFirstTag(block, 'ValidDate') })
    }
  }
  return fromNumbers
}

/** 발신번호: 환경변수(BAROBILL_FAX_FROM)가 없으면 바로빌에 등록된 첫 번째 팩스 발신번호 */
export async function resolveBarobillFaxFromNumber() {
  const config = ensureConfig()
  if (config.DEFAULT_FROM) return config.DEFAULT_FROM

  const fromNumbers = await getBarobillFaxFromNumbers()
  if (fromNumbers.length === 0) {
    throw new Error('바로빌에 등록된 팩스 발신번호가 없습니다. 바로빌에서 팩스 발신번호를 먼저 등록하세요.')
  }
  return fromNumbers[0].number
}

export async function getBarobillFaxErrorMessage(resultCode: number) {
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

/** 바로빌 FTP에 팩스 파일 업로드. 반환값은 SendFaxFromFTP의 FileName에 그대로 사용한다. */
export async function uploadBarobillFaxFile(fileName: string, data: Buffer) {
  const config = ensureFtpConfig()
  const client = new FtpClient(30_000)
  try {
    await client.access({
      host: config.FTP_HOST,
      port: config.FTP_PORT,
      user: config.FTP_USER,
      password: config.FTP_PASSWORD,
      secure: config.FTP_SECURE,
    })
    // 바로빌은 FTP root 업로드를 요구한다. FTP_DIR은 별도 안내가 있을 때만 사용.
    if (config.FTP_DIR) {
      await client.ensureDir(config.FTP_DIR)
    }
    await client.uploadFrom(Readable.from(data), fileName)
    return fileName
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`바로빌 FTP 업로드 실패 (${config.FTP_HOST}): ${message}`)
  } finally {
    client.close()
  }
}

/** FTP 접속만 확인 (설정 점검용) */
export async function checkBarobillFaxFtp() {
  const config = ensureFtpConfig()
  const client = new FtpClient(15_000)
  try {
    await client.access({
      host: config.FTP_HOST,
      port: config.FTP_PORT,
      user: config.FTP_USER,
      password: config.FTP_PASSWORD,
      secure: config.FTP_SECURE,
    })
    return { ok: true as const, host: config.FTP_HOST, user: config.FTP_USER }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false as const, host: config.FTP_HOST, user: config.FTP_USER, message }
  } finally {
    client.close()
  }
}

export type SendBarobillFaxParams = {
  fileName: string
  fromNumber: string
  toNumber: string
  receiveCorp: string
  receiveName: string
  sendDT?: string
  refKey?: string
}

export async function sendBarobillFaxFromFtp(params: SendBarobillFaxParams) {
  const config = ensureConfig()

  const xml = await callSoapAction(
    'SendFaxFromFTP',
    `
      <CERTKEY>${escapeXml(config.CERTKEY)}</CERTKEY>
      <CorpNum>${escapeXml(config.CORP_NUM)}</CorpNum>
      <SenderID>${escapeXml(config.SENDER_ID)}</SenderID>
      <FileName>${escapeXml(params.fileName)}</FileName>
      <FromNumber>${escapeXml(params.fromNumber)}</FromNumber>
      <ToNumber>${escapeXml(params.toNumber)}</ToNumber>
      <ReceiveCorp>${escapeXml(params.receiveCorp)}</ReceiveCorp>
      <ReceiveName>${escapeXml(params.receiveName)}</ReceiveName>
      <SendDT>${escapeXml(params.sendDT || '')}</SendDT>
      <RefKey>${escapeXml(params.refKey || '')}</RefKey>
    `
  )

  // 성공: 숫자가 아닌 접수번호 문자열 / 실패: 음수 오류코드 문자열
  const result = extractFirstTag(xml, 'SendFaxFromFTPResult')
  if (!result) {
    throw new Error('Barobill FAX response did not include SendFaxFromFTPResult.')
  }

  // 결과가 0 이하 정수면 오류 코드, 그 외에는 전송키(SendKey)
  if (/^-?\d+$/.test(result) && Number(result) <= 0) {
    const resultCode = Number(result)
    const message = await getBarobillFaxErrorMessage(resultCode).catch(() => `Error code ${resultCode}`)
    return { success: false as const, resultCode, message, sendKey: '' }
  }

  return { success: true as const, resultCode: 1, message: 'Fax queued.', sendKey: result }
}

export type BarobillFaxMessage = {
  sendKey: string
  sendFileName: string
  sendPageCount: number | null
  successPageCount: number | null
  sendResult: string
  senderNum: string
  receiverName: string
  receiverNum: string
  sendDT: string
  refKey: string
  sendState: number | null
}

const readInt = (value: string) => {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function getBarobillFaxMessage(sendKey: string): Promise<BarobillFaxMessage> {
  const config = ensureConfig()
  // GetFaxMessage는 구버전. 문서가 권장하는 GetFaxMessageEx2 사용 (필드는 상위 호환)
  const xml = await callSoapAction(
    'GetFaxMessageEx2',
    `
      <CERTKEY>${escapeXml(config.CERTKEY)}</CERTKEY>
      <CorpNum>${escapeXml(config.CORP_NUM)}</CorpNum>
      <SendKey>${escapeXml(sendKey)}</SendKey>
    `
  )

  const block = xml
  const sendState = readInt(extractFirstTag(block, 'SendState'))
  if (sendState !== null && sendState < 0) {
    const message = await getBarobillFaxErrorMessage(sendState).catch(() => `Error code ${sendState}`)
    throw new Error(`[Barobill FAX] 상태 조회 실패 (${sendState}): ${message}`)
  }

  return {
    sendKey: extractFirstTag(block, 'SendKey') || sendKey,
    sendFileName: extractFirstTag(block, 'SendFileName'),
    sendPageCount: readInt(extractFirstTag(block, 'SendPageCount')),
    successPageCount: readInt(extractFirstTag(block, 'SuccessPageCount')),
    sendResult: extractFirstTag(block, 'SendResult'),
    senderNum: extractFirstTag(block, 'SenderNum'),
    receiverName: extractFirstTag(block, 'ReceiverName'),
    receiverNum: extractFirstTag(block, 'ReceiverNum'),
    sendDT: extractFirstTag(block, 'SendDT'),
    refKey: extractFirstTag(block, 'RefKey'),
    sendState: readInt(extractFirstTag(block, 'SendState')),
  }
}

/** 팩스 전송결과 코드 (SendResult) — 바로빌 "팩스 전송결과 테이블" */
export const BAROBILL_FAX_RESULT_LABELS: Record<string, string> = {
  '101': '파일변환실패 (환불)',
  '103': '파일용량초과 (환불)',
  '801': '부분완료 (부분환불)',
  '802': '완료',
  '803': '통화중 (재전송시도)',
  '804': '잘못된 수신번호 (환불)',
  '805': '응답없음 (환불)',
  '807': '수신거부 (환불)',
  '808': '알수없는 오류 (환불)',
}

export const BAROBILL_FAX_SUCCESS_RESULT = '802'

export function describeBarobillFaxResult(result: string | null | undefined) {
  if (!result) return ''
  return BAROBILL_FAX_RESULT_LABELS[result] ?? `결과코드 ${result}`
}

/** 바로빌 팩스 전송상태 코드 (SendState) 라벨 */
export function describeBarobillFaxState(state: number | null | undefined) {
  switch (state) {
    case 0:
      return '변환 대기중'
    case 1:
      return '파일 변환중'
    case 2:
      return '전송중'
    case 3:
      return '전송완료'
    case 4:
      return '예약취소'
    case 5:
      return '파일변환실패'
    case 6:
      return '전송실패'
    case 7:
      return '부분성공'
    case 8:
      return '파일용량초과'
    default:
      return state === null || state === undefined ? '확인중' : `상태 ${state}`
  }
}

export function isBarobillFaxFinalState(state: number | null | undefined) {
  return state !== null && state !== undefined && state >= 3
}

/** 전송완료(3)이면서 결과코드 802 인 경우만 성공 */
export function isBarobillFaxSuccess(state: number | null | undefined, result: string | null | undefined) {
  return state === 3 && (result === BAROBILL_FAX_SUCCESS_RESULT || !result)
}

/** 화면 표시용 상태 라벨: 전송완료(3)라도 결과코드가 802가 아니면 실패로 표시 */
export function describeBarobillFaxLog(state: number | null | undefined, result: string | null | undefined) {
  if (state === 3 && result && result !== BAROBILL_FAX_SUCCESS_RESULT) return '전송실패'
  return describeBarobillFaxState(state)
}
