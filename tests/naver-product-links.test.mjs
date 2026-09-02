import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getNaverProductUrl,
  NAVER_PRODUCT_LINKS,
} from '../lib/naverProductLinks.mjs'

test('uses verified direct product pages instead of search result pages', () => {
  assert.equal(
    getNaverProductUrl('BEIKO 퀵베이트V3'),
    'https://smartstore.naver.com/xtr/products/13736901243',
  )
  assert.equal(
    getNaverProductUrl('XTRACKER 키비쯔 갈치웜'),
    'https://smartstore.naver.com/xtr/products/12410708825',
  )
  assert.equal(NAVER_PRODUCT_LINKS.some((url) => url.includes('/search?')), false)
})

test('includes sold-out and stopped Naver products', () => {
  assert.equal(
    getNaverProductUrl('엑스트래커 글로우 쉐드웜 7cm'),
    'https://smartstore.naver.com/xtr/products/7731609666',
  )
  assert.equal(
    getNaverProductUrl('엑스트래커 크로우피쉬 호그웜 8cm 배스 가재 웜 루어'),
    'https://smartstore.naver.com/xtr/products/7775955645',
  )
  assert.equal(
    getNaverProductUrl('엑스트래커 메탈바이브 3g 루어낚시 배스 메탈지그 하드베이트'),
    'https://smartstore.naver.com/xtr/products/5415482340',
  )
})

test('keeps similar Naver product families separated', () => {
  assert.equal(
    getNaverProductUrl('엑스트래커 토부에기 시리즈1'),
    'https://smartstore.naver.com/xtr/products/10436112807',
  )
  assert.equal(
    getNaverProductUrl('엑스트래커 토부에기 시리즈2'),
    'https://smartstore.naver.com/xtr/products/12355299485',
  )
})

test('can match a shortened group from its SKU names and hides unverified links', () => {
  assert.equal(
    getNaverProductUrl('에기 그룹', ['엑스트래커 케이무라 캐스팅에기 무늬오징어 한치 에기']),
    'https://smartstore.naver.com/xtr/products/6736450926',
  )
  assert.equal(getNaverProductUrl('네이버 등록 이력이 없는 그룹'), null)
})
