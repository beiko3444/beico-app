export type ElectricityInvoiceNotice = { title: string; content: string }
export type ElectricityInvoiceNotes = { remarks: string; notices: ElectricityInvoiceNotice[] }

export const MAX_INVOICE_NOTICES = 20
export const MAX_NOTICE_TITLE_LENGTH = 120
export const MAX_NOTICE_CONTENT_LENGTH = 2000
export const MAX_INVOICE_REMARKS_LENGTH = 5000

export function validateInvoiceNotes(value: unknown): ElectricityInvoiceNotes {
    if (!value || typeof value !== 'object') throw new Error('고지 내용을 확인해주세요.')
    const notes = value as Record<string, unknown>
    if (typeof notes.remarks !== 'string' || notes.remarks.length > MAX_INVOICE_REMARKS_LENGTH) {
        throw new Error(`비고는 ${MAX_INVOICE_REMARKS_LENGTH}자 이내로 입력해주세요.`)
    }
    if (!Array.isArray(notes.notices) || notes.notices.length > MAX_INVOICE_NOTICES) {
        throw new Error(`고지 항목은 최대 ${MAX_INVOICE_NOTICES}개까지 추가할 수 있습니다.`)
    }
    const notices = notes.notices.map((item: unknown) => {
        if (!item || typeof item !== 'object') throw new Error('고지 항목을 확인해주세요.')
        const { title, content } = item as Record<string, unknown>
        if (typeof title !== 'string' || typeof content !== 'string'
            || title.length > MAX_NOTICE_TITLE_LENGTH || content.length > MAX_NOTICE_CONTENT_LENGTH) {
            throw new Error('고지 항목의 제목 또는 내용이 너무 깁니다.')
        }
        if (!title.trim() && !content.trim()) throw new Error('빈 고지 항목을 입력하거나 삭제해주세요.')
        return { title: title.trim(), content: content.trim() }
    })
    return { remarks: notes.remarks.trim(), notices }
}

export function readInvoiceNotes(value: string | null | undefined): ElectricityInvoiceNotes {
    if (value) {
        try { return validateInvoiceNotes(JSON.parse(value)) } catch { /* Older bills have no notes. */ }
    }
    return { remarks: '', notices: [] }
}
