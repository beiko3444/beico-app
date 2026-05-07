import assert from 'node:assert/strict'
import { test } from 'node:test'

const progress = await import('../lib/remittanceProgress.ts')

test('remittance progress extracts latest step from ascii arrow steps', () => {
  const latest = progress.extractLatestAutomationStep(
    'Login Failed: Login failed (URL: https://www.moinbizplus.com/login). [steps: runtime:playwright-core+sparticuz -> proxy:none -> open-login-page:domcontentloaded -> fill-login-id -> fill-login-password -> submit-login]',
  )

  assert.equal(latest, 'submit-login')
  assert.deepEqual(progress.resolveRemittanceStageFromStep(latest), {
    percent: 28,
    label: '로그인을 제출하고 확인하는 중...',
  })
})

test('remittance progress extracts latest step from unicode arrow steps', () => {
  const latest = progress.extractLatestAutomationStep(
    'Automation failed [steps: runtime:playwright-core → open-login-page:domcontentloaded → fill-login-id]',
  )

  assert.equal(latest, 'fill-login-id')
})

test('remittance progress maps login page start failures to login page stage', () => {
  assert.deepEqual(progress.resolveRemittanceStageFromStep('open-login-page:start'), {
    percent: 12,
    label: '모인 로그인 페이지에 접속하는 중...',
  })
})
