import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(
    { error: 'Mindboard feature is no longer available.' },
    { status: 410 },
  )
}
