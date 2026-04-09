import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { getParsedMailByUid } from '@/lib/wormOrderMail'
import { requireAdminSession } from '@/lib/requireAdmin'

export const dynamic = 'force-dynamic'

const DEFAULT_FORWARD_SUBJECT_SUFFIX = '엑스트래커 갯지렁이 생물 통관 진행 요청드립니다.'

function formatKstDateDot(date: Date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date)

    const year = parts.find((part) => part.type === 'year')?.value ?? '0000'
    const month = parts.find((part) => part.type === 'month')?.value ?? '00'
    const day = parts.find((part) => part.type === 'day')?.value ?? '00'
    return `${year}.${month}.${day}`
}

export async function POST(req: Request) {
    const { unauthorized } = await requireAdminSession()
    if (unauthorized) return unauthorized

    try {
        const body = await req.json()
        const { uid, uids, toEmail } = body

        const normalizedUids = Array.from(new Set(
            (Array.isArray(uids) ? uids : [uid])
                .filter((value): value is string => typeof value === 'string')
                .map((value) => value.trim())
                .filter(Boolean),
        ))

        if (!toEmail || normalizedUids.length === 0) {
            return NextResponse.json({ error: '요청 파라미터가 누락되었습니다. (uid/uids, toEmail)' }, { status: 400 })
        }

        const user = process.env.DAUM_IMAP_USER
        const pass = process.env.DAUM_IMAP_PASS

        if (!user || !pass) return NextResponse.json({ error: '메일 서버 환경변수가 없습니다.' }, { status: 500 })

        // 1. 원본 메일 및 첨부파일 확보 (캐시 재사용)
        const parsedMessages = await Promise.all(
            normalizedUids.map(async (targetUid) => {
                const parsedMessage = await getParsedMailByUid(targetUid)
                if (!parsedMessage) {
                    throw new Error(`원본 메일 파싱에 실패했습니다. (uid: ${targetUid})`)
                }
                return parsedMessage
            }),
        )

        // 2. 제목 & 본문 포맷팅 (KST 오늘 날짜, 요청 문구 고정)
        const dateStr = formatKstDateDot(new Date())
        const subject = `${dateStr} ${DEFAULT_FORWARD_SUBJECT_SUFFIX}`
        const bodyText = `안녕하세요 관세사님- ${dateStr}  엑스트래커 갯지렁이 생물 통관 진행 요청드립니다.
<직접배차>예정입니다- 감사합니다:)

엑스트래커 매니저 김유정
010-8119-3313
전화/문자 메세지 회신은 위에 번호로 연락 부탁드립니다.
감사합니다.`

        // 3. 원본 첨부파일 추출 (인보이스 + AWB 메일 모두 포함)
        const usedNames = new Map<string, number>()
        const attachments = parsedMessages.flatMap((message) =>
            (message.attachments || []).map((att) => {
                const originalName = (att.filename || 'attachment.dat').trim() || 'attachment.dat'
                const duplicateCount = usedNames.get(originalName) ?? 0
                usedNames.set(originalName, duplicateCount + 1)

                const normalizedName = duplicateCount > 0
                    ? `${originalName.replace(/(\.[^.]+)$/, `_${duplicateCount + 1}$1`)}${/\.[^.]+$/.test(originalName) ? '' : `_${duplicateCount + 1}`}`
                    : originalName
                return {
                    filename: normalizedName,
                    content: att.content,
                    contentType: att.contentType,
                }
            }),
        )

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
            attachments,
        })

        return NextResponse.json({ success: true, message: '이메일 전달 성공', attachmentCount: attachments.length })

    } catch (error: unknown) {
        console.error('Email Forward Error:', error)
        const message = error instanceof Error ? error.message : '이메일 전달 실패'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
