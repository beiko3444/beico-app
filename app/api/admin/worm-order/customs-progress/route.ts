import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/requireAdmin'
import { normalizeBlNo } from '@/lib/unipassCustoms'
import { lookupUnipassCustomsProgress } from '@/lib/unipassCustomsLookup'

const CACHE_TTL_MS = 10 * 60 * 1000
const NOT_FOUND_CACHE_TTL_MS = 60 * 1000

export const runtime = 'nodejs'

type CachedResponse = {
  expiresAt: number
  status: number
  payload: unknown
}

const responseCache = new Map<string, CachedResponse>()

export async function GET(request: NextRequest) {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  const blNo = normalizeBlNo(request.nextUrl.searchParams.get('blNo') || '')
  const forceRefresh = request.nextUrl.searchParams.get('force') === '1'

  if (!blNo) return NextResponse.json({ error: 'B/L 번호를 입력해주세요.' }, { status: 400 })
  if (blNo.length < 6) return NextResponse.json({ error: 'B/L 번호 형식이 너무 짧습니다.' }, { status: 400 })

  if (!forceRefresh) {
    const cached = responseCache.get(blNo)
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(cached.payload, {
        status: cached.status,
        headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' },
      })
    }
  }

  const outcome = await lookupUnipassCustomsProgress(blNo)
  responseCache.set(blNo, {
    expiresAt: Date.now() + (outcome.ok ? CACHE_TTL_MS : NOT_FOUND_CACHE_TTL_MS),
    status: outcome.status,
    payload: outcome.payload,
  })

  return NextResponse.json(outcome.payload, {
    status: outcome.status,
    headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' },
  })
}
