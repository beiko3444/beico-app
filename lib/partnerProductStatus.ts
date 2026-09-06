export const PARTNER_PRODUCT_STATUSES = ['VISIBLE', 'HIDDEN', 'SOLD_OUT'] as const

export type PartnerProductStatus = (typeof PARTNER_PRODUCT_STATUSES)[number]

export function normalizePartnerProductStatus(
    status: unknown,
    legacyWholesaleAvailable: unknown = true,
): PartnerProductStatus {
    if (status === 'SOLD_OUT') return 'SOLD_OUT'
    if (status === 'HIDDEN') return 'HIDDEN'
    if (status === 'VISIBLE') return 'VISIBLE'
    return legacyWholesaleAvailable === false ? 'HIDDEN' : 'VISIBLE'
}

export function isPartnerProductVisible(
    status: unknown,
    legacyWholesaleAvailable: unknown = true,
) {
    return normalizePartnerProductStatus(status, legacyWholesaleAvailable) !== 'HIDDEN'
}

export function isPartnerProductOrderable(
    status: unknown,
    legacyWholesaleAvailable: unknown = true,
) {
    return normalizePartnerProductStatus(status, legacyWholesaleAvailable) === 'VISIBLE'
}

export function getPartnerProductStatusWrite(status: unknown) {
    const normalized = normalizePartnerProductStatus(status)
    return {
        partnerSaleStatus: normalized,
        wholesaleAvailable: normalized === 'VISIBLE',
    }
}
