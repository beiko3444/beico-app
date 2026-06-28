import assert from 'node:assert/strict'
import test from 'node:test'

const pricing = await import('../lib/exportDeclarationPricing.ts')

test('uses US selling price directly as USD unit price', () => {
  const price = pricing.resolveExportUnitPriceUsd({
    prices: {
      US: { amount: 4.2, currency: 'USD' },
      JP: { amount: 2880, currency: 'JPY' },
      KR: { amount: 5800, currency: 'KRW' },
    },
    exportCountry: 'US',
    exchangeRates: { KRW: 1450, JPY: 160 },
    fallbackUsd: 0,
  })

  assert.equal(price, 4.2)
})

test('converts Japan selling price to USD using live USD base rates', () => {
  const price = pricing.resolveExportUnitPriceUsd({
    prices: {
      JP: { amount: 2880, currency: 'JPY' },
    },
    exportCountry: 'JP',
    exchangeRates: { KRW: 1450, JPY: 160 },
    fallbackUsd: 0,
  })

  assert.equal(price, 18)
})

test('converts Korea selling price to USD using live USD base rates', () => {
  const price = pricing.resolveExportUnitPriceUsd({
    prices: {
      KR: { amount: 5800, currency: 'KRW' },
    },
    exportCountry: 'KR',
    exchangeRates: { KRW: 1450, JPY: 160 },
    fallbackUsd: 0,
  })

  assert.equal(price, 4)
})

test('builds export prices from C grade retail values before legacy fields', () => {
  const prices = pricing.buildExportProductPrices({
    krSellPrice: 999,
    jpSellPrice: 999,
    usSellPrice: 999,
    regionalPrices: {
      C: {
        KR: { retail: '5,800' },
        JP: { retail: '2,880' },
        US: { retail: '4.2' },
      },
    },
  })

  assert.deepEqual(prices, {
    KR: { amount: 5800, currency: 'KRW' },
    JP: { amount: 2880, currency: 'JPY' },
    US: { amount: 4.2, currency: 'USD' },
  })
})
