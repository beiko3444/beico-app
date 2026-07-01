import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/requireAdmin'

export const dynamic = 'force-dynamic'

const memoColors = new Set(['green', 'yellow', 'blue', 'red', 'gray'])

type AdminMemoRow = {
  id: string
  title: string
  content: string
  category: string
  color: string
  pinned: boolean
  archived: boolean
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

const normalizeMemoInput = (body: Record<string, unknown>) => {
  const title = readString(body.title)
  if (!title) throw new Error('메모 제목을 입력해주세요.')

  const color = readString(body.color, 'green')

  return {
    title,
    content: readString(body.content),
    category: readString(body.category, '일반') || '일반',
    color: memoColors.has(color) ? color : 'green',
    pinned: Boolean(body.pinned),
    archived: Boolean(body.archived),
  }
}

const serializeMemo = (memo: AdminMemoRow) => ({
  ...memo,
  createdAt: new Date(memo.createdAt).toISOString(),
  updatedAt: new Date(memo.updatedAt).toISOString(),
})

export async function GET() {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  try {
    const memos = await memoClient().findMany({
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
    const body = await request.json()
    const memo = await memoClient().create({ data: normalizeMemoInput(body || {}) })

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
    const body = await request.json()
    const id = readString(body?.id)
    if (!id) return NextResponse.json({ error: '수정할 메모 ID가 없습니다.' }, { status: 400 })

    if (body?.togglePinned === true) {
      const memo = await memoClient().update({
        where: { id },
        data: { pinned: Boolean(body.pinned) },
      })
      return NextResponse.json({ memo: serializeMemo(memo) })
    }

    if (body?.toggleArchived === true) {
      const memo = await memoClient().update({
        where: { id },
        data: { archived: Boolean(body.archived) },
      })
      return NextResponse.json({ memo: serializeMemo(memo) })
    }

    const memo = await memoClient().update({
      where: { id },
      data: normalizeMemoInput(body || {}),
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
