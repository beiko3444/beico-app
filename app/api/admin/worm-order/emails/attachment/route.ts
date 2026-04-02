import { NextResponse } from 'next/server'
import { getWormEmailAttachment } from '@/lib/wormOrderMail'
import { requireAdminSession } from '@/lib/requireAdmin'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
    const { unauthorized } = await requireAdminSession()
    if (unauthorized) return unauthorized

    const { searchParams } = new URL(req.url)
    const uid = searchParams.get('uid')
    const indexStr = searchParams.get('index')

    if (!uid || !indexStr) {
        return NextResponse.json({ error: '요청 파라미터가 누락되었습니다.' }, { status: 400 })
    }

    const index = parseInt(indexStr, 10)
    if (!Number.isInteger(index) || index < 0) {
        return NextResponse.json({ error: 'index 파라미터가 올바르지 않습니다.' }, { status: 400 })
    }
    try {
        const attachment = await getWormEmailAttachment(uid, index)

        const headers = new Headers()
        const safeFilename = attachment.filename || `attachment-${index}`
        const encodedFilename = encodeURIComponent(safeFilename).replace(/['()]/g, escape).replace(/\*/g, '%2A')
        headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`)
        headers.set('Content-Type', attachment.contentType || 'application/octet-stream')
        headers.set('Cache-Control', 'private, max-age=86400, stale-while-revalidate=604800')

        return new NextResponse(new Uint8Array(attachment.content), {
            status: 200,
            headers,
        })
    } catch (error: unknown) {
        console.error('Attachment Download Error:', error)
        const message = error instanceof Error ? error.message : '첨부파일 다운로드 실패'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
