import { NextResponse } from 'next/server'

import { requireAdminApi, apiErrorResponse } from '@/lib/admin-api'
import { getWarehousingDetail } from '@/lib/fassto'

export async function GET(request: Request) {
  const unauthorized = await requireAdminApi()
  if (unauthorized) return unauthorized

  try {
    const { searchParams } = new URL(request.url)
    const slipNo = searchParams.get('slipNo')

    if (!slipNo) {
      return NextResponse.json({ error: '전표번호를 입력해주세요.' }, { status: 400 })
    }

    const result = await getWarehousingDetail(slipNo)
    return NextResponse.json(result)
  } catch (error) {
    return apiErrorResponse(error)
  }
}
