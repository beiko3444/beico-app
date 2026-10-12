import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { savePartnerProductStatus } from '../lib/partnerProductStatusClient.ts'
import { getPartnerProductStatusWrite, PARTNER_PRODUCT_STATUSES } from '../lib/partnerProductStatus.ts'

const saved = (status = 'VISIBLE') => ({ id: 'product-1', partnerSaleStatus: status, wholesaleAvailable: status === 'VISIBLE' })

test('client uses the dedicated endpoint and verifies the persisted response', async () => {
    const result = await savePartnerProductStatus('product-1', 'VISIBLE', async (url, init) => {
        assert.equal(url, '/api/products/product-1/partner-status')
        assert.equal(init.method, 'PATCH')
        assert.deepEqual(JSON.parse(init.body), { partnerSaleStatus: 'VISIBLE' })
        assert.ok(init.signal)
        return Response.json(saved())
    })
    assert.deepEqual(result, saved())
})

for (const status of [502, 503, 504]) {
    test(`client retries HTTP ${status} once`, async () => {
        let calls = 0
        await savePartnerProductStatus('product-1', 'VISIBLE', async () => {
            return ++calls === 1 ? Response.json({ error: 'temporary' }, { status }) : Response.json(saved())
        })
        assert.equal(calls, 2)
    })
}

test('client retries a network failure once', async () => {
    let calls = 0
    await savePartnerProductStatus('product-1', 'VISIBLE', async () => {
        if (++calls === 1) throw new TypeError('fetch failed')
        return Response.json(saved())
    })
    assert.equal(calls, 2)
})

for (const [status, message] of [[401, /다시 로그인/], [403, /관리자 권한/], [400, /specific failure/], [500, /specific failure/]]) {
    test(`client shows an actionable HTTP ${status} error without retry`, async () => {
        let calls = 0
        await assert.rejects(savePartnerProductStatus('product-1', 'VISIBLE', async () => {
            calls++
            return Response.json({ error: 'specific failure' }, { status })
        }), message)
        assert.equal(calls, 1)
    })
}

test('client never retries forever', async () => {
    let calls = 0
    await assert.rejects(savePartnerProductStatus('product-1', 'VISIBLE', async () => {
        calls++
        throw new TypeError('fetch failed')
    }), /네트워크/)
    assert.equal(calls, 2)
})

test('client rejects a success response with the wrong persisted status', async () => {
    await assert.rejects(savePartnerProductStatus('product-1', 'VISIBLE', async () => Response.json(saved('HIDDEN'))), /저장 결과/)
})

const source = readFileSync(new URL('../app/api/products/[id]/partner-status/route.ts', import.meta.url), 'utf8')
const routeCode = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText

function routeFixture({ role = 'ADMIN', dbError, cacheError = false } = {}) {
    const calls = []
    const dependencies = {
        'next/server': { NextResponse: Response },
        'next/cache': { revalidatePath: () => { if (cacheError) throw new Error('cache failed') } },
        'next-auth': { getServerSession: async () => role ? { user: { role } } : null },
        '@/lib/auth': { authOptions: {} },
        '@/lib/partnerProductStatus': { getPartnerProductStatusWrite, PARTNER_PRODUCT_STATUSES },
        '@/lib/prisma': { prisma: { product: { update: async (args) => {
            calls.push(args)
            if (dbError) throw Object.assign(new Error('DB failed'), { code: dbError })
            return { id: args.where.id, ...args.data }
        } } } },
    }
    const exports = {}
    vm.runInNewContext(routeCode, { exports, console: { error() {} }, require: (name) => {
        assert.ok(name in dependencies)
        return dependencies[name]
    } })
    return { calls, patch: (body) => exports.PATCH(new Request('http://localhost/api/products/product-1/partner-status', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }), { params: Promise.resolve({ id: 'product-1' }) }) }
}

for (const status of PARTNER_PRODUCT_STATUSES) {
    test(`server saves ${status} without touching stock or prices`, async () => {
        const app = routeFixture()
        const response = await app.patch({ partnerSaleStatus: status, stock: 0, sellPrice: 0 })
        assert.equal(response.status, 200)
        assert.deepEqual(await response.json(), saved(status))
        assert.deepEqual(Object.keys(app.calls[0].data).sort(), ['partnerSaleStatus', 'wholesaleAvailable'])
        assert.equal(app.calls[0].where.id, 'product-1')
    })
}

for (const role of [null, 'PARTNER']) {
    test(`${role || 'unauthenticated'} cannot save visibility`, async () => {
        const app = routeFixture({ role })
        assert.equal((await app.patch({ partnerSaleStatus: 'VISIBLE' })).status, role ? 403 : 401)
        assert.equal(app.calls.length, 0)
    })
}

for (const body of [null, {}, { partnerSaleStatus: 'TYPO' }, { partnerSaleStatus: false }]) {
    test(`invalid status body ${JSON.stringify(body)} is rejected`, async () => {
        const app = routeFixture()
        assert.equal((await app.patch(body)).status, 400)
        assert.equal(app.calls.length, 0)
    })
}

test('successful DB writes stay successful even when cache invalidation fails', async () => {
    const app = routeFixture({ cacheError: true })
    assert.equal((await app.patch({ partnerSaleStatus: 'VISIBLE' })).status, 200)
    assert.equal(app.calls.length, 1)
})

for (const [code, httpStatus] of [['P2025', 404], ['P1001', 503], ['P2024', 503], ['P2002', 500]]) {
    test(`DB ${code} returns HTTP ${httpStatus}`, async () => {
        const app = routeFixture({ dbError: code })
        assert.equal((await app.patch({ partnerSaleStatus: 'VISIBLE' })).status, httpStatus)
    })
}

test('desktop and mobile share a disabled-while-saving control', () => {
    const ui = readFileSync(new URL('../app/admin/products/ProductTable.tsx', import.meta.url), 'utf8')
    assert.equal((ui.match(/<PartnerStatusSelect\b/g) || []).length, 2)
    assert.match(ui, /disabled=\{saving\}/)
    assert.match(ui, /pendingPartnerStatusIds\.current\.has\(id\)/)
    assert.match(ui, /savePartnerProductStatus\(id, status\)/)
})
