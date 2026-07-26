import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/requireAdmin'
import {
  collectSmartThingsSensors,
  exchangeSmartThingsAuthorizationCode,
} from '@/lib/smartThings'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

function environmentRedirect(request: NextRequest, params: Record<string, string>) {
  const url = new URL('/admin/environment', request.url)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  const response = NextResponse.redirect(url)
  response.cookies.delete('smartthings_oauth_state')
  return response
}

export async function GET(request: NextRequest) {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  const oauthError = request.nextUrl.searchParams.get('error')
  if (oauthError) {
    return environmentRedirect(request, {
      smartthings: 'error',
      message: oauthError === 'access_denied' ? 'SmartThings 연결 승인이 취소되었습니다.' : 'SmartThings 연결에 실패했습니다.',
    })
  }

  const state = request.nextUrl.searchParams.get('state') || ''
  const expectedState = request.cookies.get('smartthings_oauth_state')?.value || ''
  if (!state || !expectedState || state !== expectedState) {
    return environmentRedirect(request, {
      smartthings: 'error',
      message: 'SmartThings 연결 확인값이 일치하지 않습니다. 다시 시도해 주세요.',
    })
  }

  try {
    await exchangeSmartThingsAuthorizationCode(request.nextUrl.searchParams.get('code') || '')
    try {
      await collectSmartThingsSensors()
      return environmentRedirect(request, { smartthings: 'connected' })
    } catch {
      return environmentRedirect(request, {
        smartthings: 'connected',
        collect: 'failed',
      })
    }
  } catch (error) {
    console.error('[smartthings] OAuth callback failed', error)
    return environmentRedirect(request, {
      smartthings: 'error',
      message: error instanceof Error ? error.message : 'SmartThings 연결에 실패했습니다.',
    })
  }
}
