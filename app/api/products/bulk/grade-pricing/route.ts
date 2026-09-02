import { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

import {
  isProductGrade,
  setProductGradeOrderValue,
  setProductGradePriceValue,
  type ProductGrade,
} from '@/lib/productGradePricing'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/requireAdmin'

type GradePricingUpdate = {
  id: string
  cnyCost?: number
  cost?: number
  wholesale?: number
  retail?: number
  moq?: number
  orderUnit?: number
}

export async function POST(request: Request) {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  try {
    const body = await request.json()
    const grade = body?.grade
    const updates = parseUpdates(body?.updates)

    if (!isProductGrade(grade)) {
      return NextResponse.json({ error: '유효한 상품 등급을 선택해 주세요.' }, { status: 400 })
    }
    if (updates.length === 0) {
      return NextResponse.json({ error: '저장할 수정사항이 없습니다.' }, { status: 400 })
    }

    const productIds = updates.map((update) => update.id)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, regionalPrices: true },
    })
    const productById = new Map(products.map((product) => [product.id, product]))

    const updatedIds = await prisma.$transaction(async (tx) => {
      const ids: string[] = []
      for (const update of updates) {
        const product = productById.get(update.id)
        if (!product) continue

        let regionalPrices: unknown = product.regionalPrices
        if (update.cost !== undefined) {
          regionalPrices = setProductGradePriceValue(regionalPrices, grade, 'cost', update.cost)
        }
        if (update.wholesale !== undefined) {
          regionalPrices = setProductGradePriceValue(regionalPrices, grade, 'wholesale', update.wholesale)
        }
        if (update.retail !== undefined) {
          regionalPrices = setProductGradePriceValue(regionalPrices, grade, 'retail', update.retail)
        }
        if (update.moq !== undefined) {
          regionalPrices = setProductGradeOrderValue(regionalPrices, grade, 'moq', update.moq)
        }
        if (update.orderUnit !== undefined) {
          regionalPrices = setProductGradeOrderValue(regionalPrices, grade, 'orderUnit', update.orderUnit)
        }

        await tx.product.update({
          where: { id: update.id },
          data: {
            regionalPrices: regionalPrices as Prisma.InputJsonValue,
            ...buildLegacyPriceUpdates(grade, update),
          },
        })
        ids.push(update.id)
      }
      return ids
    })

    revalidatePath('/admin/products')
    revalidatePath('/order')
    return NextResponse.json({ success: true, count: updatedIds.length })
  } catch (error: unknown) {
    console.error('[product-grade-pricing] bulk update failed', error)
    return NextResponse.json({
      error: '등급별 상품 정보를 저장하지 못했습니다.',
      message: error instanceof Error ? error.message : undefined,
    }, { status: 500 })
  }
}

function parseUpdates(value: unknown): GradePricingUpdate[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((rawUpdate) => {
    if (!rawUpdate || typeof rawUpdate !== 'object' || Array.isArray(rawUpdate)) return []
    const source = rawUpdate as Record<string, unknown>
    const id = typeof source.id === 'string' ? source.id.trim() : ''
    if (!id) return []

    const update: GradePricingUpdate = { id }
    assignNonNegativeNumber(update, 'cost', source.cost)
    assignNonNegativeNumber(update, 'cnyCost', source.cnyCost)
    assignNonNegativeNumber(update, 'wholesale', source.wholesale)
    assignNonNegativeNumber(update, 'retail', source.retail)
    assignPositiveInt(update, 'moq', source.moq)
    assignPositiveInt(update, 'orderUnit', source.orderUnit)

    return Object.keys(update).length > 1 ? [update] : []
  })
}

function assignNonNegativeNumber(
  target: GradePricingUpdate,
  key: 'cnyCost' | 'cost' | 'wholesale' | 'retail',
  value: unknown,
) {
  if (value === undefined) return
  const parsed = Number(value)
  if (Number.isFinite(parsed) && parsed >= 0) target[key] = parsed
}

function assignPositiveInt(
  target: GradePricingUpdate,
  key: 'moq' | 'orderUnit',
  value: unknown,
) {
  if (value === undefined) return
  const parsed = Math.round(Number(value))
  if (Number.isFinite(parsed) && parsed > 0) target[key] = parsed
}

function buildLegacyPriceUpdates(grade: ProductGrade, update: GradePricingUpdate) {
  const data: Record<string, number> = {}
  if (update.wholesale !== undefined) data[`price${grade}`] = update.wholesale

  if (grade === 'C') {
    if (update.cnyCost !== undefined) data.cnyBuyPrice = update.cnyCost
    if (update.cost !== undefined) data.buyPrice = update.cost
    if (update.wholesale !== undefined) {
      data.sellPrice = update.wholesale
      data.krBuyPrice = update.wholesale
    }
    if (update.retail !== undefined) {
      data.onlinePrice = update.retail
      data.krSellPrice = update.retail
    }
    if (update.moq !== undefined) data.minOrderQuantity = update.moq
    if (update.orderUnit !== undefined) data.orderUnit = update.orderUnit
  }

  return data
}
