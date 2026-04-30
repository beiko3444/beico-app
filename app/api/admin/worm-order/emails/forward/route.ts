import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { getParsedMailsByUids } from '@/lib/wormOrderMail'
import { requireAdminSession } from '@/lib/requireAdmin'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const DEFAULT_FORWARD_SUBJECT_SUFFIX = '엑스트래커 갯지렁이 생물 통관 진행 요청드립니다.'
const FORWARD_FROM_EMAIL = 'contact@beiko.co.kr'
const FORWARD_FROM_NAME = 'BEIKO'

function isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function resolveListLimit(input: string | null) {
    if (!input) return 20
    const parsed = Number.parseInt(input, 10)
    if (!Number.isFinite(parsed) || parsed <= 0) return 20
    return Math.min(parsed, 100)
}

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

export async function GET(req: Request) {
    const { unauthorized } = await requireAdminSession()
    if (unauthorized) return unauthorized

    try {
        const forwardLogClient = (prisma as any).wormEmailForwardLog
        if (!forwardLogClient) {
            return NextResponse.json({ error: '발송 이력 모델이 준비되지 않았습니다.' }, { status: 500 })
        }

        const { searchParams } = new URL(req.url)
        const orderIdRaw = (searchParams.get('orderId') || '').trim()
        const limit = resolveListLimit(searchParams.get('limit'))

        if (orderIdRaw && !isUuid(orderIdRaw)) {
            return NextResponse.json({ error: '유효한 발주 ID가 아닙니다.' }, { status: 400 })
        }

        const logs = await forwardLogClient.findMany({
            where: orderIdRaw ? { orderId: orderIdRaw } : undefined,
            orderBy: [{ createdAt: 'desc' }],
            take: limit,
            include: {
                order: {
                    select: {
                        orderNumber: true,
                    },
                },
            },
        })

        return NextResponse.json({
            logs: logs.map((log: any) => ({
                id: log.id,
                orderId: log.orderId,
                orderNumber: log.order?.orderNumber || null,
                toEmail: log.toEmail,
                fromEmail: log.fromEmail,
                subject: log.subject,
                attachmentCount: log.attachmentCount,
                sentByUserId: log.sentByUserId,
                sentByUserName: log.sentByUserName,
                createdAt: log.createdAt.toISOString(),
            })),
        })
    } catch (error: unknown) {
        console.error('Forward log list error:', error)
        const message = error instanceof Error ? error.message : '발송 이력 조회 실패'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}

export async function POST(req: Request) {
    const { session, unauthorized } = await requireAdminSession()
    if (unauthorized) return unauthorized

    try {
        const forwardLogClient = (prisma as any).wormEmailForwardLog
        const body = await req.json()
        const { uid, uids, toEmail, orderId: orderIdRaw, forwardDate: forwardDateRaw } = body

        const normalizedUids = Array.from(new Set(
            (Array.isArray(uids) ? uids : [uid])
                .filter((value): value is string => typeof value === 'string')
                .map((value) => value.trim())
                .filter(Boolean),
        ))
        const normalizedToEmail = typeof toEmail === 'string' ? toEmail.trim() : ''
        const normalizedOrderId = typeof orderIdRaw === 'string' && orderIdRaw.trim() ? orderIdRaw.trim() : null

        if (!normalizedToEmail || normalizedUids.length === 0) {
            return NextResponse.json({ error: '요청 파라미터가 누락되었습니다. (uid/uids, toEmail)' }, { status: 400 })
        }
        if (normalizedOrderId && !isUuid(normalizedOrderId)) {
            return NextResponse.json({ error: '유효한 발주 ID가 아닙니다.' }, { status: 400 })
        }

        const user = process.env.DAUM_IMAP_USER
        const pass = process.env.DAUM_IMAP_PASS

        if (!user || !pass) return NextResponse.json({ error: '메일 서버 환경변수가 없습니다.' }, { status: 500 })

        // 1. 원본 메일 및 첨부파일 확보 (캐시 재사용 + 단일 IMAP 세션 처리)
        const parsedMap = await getParsedMailsByUids(normalizedUids)
        const parsedMessages = normalizedUids.map((targetUid) => {
            const parsedMessage = parsedMap.get(targetUid)
            if (!parsedMessage) {
                throw new Error(`원본 메일 파싱에 실패했습니다. (uid: ${targetUid})`)
            }
            return parsedMessage
        })

        // 2. 제목 & 본문 포맷팅 (요청한 날짜, 또는 KST 오늘 날짜)
        const forwardDateYmd = typeof forwardDateRaw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(forwardDateRaw)
            ? forwardDateRaw
            : null
        const dateStr = forwardDateYmd
            ? forwardDateYmd.replace(/-/g, '.')
            : formatKstDateDot(new Date())
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
        const smtpAuthUser = user.includes('@') ? user : `${user}@daum.net`

        const transporter = nodemailer.createTransport({
            host: 'smtp.daum.net',
            port: 465,
            secure: true,
            auth: {
                user: smtpAuthUser,
                pass,
            },
        })

        await transporter.sendMail({
            from: `"${FORWARD_FROM_NAME}" <${FORWARD_FROM_EMAIL}>`,
            to: normalizedToEmail,
            subject: subject,
            text: bodyText,
            attachments,
        })

        let warning = ''
        let logSaved = true

        try {
            await forwardLogClient.create({
                data: {
                    orderId: normalizedOrderId,
                    toEmail: normalizedToEmail,
                    fromEmail: FORWARD_FROM_EMAIL,
                    subject,
                    attachmentCount: attachments.length,
                    sourceUids: normalizedUids,
                    sentByUserId: session?.user?.id || null,
                    sentByUserName: session?.user?.name || null,
                },
            })
        } catch (logError: unknown) {
            logSaved = false
            const message = logError instanceof Error ? logError.message : 'unknown'
            warning = `메일 발송은 완료됐지만 발송 이력 저장에 실패했습니다. (${message})`
            console.error('Forward log save error:', logError)
        }

        return NextResponse.json({
            success: true,
            message: '이메일 전달 성공',
            attachmentCount: attachments.length,
            logSaved,
            warning,
        })

    } catch (error: unknown) {
        console.error('Email Forward Error:', error)
        const message = error instanceof Error ? error.message : '이메일 전달 실패'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
