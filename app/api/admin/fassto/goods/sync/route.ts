import { NextResponse } from 'next/server'

import { requireAdminApi, apiErrorResponse } from '@/lib/admin-api'
import { extractFasstoList, normalizeFasstoGoods } from '@/lib/fassto-data'
import { createGoods, getGoodsList, updateGoods } from '@/lib/fassto'
import { buildGoodsPayload, buildGoodsSyncPreview, getFasstoLocalProducts } from '@/lib/fassto-sync'

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

function serializeReason(error: unknown) {
  if (error instanceof Error) return error.message
  return '알 수 없는 오류'
}

export async function GET() {
  const unauthorized = await requireAdminApi()
  if (unauthorized) return unauthorized

  try {
    const [products, goodsResult] = await Promise.all([getFasstoLocalProducts(), getGoodsList()])
    const remoteGoods = normalizeFasstoGoods(extractFasstoList(goodsResult.data))
    const preview = buildGoodsSyncPreview(products, remoteGoods)

    return NextResponse.json({
      summary: preview.summary,
      items: preview.items,
      remoteGoodsCount: remoteGoods.length,
    })
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireAdminApi()
  if (unauthorized) return unauthorized

  try {
    const body = await request.json().catch(() => ({}))
    const selectedIds = Array.isArray(body?.productIds)
      ? new Set(body.productIds.map((id: unknown) => String(id)))
      : null

    const [products, goodsResult] = await Promise.all([getFasstoLocalProducts(), getGoodsList()])
    const productMap = new Map(products.map((product) => [product.id, product]))
    const remoteGoods = normalizeFasstoGoods(extractFasstoList(goodsResult.data))
    const preview = buildGoodsSyncPreview(products, remoteGoods)
    const previewItems = preview.items.filter((item) => !selectedIds || selectedIds.has(item.productId))

    const createPayloads = previewItems
      .filter((item) => item.action === 'CREATE')
      .map((item) => buildGoodsPayload(productMap.get(item.productId)!))

    const updatePayloads = previewItems
      .filter((item) => item.action === 'UPDATE')
      .map((item) => buildGoodsPayload(productMap.get(item.productId)!))

    const errors: Array<{ action: 'CREATE' | 'UPDATE'; codes: string[]; message: string }> = []
    let createdCount = 0
    let updatedCount = 0

    for (const chunk of chunkArray(createPayloads, 50)) {
      try {
        await createGoods(chunk)
        createdCount += chunk.length
      } catch (error) {
        errors.push({
          action: 'CREATE',
          codes: chunk.map((item) => item.cstGodCd),
          message: serializeReason(error),
        })
      }
    }

    for (const chunk of chunkArray(updatePayloads, 50)) {
      try {
        await updateGoods(chunk)
        updatedCount += chunk.length
      } catch (error) {
        errors.push({
          action: 'UPDATE',
          codes: chunk.map((item) => item.cstGodCd),
          message: serializeReason(error),
        })
      }
    }

    return NextResponse.json({
      summary: {
        selectedCount: previewItems.length,
        requestedCreateCount: createPayloads.length,
        requestedUpdateCount: updatePayloads.length,
        createdCount,
        updatedCount,
        skippedCount: previewItems.length - createPayloads.length - updatePayloads.length,
        errorCount: errors.length,
      },
      errors,
    })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
