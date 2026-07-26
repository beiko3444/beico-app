import assert from 'node:assert/strict'
import {
  buildProductHistorySeries,
  parseInventoryProductKey,
} from '../lib/smartInventoryHistory.mjs'

assert.deepEqual(parseInventoryProductKey('id:100|item:A'), { productId: '100', itemId: 'A' })
assert.deepEqual(parseInventoryProductKey('200|'), { productId: '200', itemId: '' })
assert.equal(parseInventoryProductKey('url:https://example.com/product'), null)

const result = buildProductHistorySeries({
  links: [
    { channel: 'naver', productKey: 'id:100|item:A', multiplier: 2 },
    { channel: 'coupang', productKey: '200|', multiplier: 1 },
  ],
  startDate: '2026-07-24',
  endDate: '2026-07-26',
  selectedDate: '2026-07-25',
  dailyRows: [
    { date: '2026-07-24', channel: 'naver', product_id: '100', item_id: 'A', qty_sold: 3 },
    { date: '2026-07-24', channel: 'coupang', product_id: '200', item_id: null, qty_sold: 2 },
    { date: '2026-07-25', channel: 'naver', product_id: '100', item_id: 'A', qty_sold: 1 },
    { date: '2026-07-25', channel: 'naver', product_id: 'unlinked', item_id: 'A', qty_sold: 99 },
  ],
  eventRows: [
    { recorded_at: '2026-07-25T09:10:00', channel: 'naver', product_id: '100', item_id: 'A', qty_sold: 1 },
    { recorded_at: '2026-07-25T09:40:00', channel: 'coupang', product_id: '200', item_id: null, qty_sold: 2 },
    { recorded_at: '2026-07-25T11:10:00', channel: 'naver', product_id: '100', item_id: 'A', qty_sold: 2 },
    { recorded_at: '2026-07-24T09:10:00', channel: 'naver', product_id: '100', item_id: 'A', qty_sold: 50 },
  ],
})

assert.deepEqual(result.daily.map((point) => point.total), [8, 2, 0])
assert.equal(result.daily[0].naver, 6)
assert.equal(result.daily[0].coupang, 2)
assert.equal(result.hourly[9].naver, 2)
assert.equal(result.hourly[9].coupang, 2)
assert.equal(result.hourly[9].total, 4)
assert.equal(result.hourly[11].total, 4)
assert.equal(result.summary.periodTotal, 10)
assert.equal(result.summary.selectedDayTotal, 8)
assert.equal(result.summary.peakDate?.date, '2026-07-24')
assert.equal(result.summary.peakHour?.hour, 9)

console.log('smart inventory history ok')
