import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { resolveTranslatorUrl, translatorGistUrl, translatorLoginToken, validateTranslatorUrl } from '../lib/translatorPortal.ts'

const now = 1700000000000
const token = translatorLoginToken('test-secret', now)
const expires = 1700000120
assert.equal(token, `${expires}.${createHmac('sha256', 'test-secret').update(`translator-login:${expires}`).digest('hex')}`)
assert.notEqual(token, translatorLoginToken('another-secret', now))
assert.equal(translatorGistUrl('https://gist.githubusercontent.com/user/id/raw/old-revision/monitor.json?t=1'), 'https://gist.githubusercontent.com/user/id/raw/translator.json')
for (const value of ['http://example.com', 'https://localhost', 'https://trycloudflare.com.evil.test', 'https://user:pass@test.trycloudflare.com']) {
  assert.throws(() => validateTranslatorUrl(value, true))
}
assert.equal(await resolveTranslatorUrl({ TRANSLATOR_URL: 'https://translate.example.com/' }), 'https://translate.example.com')
let calls = 0
const url = await resolveTranslatorUrl({ SMARTINVENTORY_MONITOR_URL_GIST: 'https://gist.githubusercontent.com/user/id/raw/monitor.json' }, async (url, options) => {
  calls++
  assert.equal(url.pathname, '/user/id/raw/translator.json')
  assert.equal(options.cache, 'no-store')
  return new Response(JSON.stringify({ url: 'https://test.trycloudflare.com' }), { status: 200 })
})
assert.equal(url, 'https://test.trycloudflare.com')
assert.equal(calls, 1)
await assert.rejects(resolveTranslatorUrl({}, async () => new Response('', { status: 404 })))
await assert.rejects(resolveTranslatorUrl({}, async () => new Response(JSON.stringify({ url: 'https://evil.test' }))))
await assert.rejects(resolveTranslatorUrl({ TRANSLATOR_URL_GIST: 'http://localhost/secret' }))
console.log('translator token, URL resolution, and redirect validation passed')
