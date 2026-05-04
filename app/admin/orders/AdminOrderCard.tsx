'use client'

import OrderDetailPage from './OrderDetailPage'

export default function AdminOrderCard({ order }: { order: any }) {
  return <OrderDetailPage order={order} />
}
