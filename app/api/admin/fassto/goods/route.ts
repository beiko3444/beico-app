import { NextResponse } from 'next/server'

import { requireAdminApi, apiErrorResponse } from '@/lib/admin-api'
import { extractFasstoList, normalizeFasstoGoods } from '@/lib/fassto-data'
import { createGoods, getGoodsElements, getGoodsList, updateGoods } from '@/lib/fassto'

export async function GET(request: Request) {
  const unauthorized = await requireAdminApi()
  if (unauthorized) return unauthorized

  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode')

    if (mode === 'elements') {
      const result = await getGoodsElements()
      return NextResponse.json(result)
    }

    const result = await getGoodsList()
    const items = normalizeFasstoGoods(extractFasstoList(result.data))

    return NextResponse.json({
      ...result,
      items,
      summary: {
        total: items.length,
        activeCount: items.filter((item) => item.useYn !== 'N').length,
        inactiveCount: items.filter((item) => item.useYn === 'N').length,
      },
    })
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireAdminApi()
  if (unauthorized) return unauthorized

  try {
    const body = await request.json()
    const result = await createGoods(Array.isArray(body) ? body : [body])
    return NextResponse.json(result)
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function PATCH(request: Request) {
  const unauthorized = await requireAdminApi()
  if (unauthorized) return unauthorized

  try {
    const body = await request.json()
    const result = await updateGoods(Array.isArray(body) ? body : [body])
    return NextResponse.json(result)
  } catch (error) {
    return apiErrorResponse(error)
  }
}
