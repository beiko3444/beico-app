import { NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'

export const dynamic = 'force-dynamic'

export async function GET() {
    const user = process.env.DAUM_IMAP_USER
    const pass = process.env.DAUM_IMAP_PASS

    if (!user || !pass) {
        return NextResponse.json(
            { error: 'Vercel 환경변수 (DAUM_IMAP_USER, DAUM_IMAP_PASS) 가 설정되지 않았습니다.' },
            { status: 500 }
        )
    }

    const client = new ImapFlow({
        host: 'imap.daum.net',
        port: 993,
        secure: true,
        auth: { user, pass },
        logger: false,
    })

    try {
        await client.connect()
        
        const lock = await client.getMailboxLock('INBOX')
        try {
            // 제목에 'documents'가 포함된 메일 검색 (UID 배열 반환)
            const uids = await client.search({ subject: 'documents' }, { uid: true })
            
            if (!uids || uids.length === 0) {
                return NextResponse.json({ emails: [] })
            }

            // 최신 메일이 나중에 오므로, 배열의 뒷부분 5개만 가져오고 역순(최신순) 정렬
            const recentUids = typeof uids === 'object' && Array.isArray(uids) 
                                ? uids.slice(-5).reverse() 
                                : Array.from((uids as Set<number>).values()).slice(-5).reverse()

            const emails = []

            for (const uid of recentUids) {
                const message = await client.fetchOne(uid, { source: true }, { uid: true })
                if (message && message.source) {
                    const parsed = await simpleParser(message.source)
                    emails.push({
                        uid,
                        subject: parsed.subject || '(제목 없음)',
                        date: parsed.date,
                        // HTML 본문 우선, 없으면 Text 본문 반환
                        text: parsed.html || parsed.textAsHtml || parsed.text || '',
                        hasAttachments: parsed.attachments && parsed.attachments.length > 0,
                    })
                }
            }

            return NextResponse.json({ emails })
        } finally {
            lock.release()
        }
    } catch (error: any) {
        console.error('Daum IMAP 연동 에러:', error)
        return NextResponse.json({ error: error.message || '이메일 로딩 실패' }, { status: 500 })
    } finally {
        await client.logout()
    }
}
