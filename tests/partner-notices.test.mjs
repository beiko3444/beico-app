import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const readSource = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const schemaSource = readSource('prisma/schema.prisma')
const adminNavSource = readSource('app/admin/AdminNav.tsx')
const partnersPageSource = readSource('app/admin/partners/page.tsx')
const apiSource = readSource('app/api/admin/partner-notices/route.ts')
const layoutSource = readSource('app/order/layout.tsx')
const boardSource = readSource('components/PartnerNoticeBoard.tsx')

assert.match(schemaSource, /model PartnerNotice/)
assert.doesNotMatch(adminNavSource, /path: '\/admin\/notices'/)
assert.match(partnersPageSource, /href="\/admin\/notices"/)
assert.match(partnersPageSource, /파트너 공지/)
assert.match(apiSource, /requireAdminSession/)
assert.match(apiSource, /export async function (?:GET|POST|PATCH|DELETE)/)
assert.match(layoutSource, /partnerNotice\.findMany/)
assert.match(layoutSource, /take: 5/)
assert.match(layoutSource, /startsAt: \{ lte: now \}/)
assert.match(layoutSource, /endsAt: \{ gte: now \}/)
assert.match(layoutSource, /PartnerNoticeBoard notices=\{activeNotices\}/)
assert.doesNotMatch(layoutSource, /PartnerNoticePopup/)
assert.match(boardSource, /pathname !== '\/order' \|\| notices\.length === 0/)
assert.match(boardSource, /PARTNER NOTICE/)

console.log('partner notice tests passed')
