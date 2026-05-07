import assert from 'node:assert/strict'
import test from 'node:test'

const moin = await import('../lib/moinBizplus.ts')

class FakeLoginInputLocator {
  constructor() {
    this.visibleChecks = 0
  }

  first() {
    return this
  }

  async waitFor() {
    this.visibleChecks += 1
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
    if (selector === 'input[name="email"]') return this.loginInput
    return new MissingLocator()
  }
}

test('MOIN login page opening checks input after commit before waiting for domcontentloaded', async () => {
  const openLogin = moin.__moinBizplusTestHooks?.openMoinLoginPage
  assert.ok(openLogin, 'MOIN open login hook is unavailable')

  const page = new FakeLoginPage()

  const waitUntil = await openLogin(page, 18000)

  assert.equal(waitUntil, 'commit')
  assert.deepEqual(page.gotoWaits, ['commit'])
  assert.ok(page.loginInput.visibleChecks > 0)
})

test('MOIN login page opening still checks for input after a navigation timeout', async () => {
  const openLogin = moin.__moinBizplusTestHooks?.openMoinLoginPage
  assert.ok(openLogin, 'MOIN open login hook is unavailable')

  const page = new FakeLoginPage({ throwFor: ['commit'] })

  const waitUntil = await openLogin(page, 18000)

  assert.equal(waitUntil, 'commit')
  assert.deepEqual(page.gotoWaits, ['commit'])
  assert.ok(page.loginInput.visibleChecks > 0)
})
