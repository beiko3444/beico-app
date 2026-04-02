import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { getParsedMailByUid } from '@/lib/wormOrderMail'
import { requireAdminSession } from '@/lib/requireAdmin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
    const { unauthorized } = await requireAdminSession()
    if (unauthorized) return unauthorized

    try {
        const body = await req.json()
        const { uid, toEmail } = body

        if (!uid || !toEmail) {
            return NextResponse.json({ error: '요청 파라미터가 누락되었습니다. (uid, toEmail)' }, { status: 400 })
        }

        const user = process.env.DAUM_IMAP_USER
        const pass = process.env.DAUM_IMAP_PASS

        if (!user || !pass) return NextResponse.json({ error: '메일 서버 환경변수가 없습니다.' }, { status: 500 })

        // 1. 원본 메일 및 첨부파일 확보 (캐시 재사용)
        const parsedMessage = await getParsedMailByUid(uid)

        if (!parsedMessage) throw new Error('원본 메일 파싱에 실패했습니다.')

        // 2. 제목 & 본문 포맷팅 (KST 오늘 날짜)
        const kstObj = new Date(new Date().getTime() + 9 * 60 * 60 * 1000)
        const month = String(kstObj.getUTCMonth() + 1).padStart(2, '0')
        const day = String(kstObj.getUTCDate()).padStart(2, '0')
        const dateStr = `${month}/${day}` // 예: 03/30

        const subject = `[${dateStr}] 엑스트래커 갯지렁이 생물 통관 진행 요청드립니다.`
        const bodyText = `안녕하세요 관세사님-\n[${dateStr}] 엑스트래커 갯지렁이 생물 통관 진행 요청드립니다.\n<직접배차>예정입니다- 감사합니다:)`

        // 3. 원본 첨부파일 추출
        const attachments = (parsedMessage.attachments || []).map((att) => ({
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

    } catch (error: unknown) {
        console.error('Email Forward Error:', error)
        const message = error instanceof Error ? error.message : '이메일 전달 실패'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
