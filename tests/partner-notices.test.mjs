import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const readSource = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const schemaSource = readSource('prisma/schema.prisma')
const adminNavSource = readSource('app/admin/AdminNav.tsx')
const apiSource = readSource('app/api/admin/partner-notices/route.ts')
const layoutSource = readSource('app/order/layout.tsx')
const popupSource = readSource('components/PartnerNoticePopup.tsx')

assert.match(schemaSource, /model PartnerNotice/)
assert.match(adminNavSource, /파트너 공지/)
assert.match(apiSource, /requireAdminSession/)
assert.match(apiSource, /export async function (?:GET|POST|PATCH|DELETE)/)
assert.match(layoutSource, /partnerNotice\.findMany/)
assert.match(layoutSource, /take: 5/)
assert.match(layoutSource, /startsAt: \{ lte: now \}/)
assert.match(layoutSource, /endsAt: \{ gte: now \}/)
assert.match(popupSource, /role="dialog"/)
assert.match(popupSource, /今日は表示しない/)
assert.match(popupSource, /localStorage/)

console.log('partner notice tests passed')
