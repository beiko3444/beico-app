// One vocabulary for order states, shared by the admin list, the admin detail and the partner history,
// so the same order never shows two different names or colours.
export type OrderStatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'progress'
export type OrderStatusGroup = 'pending' | 'paid' | 'shipped' | 'completed' | 'canceled'

type Meta = { group: OrderStatusGroup; label: string; labelJa: string; tone: OrderStatusTone }

const META: Record<OrderStatusGroup, Meta> = {
  pending: { group: 'pending', label: '입금 대기', labelJa: '入金待ち', tone: 'warning' },
  paid: { group: 'paid', label: '입금 확인', labelJa: '入金確認済み', tone: 'info' },
  shipped: { group: 'shipped', label: '배송 중', labelJa: '配送中', tone: 'progress' },
  completed: { group: 'completed', label: '거래 완료', labelJa: '取引完了', tone: 'success' },
  canceled: { group: 'canceled', label: '취소', labelJa: 'キャンセル済み', tone: 'neutral' },
}

// APPROVED is the legacy "approved, waiting for the deposit" state.
export function orderStatusGroup(status: string | null | undefined, hasTracking = false): OrderStatusGroup {
  if (status === 'CANCELED') return 'canceled'
  if (status === 'COMPLETED') return 'completed'
  if (status === 'SHIPPED' || hasTracking) return 'shipped'
  if (status === 'DEPOSIT_COMPLETED') return 'paid'
  return 'pending'
}

export function orderStatusMeta(status: string | null | undefined, hasTracking = false): Meta {
  return META[orderStatusGroup(status, hasTracking)]
}

export const ORDER_STATUS_GROUPS: Meta[] = Object.values(META)
