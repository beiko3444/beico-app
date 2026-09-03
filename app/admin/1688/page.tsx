import { prisma } from '@/lib/prisma'
import { ensurePurchase1688Seeded } from '@/lib/purchase1688'
import Purchase1688Client, { type Purchase1688Item } from './Purchase1688Client'

export const dynamic = 'force-dynamic'

export default async function Purchase1688Page() {
  let items: Purchase1688Item[] = []
  let cnyKrwRate = 204
  let loadError = ''

  try {
    const setting = await ensurePurchase1688Seeded()
    const rows = await prisma.purchase1688Item.findMany({
      orderBy: [{ orderedOn: 'desc' }, { orderNo: 'desc' }, { createdAt: 'asc' }],
    })
    cnyKrwRate = setting.cnyKrwRate
    items = rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }))
  } catch (error) {
    console.error('[1688 page]', error)
    loadError = '데이터베이스 연결을 확인해 주세요.'
  }

  return <Purchase1688Client initialItems={items} initialRate={cnyKrwRate} loadError={loadError} />
}
