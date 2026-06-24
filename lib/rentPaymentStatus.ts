export type RentPaymentChecklistStatus = {
  rentTaxInvoiceIssued: boolean
  electricityPaid: boolean
  electricityPaidAt: string | null
}

export const defaultRentPaymentChecklistStatus: RentPaymentChecklistStatus = {
  rentTaxInvoiceIssued: false,
  electricityPaid: false,
  electricityPaidAt: null,
}

export function rentPaymentStatusKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

export function normalizeRentPaymentStatus(entry: unknown): RentPaymentChecklistStatus {
  const record = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {}
  return {
    rentTaxInvoiceIssued: Boolean(record.rentTaxInvoiceIssued),
    electricityPaid: Boolean(record.electricityPaid),
    electricityPaidAt: typeof record.electricityPaidAt === 'string' && record.electricityPaidAt
      ? record.electricityPaidAt
      : null,
  }
}

