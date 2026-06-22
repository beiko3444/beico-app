import assert from 'node:assert/strict'
import { test } from 'node:test'

const matchWindow = await import('../lib/depositMatchWindow.mjs')

test('deposit match window includes deposits exactly four days after order creation', () => {
  const orderCreatedAt = new Date('2026-06-01T09:00:00.000Z')
  const depositReceivedAt = new Date('2026-06-05T09:00:00.000Z')

  assert.equal(matchWindow.isDepositWithinOrderMatchWindow(orderCreatedAt, depositReceivedAt), true)
})

test('deposit match window excludes deposits more than four days after order creation', () => {
  const orderCreatedAt = new Date('2026-06-01T09:00:00.000Z')
  const depositReceivedAt = new Date('2026-06-05T09:00:00.001Z')

  assert.equal(matchWindow.isDepositWithinOrderMatchWindow(orderCreatedAt, depositReceivedAt), false)
})

test('deposit match window excludes deposits before order creation', () => {
  const orderCreatedAt = new Date('2026-06-01T09:00:00.000Z')
  const depositReceivedAt = new Date('2026-06-01T08:59:59.999Z')

  assert.equal(matchWindow.isDepositWithinOrderMatchWindow(orderCreatedAt, depositReceivedAt), false)
})

test('deposit match order query range only looks back four days from deposit time', () => {
  const depositReceivedAt = new Date('2026-06-05T09:00:00.000Z')
  const range = matchWindow.getDepositMatchOrderCreatedAtRange(depositReceivedAt)

  assert.deepEqual(range, {
    gte: new Date('2026-06-01T09:00:00.000Z'),
    lte: depositReceivedAt,
  })
})
