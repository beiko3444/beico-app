import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/requireAdmin'
import { validateInvoiceNotes } from '@/lib/electricityInvoiceNotes'

export async function PATCH(request: Request) {
    const { unauthorized } = await requireAdminSession()
    if (unauthorized) return unauthorized

    let body
    try { body = await request.json() } catch {
        return NextResponse.json({ error: '고지 내용을 확인해주세요.' }, { status: 400 })
    }
    const { year, month } = body || {}
    if (!Number.isInteger(year) || year < 2000 || year > 9999
        || !Number.isInteger(month) || month < 1 || month > 12) {
        return NextResponse.json({ error: '청구 년월을 확인해주세요.' }, { status: 400 })
    }
    let notes
    try { notes = validateInvoiceNotes(body.notes) } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 400 })
    }
    try {
        const saved = await prisma.electricityUsage.update({
            where: { year_month: { year, month } },
            data: { invoiceNotes: JSON.stringify(notes) },
            select: { invoiceNotes: true },
        })
        return NextResponse.json({ notes: JSON.parse(saved.invoiceNotes!) })
    } catch (error) {
        if ((error as { code?: string }).code === 'P2025') {
            return NextResponse.json({ error: '전기요금 데이터를 먼저 저장해주세요.' }, { status: 404 })
        }
        console.error('Failed to save electricity invoice notes:', error)
        return NextResponse.json({ error: '고지 내용 저장에 실패했습니다. 다시 시도해주세요.' }, { status: 500 })
    }
}
