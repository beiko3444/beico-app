import assert from 'node:assert/strict'
import test from 'node:test'

const holidays = await import('../lib/koreanHolidays.ts')

test('returns 2026 Korean holiday names used by attendance calendar', () => {
  assert.equal(holidays.getKoreanHolidayName('2026-06-03'), '전국동시지방선거')
  assert.equal(holidays.getKoreanHolidayName('2026-06-06'), '현충일')
  assert.equal(holidays.getKoreanHolidayName('2026-10-05'), '대체공휴일')
})

test('returns null for ordinary weekdays', () => {
  assert.equal(holidays.getKoreanHolidayName('2026-06-04'), null)
})
