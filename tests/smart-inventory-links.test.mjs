import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { externalProductHref } from '../lib/smartInventoryLinks.mjs'

assert.equal(
  externalProductHref('/beiko/products/1234567890', 'naver'),
  'https://smartstore.naver.com/beiko/products/1234567890',
)

assert.equal(
  externalProductHref('/vp/products/1234567890?itemId=987654321', 'coupang'),
  'https://www.coupang.com/vp/products/1234567890?itemId=987654321',
)

assert.equal(
  externalProductHref('smartstore.naver.com/beiko/products/1234567890', 'naver'),
  'https://smartstore.naver.com/beiko/products/1234567890',
)

assert.equal(
  externalProductHref('//smartstore.naver.com/beiko/products/1234567890', 'naver'),
  'https://smartstore.naver.com/beiko/products/1234567890',
)

assert.equal(externalProductHref('', 'naver'), null)
assert.equal(externalProductHref(null, 'naver'), null)

const smartInventoryClientSource = readFileSync(new URL('../lib/smartInventoryClient.ts', import.meta.url), 'utf8')

assert.match(
  smartInventoryClientSource,
  /export async function resolveMonitorCandidates/,
  'smart inventory should expose ordered monitor candidates',
)

assert.match(
  smartInventoryClientSource,
  /addMonitorCandidate\(candidates,\s*envUrl,\s*'env'\)/,
  'SMARTINVENTORY_MONITOR_URL should be tried before the Gist tunnel',
)

assert.match(
  smartInventoryClientSource,
  /isHardMonitorFailure\(payload\)/,
  'dead monitor candidates should be skipped before returning an empty dashboard',
)

assert.match(
  smartInventoryClientSource,
  /const DEFAULT_MONITOR_TIMEOUT_MS = 55000/,
  'the monitor timeout should leave enough time for a queued Raspberry Pi inventory response',
)

assert.match(
  smartInventoryClientSource,
  /if \(isHardMonitorFailure\(payload\)\)[\s\S]*라즈베리 응답이 지연되어 마지막 정상 재고를 유지합니다/,
  'a transient full monitor failure should not replace the last healthy dashboard cache',
)

console.log('smart inventory links ok')
