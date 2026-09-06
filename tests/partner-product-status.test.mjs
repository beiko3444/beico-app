import assert from 'node:assert/strict'
import test from 'node:test'

import {
    getPartnerProductStatusWrite,
    isPartnerProductOrderable,
    isPartnerProductVisible,
    normalizePartnerProductStatus,
} from '../lib/partnerProductStatus.ts'

test('keeps legacy partner visibility data compatible', () => {
    assert.equal(normalizePartnerProductStatus(null, true), 'VISIBLE')
    assert.equal(normalizePartnerProductStatus(null, false), 'HIDDEN')
})

test('distinguishes hidden products from visible sold-out products', () => {
    assert.equal(isPartnerProductVisible('HIDDEN'), false)
    assert.equal(isPartnerProductVisible('SOLD_OUT'), true)
    assert.equal(isPartnerProductOrderable('SOLD_OUT'), false)
    assert.equal(isPartnerProductOrderable('VISIBLE'), true)
})

test('writes the legacy availability flag together with the new status', () => {
    assert.deepEqual(getPartnerProductStatusWrite('VISIBLE'), {
        partnerSaleStatus: 'VISIBLE',
        wholesaleAvailable: true,
    })
    assert.deepEqual(getPartnerProductStatusWrite('SOLD_OUT'), {
        partnerSaleStatus: 'SOLD_OUT',
        wholesaleAvailable: false,
    })
})
