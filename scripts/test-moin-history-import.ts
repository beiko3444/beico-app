import assert from 'node:assert/strict'
import { __moinBizplusTestHooks } from '../lib/moinBizplus'

const { normalizeMoinTransaction, matchHistoryItem } = __moinBizplusTestHooks

const normalized = normalizeMoinTransaction({
  transactionId: 'tx-1050',
  appliedAt: '2026-05-12T00:13:48+09:00',
  recipientCompany: 'Shanghai Oikki Trading Co.,Ltd',
  finalReceiveAmountUsd: 1050,
  sendAmountKrw: 1530069,
  totalFeeKrw: 34508,
  exchangeRate: 1457,
  status: '송금완료',
})

assert.equal(normalized.transactionId, 'tx-1050')
assert.equal(normalized.dateText, '2026-05-12')
assert.equal(normalized.recipient, 'Shanghai Oikki Trading Co.,Ltd')
assert.equal(normalized.amountUsdText, '1,050.00 USD')
assert.equal(normalized.sendAmountKrwText, '1,530,069 KRW')
assert.equal(normalized.totalFeeKrwText, '34,508 KRW')
assert.equal(normalized.exchangeRateText, '1 USD = 1,457 KRW')

const matched = matchHistoryItem(
  [
    {
      detailUrl: 'https://www.moinbizplus.com/history/near-date-wrong-amount',
      rowText: 'Shanghai Oikki Trading Co.,Ltd 2026-05-14 960 USD 송금완료',
      dateText: '2026-05-14',
      recipient: 'Shanghai Oikki Trading Co.,Ltd',
      amountUsdText: '960.00 USD',
      sendAmountKrwText: '1,447,690 KRW',
      totalFeeKrwText: '34,041 KRW',
      exchangeRateText: '1 USD = 1,473 KRW',
      statusText: '송금완료',
      transactionId: 'near-date-wrong-amount',
    },
    {
      detailUrl: 'https://www.moinbizplus.com/history/right-amount',
      rowText: 'Shanghai Oikki Trading Co.,Ltd 2026-05-12 1050 USD 송금완료',
      dateText: '2026-05-12',
      recipient: 'Shanghai Oikki Trading Co.,Ltd',
      amountUsdText: '1,050.00 USD',
      sendAmountKrwText: '1,530,069 KRW',
      totalFeeKrwText: '34,508 KRW',
      exchangeRateText: '1 USD = 1,457 KRW',
      statusText: '송금완료',
      transactionId: 'right-amount',
    },
  ],
  {
    targetDate: '2026-05-14',
    fallbackDate: '2026-05-07',
    invoiceDate: '2026-05-08',
    recipientHint: 'Shanghai Oikki Trading',
    targetAmountUsd: 1050,
  },
)

assert.equal(matched?.transactionId, 'right-amount')

console.log('moin history import tests passed')
