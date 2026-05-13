import assert from 'node:assert/strict'
import { test } from 'node:test'

const moin = await import('../lib/moinBizplus.ts')

test('MOIN runtime resolver prefers explicit local Chrome path before hosted chromium', () => {
  const resolve = moin.__moinBizplusTestHooks?.resolveLocalChromiumExecutable
  assert.ok(resolve, 'runtime resolver test hook is unavailable')

  const executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  const result = resolve(
    { CHROME_EXECUTABLE_PATH: executablePath },
    (candidate) => candidate === executablePath,
  )

  assert.equal(result, executablePath)
})

test('MOIN runtime health masks env values and reports missing credentials', async () => {
  const check = moin.checkMoinRuntimeAvailability
  assert.ok(check, 'MOIN runtime health check is unavailable')

  const result = await check({
    env: {
      MOIN_BIZPLUS_LOGIN_ID: 'admin@example.com',
      MOIN_BIZPLUS_LOGIN_PASSWORD: '',
      FIXIE_URL: 'http://user:secret@example.com:8080',
      CHROME_EXECUTABLE_PATH: '/missing/chrome',
    },
    launch: false,
    exists: () => false,
  })

  assert.equal(result.credentials.loginIdConfigured, true)
  assert.equal(result.credentials.passwordConfigured, false)
  assert.equal(result.proxyConfigured, true)
  assert.equal(result.runtimeAvailable, false)
  assert.equal(result.resolvedExecutablePath, null)
  assert.ok(result.missingComponents.includes('MOIN_BIZPLUS_LOGIN_PASSWORD'))
  assert.equal(JSON.stringify(result).includes('secret'), false)
  assert.equal(JSON.stringify(result).includes('admin@example.com'), false)
})
