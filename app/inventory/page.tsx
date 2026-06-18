import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import InventoryStandaloneClient from './InventoryStandaloneClient'

export const dynamic = 'force-dynamic'

export default async function InventoryStandalonePage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  return <InventoryStandaloneClient />
}
