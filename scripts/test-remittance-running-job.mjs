import assert from 'node:assert/strict'
import { test } from 'node:test'

const runningJob = await import('../lib/remittanceRunningJob.ts')

test('remittance running job is stale after the server max duration buffer', () => {
  const now = 1_000_000
  const startedAt = now - runningJob.REMITTANCE_RUNNING_JOB_STALE_MS - 1

  assert.equal(runningJob.isRemittanceRunningJobStale(startedAt, now), true)
})

test('remittance running job is not stale while still inside max duration buffer', () => {
  const now = 1_000_000
  const startedAt = now - runningJob.REMITTANCE_RUNNING_JOB_STALE_MS + 1

  assert.equal(runningJob.isRemittanceRunningJobStale(startedAt, now), false)
})

test('remittance running job elapsed time is never negative', () => {
  assert.equal(runningJob.getRemittanceRunningJobElapsedMs(2_000, 1_000), 0)
})
