import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/requireAdmin'
import { resolveStoredAsset } from '@/lib/stored-asset'

const MEMO_ATTACHMENT_R2_PREFIX = 'admin-memos'

function encodeContentDispositionFilename(fileName: string) {
  const fallback = fileName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_') || 'attachment'
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}

type AdminMemoAttachmentClient = {
  adminMemoAttachment: {
    findFirst: (args: unknown) => Promise<{
      id: string
      memoId: string
      fileName: string
      contentType: string
      assetUrl: string
    } | null>
    update: (args: unknown) => Promise<unknown>
  }
}

const attachmentClient = () => (prisma as unknown as AdminMemoAttachmentClient).adminMemoAttachment

export async function GET(
  _request: Request,
  context: { params: Promise<{ memoId: string; attachmentId: string }> },
) {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  const { memoId, attachmentId } = await context.params

  const attachment = await attachmentClient().findFirst({
    where: {
      id: attachmentId,
      memoId,
    },
  })

  if (!attachment) {
    return NextResponse.json({ error: '첨부 파일을 찾지 못했습니다.' }, { status: 404 })
  }

  const resolved = await resolveStoredAsset({
    assetUrl: attachment.assetUrl,
    keyPrefix: MEMO_ATTACHMENT_R2_PREFIX,
    filenameBase: attachment.fileName.replace(/\.[^.]+$/, '') || 'attachment',
    disposition: 'attachment',
  })

  if (!resolved) {
    return NextResponse.json({ error: '첨부 파일을 불러오지 못했습니다.' }, { status: 404 })
  }

  if (resolved.migratedAssetUrl && resolved.migratedAssetUrl !== attachment.assetUrl) {
    await attachmentClient().update({
      where: { id: attachment.id },
      data: { assetUrl: resolved.migratedAssetUrl },
    })
  }

  if (resolved.kind === 'redirect') {
    return NextResponse.redirect(resolved.location, 302)
  }

  return new NextResponse(Buffer.from(resolved.body), {
    headers: {
      'Content-Type': attachment.contentType || resolved.contentType || 'application/octet-stream',
      'Content-Disposition': encodeContentDispositionFilename(attachment.fileName),
      'Content-Length': String(resolved.body.byteLength),
    },
  })
}
