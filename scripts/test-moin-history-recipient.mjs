import assert from 'node:assert/strict'
import test from 'node:test'

const moin = await import('../lib/moinBizplus.ts')

test('MOIN history parser extracts nested recipient names', () => {
  const normalize = moin.__moinBizplusTestHooks?.normalizeMoinTransaction
  assert.ok(normalize, 'MOIN transaction normalizer test hook is unavailable')

  const item = normalize({
    transactionId: 'tx-1',
    appliedAt: '2026-05-06T01:00:00.000Z',
    receiver: {
      companyName: 'Shanghai Oikki Trading Co.,Ltd',
    },
    sendAmount: 1564177,
  })

  assert.equal(item.recipient, 'Shanghai Oikki Trading Co.,Ltd')
})

test('MOIN history candidates use recipient hint when raw transaction contains it', () => {
  const fillMissing = moin.__moinBizplusTestHooks?.fillMissingHistoryRecipients
  assert.ok(fillMissing, 'MOIN recipient fallback test hook is unavailable')

  const [item] = fillMissing([
    {
      detailUrl: 'https://www.moinbizplus.com/history/tx-2',
      rowText: '',
      dateText: '2026-05-06',
      recipient: '',
      amountUsdText: '',
      statusText: '',
      transactionId: 'tx-2',
      rawTransaction: {
        memo: 'payment to Shanghai Oikki Trading',
      },
    },
  ], 'Shanghai Oikki Trading')

  assert.equal(item.recipient, 'Shanghai Oikki Trading')
})
