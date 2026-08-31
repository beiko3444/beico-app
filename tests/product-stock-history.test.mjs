import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const readSource = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const schemaSource = readSource('prisma/schema.prisma')
const stockHistoryHelperSource = readSource('lib/product-stock-history.ts')
const productRouteSource = readSource('app/api/products/[id]/route.ts')
const productCreateRouteSource = readSource('app/api/products/route.ts')
const bulkStockRouteSource = readSource('app/api/products/bulk/stock/route.ts')
const stockHistoryRouteSource = readSource('app/api/products/[id]/stock-history/route.ts')
const stockHistoryModalSource = readSource('app/admin/products/ProductStockHistoryModal.tsx')
const productTableSource = readSource('app/admin/products/ProductTable.tsx')

assert.match(schemaSource, /model ProductStockHistory/)
assert.match(schemaSource, /previousStock Int/)
assert.match(schemaSource, /newStock\s+Int/)
assert.match(schemaSource, /delta\s+Int/)
assert.match(schemaSource, /@@index\(\[productId, createdAt\]\)/)

assert.match(stockHistoryHelperSource, /if \(previousStock === newStock\) return null/)
assert.match(stockHistoryHelperSource, /delta: newStock - previousStock/)
assert.match(stockHistoryHelperSource, /changedById/)

assert.match(productRouteSource, /PRODUCT_STOCK_SOURCES\.EDIT/)
assert.match(productRouteSource, /PRODUCT_STOCK_SOURCES\.PATCH/)
assert.match(productCreateRouteSource, /PRODUCT_STOCK_SOURCES\.CREATE/)
assert.match(bulkStockRouteSource, /PRODUCT_STOCK_SOURCES\.BULK/)
assert.match(bulkStockRouteSource, /prisma\.\$transaction/)

assert.match(stockHistoryRouteSource, /productStockHistory\.findMany/)
assert.match(stockHistoryRouteSource, /orderBy: \{ createdAt: 'desc' \}/)
assert.match(stockHistoryModalSource, /관리용 재고 변경 이력/)
assert.match(stockHistoryModalSource, /previousStock/)
assert.match(stockHistoryModalSource, /newStock/)
assert.match(stockHistoryModalSource, /delta/)
assert.match(productTableSource, /ProductStockHistoryModal/)
assert.match(productTableSource, /inferProductGroup/)
assert.match(productTableSource, /자동 그룹/)

console.log('product stock history tests passed')
