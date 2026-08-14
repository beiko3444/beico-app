import { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

import { calculateOrderFinalAmount } from '@/lib/orderAmount'
import { resolvePartnerOrderTerms } from '@/lib/partnerOrderPricing'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/requireAdmin'

type DraftItem = {
  productId: string
  quantity: number
}

const productPricingSelect = {
  id: true,
  name: true,
  sellPrice: true,
  priceA: true,
  priceB: true,
  priceC: true,
  priceD: true,
  minOrderQuantity: true,
  orderUnit: true,
  regionalPrices: true,
  wholesaleAvailable: true,
} as const

export async function POST(request: Request) {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  try {
    const body = await request.json()
    const partnerId = typeof body?.partnerId === 'string' ? body.partnerId.trim() : ''
    const items = parseDraftItems(body?.items)

    if (!partnerId) {
      return NextResponse.json({ error: '업체를 선택해 주세요.' }, { status: 400 })
    }
    if (items.length === 0) {
      return NextResponse.json({ error: '한 개 이상의 상품을 선택해 주세요.' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const partner = await tx.user.findFirst({
        where: {
          id: partnerId,
          role: 'PARTNER',
          status: { not: 'DELETED' },
        },
        select: {
          id: true,
          name: true,
          country: true,
          partnerProfile: {
            select: {
              businessName: true,
              grade: true,
            },
          },
        },
      })

      if (!partner) {
        throw new AdminOrderError('선택한 업체를 찾을 수 없습니다.')
      }

      const products = await tx.product.findMany({
        where: { id: { in: items.map((item) => item.productId) } },
        select: productPricingSelect,
      })
      const productById = new Map(products.map((product) => [product.id, product]))

      const resolvedItems = items.map((item) => {
        const product = productById.get(item.productId)
        if (!product) {
          throw new AdminOrderError('선택한 상품 중 존재하지 않는 상품이 있습니다.')
        }
        if (!product.wholesaleAvailable) {
          throw new AdminOrderError(`현재 발주 불가능한 상품입니다: ${product.name}`)
        }

        const terms = resolvePartnerOrderTerms(product, {
          country: partner.country,
          grade: partner.partnerProfile?.grade,
        })
        if (item.quantity < terms.minimumQuantity) {
          throw new AdminOrderError(`${product.name}의 최소 주문수량은 ${terms.minimumQuantity}개입니다.`)
        }
        if (item.quantity % terms.orderUnit !== 0) {
          throw new AdminOrderError(`${product.name}은 ${terms.orderUnit}개 단위로 주문해야 합니다.`)
        }

        return {
          productId: product.id,
          quantity: item.quantity,
          price: terms.unitPrice,
        }
      })

      const total = calculateOrderFinalAmount(resolvedItems).finalAmount
      const orderNumber = await getNextOrderNumber(tx, new Date())
      const order = await tx.order.create({
        data: {
          userId: partner.id,
          orderNumber,
          total,
          status: 'PENDING',
          items: { create: resolvedItems },
        },
        select: {
          id: true,
          orderNumber: true,
        },
      })

      return {
        ...order,
        partnerName: partner.partnerProfile?.businessName || partner.name,
      }
    })

    revalidatePath('/admin/orders')
    revalidatePath('/order/history')
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('[admin-orders] failed to create order', error)
    const message = error instanceof AdminOrderError
      ? error.message
      : '관리자 발주 생성에 실패했습니다.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

function parseDraftItems(value: unknown): DraftItem[] {
  if (!Array.isArray(value)) return []

  const quantitiesByProduct = new Map<string, number>()
  for (const rawItem of value) {
    if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) continue
    const item = rawItem as Record<string, unknown>
    const productId = typeof item.productId === 'string' ? item.productId.trim() : ''
    const quantity = Number(item.quantity)
    if (!productId || !Number.isInteger(quantity) || quantity <= 0) continue
    quantitiesByProduct.set(productId, (quantitiesByProduct.get(productId) || 0) + quantity)
  }

  return Array.from(quantitiesByProduct, ([productId, quantity]) => ({ productId, quantity }))
}

async function getNextOrderNumber(tx: Prisma.TransactionClient, date: Date) {
  const prefix = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('')
  const latestOrder = await tx.order.findFirst({
    where: { orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: 'desc' },
    select: { orderNumber: true },
  })
  const latestSequence = Number(latestOrder?.orderNumber?.slice(-3))
  const nextSequence = Number.isFinite(latestSequence) ? latestSequence + 1 : 1
  return `${prefix}${String(nextSequence).padStart(3, '0')}`
}

class AdminOrderError extends Error {}
