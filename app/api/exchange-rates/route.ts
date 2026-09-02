import { NextResponse } from 'next/server'

import { requireAdminSession } from '@/lib/requireAdmin'

export const revalidate = 3600

export async function GET() {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD', {
      next: { revalidate: 3600 },
    })
    if (!response.ok) throw new Error(`Exchange API returned ${response.status}`)

    const data = await response.json()
    const krw = Number(data?.rates?.KRW)
    const cny = Number(data?.rates?.CNY)
    if (!Number.isFinite(krw) || !Number.isFinite(cny) || krw <= 0 || cny <= 0) {
      throw new Error('Exchange API response did not include KRW/CNY rates')
    }

    return NextResponse.json({
      cnyKrw: krw / cny,
      updatedAt: data?.time_last_update_utc || new Date().toISOString(),
    })
  } catch (error) {
    console.error('[exchange-rates] Failed to load CNY/KRW rate', error)
    return NextResponse.json({ error: '환율을 불러오지 못했습니다.' }, { status: 503 })
  }
}
