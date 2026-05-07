import assert from 'node:assert/strict'
import test from 'node:test'

const customs = await import('../lib/unipassCustoms.ts')

test('UNIPASS BL year is sent as four digits', () => {
  assert.equal(customs.formatBlYear(2026), '2026')
})

test('UNIPASS query attempts include cargo management number lookup for cargo numbers', () => {
  const attempts = customs.resolveUnipassQueryAttempts('123-4567-8901-2345', 2026, 2)

  assert.deepEqual(attempts.slice(0, 5), [
    { kind: 'cargMtNo', blYy: null },
    { kind: 'mblNo', blYy: '2026' },
    { kind: 'hblNo', blYy: '2026' },
    { kind: 'mblNo', blYy: '2025' },
    { kind: 'hblNo', blYy: '2025' },
  ])
})

test('UNIPASS params omit BL year for cargo management number lookup', () => {
  const params = customs.buildUnipassSearchParams('KEY', '123456789012345', { kind: 'cargMtNo', blYy: null })

  assert.equal(params.get('crkyCn'), 'KEY')
  assert.equal(params.get('cargMtNo'), '123456789012345')
  assert.equal(params.has('blYy'), false)
})
