import assert from 'node:assert/strict'
import {
  inventorySyncFailure,
  resolveInventoryChannelHealth,
} from '../lib/smartInventoryHealth.ts'

const now = Date.parse('2026-09-13T12:00:00.000Z')

assert.deepEqual(
  resolveInventoryChannelHealth(
    { coupang_last_updated: '2026-09-13T10:00:00.000Z' },
    'coupang',
    now,
  ),
  {
    status: 'current',
    lastUpdatedAt: '2026-09-13T10:00:00.000Z',
    ageMinutes: 120,
  },
)

assert.equal(
  resolveInventoryChannelHealth(
    { coupang_last_updated: '2026-08-20T14:16:58.394Z' },
    'coupang',
    now,
  ).status,
  'stale',
)

assert.equal(resolveInventoryChannelHealth(null, 'coupang', now).status, 'unknown')

assert.match(
  inventorySyncFailure({
    naver: { ok: true },
    coupang: { ok: false, error: 'ERROR: Hmac key is expired.' },
  }) || '',
  /인증키가 만료/,
)

assert.equal(
  inventorySyncFailure({ naver: { ok: true }, coupang: { ok: true } }),
  null,
)

console.log('smart inventory health tests passed')
