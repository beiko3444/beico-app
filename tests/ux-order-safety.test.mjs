import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { productionReviewReason } from '../lib/productionReview.ts'

const source = readFileSync(new URL('../app/api/orders/route.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
function fixture() {
    let writes = 0
    const tx = {
        user: { findUnique: async () => ({ country: 'Korea', partnerProfile: { grade: 'C' } }) },
        product: { findUnique: async () => ({ id: 'p1', name: '테스트 상품', minOrderQuantity: 1, orderUnit: 1 }) },
        order: { findFirst: async () => null, create: async ({ data }) => { writes++; return { ...data, items: [] } } },
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
    }
    const exports = {}
    vm.runInNewContext(compiled, { exports, console: { error() {} }, require: name => {
        assert.ok(name in dependencies, `Unexpected dependency ${name}`)
        return dependencies[name]
    } })
    return { post: exports.POST, writes: () => writes }
}
for (const [name, quantity, price] of [['zero price', 100, 0], ['negative price', 100, -1], ['missing price', 100, null], ['fractional quantity', 1.5, 1000], ['zero quantity', 0, 1000], ['negative quantity', -2, 1000]]) {
    test(`order rejects ${name} before any order is written`, async () => {
        const app = fixture()
        const result = await app.post(new Request('http://localhost/api/orders', { method: 'POST', body: JSON.stringify({ items: [{ productId: 'p1', quantity, price }], total: 1000 }) }))
        assert.equal(result.status, 400)
        assert.equal(app.writes(), 0)
        assert.match((await result.json()).error, /수량과 거래 단가/)
    })
}
test('valid quantity and price still create an order', async () => {
    const app = fixture()
    const result = await app.post(new Request('http://localhost/api/orders', { method: 'POST', body: JSON.stringify({ items: [{ productId: 'p1', quantity: 100, price: 1000 }], total: 113300 }) }))
    assert.equal(result.status, 200)
    assert.equal(app.writes(), 1)
})
test('a one-unit batch with high recorded cost is marked for review without changing its data', () => {
    const batch = { quantity: 1, unitCost: 2002481, salesPrice: 4350 }
    const original = structuredClone(batch)
    assert.match(productionReviewReason(batch), /도매가/)
    assert.deepEqual(batch, original)
    assert.equal(productionReviewReason({ quantity: 1497, unitCost: 1777, salesPrice: 4350 }), null)
})
