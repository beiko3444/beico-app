import assert from 'node:assert/strict'
import test from 'node:test'

const materialSupplies = await import('../lib/materialSupplies.ts')

test('normalizes material supply input for saving', () => {
  const input = materialSupplies.normalizeMaterialSupplyInput({
    name: '  택배 박스  ',
    category: ' 포장 ',
    supplierName: ' 쿠팡 ',
    purchaseUrl: ' https://example.com/box ',
    unit: ' 100개 ',
    priceKrw: '12,500',
    memo: ' 자주 쓰는 박스 ',
    sortOrder: '3',
    active: true,
  })

  assert.deepEqual(input, {
    name: '택배 박스',
    category: '포장',
    supplierName: '쿠팡',
    purchaseUrl: 'https://example.com/box',
    unit: '100개',
    priceKrw: 12500,
    memo: '자주 쓰는 박스',
    sortOrder: 3,
    active: true,
  })
})

test('requires a name and http purchase link', () => {
  assert.throws(
    () => materialSupplies.normalizeMaterialSupplyInput({ name: '', purchaseUrl: 'https://example.com' }),
    /부자재명을 입력해주세요/,
  )
  assert.throws(
    () => materialSupplies.normalizeMaterialSupplyInput({ name: '박스', purchaseUrl: 'javascript:alert(1)' }),
    /구매 링크는 http 또는 https 주소여야 합니다/,
  )
})

test('filters active material supplies before inactive and sorts by category', () => {
  const sorted = materialSupplies.sortMaterialSupplies([
    { id: '1', name: 'B', category: '소모품', active: false, sortOrder: 0, updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: '2', name: 'A', category: '포장', active: true, sortOrder: 2, updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: '3', name: 'C', category: '라벨', active: true, sortOrder: 1, updatedAt: '2026-01-01T00:00:00.000Z' },
  ])

  assert.deepEqual(sorted.map((item) => item.id), ['3', '2', '1'])
})
