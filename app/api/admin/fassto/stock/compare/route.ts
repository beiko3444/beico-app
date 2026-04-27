import { NextResponse } from 'next/server'

import { requireAdminApi, apiErrorResponse } from '@/lib/admin-api'
import { extractFasstoList, normalizeFasstoGoods, normalizeFasstoStocks } from '@/lib/fassto-data'
import { getGoodsList, getStockList } from '@/lib/fassto'
import { buildStockComparison, getFasstoLocalProducts } from '@/lib/fassto-sync'

export async function GET() {
  const unauthorized = await requireAdminApi()
  if (unauthorized) return unauthorized

  try {
    const [products, goodsResult, stockResult] = await Promise.all([
      getFasstoLocalProducts(),
      getGoodsList(),
      getStockList(),
    ])

    const remoteGoods = normalizeFasstoGoods(extractFasstoList(goodsResult.data))
    const remoteStocks = normalizeFasstoStocks(extractFasstoList(stockResult.data))
    const comparison = buildStockComparison(products, remoteGoods, remoteStocks)

    return NextResponse.json({
      summary: comparison.summary,
      items: comparison.items,
      remoteGoodsCount: remoteGoods.length,
      remoteStockRows: remoteStocks.length,
    })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
