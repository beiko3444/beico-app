import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'

export async function getAdminSession() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return null
  }

  return session
}
