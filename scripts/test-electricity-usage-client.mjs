import assert from 'node:assert/strict'
import test from 'node:test'

const helpers = await import('../lib/electricityUsageClient.ts')

test('saved landlord reading is detected even when bill data is empty', () => {
  assert.equal(
    helpers.hasSavedLandlordReading({
      year: 2026,
      month: 5,
      totalUsage: 0,
      totalAmount: 0,
      rawBillData: '{"beicoTotal":0,"landlordTotal":0}',
      rawText: null,
      landlordMeterCurr: 43670,
    }),
    true,
  )
})

test('landlord-only save payload does not send bill deletion fields', () => {
  const payload = helpers.buildElectricitySavePayload({
    selectedYear: 2026,
    selectedMonth: 5,
    billData: null,
    landlordData: {
      hasReading: true,
      prevMeter: 43097,
      currMeter: 43670,
      waterHeaterKw: 0,
      outdoorLightKw: 110,
      photo: 'data:image/jpeg;base64,abc',
      photoUploadedAt: '2026-06-01T07:11:01.204Z',
    },
    rawText: '',
    extractionHistory: [],
  })

  assert.equal(payload.year, 2026)
  assert.equal(payload.month, 5)
  assert.equal(payload.landlordMeterPrev, 43097)
  assert.equal(payload.landlordMeterCurr, 43670)
  assert.equal(payload.landlordUsage, 683)
  assert.equal(payload.meterPhotoUrl, 'data:image/jpeg;base64,abc')
  assert.equal(Object.hasOwn(payload, 'rawBillData'), false)
  assert.equal(Object.hasOwn(payload, 'readingDate'), false)
  assert.equal(Object.hasOwn(payload, 'totalUsage'), false)
})
