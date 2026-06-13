import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  return NextResponse.json(
    { error: '네이버 통계 저장 방식은 사용하지 않습니다. 통계는 라즈베리 API에서 실시간으로 가져옵니다.' },
    { status: 410 },
  )
}
