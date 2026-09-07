import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const readSource = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const layoutSource = readSource('app/order/layout.tsx')
const orderPageSource = readSource('app/order/page.tsx')
const orderInterfaceSource = readSource('app/order/order-interface.tsx')
const historySource = readSource('components/OrderHistory.tsx')
const navbarSource = readSource('components/UserNavbar.tsx')
const profileSource = readSource('app/order/profile/page.tsx')
const passwordSource = readSource('components/ChangePasswordForm.tsx')
const boardSource = readSource('components/PartnerNoticeBoard.tsx')

assert.match(layoutSource, /const isKorean = country === 'Korea'/)
assert.match(layoutSource, /UserNavbar isKorean=\{isKorean\}/)
assert.doesNotMatch(layoutSource, /PartnerNoticePopup/)
assert.match(orderPageSource, /OrderInterface products=\{productsWithTieredPrice\} isKorean=/)
assert.match(orderInterfaceSource, /productList: '상품 목록'/)
assert.match(orderInterfaceSource, /soldOut: '품절'/)
assert.match(orderInterfaceSource, /total: '총 결제금액'/)
assert.match(orderInterfaceSource, /isKorean \? product\.name/)
assert.match(historySource, /isKorean \? '주문내역'/)
assert.match(historySource, /label: '입금 확인'/)
assert.match(navbarSource, /KOREAN_NAV_ITEMS/)
assert.match(navbarSource, /label: '내 정보'/)
assert.match(profileSource, /ChangePasswordForm isKorean=\{isKorean\}/)
assert.match(passwordSource, /'현재 비밀번호'/)
assert.match(boardSource, /'공지사항'/)
assert.match(boardSource, /자세히 보기/)

console.log('partner Korean locale tests passed')
