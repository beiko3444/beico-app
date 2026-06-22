import assert from 'node:assert/strict'
import { test } from 'node:test'

const payload = await import('../lib/adminPushPayload.mjs')

test('new order push payload has stable title, body, url and string data', () => {
  const result = payload.buildNewOrderPushPayload({
    orderNumber: '20260622001',
    customerName: '비이코상사',
    total: 125000,
    itemsCount: 3,
  })

  assert.equal(result.title, '신규 주문 접수')
  assert.equal(result.body, '비이코상사 · 20260622001 · 125,000원 · 3개 상품')
  assert.equal(result.url, '/admin/orders')
  assert.deepEqual(result.data, {
    type: 'new_order',
    url: '/admin/orders',
    orderNumber: '20260622001',
    total: '125000',
    itemsCount: '3',
  })
})

test('mobile message push payload compacts multiline message body', () => {
  const result = payload.buildMobileMessagePushPayload({
    count: 2,
    sender: '01012345678',
    body: '첫 줄\n둘째 줄이 들어온 문자입니다.',
  })

  assert.equal(result.title, '새 문자 2건')
  assert.equal(result.body, '01012345678 · 첫 줄 둘째 줄이 들어온 문자입니다.')
  assert.equal(result.url, '/admin/mobile-messages')
  assert.equal(result.data.type, 'mobile_message')
})

test('deposit match push payload maps statuses to useful Korean labels', () => {
  const result = payload.buildDepositMatchPushPayload({
    matchStatus: 'AMBIGUOUS',
    amount: 43000,
    depositorName: '홍길동',
  })

  assert.equal(result.title, '입금문자 확인 필요')
  assert.equal(result.body, '홍길동 · 43,000원 · 후보 여러 건')
  assert.equal(result.url, '/admin/orders')
  assert.equal(result.data.matchStatus, 'AMBIGUOUS')
})
