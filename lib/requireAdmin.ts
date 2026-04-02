import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'

export async function requireAdminSession() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return {
      session: null,
      unauthorized: NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 }),
    }
  }

  return {
    session,
    unauthorized: null,
  }
}
