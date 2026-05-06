import assert from 'node:assert/strict'
import test from 'node:test'

const moin = await import('../lib/moinBizplus.ts')

class FakeTypeLocator {
  constructor() {
    this.delay = null
    this.fillValue = null
    this.clicked = 0
  }

  first() {
    return this
  }

  async waitFor() {}

  async click() {
    this.clicked += 1
  }

  async fill(value) {
    this.fillValue = value
  }

  async pressSequentially(_value, options = {}) {
    this.delay = options.delay ?? null
  }
}

class FakeTypePage {
  constructor(locator) {
    this.locatorInstance = locator
  }

  locator() {
    return this.locatorInstance
  }

  url() {
    return 'https://www.moinbizplus.com/login'
  }
}

test('MOIN login typing uses a positive per-character delay', async () => {
  const typeFirstVisible = moin.__moinBizplusTestHooks?.typeFirstVisible
  assert.ok(typeFirstVisible, 'MOIN typeFirstVisible hook is unavailable')

  const locator = new FakeTypeLocator()
  const page = new FakeTypePage(locator)

  await typeFirstVisible(page, ['input[name="email"]'], 'xtracker@naver.com', 'Fill login ID')

  assert.equal(locator.clicked, 1)
  assert.equal(locator.fillValue, '')
  assert.equal(typeof locator.delay, 'number')
  assert.ok(locator.delay > 0, `expected typing delay > 0, received ${locator.delay}`)
})
