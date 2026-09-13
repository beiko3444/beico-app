export type InventoryChannelHealth = {
  status: 'current' | 'stale' | 'unknown'
  lastUpdatedAt: string | null
  ageMinutes: number | null
}

const DEFAULT_STALE_AFTER_MS = 6 * 60 * 60 * 1000

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function dateString(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : value
}

export function resolveInventoryChannelHealth(
  health: Record<string, unknown> | null,
  channel: 'naver' | 'coupang',
  nowMs = Date.now(),
  staleAfterMs = DEFAULT_STALE_AFTER_MS,
): InventoryChannelHealth {
  const lastUpdatedAt = dateString(health?.[`${channel}_last_updated`])
  if (!lastUpdatedAt) return { status: 'unknown', lastUpdatedAt: null, ageMinutes: null }

  const ageMs = Math.max(0, nowMs - new Date(lastUpdatedAt).getTime())
  return {
    status: ageMs > staleAfterMs ? 'stale' : 'current',
    lastUpdatedAt,
    ageMinutes: Math.floor(ageMs / 60000),
  }
}

function friendlySyncError(channel: 'naver' | 'coupang', error: string): string {
  const label = channel === 'coupang' ? '쿠팡' : '네이버'
  if (/hmac key is expired/i.test(error)) {
    return `${label} Open API 인증키가 만료되었습니다. Wing에서 API 키를 재발급한 뒤 수집기 설정을 갱신해 주세요.`
  }
  return `${label} 재고 동기화 실패: ${error || '원인을 확인할 수 없습니다.'}`
}

export function inventorySyncFailure(result: unknown): string | null {
  const payload = record(result)
  if (!payload) return '재고 수집기가 올바른 동기화 결과를 반환하지 않았습니다.'

  const failures: string[] = []
  for (const channel of ['naver', 'coupang'] as const) {
    const channelResult = record(payload[channel])
    if (channelResult?.ok === false) {
      failures.push(friendlySyncError(channel, String(channelResult.error || '')))
    }
  }

  const rootError = typeof payload.error === 'string' ? payload.error.trim() : ''
  if (rootError) failures.push(rootError)
  return failures.length ? failures.join(' ') : null
}
