import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

import {
    DEFAULT_PRODUCT_TABLE_COLUMNS,
    normalizeProductTableColumns,
} from '../lib/productTableColumns.ts'

test('uses the approved business columns by default', () => {
    assert.deepEqual(DEFAULT_PRODUCT_TABLE_COLUMNS, ['stock', 'safetyStock', 'stockStatus', 'availability', 'cnyCost', 'cost', 'wholesale', 'retail'])
})

test('normalizes saved columns and removes duplicates or unknown values', () => {
    assert.deepEqual(
        normalizeProductTableColumns(['retail', 'unknown', 'stock', 'retail', 'productCode']),
        ['stock', 'retail', 'productCode'],
    )
    assert.deepEqual(normalizeProductTableColumns(null), DEFAULT_PRODUCT_TABLE_COLUMNS)
})

test('connects permanent product numbers and the configurable table UI', () => {
    const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8')
    const page = readFileSync(new URL('../app/admin/products/page.tsx', import.meta.url), 'utf8')
    const table = readFileSync(new URL('../app/admin/products/ProductTable.tsx', import.meta.url), 'utf8')

    assert.match(schema, /productNumber\s+Int\s+@unique\s+@default\(autoincrement\(\)\)/)
    assert.match(page, /productNumber: true/)
    assert.match(table, /표시 열 설정/)
    assert.match(table, /상품번호/)
    assert.match(table, /그룹순서/)
    assert.match(table, /PRODUCT_TABLE_COLUMNS_STORAGE_KEY/)
})

test('keeps the product table and optional summary in one compact workspace', () => {
    const table = readFileSync(new URL('../app/admin/products/ProductTable.tsx', import.meta.url), 'utf8')

    assert.match(table, /maxWidth: productTableWidth \+ \(selectedGroup \? 310 : 0\)/)
    assert.match(table, /selectedGroupKey \? productGroups\.find/)
    assert.match(table, /onClose=\{\(\) => setSelectedGroupKey\(null\)\}/)
    assert.doesNotMatch(table, /productGroups\[0\] \|\| null/)
    assert.match(table, /data-testid="product-table-scroll"/)
    assert.match(table, /max-h-\[calc\(100vh-190px\)\]/)
    assert.match(table, /sticky top-0 z-30/)
    assert.match(table, /CN¥ 1/)
    assert.match(table, /US\$ 1/)
    assert.match(table, /onForeignCostChange/)
})

test('switches narrow screens to touch-friendly product cards', () => {
    const table = readFileSync(new URL('../app/admin/products/ProductTable.tsx', import.meta.url), 'utf8')
    const form = readFileSync(new URL('../app/admin/products/product-form.tsx', import.meta.url), 'utf8')

    assert.match(table, /matchMedia\('\(max-width: 1023px\)'\)/)
    assert.match(table, /data-testid="product-mobile-cards"/)
    assert.match(table, /C\uB4F1\uAE09|\{activeGrade\}\uB4F1\uAE09/)
    assert.match(table, /\uAC00\uACA9·\uBC1C\uC8FC \uC124\uC815/)
    assert.match(table, /onPurchaseCurrencyChange/)
    assert.match(table, /mobile-product-row-/)
    assert.match(table, /fixed inset-x-3 bottom-4/)
    assert.match(table, /data-testid="product-table-scroll"/)
    assert.match(form, /h-\[100dvh\]/)
    assert.match(form, /grid-cols-2.*sm:grid-cols-3.*xl:grid-cols-7/)
    assert.match(form, /sticky bottom-0/)
})
