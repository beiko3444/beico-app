import { NextResponse } from 'next/server'
import { loadWormEmailList } from '@/lib/wormOrderMail'
import { requireAdminSession } from '@/lib/requireAdmin'

export const dynamic = 'force-dynamic'

function isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function GET(request: Request) {
    const { unauthorized } = await requireAdminSession()
    if (unauthorized) return unauthorized

    try {
        const { searchParams } = new URL(request.url)
        const orderIdRaw = (searchParams.get('orderId') || '').trim()
        const orderId = isUuid(orderIdRaw) ? orderIdRaw : null
        const forceRefresh = ['1', 'true', 'yes', 'y'].includes((searchParams.get('forceRefresh') || '').trim().toLowerCase())
        const requestedSubjectKeyword = (searchParams.get('subjectKeyword') || 'invoice').trim() || 'invoice'
        const keywordTokens = requestedSubjectKeyword
            .toLowerCase()
            .split(',')
            .map((token) => token.trim())
            .filter(Boolean)
        const isInvoiceInboxRequest = keywordTokens.includes('invoice') || keywordTokens.includes('payment')
        const subjectKeyword = isInvoiceInboxRequest ? 'invoice,payment' : requestedSubjectKeyword

        const emails = await loadWormEmailList({
            subjectKeyword,
            scanLimit: 40,
            listLimit: 20,
            orderId,
            senderEmail: isInvoiceInboxRequest ? 'michael@oikki.com' : null,
            keywordMatchInSource: isInvoiceInboxRequest,
            forceRefresh,
        })
        return NextResponse.json(
            { emails },
            {
                headers: {
                    'Cache-Control': 'private, max-age=30, stale-while-revalidate=120',
                },
            },
        )
    } catch (error: unknown) {
        console.error('Daum IMAP 연동 에러:', error)
        const message = error instanceof Error ? error.message : '이메일 로딩 실패'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
