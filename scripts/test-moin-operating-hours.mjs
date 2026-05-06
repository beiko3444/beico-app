import assert from 'node:assert/strict'
import test from 'node:test'

const moin = await import('../lib/moinBizplus.ts')

test('MOIN remittance operating window uses Korea time, not server local time', () => {
  const getState = moin.__moinBizplusTestHooks?.getMoinRemittanceWindowState
  assert.ok(getState, 'MOIN operating-hours test hook is unavailable')

  assert.equal(
    getState(new Date('2026-05-06T03:00:00.000Z')).isOpen,
    true,
    'Wednesday 12:00 KST should be open',
  )

  assert.equal(
    getState(new Date('2026-05-08T08:59:00.000Z')).isOpen,
    true,
    'Friday 17:59 KST should still be open',
  )

  assert.equal(
    getState(new Date('2026-05-08T09:00:00.000Z')).isOpen,
    false,
    'Friday 18:00 KST should be closed',
  )

  assert.equal(
    getState(new Date('2026-05-10T03:00:00.000Z')).isOpen,
    false,
    'Sunday 12:00 KST should be closed',
  )

  assert.equal(
    getState(new Date('2026-05-10T19:00:00.000Z')).isOpen,
    true,
    'Monday 04:00 KST should reopen',
  )
})
