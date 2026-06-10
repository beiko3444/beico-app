import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const { createJiti } = require('jiti')
const jiti = createJiti(import.meta.url)
const customs = jiti('../lib/unipassCustoms.ts')

test('UNIPASS BL year is sent as four digits', () => {
  assert.equal(customs.formatBlYear(2026), '2026')
})

test('UNIPASS current year follows Korea date', () => {
  assert.equal(customs.getKoreaCurrentYear(new Date('2025-12-31T15:05:00.000Z')), 2026)
})

test('UNIPASS query attempts include cargo management number lookup for cargo numbers', () => {
  const attempts = customs.resolveUnipassQueryAttempts('123-4567-8901-2345', 2026, 2)

  assert.deepEqual(attempts.slice(0, 5), [
    { kind: 'cargMtNo', blYy: null, value: '123456789012345', label: 'cargo-management-number' },
    { kind: 'hblNo', blYy: '2026', value: '123456789012345', label: 'normalized' },
    { kind: 'mblNo', blYy: '2026', value: '123456789012345', label: 'normalized' },
    { kind: 'hblNo', blYy: '2025', value: '123456789012345', label: 'normalized' },
    { kind: 'mblNo', blYy: '2025', value: '123456789012345', label: 'normalized' },
  ])
})

test('UNIPASS master air waybill lookup starts with MBL and four digit year', () => {
  const attempts = customs.resolveUnipassQueryAttempts('11206444454', 2026, 3)

  assert.deepEqual(attempts.slice(0, 4), [
    { kind: 'mblNo', blYy: '2026', value: '11206444454', label: 'master-air-waybill' },
    { kind: 'hblNo', blYy: '2026', value: '11206444454', label: 'master-air-waybill' },
    { kind: 'mblNo', blYy: '2025', value: '11206444454', label: 'master-air-waybill' },
    { kind: 'hblNo', blYy: '2025', value: '11206444454', label: 'master-air-waybill' },
  ])

  const params = customs.buildUnipassSearchParams('KEY', '11206444454', attempts[0])
  assert.equal(params.toString(), 'crkyCn=KEY&mblNo=11206444454&blYy=2026')
})

test('UNIPASS query attempts include next BL year after lookback years', () => {
  const attempts = customs.resolveUnipassQueryAttempts('11206305924', 2025, 3)

  assert.deepEqual(attempts.slice(-2), [
    { kind: 'mblNo', blYy: '2026', value: '11206305924', label: 'master-air-waybill' },
    { kind: 'hblNo', blYy: '2026', value: '11206305924', label: 'master-air-waybill' },
  ])
})

test('UNIPASS params omit BL year for cargo management number lookup', () => {
  const params = customs.buildUnipassSearchParams('KEY', '123456789012345', {
    kind: 'cargMtNo',
    blYy: null,
    value: '123456789012345',
    label: 'cargo-management-number',
  })

  assert.equal(params.get('crkyCn'), 'KEY')
  assert.equal(params.get('cargMtNo'), '123456789012345')
  assert.equal(params.has('blYy'), false)
})

test('UNIPASS live lookup finds 11206444454 as a 2026 MBL', { skip: process.env.UNIPASS_LIVE !== '1' }, async () => {
  const attempts = customs.resolveUnipassQueryAttempts('11206444454', 2026, 3)
  const params = customs.buildUnipassSearchParams('r290g216h033p330q080i040q6', '11206444454', attempts[0])
  const response = await fetch(`https://unipass.customs.go.kr:38010/ext/rest/cargCsclPrgsInfoQry/retrieveCargCsclPrgsInfo?${params}`)
  const xml = await response.text()

  assert.equal(response.ok, true)
  assert.match(xml, /<mblNo>11206444454<\/mblNo>/)
})
