import assert from 'node:assert/strict'
import test from 'node:test'

import {
    classifyProductCatalogCategory,
    getGroupedSkuLabel,
} from '../lib/productCatalogDisplay.ts'

test('classifies reviewed product families with explicit priority', () => {
    assert.equal(classifyProductCatalogCategory({ name: 'BEIKO 퀵베이트V3 청갯지렁이' }), 'quick')
    assert.equal(classifyProductCatalogCategory({ name: '엑스트래커 가드훅 10pcs' }), 'accessory')
    assert.equal(classifyProductCatalogCategory({ name: '로얄쉬림프 새우지그웜 메탈지그' }), 'hard')
    assert.equal(classifyProductCatalogCategory({ name: '트위치 플로팅 미노우' }), 'hard')
    assert.equal(classifyProductCatalogCategory({ name: '크랩베이트 게웜 문어미끼' }), 'soft')
    assert.equal(classifyProductCatalogCategory({ name: '글로우 쉐드웜 7cm' }), 'soft')
    assert.equal(classifyProductCatalogCategory({ name: '분류되지 않은 낚시용품' }), 'accessory')
})

test('classifies known hard and soft product image groups', () => {
    assert.equal(classifyProductCatalogCategory({ name: '엑스트래커 토부에기 시리즈1 : 금새우' }), 'hard')
    assert.equal(classifyProductCatalogCategory({ name: '엑스트래커 아머드 탑워터 크랭크베이트' }), 'hard')
    assert.equal(classifyProductCatalogCategory({ name: '엑스트래커 크로우피쉬 호그웜 8cm' }), 'soft')
    assert.equal(classifyProductCatalogCategory({ name: '엑스트래커 옥토푸스 베이트 소프트베이트' }), 'soft')
})

test('shows only the distinguishing SKU suffix inside a named group', () => {
    assert.equal(getGroupedSkuLabel({
        productName: '엑스트래커 토부에기 시리즈1 : 금새우',
        groupName: '엑스트래커 토부에기 시리즈1',
        productCode: 'XT-TOBU-01',
    }), '금새우')
    assert.equal(getGroupedSkuLabel({
        productName: '엑스트래커 글로우 쉐드웜 7cm : GPS_01 (5개입)',
        groupName: '엑스트래커 글로우 쉐드웜 7cm',
    }), 'GPS_01 (5개입)')
    assert.equal(getGroupedSkuLabel({
        productName: 'BEIKO 퀵베이트V3',
        groupName: 'BEIKO  퀵베이트V3',
        productCode: 'BEIKO-QB-01',
    }), 'BEIKO-QB-01')
})

test('keeps the full name when the product is not prefixed by the group name', () => {
    assert.equal(getGroupedSkuLabel({
        productName: '별도 상품명',
        groupName: '직접 지정 그룹',
        productCode: 'SKU-01',
    }), '별도 상품명')
})
