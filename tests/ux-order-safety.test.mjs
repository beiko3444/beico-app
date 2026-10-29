import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { productionReviewReason } from '../lib/productionReview.ts'
import * as partnerOrderPricing from '../lib/partnerOrderPricing.ts'

const source = readFileSync(new URL('../app/api/orders/route.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
function fixture({ product = { id: 'p1', name: '테스트 상품', minOrderQuantity: 1, orderUnit: 1, priceC: 1000 } } = {}) {
    let writes = 0
    let created = null
    const tx = {
        user: { findUnique: async () => ({ country: 'Korea', partnerProfile: { grade: 'C' } }) },
        product: { findUnique: async () => product },
        order: { findFirst: async () => null, create: async ({ data }) => { writes++; created = data; return { ...data, items: [] } } },
    }
    const dependencies = {
        'next/server': { NextResponse: Response },
        '@/lib/prisma': { prisma: { $transaction: fn => fn(tx) } },
        'next-auth': { getServerSession: async () => ({ user: { id: 'partner', name: '테스트' } }) },
        '@/lib/auth': { authOptions: {} },
        '@/lib/notification': { sendOrderNotification: async () => {} },
        '@/lib/adminPush': { sendNewOrderAdminPush: async () => {} },
        '@/lib/product-image-url': { getProductImageUrl: () => '' },
        '@/lib/partnerProductStatus': { isPartnerProductOrderable: () => true },
        '@/lib/partnerOrderPricing': partnerOrderPricing,
    }
    const exports = {}
    vm.runInNewContext(compiled, { exports, console: { error() {} }, require: name => {
        assert.ok(name in dependencies, `Unexpected dependency ${name}`)
        return dependencies[name]
    } })
    return { post: exports.POST, writes: () => writes, created: () => created }
}
for (const [name, quantity] of [['fractional quantity', 1.5], ['zero quantity', 0], ['negative quantity', -2]]) {
    test(`order rejects ${name} before any order is written`, async () => {
        const app = fixture()
        const result = await app.post(new Request('http://localhost/api/orders', { method: 'POST', body: JSON.stringify({ items: [{ productId: 'p1', quantity, price: 1000 }], total: 1000 }) }))
        assert.equal(result.status, 400)
        assert.equal(app.writes(), 0)
        assert.match((await result.json()).error, /수량과 거래 단가/)
    })
}
test('order rejects a product without a partner price before any order is written', async () => {
    const app = fixture({ product: { id: 'p1', name: '테스트 상품', minOrderQuantity: 1, orderUnit: 1 } })
    const result = await app.post(new Request('http://localhost/api/orders', { method: 'POST', body: JSON.stringify({ items: [{ productId: 'p1', quantity: 100, price: 1000 }], total: 113300 }) }))
    assert.equal(result.status, 400)
    assert.equal(app.writes(), 0)
    assert.match((await result.json()).error, /수량과 거래 단가/)
})
test('valid quantity still creates an order', async () => {
    const app = fixture()
    const result = await app.post(new Request('http://localhost/api/orders', { method: 'POST', body: JSON.stringify({ items: [{ productId: 'p1', quantity: 100 }] }) }))
    assert.equal(result.status, 200)
    assert.equal(app.writes(), 1)
    assert.equal(app.created().total, 113300)
})
for (const [name, price, total] of [['one won', 1, 1], ['zero', 0, 0], ['negative', -1, -1]]) {
    test(`client-sent ${name} price and total are replaced by the partner's price`, async () => {
        const app = fixture()
        const result = await app.post(new Request('http://localhost/api/orders', { method: 'POST', body: JSON.stringify({ items: [{ productId: 'p1', quantity: 100, price }], total }) }))
        assert.equal(result.status, 200)
        assert.deepEqual(JSON.parse(JSON.stringify(app.created().items.create)), [{ productId: 'p1', quantity: 100, price: 1000 }])
        assert.equal(app.created().total, 113300)
    })
}
test('a one-unit batch with high recorded cost is marked for review without changing its data', () => {
    const batch = { quantity: 1, unitCost: 2002481, salesPrice: 4350 }
    const original = structuredClone(batch)
    assert.match(productionReviewReason(batch), /도매가/)
    assert.deepEqual(batch, original)
    assert.equal(productionReviewReason({ quantity: 1497, unitCost: 1777, salesPrice: 4350 }), null)
})
