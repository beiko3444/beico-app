import assert from 'node:assert/strict'
import test from 'node:test'

const moin = await import('../lib/moinBizplus.ts')

class FakeLoginInputLocator {
  constructor() {
    this.waitChecks = []
  }

  first() {
    return this
  }

  async waitFor(options = {}) {
    this.waitChecks.push(options)
  }
}

class MissingLocator {
  first() {
    return this
  }

  async waitFor() {
    throw new Error('not visible')
  }
}

class FakeLoginPage {
  constructor(options = {}) {
    this.gotoWaits = []
    this.loginInput = new FakeLoginInputLocator()
    this.throwFor = new Set(options.throwFor || [])
  }

  async goto(_url, options = {}) {
    this.gotoWaits.push(options.waitUntil)
    if (this.throwFor.has(options.waitUntil)) {
      throw new Error(`page.goto: Timeout 18000ms exceeded. waiting until "${options.waitUntil}"`)
    }
  }

  locator(selector) {
    if (selector === 'input[data-testid="input-email"]') return this.loginInput
    return new MissingLocator()
  }
}

test('MOIN login page opening checks attached data-testid input after commit before waiting for domcontentloaded', async () => {
  const openLogin = moin.__moinBizplusTestHooks?.openMoinLoginPage
  assert.ok(openLogin, 'MOIN open login hook is unavailable')

  const page = new FakeLoginPage()

  const waitUntil = await openLogin(page, 18000)

  assert.equal(waitUntil, 'commit')
  assert.deepEqual(page.gotoWaits, ['commit'])
  assert.deepEqual(page.loginInput.waitChecks.map((options) => options.state), ['attached'])
})

test('MOIN login page opening still checks data-testid input after a navigation timeout', async () => {
  const openLogin = moin.__moinBizplusTestHooks?.openMoinLoginPage
  assert.ok(openLogin, 'MOIN open login hook is unavailable')

  const page = new FakeLoginPage({ throwFor: ['commit'] })

  const waitUntil = await openLogin(page, 18000)

  assert.equal(waitUntil, 'commit')
  assert.deepEqual(page.gotoWaits, ['commit'])
  assert.deepEqual(page.loginInput.waitChecks.map((options) => options.state), ['attached'])
})
