export type ProductionReviewInput = {
    quantity: number
    unitCost: number | null
    salesPrice: number | null
}

/** A review hint, not a declaration that a batch is wrong or incomplete. */
export function productionReviewReason(batch: ProductionReviewInput): string | null {
    if (!Number.isFinite(batch.quantity) || batch.quantity <= 0) return '생산수량 확인 필요'
    if (batch.unitCost === null || !Number.isFinite(batch.unitCost)) return '생산단가 미입력'
    if (batch.salesPrice !== null && batch.salesPrice > 0 && batch.unitCost > batch.salesPrice) return '생산단가가 도매가보다 높음'
    return null
}
