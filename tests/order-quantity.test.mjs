import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import { calculateOrderFinalAmount } from '../lib/orderAmount.ts'
import { applyOrderQuantityChanges, OrderQuantityError, parseOrderQuantityChanges } from '../lib/orderQuantity.ts'

const source = readFileSync(new URL('../app/api/orders/[id]/route.ts', import.meta.url), 'utf8')
const routeCode = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

function fixture({ role = 'ADMIN', shippingFeeOverride = null, taxInvoiceIssued = false, beforeTransaction } = {}) {
  let store = {
    id: 'order-1', userId: 'partner-1', orderNumber: '20260731001', status: 'PENDING',
    shippingFeeOverride, taxInvoiceIssued, user: { name: '거래처' },
    items: [
      { id: 'item-1', productId: 'product-1', quantity: 100, price: 1000, product: { name: '상품 A' } },
      { id: 'item-2', productId: 'product-2', quantity: 50, price: 2000, product: { name: '상품 B' } },
    ],
  }
  store.total = calculateOrderFinalAmount(store.items, shippingFeeOverride).finalAmount
  const calls = []
  const prisma = {
    order: { findUnique: async () => structuredClone(store) },
    $transaction: async (fn, options) => {
      calls.push(options)
      beforeTransaction?.(store)
      const next = structuredClone(store)
      const tx = { order: {
        findUnique: async () => structuredClone(next),
        update: async ({ data }) => {
          const { items, ...fields } = data
          Object.assign(next, fields)
          for (const update of items?.update || []) {
            Object.assign(next.items.find((item) => item.id === update.where.id), update.data)
          }
          return structuredClone(next)
        },
      } }
      const result = await fn(tx)
      store = next
      return result
    },
  }
  const exports = {}
  const dependencies = {
    'next/server': { NextResponse: Response },
    '@/lib/partnerProductStatus': { isPartnerProductOrderable: () => true },
    '@/lib/prisma': { prisma },
    'next-auth': { getServerSession: async () => role ? { user: { id: 'partner-1', role } } : null },
    '@/lib/auth': { authOptions: {} },
    '@/lib/email': { sendEmail: async () => {} },
    '@/lib/orderAmount': { calculateOrderFinalAmount },
    '@/lib/orderQuantity': { applyOrderQuantityChanges, OrderQuantityError, parseOrderQuantityChanges },
  }
  vm.runInNewContext(routeCode, {
    exports, require: (name) => {
      assert.ok(name in dependencies, `Unexpected dependency ${name}`)
      return dependencies[name]
    }, console: { log() {}, error() {} }, Date,
  })
  return {
    getOrder: () => structuredClone(store), calls,
    patch: (body) => exports.PATCH(new Request('http://localhost/api/orders/order-1', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }), { params: Promise.resolve({ id: 'order-1' }) }),
  }
}

test('quantity edits preserve unit prices and recalculate every amount atomically', async () => {
  const app = fixture()
  const response = await app.patch({ items: [{ id: 'item-1', quantity: 151, price: 1 }] })
  assert.equal(response.status, 200)
  const order = app.getOrder()
  assert.equal(order.items[0].quantity, 151)
  assert.equal(order.items[0].price, 1000)
  assert.equal(order.items[1].quantity, 50)
  assert.deepEqual(calculateOrderFinalAmount(order.items), {
    totalQuantity: 201, productSupplyPrice: 251000, shippingFee: 9000, vat: 26000, finalAmount: 286000,
  })
  assert.equal(order.total, 286000)
  assert.equal(app.calls[0].isolationLevel, 'Serializable')
})

test('reducing quantities reduces automatic shipping across a box boundary', async () => {
  const app = fixture()
  assert.equal((await app.patch({ items: [{ id: 'item-1', quantity: 50 }] })).status, 200)
  const order = app.getOrder()
  assert.equal(order.total, 168300)
  assert.equal(calculateOrderFinalAmount(order.items).shippingFee, 3000)
})

