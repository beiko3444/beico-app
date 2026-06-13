import assert from 'node:assert/strict'
import { normalizeNaverSalesRows } from '../scripts/naver-sales-normalize.mjs'

const rows = normalizeNaverSalesRows('2026-06-13', [
  {
    productId: 12345,
    productName: '퀵베이트 청갯지렁이',
    numPurchases: '3',
    productQuantity: '7',
    payAmount: '12000.8',
    refundPayAmount: '2000',
    sellerManagementCode: ' qb-01 ',
  },
  {
    productId: '',
    productName: '무시할 행',
    numPurchases: 1,
  },
])

assert.equal(rows.length, 1)
assert.deepEqual(rows[0], {
  saleDate: '2026-06-13',
  channelProductNo: '12345',
  sellerManagementCode: 'QB-01',
  productName: '퀵베이트 청갯지렁이',
  orders: 3,
  quantity: 7,
  payAmount: 12001,
  refundAmount: 2000,
  netAmount: 10001,
  raw: {
    productId: 12345,
    productName: '퀵베이트 청갯지렁이',
    numPurchases: '3',
    productQuantity: '7',
    payAmount: '12000.8',
    refundPayAmount: '2000',
    sellerManagementCode: ' qb-01 ',
  },
})

console.log('naver sales normalization ok')
