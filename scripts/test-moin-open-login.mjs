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
  constructor() {
    this.gotoWaits = []
    this.loginInput = new FakeLoginInputLocator()
  }

  async goto(_url, options = {}) {
    this.gotoWaits.push(options.waitUntil)
    if (options.waitUntil === 'domcontentloaded') {
      throw new Error('page.goto: Timeout 18000ms exceeded. waiting until "domcontentloaded"')
    }
  }

  locator(selector) {
    if (selector === 'input[name="email"]') return this.loginInput
    return new MissingLocator()
  }
}

test('MOIN login page opening falls back when domcontentloaded waits on slow third-party scripts', async () => {
  const openLogin = moin.__moinBizplusTestHooks?.openMoinLoginPage
  assert.ok(openLogin, 'MOIN open login hook is unavailable')

  const page = new FakeLoginPage()

  const waitUntil = await openLogin(page, 18000)

  assert.equal(waitUntil, 'commit')
  assert.deepEqual(page.gotoWaits, ['domcontentloaded', 'commit'])
  assert.ok(page.loginInput.visibleChecks > 0)
})
