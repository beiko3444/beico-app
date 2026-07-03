import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/requireAdmin'
import { fileLikeToDataUrl, normalizeIncomingStoredAsset, type FileLike } from '@/lib/stored-asset'

export const dynamic = 'force-dynamic'

const memoColors = new Set(['green', 'yellow', 'blue', 'red', 'gray'])
const MEMO_ATTACHMENT_R2_PREFIX = 'admin-memos'
const MAX_ATTACHMENT_SIZE = 15 * 1024 * 1024

type AdminMemoRow = {
  id: string
  title: string
  content: string
  category: string
  color: string
  pinned: boolean
  archived: boolean
  username: string | null
  password: string | null
  siteUrl: string | null
  attachments: Array<{
    id: string
    memoId: string
    fileName: string
    contentType: string
    size: number
    assetUrl: string
    createdAt: Date | string
    updatedAt: Date | string
  }>
  createdAt: Date | string
  updatedAt: Date | string
}

type AdminMemoClient = {
  adminMemo: {
    findMany: (args: unknown) => Promise<AdminMemoRow[]>
    create: (args: unknown) => Promise<AdminMemoRow>
    update: (args: unknown) => Promise<AdminMemoRow>
    delete: (args: unknown) => Promise<AdminMemoRow>
  }
}

const memoClient = () => (prisma as unknown as AdminMemoClient).adminMemo

const readString = (value: unknown, fallback = '') => {
  if (typeof value !== 'string') return fallback
  return value.trim()
}

const readBoolean = (value: unknown) => value === true || value === 'true' || value === 'on'

