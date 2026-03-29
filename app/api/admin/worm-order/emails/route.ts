import { NextResponse } from 'next/server'
import { loadWormEmailList } from '@/lib/wormOrderMail'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const emails = await loadWormEmailList({
            keyword: 'michael@oikki.com',
            scanLimit: 20,
            listLimit: 10,
        })
        return NextResponse.json({ emails })
    } catch (error: unknown) {
        console.error('Daum IMAP 연동 에러:', error)
        const message = error instanceof Error ? error.message : '이메일 로딩 실패'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
