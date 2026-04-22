import { NextResponse } from 'next/server'

import { getAdminSession } from '@/lib/admin-session'
import { FasstoApiError } from '@/lib/fassto'

export async function requireAdminApi() {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}

export function apiErrorResponse(error: unknown) {
  if (error instanceof FasstoApiError) {
    const status = error.status >= 400 ? error.status : 502

    return NextResponse.json(
      {
        error: error.message,
        errorCode: error.errorCode,
        details: error.details,
        path: error.path,
        method: error.method,
      },
      { status }
    )
  }

  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 })
}
