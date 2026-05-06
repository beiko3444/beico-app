import test from 'node:test'
import assert from 'node:assert/strict'

const moin = await import('../lib/moinBizplus.ts')

class MockElement {
  constructor(label, visible = true) {
    this.label = label
    this.visible = visible
    this.clicked = false
  }

  first() {
    return this
  }

  nth() {
    return this
  }

  locator() {
    return this
  }

  async waitFor() {}

  async click() {
    this.clicked = true
  }

  async fill() {}

  async pressSequentially() {}

  async setInputFiles() {}

  async check() {}

  async isVisible() {
    return this.visible
  }

  async isEnabled() {
    return true
  }

  async isDisabled() {
    return false
  }

  async count() {
    return 1
  }

  async textContent() {
    return this.label
  }
}

class MockLocatorList {
  constructor(elements) {
    this.elements = elements
  }

  first() {
    return this.nth(0)
  }

  nth(index) {
    return this.elements[index] || new MockElement('missing', false)
  }

  locator() {
    return this
  }

  async waitFor() {}

  async click() {}

  async fill() {}

  async pressSequentially() {}

  async setInputFiles() {}

  async check() {}

  async isVisible() {
    return this.elements.some((element) => element.visible)
  }

  async isEnabled() {
    return true
  }

  async isDisabled() {
    return false
  }

  async count() {
    return this.elements.length
  }

  async textContent() {
    return this.elements.map((element) => element.label).join(' ')
  }
}

class MockPage {
  constructor(selectors) {
    this.selectors = selectors
  }

  locator(selector) {
    return this.selectors[selector] || new MockLocatorList([])
  }

  url() {
    return 'https://www.moinbizplus.com/transfer/confirm'
  }

  async waitForTimeout() {}
}

test('MOIN final submit clicks the last visible matching selector', async () => {
  assert.ok(moin.__moinBizplusTestHooks?.clickLastVisible, 'clickLastVisible hook is unavailable')

  const first = new MockElement('top 송금 신청')
  const hiddenMiddle = new MockElement('hidden 송금 신청', false)
  const last = new MockElement('bottom 송금 신청')
  const page = new MockPage({
    'button:has-text("송금 신청")': new MockLocatorList([first, hiddenMiddle, last]),
  })

  const selectorUsed = await moin.__moinBizplusTestHooks.clickLastVisible(
    page,
    ['button:has-text("송금 신청")'],
    'Submit remittance',
    100,
  )

  assert.equal(selectorUsed, 'button:has-text("송금 신청")#2')
  assert.equal(first.clicked, false)
  assert.equal(hiddenMiddle.clicked, false)
  assert.equal(last.clicked, true)
})
