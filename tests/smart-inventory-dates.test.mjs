import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveInventoryRowSyncedAt } from '../lib/smartInventoryDates.ts'

test('uses the newest linked channel sync time instead of the master edit time', () => {
  assert.equal(
    resolveInventoryRowSyncedAt({
      updatedAt: '2026-04-25T01:00:00.000Z',
      linked: [
        { syncedAt: '2026-09-12T01:00:00.000Z' },
        { syncedAt: '2026-09-13T02:30:00.000Z' },
        { syncedAt: '2026-09-11T04:00:00.000Z' },
      ],
    }),
    '2026-09-13T02:30:00.000Z',
  )
})

test('falls back to the master edit time when no channel sync time exists', () => {
  assert.equal(
    resolveInventoryRowSyncedAt({
      updatedAt: '2026-04-25T01:00:00.000Z',
      linked: [{ syncedAt: null }],
    }),
    '2026-04-25T01:00:00.000Z',
  )
})
