import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const source = readFileSync(new URL('../lib/partnerProfileInput.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { parsePartnerProfileInput } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
const valid = { name: ' 담당자 ', contact: '+82 10-1234-5678', email: 'hello@example.com', fax: '', address: '서울시 1층' }

test('normalizes editable contact fields and supports clearing optional values', () => {
    assert.equal(parsePartnerProfileInput(valid).name, '담당자')
    assert.equal(parsePartnerProfileInput({ ...valid, email: '' }).email, '')
})
test('rejects changes to account ownership and trading permissions', () => {
    for (const key of ['userId', 'role', 'status', 'grade', 'country', 'businessRegNumber', 'partnerProfile']) {
        assert.throws(() => parsePartnerProfileInput({ ...valid, [key]: 'modified' }))
    }
})
test('rejects malformed, missing and oversized fields', () => {
    for (const input of [null, [], {}, { ...valid, name: ' ' }, { ...valid, email: 'not-email' }, { ...valid, address: 'a'.repeat(501) }, { ...valid, contact: 123 }]) {
        assert.throws(() => parsePartnerProfileInput(input))
    }
})
