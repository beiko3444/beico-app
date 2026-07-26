import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/requireAdmin'
import {
  SmartThingsIntegrationError,
  smartThingsAuthorizationUrl,
} from '@/lib/smartThings'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  try {
    const state = randomBytes(32).toString('base64url')
    const response = NextResponse.redirect(smartThingsAuthorizationUrl(state))
    response.cookies.set('smartthings_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60,
      path: '/',
    })
    return response
  } catch (error) {
    const status = error instanceof SmartThingsIntegrationError ? error.status : 500
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'SmartThings 연결을 시작하지 못했습니다.' },
      { status },
    )
  }
}
