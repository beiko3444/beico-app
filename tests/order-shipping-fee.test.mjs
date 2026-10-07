import assert from 'node:assert/strict'
import { calculateOrderFinalAmount } from '../lib/orderAmount.ts'

const items = [{ quantity: 150, price: 1000 }]
assert.deepEqual(calculateOrderFinalAmount(items), {
  totalQuantity: 150, productSupplyPrice: 150000, shippingFee: 6000,
  vat: 15600, finalAmount: 171600,
})
assert.equal(calculateOrderFinalAmount(items, 0).finalAmount, 165000)
assert.equal(calculateOrderFinalAmount(items, 5000).finalAmount, 170500)
assert.equal(calculateOrderFinalAmount(items, null).shippingFee, 6000)
console.log('Order shipping fee tests passed')
