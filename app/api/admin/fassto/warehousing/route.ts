import { NextResponse } from 'next/server'

import { requireAdminApi, apiErrorResponse } from '@/lib/admin-api'
import { extractFasstoList } from '@/lib/fassto-data'
import { createWarehousing, getWarehousingList, updateWarehousing } from '@/lib/fassto'

export async function GET(request: Request) {
  const unauthorized = await requireAdminApi()
  if (unauthorized) return unauthorized

  try {
    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start') || ''
    const end = searchParams.get('end') || ''

    if (!start || !end) {
      return NextResponse.json({ error: '시작일과 종료일을 입력해주세요.' }, { status: 400 })
    }

    const result = await getWarehousingList(start, end)
    const items = extractFasstoList(result.data)

    return NextResponse.json({
      ...result,
      items,
      summary: {
        total: items.length,
        doneCount: items.filter((item) => String(item?.wrkStat) === '4').length,
        pendingCount: items.filter((item) => ['1', '2', '3'].includes(String(item?.wrkStat))).length,
        cancelledCount: items.filter((item) => String(item?.wrkStat) === '5').length,
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
    const result = await createWarehousing(Array.isArray(body) ? body : [body])
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
    const result = await updateWarehousing(Array.isArray(body) ? body : [body])
    return NextResponse.json(result)
  } catch (error) {
    return apiErrorResponse(error)
  }
}
