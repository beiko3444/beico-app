export const CARGO_PROXY_PRINCIPAL = {
    name: '이다빈 (주식회사 베이코)',
    address: '부산광역시 강서구 낙동남로1013번길 35, 1층(명지동,베이코)',
    phone: '010-3444-3467',
    businessNo: '881-88-03836',
} as const

export const CARGO_PROXY_DEFAULT_CARGO_NAME = '갯지렁이'

export type CargoDriverRecord = {
    id: string
    name: string
    phone: string
    vehicleNo: string
}

export type CargoProxyDocument = {
    documentNo: string | null
    issueDate: string // YYYY-MM-DD
    blNumber: string
    cargoName: string
    quantityText: string
    driverName: string
    driverPhone: string
    driverVehicle: string
    principalName: string
    principalAddress: string
    principalPhone: string
    principalBusinessNo: string
}

export type CargoProxyRecord = CargoProxyDocument & {
    id: string
    documentNo: string
    driverId: string | null
    createdAt: string
}

export const toDateInputValue = (value: Date) => {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

/** 2026-09-29 -> 2026.09.29 (위임장 본문 표기) */
export const formatProxyDate = (dateInput: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateInput)
    if (!match) return dateInput
    return `${match[1]}.${match[2]}.${match[3]}`
}

/** 2026-09-29 -> 2026년 09월 29일 */
export const formatProxyDateKorean = (dateInput: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateInput)
    if (!match) return dateInput
    return `${match[1]}년 ${match[2]}월 ${match[3]}일`
}

/** 2026-09-29 (YYYY-MM-DD, 로컬 날짜) -> Date (정오 기준, 타임존 밀림 방지) */
export const parseDateInput = (dateInput: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateInput)
    if (!match) return null
    const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0)
    return Number.isNaN(parsed.getTime()) ? null : parsed
}

type CargoProxyRow = {
    id: string
    documentNo: string
    issueDate: Date
    blNumber: string
    cargoName: string
    quantityText: string
    driverId: string | null
    driverName: string
    driverPhone: string
    driverVehicle: string
    principalName: string
    principalAddress: string
    principalPhone: string
    principalBusinessNo: string
    createdAt: Date
}

/** Prisma row -> 클라이언트로 내려보내는 직렬화 형태 */
export const toProxyRecord = (row: CargoProxyRow): CargoProxyRecord => ({
    id: row.id,
    documentNo: row.documentNo,
    issueDate: toDateInputValue(row.issueDate),
    blNumber: row.blNumber,
    cargoName: row.cargoName,
    quantityText: row.quantityText,
    driverId: row.driverId,
    driverName: row.driverName,
    driverPhone: row.driverPhone,
    driverVehicle: row.driverVehicle,
    principalName: row.principalName,
    principalAddress: row.principalAddress,
    principalPhone: row.principalPhone,
    principalBusinessNo: row.principalBusinessNo,
    createdAt: row.createdAt.toISOString(),
})

export type CargoFaxRecipientRecord = {
    id: string
    name: string
    faxNumber: string
}

export type CargoFaxLogRecord = {
    id: string
    proxyId: string | null
    documentNo: string
    toName: string
    toNumber: string
    fromNumber: string
    fileName: string
    sendKey: string | null
    sendState: number | null
    sendStateLabel: string
    sendResult: string | null
    sendResultLabel: string
    sendPageCount: number | null
    successPageCount: number | null
    error: string | null
    createdAt: string
    updatedAt: string
}

type CargoFaxLogRow = {
    id: string
    proxyId: string | null
    documentNo: string
    toName: string
    toNumber: string
    fromNumber: string
    fileName: string
    sendKey: string | null
    sendState: number | null
    sendResult: string | null
    sendPageCount: number | null
    successPageCount: number | null
    error: string | null
    createdAt: Date
    updatedAt: Date
}

export type CargoFaxLogDescriber = {
    state: (state: number | null, result: string | null) => string
    result: (result: string | null) => string
}

export const toFaxLogRecord = (row: CargoFaxLogRow, describe: CargoFaxLogDescriber): CargoFaxLogRecord => ({
    id: row.id,
    proxyId: row.proxyId,
    documentNo: row.documentNo,
    toName: row.toName,
    toNumber: row.toNumber,
    fromNumber: row.fromNumber,
    fileName: row.fileName,
    sendKey: row.sendKey,
    sendState: row.sendState,
    sendStateLabel: row.error ? '오류' : describe.state(row.sendState, row.sendResult),
    sendResult: row.sendResult,
    sendResultLabel: describe.result(row.sendResult),
    sendPageCount: row.sendPageCount,
    successPageCount: row.successPageCount,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
})
