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

class MockDomElement {
  constructor(text, { visible = true, disabled = false, top = 300, bodyText = '' } = {}) {
    this.textContent = text
    this.value = ''
    this.visible = visible
    this.disabled = disabled
    this.clicked = false
    this.parentElement = null
    this.bodyText = bodyText || text
    this.attributes = new Map()
    this.rect = visible
      ? { width: 120, height: 40, top, left: 0, right: 120, bottom: top + 40 }
      : { width: 0, height: 0, top, left: 0, right: 0, bottom: top }
  }

  getBoundingClientRect() {
    return this.rect
  }

  getAttribute(name) {
    return this.attributes.get(name) || ''
  }

  dispatchEvent() {}

  scrollIntoView() {}

  click() {
    this.clicked = true
  }
}

class MockDomPage {
  constructor({ elements, pathname = '/transfer/review', bodyText = '최종 수취금액 USD KRW 총수수료' }) {
    this.elements = elements
    this.pathname = pathname
    this.body = new MockDomElement(bodyText, { top: 0 })
    this.body.innerText = bodyText
  }

  async evaluate(source) {
    const document = {
      body: this.body,
      querySelectorAll: () => this.elements,
    }
    const location = {
      href: `https://www.moinbizplus.com${this.pathname}?recipientId=17122`,
      pathname: this.pathname,
    }
    const window = {
      getComputedStyle: (element) => ({
        display: element.visible ? 'block' : 'none',
        visibility: element.visible ? 'visible' : 'hidden',
        opacity: element.visible ? '1' : '0',
      }),
    }
    const MouseEvent = class {}
    return new Function('document', 'location', 'window', 'MouseEvent', `return (${source.trim()});`)(
      document,
      location,
      window,
      MouseEvent,
    )
  }

  locator() {
    return new MockLocatorList([])
  }

  url() {
    return `https://www.moinbizplus.com${this.pathname}?recipientId=17122`
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

test('MOIN final submit clicks confirm action on review page', async () => {
  assert.ok(moin.__moinBizplusTestHooks?.clickFinalRemittanceSubmit, 'clickFinalRemittanceSubmit hook is unavailable')

  const previous = new MockDomElement('이전', { top: 180 })
  const confirm = new MockDomElement('확인', { top: 520 })
  const page = new MockDomPage({
    elements: [previous, confirm],
    pathname: '/transfer/review',
    bodyText: '최종 수취금액 $960.00 보내는 금액 KRW 총수수료 적용환율',
  })

  const selectorUsed = await moin.__moinBizplusTestHooks.clickFinalRemittanceSubmit(page, 100)

  assert.equal(selectorUsed, 'dom-scoped:확인')
  assert.equal(previous.clicked, false)
  assert.equal(confirm.clicked, true)
})
