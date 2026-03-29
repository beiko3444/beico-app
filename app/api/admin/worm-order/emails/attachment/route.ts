import { NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const uid = searchParams.get('uid')
    const indexStr = searchParams.get('index')

    if (!uid || !indexStr) {
        return NextResponse.json({ error: '요청 파라미터가 누락되었습니다.' }, { status: 400 })
    }

    const index = parseInt(indexStr, 10)
    const user = process.env.DAUM_IMAP_USER
    const pass = process.env.DAUM_IMAP_PASS

    if (!user || !pass) return NextResponse.json({ error: '환경변수가 없습니다.' }, { status: 500 })

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
            const message = await client.fetchOne(uid, { source: true }, { uid: true })
            if (!message || !message.source) {
                return NextResponse.json({ error: '해당 메일을 찾을 수 없습니다.' }, { status: 404 })
            }

            const parsed = await simpleParser(message.source)
            if (!parsed.attachments || parsed.attachments.length <= index) {
                return NextResponse.json({ error: '해당 첨부파일을 찾을 수 없습니다.' }, { status: 404 })
            }

            const attachment = parsed.attachments[index]
            
            // 브라우저에서 다운로드 처리할 수 있도록 헤더 설정
            const headers = new Headers()
            // UTF-8 파일명 처리
            const filenameRegex = /^[ -~]+$/
            const safeFilename = attachment.filename || `attachment-${index}`
            const encodedFilename = encodeURIComponent(safeFilename).replace(/['()]/g, escape).replace(/\*/g, '%2A')
            headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`)
            headers.set('Content-Type', attachment.contentType || 'application/octet-stream')

            return new NextResponse(new Uint8Array(attachment.content), {
                status: 200,
                headers,
            })
        } finally {
            lock.release()
        }
    } catch (error: any) {
        console.error('Attachment Download Error:', error)
        return NextResponse.json({ error: error.message || '첨부파일 다운로드 실패' }, { status: 500 })
    } finally {
        await client.logout()
    }
}
