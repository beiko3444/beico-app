import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import MemosClient, { type AdminMemoItem } from './MemosClient'

export const dynamic = 'force-dynamic'

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

type AdminMemoReader = {
  adminMemo: {
    findMany: (args: unknown) => Promise<AdminMemoRow[]>
  }
}

const memoClient = () => (prisma as unknown as AdminMemoReader).adminMemo

export default async function AdminMemosPage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  let memos: AdminMemoItem[] = []

  try {
    const rows = await memoClient().findMany({
      include: {
        attachments: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
    })

    memos = rows.map((memo) => ({
      ...memo,
      createdAt: new Date(memo.createdAt).toISOString(),
      updatedAt: new Date(memo.updatedAt).toISOString(),
      attachments: memo.attachments.map((attachment) => ({
        ...attachment,
        createdAt: new Date(attachment.createdAt).toISOString(),
        updatedAt: new Date(attachment.updatedAt).toISOString(),
      })),
    }))
  } catch (error) {
    console.error('Failed to load admin memos:', error)
  }

  return <MemosClient initialMemos={memos} />
}
