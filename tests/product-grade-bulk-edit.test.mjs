import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  isProductGrade,
  readProductGradeOrderValue,
  readProductGradePriceValue,
  setProductGradeOrderValue,
  setProductGradePriceValue,
} from '../lib/productGradePricing.ts'

const original = {
  A: {
    KR: { wholesale: '3,500', moq: '10', orderUnit: '5' },
  },
  C: {
    KR: { wholesale: '4,500', moq: '2', orderUnit: '2' },
  },
}

const updatedA = setProductGradeOrderValue(original, 'A', 'moq', 30)
assert.equal(readProductGradeOrderValue(updatedA, 'A', 'moq', 1), 30)
assert.equal(readProductGradeOrderValue(updatedA, 'A', 'orderUnit', 1), 5)
assert.equal(readProductGradeOrderValue(updatedA, 'C', 'moq', 1), 2)
assert.equal(updatedA.A.KR.wholesale, '3,500')
assert.equal(original.A.KR.moq, '10')

const repricedB = setProductGradePriceValue(original, 'B', 'wholesale', 3200)
assert.equal(readProductGradePriceValue(repricedB, 'B', 'wholesale', 0), 3200)
assert.equal(readProductGradePriceValue(repricedB, 'C', 'wholesale', 0), 4500)
assert.equal(readProductGradePriceValue({}, 'D', 'retail', 7000), 7000)

const createdD = setProductGradeOrderValue(original, 'D', 'orderUnit', 12)
assert.equal(readProductGradeOrderValue(createdD, 'D', 'orderUnit', 1), 12)
assert.equal(readProductGradeOrderValue(createdD, 'D', 'moq', 7), 7)
assert.equal(readProductGradeOrderValue({}, 'B', 'moq', 9), 9)

assert.equal(isProductGrade('A'), true)
assert.equal(isProductGrade('D'), true)
assert.equal(isProductGrade('C 등급'), false)

const readSource = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const productTable = readSource('app/admin/products/ProductTable.tsx')
const productForm = readSource('app/admin/products/product-form.tsx')
const productsPage = readSource('app/admin/products/page.tsx')
const prismaSchema = readSource('prisma/schema.prisma')
const moqRoute = readSource('app/api/products/bulk/moq/route.ts')
const orderUnitRoute = readSource('app/api/products/bulk/order-unit/route.ts')
const gradePricingRoute = readSource('app/api/products/bulk/grade-pricing/route.ts')
const reorderRoute = readSource('app/api/products/reorder/route.ts')

assert.match(productTable, /const activeGrade: ProductGrade = 'C'/)
assert.match(productTable, /PRODUCT_TABLE_COLUMN_OPTIONS\.map/)
assert.match(productTable, /\/api\/products\/bulk\/grade-pricing/)
assert.match(productTable, /formatNumberInput/)
assert.match(productTable, /parseNumericDraft/)
assert.match(productTable, /inputMode="numeric"/)
assert.match(productTable, /inputMode="decimal"/)
assert.match(productTable, /Math\.round\(parseNumericDraft\(val\) \* rate\)/)
assert.match(productTable, /cnyBuyPrice/)
assert.match(productTable, /purchaseCurrency === 'USD'/)
assert.match(productTable, /그룹 해제 · 단일 SKU/)
assert.match(productTable, /onContextMenu/)
assert.match(productTable, /product\.barcode \|\| '-'/)
assert.match(productTable, /memo\(function ProductRow/)
assert.doesNotMatch(productTable, /@dnd-kit/)
assert.doesNotMatch(productTable, /useSortable/)
assert.match(productTable, /hidden=\{group\.isNamed && !expanded\}/)
assert.doesNotMatch(productTable, /collapsed\?: boolean/)
assert.doesNotMatch(productTable, /\{expanded \? group\.products\.map/)
assert.match(productTable, /PRODUCT_CATALOG_CATEGORIES\.map/)
assert.match(productTable, /classifyProductCatalogCategory/)
assert.match(productTable, /getGroupedSkuLabel/)
const categoryChangeHandler = productTable.match(/const handleCategoryChange = useCallback\([\s\S]*?\}, \[\]\)/)?.[0] || ''
assert.doesNotMatch(categoryChangeHandler, /setCheckedIds/)
assert.match(productTable, /visibleGroupName && !displayName/)
assert.match(productTable, /orderSaveQueueRef/)
assert.match(productTable, /newItems\.slice\(changedRangeStart, changedRangeEnd \+ 1\)/)
assert.doesNotMatch(productTable, /saveOrder\(newItems\.map/)
assert.doesNotMatch(productTable, /ProductPaginationControls/)
assert.doesNotMatch(productTable, /ArrowLeft/)
assert.doesNotMatch(productTable, /pageSize/)
assert.match(productTable, /전체 접기/)
assert.match(productTable, /전체 펼치기/)
assert.match(productTable, /ProductSummaryPanel/)
assert.match(productTable, /setViewMode/)
assert.match(productTable, /availabilityFilter/)
assert.match(productTable, /autoGroupingDisabled/)
assert.match(productTable, /onDragStartProduct/)
assert.match(productTable, /onDropProduct/)
assert.match(productTable, /그룹 해제/)
assert.match(productTable, /자동 그룹 복귀/)
assert.match(productForm, /preserveUngroupedState/)
assert.match(prismaSchema, /autoGroupingDisabled Boolean\s+@default\(false\)/)
assert.match(prismaSchema, /cnyBuyPrice\s+Float\?\s+@default\(0\)/)
assert.match(prismaSchema, /usdPurchasePrice\s+Float\?\s+@default\(0\)/)
assert.match(prismaSchema, /purchaseCurrency\s+String\s+@default\("CNY"\)/)
assert.doesNotMatch(productsPage, /take:/)
assert.doesNotMatch(productsPage, /skip:/)
assert.match(productsPage, /<ProductTable initialProducts=\{products\} \/>/)
assert.doesNotMatch(productsPage, /unstable_cache/)
assert.match(reorderRoute, /startOrder = 0/)
assert.match(reorderRoute, /offset \+ index/)
assert.match(productForm, /cachedExchangeRates/)
assert.match(productForm, /if \(!isOpen\) return/)
assert.match(moqRoute, /grade === 'C'/)
assert.match(orderUnitRoute, /grade === 'C'/)
assert.match(gradePricingRoute, /buildLegacyPriceUpdates/)
assert.match(gradePricingRoute, /setProductGradePriceValue/)
assert.match(gradePricingRoute, /setProductGradeOrderValue/)
assert.match(gradePricingRoute, /data\.cnyBuyPrice = update\.cnyCost/)
assert.match(gradePricingRoute, /data\.usdPurchasePrice = update\.usdCost/)
assert.match(gradePricingRoute, /data\.purchaseCurrency = update\.purchaseCurrency/)
assert.doesNotMatch(moqRoute, /\['A', 'B', 'C', 'D'\]\.forEach/)
assert.doesNotMatch(orderUnitRoute, /\['A', 'B', 'C', 'D'\]\.forEach/)

console.log('product grade bulk edit tests passed')
