import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { readInvoiceNotes, validateInvoiceNotes } from '../lib/electricityInvoiceNotes.ts'

const notes = { remarks: '입금 후 연락 바랍니다.', notices: [{ title: '발행 요청', content: '9월분 세금계산서\n발행 부탁드립니다.' }] }

test('legacy bills load empty notes; saved multiline notices round-trip', () => {
    for (const value of [null, undefined, '', 'broken json']) {
        assert.deepEqual(readInvoiceNotes(value), { remarks: '', notices: [] })
    }
    assert.deepEqual(readInvoiceNotes(JSON.stringify(notes)), notes)
})

test('all notices and remarks can be removed', () => {
    assert.deepEqual(validateInvoiceNotes({ remarks: '', notices: [] }), { remarks: '', notices: [] })
})

test('invalid and excessive notices cannot be silently saved', () => {
    for (const value of [null, {}, { remarks: '', notices: [{ title: '', content: ' ' }] },
        { remarks: '', notices: Array(21).fill(notes.notices[0]) },
        { remarks: '', notices: [{ title: 'x', content: 'x'.repeat(2001) }] },
        { remarks: 'x'.repeat(5001), notices: [] }]) {
        assert.throws(() => validateInvoiceNotes(value))
    }
})

const routeCode = ts.transpileModule(readFileSync(new URL('../app/api/admin/electricity/invoice/route.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

function fixture({ authorized = true, missing = false } = {}) {
    const calls = []
    const deps = {
        'next/server': { NextResponse: Response },
        '@/lib/requireAdmin': { requireAdminSession: async () => ({ unauthorized: authorized ? null : Response.json({}, { status: 401 }) }) },
        '@/lib/electricityInvoiceNotes': { validateInvoiceNotes },
        '@/lib/prisma': { prisma: { electricityUsage: { update: async args => {
            calls.push(args)
            if (missing) throw Object.assign(new Error('Missing'), { code: 'P2025' })
            return args.data
        } } } },
    }
    const exports = {}
    vm.runInNewContext(routeCode, { exports, console, require: name => deps[name] })
    return { calls, patch: body => exports.PATCH(new Request('http://localhost/api/admin/electricity/invoice', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })) }
}

test('save updates only selected month notes and leaves billing amounts and readings intact', async () => {
    const app = fixture()
    const response = await app.patch({ year: 2026, month: 9, notes, totalAmount: 0, landlordMeterCurr: 0 })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { notes })
    assert.equal(JSON.stringify(app.calls[0].where), JSON.stringify({ year_month: { year: 2026, month: 9 } }))
    assert.deepEqual(Object.keys(app.calls[0].data), ['invoiceNotes'])
    assert.deepEqual(readInvoiceNotes(app.calls[0].data.invoiceNotes), notes)
})

test('save deletion persists an empty collection', async () => {
    const response = await fixture().patch({ year: 2026, month: 10, notes: { remarks: '', notices: [] } })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { notes: { remarks: '', notices: [] } })
})

test('unauthorized requests never reach the database', async () => {
    const app = fixture({ authorized: false })
    assert.equal((await app.patch({ year: 2026, month: 9, notes })).status, 401)
    assert.equal(app.calls.length, 0)
})

test('invalid months and blank items are rejected before any write', async () => {
    const app = fixture()
    for (const body of [null, { year: 2026, month: 13, notes }, { year: 2026, month: 9, notes: { remarks: '', notices: [{ title: '', content: '' }] } }]) {
        assert.equal((await app.patch(body)).status, 400)
    }
    assert.equal(app.calls.length, 0)
})

test('missing bill returns a useful error and does not create an empty billing record', async () => {
    assert.equal((await fixture({ missing: true }).patch({ year: 2026, month: 9, notes })).status, 404)
})
