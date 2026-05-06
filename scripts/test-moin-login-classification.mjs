import assert from 'node:assert/strict'
import test from 'node:test'

const moin = await import('../lib/moinBizplus.ts')

test('MOIN login classifier does not treat generic "초과" text as lock failure', () => {
  const classify = moin.__moinBizplusTestHooks?.classifyMoinLoginFailure
  assert.ok(classify, 'MOIN login classifier hook is unavailable')

  const result = classify('송금 신청 가능시간을 초과했습니다')
  assert.equal(result, null)
})

test('MOIN login classifier detects password mismatch', () => {
  const classify = moin.__moinBizplusTestHooks?.classifyMoinLoginFailure
  assert.ok(classify, 'MOIN login classifier hook is unavailable')

  const result = classify('비밀번호가 일치하지 않습니다')
  assert.equal(result, 'password')
})

test('MOIN login classifier detects account protection lock wording', () => {
  const classify = moin.__moinBizplusTestHooks?.classifyMoinLoginFailure
  assert.ok(classify, 'MOIN login classifier hook is unavailable')

  const result = classify('비밀번호 실패 남은 시도: 1회 (계정 보호를 위해 제한됨)')
  assert.equal(result, 'locked')
})
