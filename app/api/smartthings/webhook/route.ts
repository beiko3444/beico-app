import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ConfirmationPayload = {
  messageType?: string
  confirmationData?: {
    confirmationUrl?: string
  }
}

function validConfirmationUrl(value: string) {
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:'
      && url.hostname === 'api.smartthings.com'
      && /^\/v1\/apps\/[^/]+\/confirm-registration$/.test(url.pathname)
    )
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null) as ConfirmationPayload | null
  if (payload?.messageType === 'CONFIRMATION') {
    const confirmationUrl = payload.confirmationData?.confirmationUrl || ''
    if (!validConfirmationUrl(confirmationUrl)) {
      return NextResponse.json({ error: '확인 주소가 올바르지 않습니다.' }, { status: 400 })
    }
    const response = await fetch(confirmationUrl, {
      method: 'GET',
      cache: 'no-store',
    })
    if (!response.ok) {
      return NextResponse.json({ error: 'SmartThings 대상 주소 확인에 실패했습니다.' }, { status: 502 })
    }
    return NextResponse.json({ ok: true, confirmed: true })
  }

  return NextResponse.json({ ok: true })
}