for (const fee of [0, 5000]) {
  test(`quantity edits retain the ${fee} won shipping override`, async () => {
    const app = fixture({ shippingFeeOverride: fee })
    assert.equal((await app.patch({ items: [{ id: 'item-1', quantity: 10 }] })).status, 200)
    const order = app.getOrder()
    assert.equal(order.shippingFeeOverride, fee)
    assert.equal(order.total, calculateOrderFinalAmount(order.items, fee).finalAmount)
  })
}

test('multiple quantities and shipping can change in a single transaction', async () => {
  const app = fixture({ shippingFeeOverride: 5000 })
  assert.equal((await app.patch({ items: [
    { id: 'item-1', quantity: 20 }, { id: 'item-2', quantity: 30 },
  ], shippingFeeOverride: null })).status, 200)
  assert.equal(app.getOrder().total, 91300)
  assert.equal(app.getOrder().shippingFeeOverride, null)
})

for (const role of [null, 'PARTNER']) {
  test(`${role || 'unauthenticated'} cannot change order quantities`, async () => {
    const app = fixture({ role })
    const before = app.getOrder()
    assert.equal((await app.patch({ items: [{ id: 'item-1', quantity: 1 }] })).status, role ? 403 : 401)
    assert.deepEqual(app.getOrder(), before)
    assert.equal(app.calls.length, 0)
  })
}

for (const quantity of [0, -1, 1.5, '100', null, 1000001]) {
  test(`invalid quantity ${JSON.stringify(quantity)} is rejected without writes`, async () => {
    const app = fixture()
    const before = app.getOrder()
    assert.equal((await app.patch({ items: [{ id: 'item-1', quantity }] })).status, 400)
    assert.deepEqual(app.getOrder(), before)
    assert.equal(app.calls.length, 0)
  })
}

for (const items of [[], {}, [null], [{ quantity: 1 }], [
  { id: 'item-1', quantity: 1 }, { id: 'item-1', quantity: 2 },
]]) {
  test(`malformed or duplicated item updates ${JSON.stringify(items)} are rejected`, async () => {
    const app = fixture()
    assert.equal((await app.patch({ items })).status, 400)
    assert.equal(app.calls.length, 0)
  })
}

test('an item belonging to another order cannot be edited and nothing is partially saved', async () => {
  const app = fixture()
  const before = app.getOrder()
  assert.equal((await app.patch({ items: [
    { id: 'item-1', quantity: 1 }, { id: 'other-order-item', quantity: 1 },
  ], shippingFeeOverride: 0 })).status, 400)
  assert.deepEqual(app.getOrder(), before)
})

test('issued tax invoices block quantity edits', async () => {
  const app = fixture({ taxInvoiceIssued: true })
  const before = app.getOrder()
  assert.equal((await app.patch({ items: [{ id: 'item-1', quantity: 1 }] })).status, 409)
  assert.deepEqual(app.getOrder(), before)
})

test('transaction re-checks invoice issuance before saving', async () => {
  const app = fixture({ beforeTransaction: (order) => { order.taxInvoiceIssued = true } })
  assert.equal((await app.patch({ items: [{ id: 'item-1', quantity: 1 }] })).status, 409)
  assert.equal(app.getOrder().items[0].quantity, 100)
})

test('transaction uses the latest shipping override, not the earlier snapshot', async () => {
  const app = fixture({ beforeTransaction: (order) => { order.shippingFeeOverride = 0 } })
  assert.equal((await app.patch({ items: [{ id: 'item-1', quantity: 1 }] })).status, 200)
  assert.equal(app.getOrder().shippingFeeOverride, 0)
  assert.equal(app.getOrder().total, 111100)
})

test('shipping-only edits still recalculate the total', async () => {
  const app = fixture()
  assert.equal((await app.patch({ shippingFeeOverride: 5000 })).status, 200)
  assert.equal(app.getOrder().total, 225500)
  assert.equal(app.getOrder().items[0].quantity, 100)
})

test('quantity editing is available in both desktop and mobile order layouts', () => {
  const ui = readFileSync(new URL('../app/admin/orders/OrderDetailPage.tsx', import.meta.url), 'utf8')
  assert.equal((ui.match(/\{renderQuantity\(product\)\}/g) || []).length, 2)
  assert.match(ui, /items: \[\{ id: editingQuantityId, quantity \}\]/)
  assert.match(ui, /order && !taxInvoiceIssued/)
})
