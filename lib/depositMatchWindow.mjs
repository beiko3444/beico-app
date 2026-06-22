export const DEPOSIT_MATCH_WINDOW_DAYS = 4
export const DEPOSIT_MATCH_WINDOW_MS = DEPOSIT_MATCH_WINDOW_DAYS * 24 * 60 * 60 * 1000

export function isDepositWithinOrderMatchWindow(orderCreatedAt, depositReceivedAt) {
  const orderTime = new Date(orderCreatedAt).getTime()
  const depositTime = new Date(depositReceivedAt).getTime()
  if (!Number.isFinite(orderTime) || !Number.isFinite(depositTime)) return false

  const elapsedMs = depositTime - orderTime
  return elapsedMs >= 0 && elapsedMs <= DEPOSIT_MATCH_WINDOW_MS
}

export function getDepositMatchOrderCreatedAtRange(depositReceivedAt) {
  const depositDate = new Date(depositReceivedAt)
  return {
    gte: new Date(depositDate.getTime() - DEPOSIT_MATCH_WINDOW_MS),
    lte: depositDate,
  }
}
