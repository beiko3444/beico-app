import test from 'node:test'
import assert from 'node:assert/strict'

const smsForwarder = await import('../lib/smsForwarder.ts')

test('pickup SMS content uses the requested manager greeting and current date format', () => {
  const contents = smsForwarder.buildPickupSmsContents(new Date('2026-06-23T09:00:00+09:00'), 4)

  assert.equal(
    contents,
    [
      '소장님, 엑스트래커 입니다.',
      '6/23, 출고 4건 집하부탁드립니다.',
      '감사합니다.',
    ].join('\n'),
  )
})

test('SMS forwarder payload carries the phone sender and outbound message', () => {
  const payload = smsForwarder.buildSmsForwarderPayload({
    fromNumber: '010-8119-3313',
    toName: '소장님',
    toNumber: '010-2710-4466',
    contents: '테스트',
    refKey: 'SMS20260623120000ABCDEF',
  })

  assert.deepEqual(payload, {
    fromNumber: '01081193313',
    toName: '소장님',
    toNumber: '01027104466',
    message: '테스트',
    contents: '테스트',
    refKey: 'SMS20260623120000ABCDEF',
  })
})
