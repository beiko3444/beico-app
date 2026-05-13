import test from 'node:test'
import assert from 'node:assert/strict'

const moin = await import('../lib/moinBizplus.ts')

test('MOIN purchase remittance action excludes external Notion guide links', () => {
  const isSafeHref = moin.__moinBizplusTestHooks?.isSafeMoinActionHref
  assert.ok(isSafeHref, 'isSafeMoinActionHref hook is unavailable')

  assert.equal(isSafeHref('https://themoin-op.notion.site/366bacb01cb44f1ba47eba382012753e'), false)
  assert.equal(isSafeHref('https://www.moinbizplus.com/transfer/recipient'), true)
  assert.equal(isSafeHref('/transfer/recipient'), true)
  assert.equal(isSafeHref(''), true)
})

test('MOIN USD amount selector prefers the real target amount field', () => {
  const selectors = moin.__moinBizplusTestHooks?.getMoinUsdAmountSelectors?.()
  assert.ok(Array.isArray(selectors), 'getMoinUsdAmountSelectors hook is unavailable')

  assert.equal(selectors[0], 'input[name="target_amount"]')
  assert.ok(selectors.includes('input[name*="usd" i]'))
})

test('MOIN final submit selector prefers the real transfer submit button', () => {
  const selectors = moin.__moinBizplusTestHooks?.getMoinFinalSubmitSelectors?.()
  assert.ok(Array.isArray(selectors), 'getMoinFinalSubmitSelectors hook is unavailable')

  assert.equal(selectors[0], 'button[name="transfer_submit"]:has-text("송금 신청")')
  assert.ok(selectors.includes('button:has-text("송금 신청")'))
})
