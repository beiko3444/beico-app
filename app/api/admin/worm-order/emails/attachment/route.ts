import { NextResponse } from 'next/server'
import { getWormEmailAttachment } from '@/lib/wormOrderMail'
import { requireAdminSession } from '@/lib/requireAdmin'
import { uploadToR2, getR2PresignedUrl } from '@/lib/r2'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
    const { unauthorized } = await requireAdminSession()
    if (unauthorized) return unauthorized

    const { searchParams } = new URL(req.url)
    const uid = searchParams.get('uid')
    const indexStr = searchParams.get('index')
    const rawMode = ['1', 'true', 'yes', 'y'].includes((searchParams.get('raw') || '').trim().toLowerCase())

    if (!uid || !indexStr) {
        return NextResponse.json({ error: '요청 파라미터가 누락되었습니다.' }, { status: 400 })
    }

    const index = parseInt(indexStr, 10)
    if (!Number.isInteger(index) || index < 0) {
        return NextResponse.json({ error: 'index 파라미터가 올바르지 않습니다.' }, { status: 400 })
    }

    try {
        if (rawMode) {
            const attachment = await getWormEmailAttachment(uid, index)
            const filename = attachment.filename || `attachment-${index}`
            const contentType = attachment.contentType || 'application/octet-stream'
            const rawContent = attachment.content
            const body =
                rawContent instanceof Uint8Array
                    ? rawContent
                    : typeof rawContent === 'string'
                        ? Buffer.from(rawContent)
                        : Buffer.from([])

            return new NextResponse(body, {
                status: 200,
                headers: {
                    'Content-Type': contentType,
                    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
                    'Cache-Control': 'private, max-age=60',
                },
            })
        }

        // 1. DB 캐시 확인
        const cached = await prisma.wormEmailAttachmentCache.findUnique({
            where: { uid_index: { uid, index } },
        })

        let r2Key: string
        let filename: string

        if (cached) {
            // 이미 R2에 올라가 있음 → presigned URL만 생성 (Vercel 트래픽 0)
            r2Key = cached.r2Key
            filename = cached.filename || `attachment-${index}`
        } else {
            // 최초 요청: IMAP에서 가져와서 R2에 업로드
            const attachment = await getWormEmailAttachment(uid, index)
            filename = attachment.filename || `attachment-${index}`
            r2Key = `worm-invoices/${uid}/${index}/${filename}`

            await uploadToR2(r2Key, new Uint8Array(attachment.content), attachment.contentType || 'application/octet-stream')

            await prisma.wormEmailAttachmentCache.create({
                data: {
                    uid,
                    index,
                    r2Key,
                    r2Url: r2Key,
                    filename,
                    contentType: attachment.contentType || 'application/octet-stream',
                },
            })
        }

        // 2. presigned URL 생성 후 리다이렉트 (파일은 R2 → 브라우저 직접 전달)
        const presignedUrl = await getR2PresignedUrl(r2Key, filename)
        return NextResponse.redirect(presignedUrl, 302)
    } catch (error: unknown) {
        console.error('Attachment Download Error:', error)
        const message = error instanceof Error ? error.message : '첨부파일 다운로드 실패'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
