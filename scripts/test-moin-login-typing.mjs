import assert from 'node:assert/strict'
import test from 'node:test'

const moin = await import('../lib/moinBizplus.ts')

class FakeTypeLocator {
  constructor(options = {}) {
    this.delay = null
    this.fillValue = null
    this.clicked = 0
    this.failTyping = options.failTyping ?? false
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
    if (this.failTyping) throw new Error('synthetic typing failed')
    this.delay = options.delay ?? null
  }
}

class FakeTypePage {
  constructor(locator) {
    this.locatorInstance = locator
    this.evaluateCalls = 0
  }

  locator() {
    return this.locatorInstance
  }

  url() {
    return 'https://www.moinbizplus.com/login'
  }

  async evaluate(script = '') {
    this.evaluateCalls += 1
    if (String(script).includes('direct-input:')) return 'direct-input:input[name="email"]'
    return '[]'
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

test('MOIN login typing falls back to direct DOM input when synthetic typing fails', async () => {
  const typeFirstVisible = moin.__moinBizplusTestHooks?.typeFirstVisible
  assert.ok(typeFirstVisible, 'MOIN typeFirstVisible hook is unavailable')

  const locator = new FakeTypeLocator({ failTyping: true })
  const page = new FakeTypePage(locator)

  await typeFirstVisible(page, ['input[name="email"]'], 'xtracker@naver.com', 'Fill login ID')

  assert.equal(locator.clicked, 1)
  assert.ok(page.evaluateCalls > 0)
})
