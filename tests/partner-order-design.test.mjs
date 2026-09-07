import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const readSource = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const layoutSource = readSource('app/order/layout.tsx')
const orderInterfaceSource = readSource('app/order/order-interface.tsx')
const noticeBoardSource = readSource('components/PartnerNoticeBoard.tsx')
const navbarSource = readSource('components/UserNavbar.tsx')

assert.match(orderInterfaceSource, /type="search"/)
assert.match(orderInterfaceSource, /statusFilter/)
assert.match(orderInterfaceSource, /filteredProducts/)
assert.match(orderInterfaceSource, /xl:grid-cols-2/)
assert.match(orderInterfaceSource, /rounded-2xl/)
assert.match(orderInterfaceSource, /soldOutOrderDisabled/)
assert.match(noticeBoardSource, /formatNoticeDate/)
assert.match(noticeBoardSource, /sm:grid-cols-\[180px_minmax\(0,1fr\)_110px\]/)
assert.match(layoutSource, /h-\[78px\]/)
assert.match(navbarSource, /sm:min-w-\[118px\]/)

console.log('partner order design tests passed')
