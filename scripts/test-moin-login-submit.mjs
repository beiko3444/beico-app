import assert from 'node:assert/strict'
import test from 'node:test'

const moin = await import('../lib/moinBizplus.ts')

class FakeLocator {
  constructor(name, options = {}) {
    this.name = name
    this.visible = options.visible ?? true
    this.disabled = options.disabled ?? false
    this.clicked = 0
  }

  first() {
    return this
  }

  async waitFor() {
    if (!this.visible) throw new Error(`${this.name} is not visible`)
  }

  async isDisabled() {
    return this.disabled
  }

  async isEnabled() {
    return !this.disabled
  }

  async click() {
    if (this.disabled) throw new Error(`${this.name} is disabled`)
    this.clicked += 1
  }
}

class MissingLocator extends FakeLocator {
  constructor(selector) {
    super(`missing:${selector}`, { visible: false })
  }
}

class FakePage {
  constructor(selectors, options = {}) {
    this.selectors = selectors
    this.directSubmitResult = options.directSubmitResult ?? null
    this.locatorCalls = []
    this.waits = []
  }

  locator(selector) {
    this.locatorCalls.push(selector)
    return this.selectors[selector] || new MissingLocator(selector)
  }

  url() {
    return 'https://www.moinbizplus.com/login'
  }

  async waitForTimeout(ms) {
    this.waits.push(ms)
  }

  async evaluate(script = '') {
    if (String(script).includes('login-submit-dom')) return this.directSubmitResult

    return JSON.stringify({
      buttons: [
        { text: '로그인', name: 'login_button', testid: 'button-login', disabled: true },
        { text: '로그인', name: null, testid: 'nav-login', disabled: false },
      ],
    })
  }
}

test('MOIN login submit bypasses a temporarily disabled form submit with direct form submit', async () => {
  assert.ok(moin.__moinBizplusTestHooks?.clickMoinLoginSubmit, 'MOIN login test hook is unavailable')

  const submit = new FakeLocator('submit', { disabled: true })
  const headerLogin = new FakeLocator('header-login')
  const page = new FakePage(
    {
      'button[data-testid="button-login"]': submit,
      'button[name="login_button"]': submit,
      'form button[type="submit"]': submit,
      'button[type="submit"]:has-text("로그인")': submit,
      'button:has-text("로그인")': headerLogin,
    },
    { directSubmitResult: 'login-submit-dom:requestSubmit' },
  )

  const result = await moin.__moinBizplusTestHooks.clickMoinLoginSubmit(page, undefined)

  assert.equal(result, 'login-submit-dom:requestSubmit')
  assert.equal(submit.clicked, 0)
  assert.equal(headerLogin.clicked, 0)
  assert.ok(!page.locatorCalls.includes('button:has-text("로그인")'))
})

test('MOIN login submit still rejects a disabled form submit when direct submit is unavailable', async () => {
  assert.ok(moin.__moinBizplusTestHooks?.clickMoinLoginSubmit, 'MOIN login test hook is unavailable')

  const submit = new FakeLocator('submit', { disabled: true })
  const headerLogin = new FakeLocator('header-login')
  const page = new FakePage({
    'button[data-testid="button-login"]': submit,
    'button[name="login_button"]': submit,
    'form button[type="submit"]': submit,
    'button[type="submit"]:has-text("로그인")': submit,
    'button:has-text("로그인")': headerLogin,
  })

  await assert.rejects(
    () => moin.__moinBizplusTestHooks.clickMoinLoginSubmit(page, undefined),
    (error) => {
      assert.ok(error instanceof moin.MoinAutomationError)
      assert.equal(error.step, 'Submit login')
      assert.match(error.message, /disabled|not become enabled/i)
      return true
    },
  )

  assert.equal(submit.clicked, 0)
  assert.equal(headerLogin.clicked, 0)
  assert.ok(!page.locatorCalls.includes('button:has-text("로그인")'))
})

test('MOIN login submit clicks the real form submit button once it is enabled', async () => {
  assert.ok(moin.__moinBizplusTestHooks?.clickMoinLoginSubmit, 'MOIN login test hook is unavailable')

  const submit = new FakeLocator('submit')
  const headerLogin = new FakeLocator('header-login')
  const page = new FakePage({
    'button[data-testid="button-login"]': submit,
    'button[name="login_button"]': submit,
    'form button[type="submit"]': submit,
    'button[type="submit"]:has-text("로그인")': submit,
    'button:has-text("로그인")': headerLogin,
  })

  await moin.__moinBizplusTestHooks.clickMoinLoginSubmit(page, undefined)

  assert.equal(submit.clicked, 1)
  assert.equal(headerLogin.clicked, 0)
})
