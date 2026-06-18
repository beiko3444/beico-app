import assert from 'node:assert/strict'
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

console.log('smart inventory links ok')
