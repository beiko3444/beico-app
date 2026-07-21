import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const { createJiti } = require('jiti')
const jiti = createJiti(import.meta.url)
const awb = jiti('../lib/wormAwbExtraction.ts')

test('validates standard AWB check digits', () => {
  assert.equal(awb.isValidAwbByCheckDigit('11206444454'), true)
  assert.equal(awb.isValidAwbByCheckDigit('18012345675'), true)
  assert.equal(awb.isValidAwbByCheckDigit('18012345674'), false)
})

test('extracts grouped and airport-formatted AWB values', () => {
  const candidates = awb.extractAwbCandidatesFromText([
    'AIR WAYBILL',
    '112 PVG 0644 4454',
    'MAWB 180-1234-5675',
  ].join('\n'), 'fixture')

  assert.equal(awb.bestTrustedAwbCandidate(candidates)?.value, '11206444454')
  assert.deepEqual(
    candidates.filter((candidate) => candidate.score >= 500).map((candidate) => candidate.value).sort(),
    ['11206444454', '18012345675'],
  )
})

test('normalizes common OCR letter substitutions', () => {
  const candidates = awb.extractAwbCandidatesFromText('AWB I80-I234-567S', 'ocr', 180)
  assert.equal(awb.bestTrustedAwbCandidate(candidates)?.value, '18012345675')
})

test('does not trust phone-like or invalid check digit values', () => {
  const phoneCandidates = awb.extractAwbCandidatesFromText('CONTACT 010-1234-5675', 'ocr')
  const invalidCandidates = awb.extractAwbCandidatesFromText('AWB 180-1234-5674', 'ocr', 180)

  assert.equal(awb.bestTrustedAwbCandidate(phoneCandidates), null)
  assert.equal(awb.bestTrustedAwbCandidate(invalidCandidates), null)
})

test('keeps the highest score when duplicate candidates are merged', () => {
  const candidates = new Map()
  awb.mergeAwbCandidate(candidates, { value: '11206444454', score: 500, source: 'text' })
  awb.mergeAwbCandidate(candidates, { value: '11206444454', score: 900, source: 'barcode' })

  assert.deepEqual(candidates.get('11206444454'), {
    value: '11206444454',
    score: 900,
    source: 'barcode',
  })
})
