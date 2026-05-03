import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../lib/moinBizplus.ts', import.meta.url), 'utf8')

const recipientListMarker = '// Wait for the recipient list to load'
const companyFindMarker = 'let companyTextEl = await findVisibleCompanyTextLocator(page, 8000)'
const searchPrefillMarker = 'fillRecipientSearchKeyword(page, TARGET_COMPANY_SEARCH_KEYWORD)'
const searchResultMarker = 'recipient-search-result-click'
const rowSelectMarker = 'recipient-row-select-click'
const nextStepFallbackMarker = 'recipient-next-step-after-company'

const recipientListIndex = source.indexOf(recipientListMarker)
const companyFindIndex = source.indexOf(companyFindMarker)
const searchPrefillIndex = source.indexOf(searchPrefillMarker)
const searchResultIndex = source.indexOf(searchResultMarker)
const rowSelectIndex = source.indexOf(rowSelectMarker)
const nextStepFallbackIndex = source.indexOf(nextStepFallbackMarker)

assert.notEqual(recipientListIndex, -1, 'recipient list marker should exist')
assert.notEqual(companyFindIndex, -1, 'initial company lookup should exist')
assert.notEqual(searchPrefillIndex, -1, 'recipient search prefill should exist')
assert.notEqual(searchResultIndex, -1, 'first search result fallback should exist')
assert.notEqual(rowSelectIndex, -1, 'recipient row selection fallback should exist')
assert.notEqual(nextStepFallbackIndex, -1, 'new recipient flow next-step fallback should exist')

assert.ok(
  recipientListIndex < searchPrefillIndex && searchPrefillIndex < companyFindIndex,
  'recipient search should be prefilled before scanning the company list',
)

assert.ok(
  companyFindIndex < searchResultIndex && searchResultIndex < rowSelectIndex && rowSelectIndex < nextStepFallbackIndex,
  'search-result and row selection fallbacks should run before next-step fallback',
)

console.log('moin-recipient-flow-ok')
