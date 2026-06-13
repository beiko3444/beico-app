import assert from 'node:assert/strict'
import {
  buildNaverSalesDashboard,
  normalizeNaverInsightRows,
} from '../lib/naverSalesAnalytics.mjs'

const dashboard = buildNaverSalesDashboard([
  {
    saleDate: new Date('2026-06-07T00:00:00.000Z'),
    channelProductNo: 'P-1',
    sellerManagementCode: 'QB-01',
    productName: '퀵베이트 청갯지렁이',
    dbProductName: null,
    orders: 2,
    quantity: 3,
    payAmount: 12000,
    refundAmount: 1000,
    netAmount: 11000,
  },
  {
    saleDate: new Date('2026-06-08T00:00:00.000Z'),
    channelProductNo: 'P-1',
    sellerManagementCode: 'QB-01',
    productName: '퀵베이트 청갯지렁이',
    dbProductName: null,
    orders: 1,
    quantity: 2,
    payAmount: 8000,
    refundAmount: 0,
    netAmount: 8000,
  },
  {
    saleDate: new Date('2026-06-08T00:00:00.000Z'),
    channelProductNo: 'P-2',
    sellerManagementCode: 'TB-01',
    productName: '토부에기 심해보라새우',
    dbProductName: '토부에기 시리즈2 09 심해보라새우',
    orders: 4,
    quantity: 7,
    payAmount: 35000,
    refundAmount: 5000,
    netAmount: 30000,
  },
])

assert.deepEqual(dashboard.totals, {
  orders: 7,
  quantity: 12,
  payAmount: 55000,
  refundAmount: 6000,
  netAmount: 49000,
  averageOrderAmount: 7857,
})

assert.equal(dashboard.products.length, 2)
assert.equal(dashboard.products[0].channelProductNo, 'P-2')
assert.equal(dashboard.products[0].netAmount, 30000)
assert.equal(dashboard.products[0].salesShare, 61.22)
assert.equal(dashboard.products[1].channelProductNo, 'P-1')
assert.equal(dashboard.products[1].orders, 3)
assert.equal(dashboard.products[1].quantity, 5)
assert.equal(dashboard.products[1].netAmount, 19000)
assert.deepEqual(dashboard.byDate, [
  { saleDate: '2026-06-07', orders: 2, quantity: 3, payAmount: 12000, refundAmount: 1000, netAmount: 11000 },
  { saleDate: '2026-06-08', orders: 5, quantity: 9, payAmount: 43000, refundAmount: 5000, netAmount: 38000 },
])

const insights = normalizeNaverInsightRows('2026-06-13', 'KEYWORD', [
  { keyword: '청갯지렁이', numInteractions: '12', numPurchases: '3', payAmount: '24000' },
  { refKeyword: '토부에기', numInteractions: 8, numPurchases: 2, payAmount: 18000 },
  { channelName: '가격비교', channelDetail: '네이버쇼핑', inflowCount: 7, payAmount: 9000 },
  { payAmount: 1000 },
])

assert.deepEqual(insights.map((row) => ({
  label: row.label,
  interactions: row.interactions,
  orders: row.orders,
  payAmount: row.payAmount,
})), [
  { label: '청갯지렁이', interactions: 12, orders: 3, payAmount: 24000 },
  { label: '토부에기', interactions: 8, orders: 2, payAmount: 18000 },
  { label: '가격비교 / 네이버쇼핑', interactions: 7, orders: 0, payAmount: 9000 },
])

console.log('naver sales analytics ok')
