import assert from 'node:assert/strict'
import test from 'node:test'

const rentPayment = await import('../lib/rentPaymentStatus.ts')

test('normalizes rent payment API rows for checklist state', () => {
  const status = rentPayment.normalizeRentPaymentStatus({
    rentTaxInvoiceIssued: 1,
    electricityPaid: true,
    electricityPaidAt: '2026-06-24T09:15:00.000Z',
  })

  assert.deepEqual(status, {
    rentTaxInvoiceIssued: true,
    electricityPaid: true,
    electricityPaidAt: '2026-06-24T09:15:00.000Z',
  })
})

test('uses a stable year-month key', () => {
  assert.equal(rentPayment.rentPaymentStatusKey(2026, 1), '2026-01')
  assert.equal(rentPayment.rentPaymentStatusKey(2026, 12), '2026-12')
})

