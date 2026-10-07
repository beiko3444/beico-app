export interface OrderQuantityChange {
  id: string
  quantity: number
}

export class OrderQuantityError extends Error {}

export function parseOrderQuantityChanges(value: unknown): OrderQuantityChange[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new OrderQuantityError('수정할 주문 품목을 선택해 주세요.')
  }
  const ids = new Set<string>()
  return value.map((item) => {
    if (!item || typeof item.id !== 'string' || !item.id.trim() || ids.has(item.id)) {
      throw new OrderQuantityError('주문 품목 정보가 잘못되었거나 중복되었습니다.')
    }
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 1000000) {
      throw new OrderQuantityError('수량은 1 이상 1,000,000 이하의 정수로 입력해 주세요.')
    }
    ids.add(item.id)
    return { id: item.id, quantity: item.quantity }
  })
}

export function applyOrderQuantityChanges<T extends OrderQuantityChange>(
  items: T[], changes: OrderQuantityChange[],
): T[] {
  const itemIds = new Set(items.map((item) => item.id))
  if (changes.some((change) => !itemIds.has(change.id))) {
    throw new OrderQuantityError('이 주문에 포함되지 않은 품목은 수정할 수 없습니다.')
  }
  const quantities = new Map(changes.map((change) => [change.id, change.quantity]))
  return items.map((item) => ({ ...item, quantity: quantities.get(item.id) ?? item.quantity }))
}
