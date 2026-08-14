import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { resolvePartnerOrderTerms } from '../lib/partnerOrderPricing.ts'

const regionalProduct = {
  sellPrice: 5000,
  priceC: 4500,
  minOrderQuantity: 1,
  orderUnit: 1,
  regionalPrices: {
    B: {
      KR: { wholesale: '4,200', moq: '10', orderUnit: '5' },
      US: { wholesale: '3.25', moq: '20', orderUnit: '10' },
    },
    C: {
      KR: { wholesale: '4,500', moq: '2', orderUnit: '2' },
      US: { wholesale: '0', moq: '4', orderUnit: '2' },
    },
  },
}

assert.deepEqual(
  resolvePartnerOrderTerms(regionalProduct, { country: 'Korea', grade: 'B' }),
  { unitPrice: 4200, minimumQuantity: 10, orderUnit: 5 },
)
assert.deepEqual(
  resolvePartnerOrderTerms(regionalProduct, { country: 'USA', grade: 'B' }),
  { unitPrice: 3.25, minimumQuantity: 20, orderUnit: 10 },
)
assert.deepEqual(
  resolvePartnerOrderTerms(regionalProduct, { country: 'USA', grade: 'C' }),
  { unitPrice: 4500, minimumQuantity: 4, orderUnit: 2 },
)
assert.deepEqual(
  resolvePartnerOrderTerms({ sellPrice: 5000, priceA: 3900, minOrderQuantity: 3, orderUnit: 3 }, { country: 'Korea', grade: 'A' }),
  { unitPrice: 3900, minimumQuantity: 3, orderUnit: 3 },
)

const readSource = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const adminOrderRoute = readSource('app/api/admin/orders/route.ts')
const orderPatchRoute = readSource('app/api/orders/[id]/route.ts')
const orderDetailPage = readSource('app/admin/orders/OrderDetailPage.tsx')
const ordersPage = readSource('app/admin/orders/page.tsx')
const ordersClient = readSource('app/admin/orders/OrdersClient.tsx')

assert.match(adminOrderRoute, /requireAdminSession/)
assert.match(adminOrderRoute, /resolvePartnerOrderTerms/)
assert.match(adminOrderRoute, /status: 'PENDING'/)
assert.match(orderPatchRoute, /'COMPLETED'/)
assert.match(orderPatchRoute, /session\.user\.role !== 'ADMIN'/)
assert.match(orderDetailPage, /currentStatus === 'COMPLETED'/)
assert.match(orderDetailPage, /배송 처리나 계산서 발급 여부와 관계없이/)
assert.doesNotMatch(ordersPage, /depositSms/)
assert.doesNotMatch(ordersClient, /depositSms|입금문자/)

console.log('admin order workflow tests passed')
