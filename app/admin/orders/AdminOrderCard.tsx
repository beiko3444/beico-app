'use client'

import OrderDetailPage from './OrderDetailPage'
import type { OrderRecord } from './OrderDetailPage'

export default function AdminOrderCard({ order }: { order: OrderRecord }) {
  return <OrderDetailPage order={order} />
}
