import { NextResponse } from 'next/server'
import { loadProductionProducts } from '@/lib/productionProduct'

export async function GET() {
  try {
    return NextResponse.json(await loadProductionProducts(), { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: '상품 가격을 불러오지 못했습니다.' }, { status: 500 })
  }
}
