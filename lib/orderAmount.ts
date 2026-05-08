export interface OrderAmountItem {
  quantity: number
  price: number
}

export interface OrderAmountSummary {
  totalQuantity: number
  productSupplyPrice: number
  shippingFee: number
  vat: number
  finalAmount: number
}

export function calculateOrderFinalAmount(items: OrderAmountItem[]): OrderAmountSummary {
  const totalQuantity = items.reduce((sum, item) => sum + safeNumber(item.quantity), 0)
  const productSupplyPrice = items.reduce((sum, item) => {
    return sum + Math.round(safeNumber(item.price) * safeNumber(item.quantity))
  }, 0)
  const shippingFee = totalQuantity > 0 ? Math.ceil(totalQuantity / 100) * 3000 : 0
  const vat = Math.round((productSupplyPrice + shippingFee) * 0.1)
  const finalAmount = productSupplyPrice + shippingFee + vat

  return {
    totalQuantity,
    productSupplyPrice,
    shippingFee,
    vat,
    finalAmount,
  }
}

function safeNumber(value: unknown) {
  const numberValue = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numberValue) ? numberValue : 0
}
