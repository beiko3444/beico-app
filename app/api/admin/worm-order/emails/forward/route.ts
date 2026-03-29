import { NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import nodemailer from 'nodemailer'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { uid, toEmail } = body

        if (!uid || !toEmail) {
            return NextResponse.json({ error: '요청 파라미터가 누락되었습니다. (uid, toEmail)' }, { status: 400 })
        }

        const user = process.env.DAUM_IMAP_USER
        const pass = process.env.DAUM_IMAP_PASS

        if (!user || !pass) return NextResponse.json({ error: '메일 서버 환경변수가 없습니다.' }, { status: 500 })

        // 1. IMAP 접속으로 원본 메일 및 첨부파일 확보
        const imapClient = new ImapFlow({
            host: 'imap.daum.net',
            port: 993,
            secure: true,
            auth: { user, pass },
            logger: false,
        })

        await imapClient.connect()
        let parsedMessage;
        
        try {
            const lock = await imapClient.getMailboxLock('INBOX')
            try {
                const message = await imapClient.fetchOne(uid, { source: true }, { uid: true })
                if (!message || !message.source) {
                    return NextResponse.json({ error: '해당 원본 메일을 찾을 수 없습니다.' }, { status: 404 })
                }
                parsedMessage = await simpleParser(message.source)
            } finally {
                lock.release()
            }
        } finally {
            await imapClient.logout()
        }

        if (!parsedMessage) throw new Error('원본 메일 파싱에 실패했습니다.')

        // 2. 제목 & 본문 포맷팅 (KST 오늘 날짜)
        const kstObj = new Date(new Date().getTime() + 9 * 60 * 60 * 1000)
        const month = String(kstObj.getUTCMonth() + 1).padStart(2, '0')
        const day = String(kstObj.getUTCDate()).padStart(2, '0')
        const dateStr = `${month}/${day}` // 예: 03/30

        const subject = `[${dateStr}] 엑스트래커 갯지렁이 생물 통관 진행 요청드립니다.`
        const bodyText = `안녕하세요 관세사님-\n[${dateStr}] 엑스트래커 갯지렁이 생물 통관 진행 요청드립니다.\n<직접배차>예정입니다- 감사합니다:)`

        // 3. 원본 첨부파일 추출
        const attachments = (parsedMessage.attachments || []).map((att: any) => ({
            filename: att.filename || 'attachment.dat',
            content: att.content,
            contentType: att.contentType
        }))

        // 4. Daum SMTP(Nodemailer) 접속 후 발송
        // user가 beiko7 인 경우 보내는 주소는 beiko7@daum.net 으로 설정
        const senderEmail = user.includes('@') ? user : `${user}@daum.net`
        
        const transporter = nodemailer.createTransport({
            host: 'smtp.daum.net',
            port: 465,
            secure: true,
            auth: {
                user,
                pass,
            },
        })

        await transporter.sendMail({
            from: `"Beico" <${senderEmail}>`,
            to: toEmail,
            subject: subject,
            text: bodyText,
            attachments: attachments
        })

        return NextResponse.json({ success: true, message: '이메일 전달 성공' })

    } catch (error: any) {
        console.error('Email Forward Error:', error)
        return NextResponse.json({ error: error.message || '이메일 전달 실패' }, { status: 500 })
    }
}
