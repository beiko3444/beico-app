import { NextResponse } from 'next/server'

import { requireAdminApi, apiErrorResponse } from '@/lib/admin-api'
import { extractFasstoList, normalizeFasstoStocks } from '@/lib/fassto-data'
import { getStockList } from '@/lib/fassto'

export async function GET() {
  const unauthorized = await requireAdminApi()
  if (unauthorized) return unauthorized

  try {
    const result = await getStockList()
    const items = normalizeFasstoStocks(extractFasstoList(result.data))

    return NextResponse.json({
      ...result,
      items,
      summary: {
        total: items.length,
        availableStock: items.reduce((sum, item) => sum + item.canStockQty, 0),
        badStock: items.reduce((sum, item) => sum + item.badStockQty, 0),
      },
    })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