const normalizeSiteUrl = (value: string) => {
  if (!value) return null
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

const isUploadFile = (value: FormDataEntryValue): value is File =>
  typeof value === 'object' && 'arrayBuffer' in value && 'name' in value && 'size' in value && value.size > 0

const parseKeepAttachmentIds = (value: unknown) => {
  const raw = readString(value)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

async function buildAttachmentRecords(files: FormDataEntryValue[]) {
  const uploadFiles = files.filter(isUploadFile)

  for (const file of uploadFiles) {
    if (file.size > MAX_ATTACHMENT_SIZE) {
      throw new Error(`${file.name} 파일은 15MB 이하만 업로드할 수 있습니다.`)
    }
  }

  return Promise.all(
    uploadFiles.map(async (file) => {
      const dataUrl = await fileLikeToDataUrl(file as FileLike)
      const assetUrl = await normalizeIncomingStoredAsset(dataUrl, {
        keyPrefix: MEMO_ATTACHMENT_R2_PREFIX,
      })
      if (!assetUrl) throw new Error(`${file.name} 파일 저장에 실패했습니다.`)

      return {
        fileName: file.name || 'attachment',
        contentType: file.type || 'application/octet-stream',
        size: file.size,
        assetUrl,
      }
    }),
  )
}

const normalizeMemoInput = (body: Record<string, unknown>, attachmentCount = 0) => {
  const title = readString(body.title)
  const content = readString(body.content)
  const username = readString(body.username)
  const password = readString(body.password)
  const siteUrl = readString(body.siteUrl)

  if (!title && !content && !username && !password && !siteUrl && attachmentCount === 0) {
    throw new Error('제목, 내용, 계정 정보 또는 첨부 문서 중 하나는 입력해주세요.')
  }

  const color = readString(body.color, 'green')

  return {
    title: title || '제목 없음',
    content,
    category: readString(body.category, '일반') || '일반',
    color: memoColors.has(color) ? color : 'green',
    pinned: readBoolean(body.pinned),
    archived: readBoolean(body.archived),
    username: username || null,
    password: password || null,
    siteUrl: normalizeSiteUrl(siteUrl),
  }
}

const serializeMemo = (memo: AdminMemoRow) => ({
  ...memo,
  createdAt: new Date(memo.createdAt).toISOString(),
  updatedAt: new Date(memo.updatedAt).toISOString(),
  attachments: (memo.attachments || []).map((attachment) => ({
    ...attachment,
    createdAt: new Date(attachment.createdAt).toISOString(),
    updatedAt: new Date(attachment.updatedAt).toISOString(),
  })),
})

export async function GET() {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  try {
    const memos = await memoClient().findMany({
      include: {
        attachments: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
    })

    return NextResponse.json(
      { memos: memos.map(serializeMemo) },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    )
  } catch (error) {
    console.error('[admin-memos GET] error:', error)
    return NextResponse.json({ error: '메모 목록을 불러오지 못했습니다.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  try {
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const body = Object.fromEntries(formData.entries())
      const attachments = await buildAttachmentRecords(formData.getAll('attachments'))
      const memo = await memoClient().create({
        data: {
          ...normalizeMemoInput(body, attachments.length),
          attachments: attachments.length ? { create: attachments } : undefined,
        },
        include: {
          attachments: {
            orderBy: { createdAt: 'asc' },
          },
        },
      })

      return NextResponse.json({ memo: serializeMemo(memo) }, { status: 201 })
    }

    const body = await request.json()
    const memo = await memoClient().create({
      data: normalizeMemoInput(body || {}),
      include: {
        attachments: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    return NextResponse.json({ memo: serializeMemo(memo) }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : '메모를 저장하지 못했습니다.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function PATCH(request: Request) {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  try {
    const contentType = request.headers.get('content-type') || ''
    const isMultipart = contentType.includes('multipart/form-data')
    const formData = isMultipart ? await request.formData() : null
    const body = isMultipart ? Object.fromEntries(formData!.entries()) : await request.json()
    const id = readString(body?.id)
    if (!id) return NextResponse.json({ error: '수정할 메모 ID가 없습니다.' }, { status: 400 })

    if (body?.togglePinned === true) {
      const memo = await memoClient().update({
        where: { id },
        data: { pinned: readBoolean(body.pinned) },
        include: {
          attachments: {
            orderBy: { createdAt: 'asc' },
          },
        },
      })
      return NextResponse.json({ memo: serializeMemo(memo) })
    }

    if (body?.toggleArchived === true) {
      const memo = await memoClient().update({
        where: { id },
        data: { archived: readBoolean(body.archived) },
        include: {
          attachments: {
            orderBy: { createdAt: 'asc' },
          },
        },
      })
      return NextResponse.json({ memo: serializeMemo(memo) })
    }

    if (isMultipart && formData) {
      const keepAttachmentIds = parseKeepAttachmentIds(body.keepAttachmentIds)
      const attachments = await buildAttachmentRecords(formData.getAll('attachments'))
      const memo = await memoClient().update({
        where: { id },
        data: {
          ...normalizeMemoInput(body, keepAttachmentIds.length + attachments.length),
          attachments: {
            deleteMany: keepAttachmentIds.length ? { id: { notIn: keepAttachmentIds } } : {},
            create: attachments,
          },
        },
        include: {
          attachments: {
            orderBy: { createdAt: 'asc' },
          },
        },
      })

      return NextResponse.json({ memo: serializeMemo(memo) })
    }

    const memo = await memoClient().update({
      where: { id },
      data: normalizeMemoInput(body || {}),
      include: {
        attachments: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    return NextResponse.json({ memo: serializeMemo(memo) })
  } catch (error) {
    const message = error instanceof Error ? error.message : '메모를 수정하지 못했습니다.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  try {
    const { searchParams } = new URL(request.url)
    const id = readString(searchParams.get('id'))
    if (!id) return NextResponse.json({ error: '삭제할 메모 ID가 없습니다.' }, { status: 400 })

    await memoClient().delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[admin-memos DELETE] error:', error)
    return NextResponse.json({ error: '메모를 삭제하지 못했습니다.' }, { status: 500 })
  }
}
