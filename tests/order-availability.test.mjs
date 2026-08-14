import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const readSource = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const productFormSource = readSource('app/admin/products/product-form.tsx')
const productTableSource = readSource('app/admin/products/ProductTable.tsx')
const orderPageSource = readSource('app/order/page.tsx')
const orderInterfaceSource = readSource('app/order/order-interface.tsx')
const orderRouteSource = readSource('app/api/orders/route.ts')
const orderDetailRouteSource = readSource('app/api/orders/[id]/route.ts')

assert.match(productFormSource, /발주 상태/)
assert.match(productFormSource, /wholesaleAvailable: orderAvailable/)
assert.doesNotMatch(productFormSource, /현재고 수량|안전재고 설정/)

assert.match(productTableSource, /발주 가능/)
assert.match(productTableSource, /발주 불가능/)
assert.doesNotMatch(productTableSource, /bulk\/stock|modifiedStock/)

assert.match(orderPageSource, /where: \{ wholesaleAvailable: true \}/)
assert.doesNotMatch(orderPageSource, /stock: true/)
assert.doesNotMatch(orderInterfaceSource, /product\.stock|品切れ|available stock/)

assert.match(orderRouteSource, /if \(!product\.wholesaleAvailable\)/)
assert.doesNotMatch(orderRouteSource, /product\.stock|stock: \{ decrement/)
assert.doesNotMatch(orderDetailRouteSource, /stock: \{ (?:increment|decrement)/)

console.log('order availability tests passed')
