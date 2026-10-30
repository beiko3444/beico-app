import InventoryClient from './InventoryClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: '재고 관리' }

export default function InventoryPage() {
  return <InventoryClient />
}
