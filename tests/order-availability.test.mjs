import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const readSource = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const productFormSource = readSource('app/admin/products/product-form.tsx')
const productTableSource = readSource('app/admin/products/ProductTable.tsx')
const orderPageSource = readSource('app/order/page.tsx')
const orderInterfaceSource = readSource('app/order/order-interface.tsx')
const orderRouteSource = readSource('app/api/orders/route.ts')
const orderDetailRouteSource = readSource('app/api/orders/[id]/route.ts')
const productSchemaSource = readSource('prisma/schema.prisma')
const productRouteSource = readSource('app/api/products/[id]/route.ts')

assert.match(productFormSource, /파트너 노출 상태/)
assert.match(productFormSource, /partnerSaleStatus/)
assert.match(productFormSource, /SOLD_OUT/)
assert.match(productFormSource, /관리용 재고/)
assert.match(productFormSource, /groupName/)

assert.match(productTableSource, /파트너 상태 전체/)
assert.match(productTableSource, /비노출/)
assert.match(productTableSource, /품절/)
assert.match(productTableSource, /관리용 재고/)
assert.match(productTableSource, /\/api\/products\/bulk\/stock/)
assert.match(productTableSource, /collapsedGroupKeys/)
assert.match(productTableSource, /ProductGroupHeader/)

assert.match(orderPageSource, /partnerSaleStatus: 'SOLD_OUT'/)
assert.match(orderPageSource, /partnerSaleStatus: null, wholesaleAvailable: true/)
assert.doesNotMatch(orderPageSource, /stock: true/)
assert.match(orderInterfaceSource, /品切れ \/ SOLD OUT/)
assert.match(orderInterfaceSource, /isPartnerProductOrderable/)
assert.doesNotMatch(orderInterfaceSource, /product\.stock|available stock/)

assert.match(orderRouteSource, /isPartnerProductOrderable/)
assert.match(orderDetailRouteSource, /isPartnerProductOrderable/)
assert.doesNotMatch(orderRouteSource, /product\.stock|stock: \{ decrement/)
assert.doesNotMatch(orderDetailRouteSource, /stock: \{ (?:increment|decrement)/)
assert.match(productSchemaSource, /partnerSaleStatus\s+String\?/)
assert.match(productRouteSource, /getPartnerProductStatusWrite/)

console.log('order availability tests passed')
