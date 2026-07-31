import assert from 'node:assert/strict'
import {
  formatKoreanYmd,
  koreanMonthRange,
  parseKoreanYmd,
} from '../lib/inventoryInboundDates.mjs'

const july = koreanMonthRange('2026-07-01')
assert.ok(july)
assert.equal(july.start.toISOString(), '2026-06-30T15:00:00.000Z')
assert.equal(july.end.toISOString(), '2026-07-31T15:00:00.000Z')

const julyFromEndOfMonth = koreanMonthRange('2026-07-31')
assert.ok(julyFromEndOfMonth)
assert.equal(julyFromEndOfMonth.start.toISOString(), july.start.toISOString())
assert.equal(julyFromEndOfMonth.end.toISOString(), july.end.toISOString())

const december = koreanMonthRange('2026-12-15')
assert.ok(december)
assert.equal(december.start.toISOString(), '2026-11-30T15:00:00.000Z')
assert.equal(december.end.toISOString(), '2026-12-31T15:00:00.000Z')

const parsed = parseKoreanYmd('2026-07-31')
assert.ok(parsed)
assert.equal(formatKoreanYmd(parsed), '2026-07-31')
assert.equal(parseKoreanYmd('2026-13-01'), null)
assert.equal(parseKoreanYmd('2026-02-31'), null)
assert.equal(koreanMonthRange('not-a-date'), null)

console.log('inventory inbound date tests passed')
