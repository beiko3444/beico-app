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
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
    })

    memos = rows.map((memo) => ({
      ...memo,
      createdAt: new Date(memo.createdAt).toISOString(),
      updatedAt: new Date(memo.updatedAt).toISOString(),
    }))
  } catch (error) {
    console.error('Failed to load admin memos:', error)
  }

  return <MemosClient initialMemos={memos} />
}
