import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/requireAdmin'

export const dynamic = 'force-dynamic'

const tones = new Set(['INFO', 'IMPORTANT', 'URGENT'])

const readText = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const readBoolean = (value: unknown, fallback = false) => typeof value === 'boolean' ? value : fallback

const readDate = (value: unknown, fieldName: string) => {
  const text = readText(value)
  if (!text) return null
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) throw new Error(`${fieldName} 형식이 올바르지 않습니다.`)
  return date
}

const normalizeInput = (body: Record<string, unknown>) => {
  const title = readText(body.title)
  const content = readText(body.content)
  const tone = readText(body.tone).toUpperCase() || 'INFO'
  const startsAt = readDate(body.startsAt, '노출 시작일')
  const endsAt = readDate(body.endsAt, '노출 종료일')

  if (!title) throw new Error('공지 제목을 입력해주세요.')
  if (!content) throw new Error('공지 내용을 입력해주세요.')
  if (title.length > 120) throw new Error('공지 제목은 120자 이하로 입력해주세요.')
  if (content.length > 5000) throw new Error('공지 내용은 5,000자 이하로 입력해주세요.')
  if (!tones.has(tone)) throw new Error('공지 중요도를 확인해주세요.')
  if (startsAt && endsAt && endsAt <= startsAt) throw new Error('종료일은 시작일보다 뒤여야 합니다.')

  return {
    title,
    content,
    tone,
    isActive: readBoolean(body.isActive, true),
    startsAt,
    endsAt,
  }
}

const serializeNotice = (notice: {
  id: string
  title: string
  content: string
  tone: string
  isActive: boolean
  startsAt: Date | null
  endsAt: Date | null
  createdByName: string | null
  createdAt: Date
  updatedAt: Date
}) => ({
  ...notice,
  startsAt: notice.startsAt?.toISOString() || null,
  endsAt: notice.endsAt?.toISOString() || null,
  createdAt: notice.createdAt.toISOString(),
  updatedAt: notice.updatedAt.toISOString(),
})

const refreshNoticePages = () => {
  revalidatePath('/admin/notices')
  revalidatePath('/order')
}

export async function GET() {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  const notices = await prisma.partnerNotice.findMany({ orderBy: { updatedAt: 'desc' } })
  return NextResponse.json({ notices: notices.map(serializeNotice) })
}

export async function POST(request: Request) {
  const { session, unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  try {
    const body = await request.json() as Record<string, unknown>
    const notice = await prisma.partnerNotice.create({
      data: {
        ...normalizeInput(body),
        createdByName: session?.user?.name || '관리자',
      },
    })
    refreshNoticePages()
    return NextResponse.json({ notice: serializeNotice(notice) }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : '공지를 등록하지 못했습니다.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function PATCH(request: Request) {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  try {
    const body = await request.json() as Record<string, unknown>
    const id = readText(body.id)
    if (!id) return NextResponse.json({ error: '수정할 공지를 찾을 수 없습니다.' }, { status: 400 })

    const data = body.toggleActive === true
      ? { isActive: readBoolean(body.isActive) }
      : normalizeInput(body)
    const notice = await prisma.partnerNotice.update({ where: { id }, data })
    refreshNoticePages()
    return NextResponse.json({ notice: serializeNotice(notice) })
  } catch (error) {
    const message = error instanceof Error ? error.message : '공지를 수정하지 못했습니다.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  try {
    const id = readText(new URL(request.url).searchParams.get('id'))
    if (!id) return NextResponse.json({ error: '삭제할 공지를 찾을 수 없습니다.' }, { status: 400 })
    await prisma.partnerNotice.delete({ where: { id } })
    refreshNoticePages()
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Failed to delete partner notice:', error)
    return NextResponse.json({ error: '공지를 삭제하지 못했습니다.' }, { status: 500 })
  }
}
