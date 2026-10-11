import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

// Execute the TS helpers and route handlers with a database double.
const cache = new Map()
let saved
const products = [
  { id: 'bulk', name: '국내산 혼무시 100g', sellPrice: 0, onlinePrice: 39000 },
  { id: 'retail', name: 'BEIKO 쿽베이트 혼무시', sellPrice: 10000, priceC: 12000, onlinePrice: 19800, regionalPrices: { C: { KR: { wholesale: '13,000', retail: '21,000' } } } },
  { id: 'blue', name: 'BEIKO 쿽베이트 청갯지렁이', sellPrice: 3500, onlinePrice: 5800 },
  { id: 'red', name: 'BEIKO 쿽베이트 홍갯지렁이', sellPrice: 4500, onlinePrice: 6800 },
]
const prisma = {
  product: { findMany: async () => products },
  productionBatch: {
    findMany: async () => [{ id: 'old-batch', category: '혼무시', salesPrice: 0, wholesalePrice: 39000 }],
    create: async ({ data }) => { saved = data; return data },
    update: async ({ data }) => { saved = data; return data },
  },
}
function load(path) {
  if (cache.has(path)) return cache.get(path)
  const source = readFileSync(new URL(`../${path}.ts`, import.meta.url), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const mod = { exports: {} }
  const require = specifier => {
    if (specifier === 'next/server') return { NextResponse: { json: (data, options) => ({ data, status: options?.status || 200 }) } }
    if (specifier.endsWith('/prisma')) return { prisma }
    if (specifier.startsWith('@/')) return load(specifier.slice(2))
    return load(`lib/${specifier.replace('./', '')}`)
  }
  new Function('require', 'module', 'exports', code)(require, mod, mod.exports)
  cache.set(path, mod.exports)
  return mod.exports
}
const { getProductionProducts, getProductionPrices, selectProductionProduct, attachProductionPrices, productionMargin } = load('lib/productionPricing')
const { resolveProductionProduct } = load('lib/productionProduct')
assert.deepEqual(getProductionProducts(products, '혼무시').map(p => p.id), ['bulk', 'retail'])
assert.deepEqual(getProductionProducts(products, '청갯지렁이').map(p => p.id), ['blue'])
assert.equal((await resolveProductionProduct('혼무시', undefined)).productId, 'retail', 'prefer the exact single product over bulk and set listings')
assert.equal(selectProductionProduct([products[0]], '혼무시'), undefined, 'do not automatically use a bulk listing')
const combo = { id: 'combo', name: '퀵베이트V3 올인원 4종 세트 청갯지렁이 홍지렁이 혼무시 멍게', sellPrice: 0, onlinePrice: 39000 }
assert.equal(selectProductionProduct([combo, { ...products[1], name: 'BEIKO  퀵베이트V3 혼무시' }], '혼무시')?.id, 'retail')
assert.equal(selectProductionProduct([combo], '혼무시'), undefined, 'never automatically match an all-in-one set')
assert.equal(selectProductionProduct([products[1], { ...products[1], id: 'duplicate' }], '혼무시'), undefined, 'duplicate exact products need explicit selection')
assert.equal(selectProductionProduct(products, 'invalid'), undefined)
assert.equal(await resolveProductionProduct('혼무시', 'blue'), null, 'wrong category cannot supply prices')
assert.deepEqual(getProductionPrices(products[1]), { salesPrice: 13000, wholesalePrice: 21000 })
assert.deepEqual(getProductionPrices({ ...products[1], regionalPrices: {} }), { salesPrice: 12000, wholesalePrice: 19800 })
assert.deepEqual(getProductionPrices({ ...products[1], regionalPrices: { C: { KR: { wholesale: '0', retail: '0' } } } }), { salesPrice: 0, wholesalePrice: 0 }, 'stored zero is a real price')
assert.equal(attachProductionPrices({ category: '혼무시', salesPrice: 0, wholesalePrice: 39000 }, products).wholesalePrice, 21000, 'legacy records show current single-product prices')
assert.equal(attachProductionPrices({ category: '혼무시', productId: 'deleted' }, products).wholesalePrice, null, 'a deleted link must not silently switch to another product')
assert.equal(productionMargin(null, 8960), null)
assert.equal(productionMargin(0, 8960), null)
assert.equal(productionMargin(16000, 8000), 50)
assert.equal(productionMargin(8000, 16000), -100)
const list = await load('app/api/production/route').GET(new Request('http://localhost/api/production?category=혼무시'))
assert.equal(list.status, 200)
assert.equal(list.data[0].productId, 'retail')
assert.equal(list.data[0].wholesalePrice, 21000)
assert.equal((await load('app/api/production/products/route').GET()).data.length, products.length)

for (const [path, method] of [['app/api/production/route', 'POST'], ['app/api/production/[id]/route', 'PUT']]) {
  const route = load(path)
  const body = { category: '혼무시', productId: 'retail', productionDate: '2026-09-29', quantity: 114, salesPrice: 1, wholesalePrice: 39000 }
  let response = await route[method]({ json: async () => body }, { params: Promise.resolve({ id: 'batch' }) })
  assert.equal(response.status, 200)
  assert.equal(saved.productId, 'retail')
  assert.equal(saved.salesPrice, 13000, 'read current database price, ignore request price')
  assert.equal(saved.wholesalePrice, 21000)
  products[1].regionalPrices.C.KR.retail = '22,000'
  response = await route[method]({ json: async () => body }, { params: Promise.resolve({ id: 'batch' }) })
  assert.equal(saved.wholesalePrice, 22000, 'changes in product prices must be reflected at save')
  products[1].regionalPrices.C.KR.retail = '21,000'
  response = await route[method]({ json: async () => ({ ...body, productId: 'deleted-product' }) }, { params: Promise.resolve({ id: 'batch' }) })
  assert.equal(response.status, 400)
}
console.log('production pricing tests passed')
