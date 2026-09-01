import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

import {
    DEFAULT_PRODUCT_TABLE_COLUMNS,
    normalizeProductTableColumns,
} from '../lib/productTableColumns.ts'

test('uses the approved business columns by default', () => {
    assert.deepEqual(DEFAULT_PRODUCT_TABLE_COLUMNS, ['barcode', 'stock', 'cost', 'retail'])
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
})
