import { NextResponse } from 'next/server'

import { requireAdminApi, apiErrorResponse } from '@/lib/admin-api'
import { extractFasstoList, normalizeFasstoDeliveries } from '@/lib/fassto-data'
import { getDeliveryList } from '@/lib/fassto'

export async function GET(request: Request) {
  const unauthorized = await requireAdminApi()
  if (unauthorized) return unauthorized

  try {
    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start') || ''
    const end = searchParams.get('end') || ''
    const status = searchParams.get('status') || 'ALL'
    const outDiv = searchParams.get('outDiv') || '1'

    if (!start || !end) {
      return NextResponse.json({ error: '시작일과 종료일을 입력해주세요.' }, { status: 400 })
    }

    const result = await getDeliveryList(start, end, status, outDiv)
    const items = normalizeFasstoDeliveries(extractFasstoList(result.data))

    return NextResponse.json({
      ...result,
      items,
      summary: {
        total: items.length,
        doneCount: items.filter((item) => item.status === 'DONE').length,
        shortageCount: items.filter((item) => item.status === 'SHORTAGE').length,
        cancelCount: items.filter((item) => item.status === 'CANCEL').length,
        workingCount: items.filter((item) => item.status === 'WORKING' || item.status === 'ORDER').length,
      },
    })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
