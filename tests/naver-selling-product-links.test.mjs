import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getNaverSellingProductUrl,
  NAVER_SELLING_PRODUCT_LINKS,
} from '../lib/naverSellingProductLinks.mjs'

test('uses verified direct product pages instead of search result pages', () => {
  assert.equal(
    getNaverSellingProductUrl('BEIKO 퀵베이트V3'),
    'https://smartstore.naver.com/xtr/products/13736901243',
  )
  assert.equal(
    getNaverSellingProductUrl('XTRACKER 키비쯔 갈치웜'),
    'https://smartstore.naver.com/xtr/products/12410708825',
  )
  assert.equal(NAVER_SELLING_PRODUCT_LINKS.some((url) => url.includes('/search?')), false)
})

test('keeps similar Naver product families separated', () => {
  assert.equal(
    getNaverSellingProductUrl('엑스트래커 토부에기 시리즈1'),
    'https://smartstore.naver.com/xtr/products/10436112807',
  )
  assert.equal(
    getNaverSellingProductUrl('엑스트래커 토부에기 시리즈2'),
    'https://smartstore.naver.com/xtr/products/12355299485',
  )
})

test('can match a shortened group from its SKU names and hides unverified links', () => {
  assert.equal(
    getNaverSellingProductUrl('에기 그룹', ['엑스트래커 케이무라 캐스팅에기 무늬오징어 한치 에기']),
    'https://smartstore.naver.com/xtr/products/6736450926',
  )
  assert.equal(getNaverSellingProductUrl('판매 상품이 확인되지 않은 그룹'), null)
})
