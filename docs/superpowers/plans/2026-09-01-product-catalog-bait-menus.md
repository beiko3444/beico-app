# Product Catalog Bait Menus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace product pagination with four bait-category menus and show only the distinguishing SKU suffix inside named groups.

**Architecture:** Put category classification and grouped-SKU label extraction in a small pure helper module. Load all products once on the server, then let `ProductTable` render and filter only the active category while preserving existing editing and grouping behavior.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma, Tailwind CSS, Node test runner.

---

### Task 1: Add Tested Catalog Display Rules

**Files:**
- Create: `lib/productCatalogDisplay.ts`
- Create: `tests/product-catalog-display.test.ts`

- [ ] **Step 1: Write failing classification and SKU-label tests**

Create tests that assert Quick Bait takes priority over worm wording, accessories are separated, metal/jig/hard-body wording takes priority over worm wording, soft worms are recognized, and grouped names collapse to their meaningful suffix.

```ts
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
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run:

```bash
node --experimental-strip-types --test tests/product-catalog-display.test.ts
```

Expected: FAIL because `lib/productCatalogDisplay.ts` does not exist.

- [ ] **Step 3: Implement the minimal pure helper**

Create category constants and labels, normalize Korean/English text, apply priority `quick -> accessory -> hard -> soft -> accessory`, and strip the normalized group prefix plus separators for grouped SKU labels.

- [ ] **Step 4: Run the focused tests**

Run the same Node test command.

Expected: all product catalog display tests PASS.

- [ ] **Step 5: Commit the helper and tests**

```bash
git add lib/productCatalogDisplay.ts tests/product-catalog-display.test.ts
git commit -m "test: define product catalog display rules"
```

### Task 2: Load The Full Catalog Without Pagination

**Files:**
- Modify: `app/admin/products/page.tsx`

- [ ] **Step 1: Remove page parsing and paginated query arguments**

Delete `searchParams`, page-size parsing, `count`, `skip`, and `take`. Keep one `findMany` ordered by `sortOrder` and `createdAt`.

- [ ] **Step 2: Pass only the full product array to the table**

Replace the pagination prop object with:

```tsx
<ProductTable initialProducts={products} />
```

- [ ] **Step 3: Run TypeScript to expose remaining pagination references**

Run:

```bash
node node_modules/typescript/bin/tsc --noEmit
```

Expected: product table errors identify the pagination prop and handlers that Task 3 must remove; unrelated pre-existing project errors are recorded separately.

- [ ] **Step 4: Commit the server loading change with Task 3 after the component compiles**

Do not commit an intentionally broken intermediate state.

### Task 3: Add Category Menus And Compact Grouped SKU Labels

**Files:**
- Modify: `app/admin/products/ProductTable.tsx`

- [ ] **Step 1: Remove pagination UI and navigation state**

Delete `ProductPagination`, `ProductPaginationControls`, page range calculations, URL page mutations, left/right page keyboard navigation, and both pagination control render sites. Keep `useRouter` for existing refresh behavior.

- [ ] **Step 2: Add active category state and counts**

Import the pure catalog helper. Add `activeCategory` with default `soft`, compute category counts from all products, then restrict search/availability/stock filtering to the selected category.

```ts
const [activeCategory, setActiveCategory] = useState<ProductCatalogCategory>('soft')
const categoryCounts = useMemo(() => {
  const counts = Object.fromEntries(PRODUCT_CATALOG_CATEGORIES.map(category => [category, 0]))
  products.forEach(product => {
    counts[classifyProductCatalogCategory(product)] += 1
  })
  return counts
}, [products])
```

- [ ] **Step 3: Render the four menu controls**

Render `소프트베이트`, `하드베이트`, `퀵베이트`, and `기타용품` as a segmented tab row with a count on each tab. On change, clear checked rows, collapsed groups, selected summary, and dragging state while leaving search and other filters intact.

- [ ] **Step 4: Pass a compact label only for named grouped rows**

Add an optional `displayName` prop to `ProductRow`. In group mode, call `getGroupedSkuLabel()` with the current group name; in SKU mode, omit the prop so the full product name is shown. Use the compact label as primary text and keep `title={product.name}`.

- [ ] **Step 5: Compact the summary preview consistently**

In `ProductSummaryPanel`, use the same helper for named groups so the sidebar does not repeat the common product name.

- [ ] **Step 6: Update catalog copy**

Replace page-oriented copy with menu-oriented copy and show the active menu count plus filtered count.

- [ ] **Step 7: Run the helper tests and focused lint/type checks**

```bash
node --experimental-strip-types --test tests/product-catalog-display.test.ts
node node_modules/eslint/bin/eslint.js app/admin/products/page.tsx app/admin/products/ProductTable.tsx lib/productCatalogDisplay.ts tests/product-catalog-display.test.ts
node node_modules/typescript/bin/tsc --noEmit
```

Expected: helper tests pass, changed files have no lint errors, and no new TypeScript errors are introduced.

- [ ] **Step 8: Commit the UI implementation**

```bash
git add app/admin/products/page.tsx app/admin/products/ProductTable.tsx
git commit -m "feat: organize products by bait category"
```

### Task 4: Browser Verification

**Files:**
- No production files expected unless verification finds a defect.

- [ ] **Step 1: Build the production bundle**

Run the project build with the configured production environment. Expected: build exits successfully.

- [ ] **Step 2: Open `/admin/products` in the signed-in browser**

Verify there are four fixed menus and no page-size selector, page counter, previous button, or next button.

- [ ] **Step 3: Check classification samples**

Verify Quick Bait products appear in `퀵베이트`, worms/crab soft plastics in `소프트베이트`, egi/minnow/metal/hard-body products in `하드베이트`, and hooks/snaps/tools in `기타용품`.

- [ ] **Step 4: Check grouped and SKU views**

Verify grouped rows show suffixes such as `금새우`, `XTDM_01 메탈릭`, and `GPS_01 (5개입)`, while SKU view shows the full names.

- [ ] **Step 5: Check responsive layout**

Verify desktop and mobile-width screenshots contain no overlapping menu labels, controls, or table headers.

- [ ] **Step 6: Push the completed main branch**

```bash
git push origin main
```

