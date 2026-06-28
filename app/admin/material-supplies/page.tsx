import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sortMaterialSupplies } from '@/lib/materialSupplies'
import MaterialSuppliesClient, { type MaterialSupplyItem } from './MaterialSuppliesClient'

export const dynamic = 'force-dynamic'

type MaterialSupplyReader = {
  materialSupply: {
    findMany: (args: unknown) => Promise<MaterialSupplyRow[]>
  }
}

type MaterialSupplyRow = {
  id: string
  name: string
  category: string
  supplierName: string
  purchaseUrl: string
  unit: string
  priceKrw: number | null
  memo: string
  active: boolean
  sortOrder: number
  lastPurchasedAt: Date | string | null
  createdAt: Date | string
  updatedAt: Date | string
}

const materialSupplyClient = () => (prisma as unknown as MaterialSupplyReader).materialSupply

export default async function MaterialSuppliesPage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login')
  }

  let items: MaterialSupplyItem[] = []

  try {
    const rows = await materialSupplyClient().findMany({
      orderBy: [{ active: 'desc' }, { category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    })
    items = sortMaterialSupplies(rows).map((item) => ({
      ...item,
      lastPurchasedAt: item.lastPurchasedAt ? new Date(item.lastPurchasedAt).toISOString() : null,
      createdAt: new Date(item.createdAt).toISOString(),
      updatedAt: new Date(item.updatedAt).toISOString(),
    }))
  } catch (error) {
    console.error('Failed to load material supplies:', error)
  }

  return <MaterialSuppliesClient initialItems={items} />
}
