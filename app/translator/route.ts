import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-session'
import { resolveTranslatorUrl, translatorLoginToken } from '@/lib/translatorPortal'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const session = await getAdminSession()
  if (!session) return NextResponse.redirect(new URL('/login', request.url), 303)
  const secret = process.env.TRANSLATOR_SHARED_SECRET?.trim()
  if (!secret) {
    return NextResponse.json({ error: '번역기 연결을 준비 중입니다. 잠시 후 다시 시도해 주세요.' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    })
  }
  try {
    const target = new URL(`${await resolveTranslatorUrl()}/auth`)
    target.searchParams.set('token', translatorLoginToken(secret))
    return new NextResponse(null, {
      status: 303,
      headers: {
        Location: target.toString(),
        'Cache-Control': 'private, no-store',
        'Referrer-Policy': 'no-referrer',
      },
    })
  } catch {
    return NextResponse.json({ error: '번역 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    })
  }
}
