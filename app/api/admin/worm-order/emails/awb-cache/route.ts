import { NextResponse } from 'next/server'
import { upsertWormEmailAwbCache } from '@/lib/wormOrderMail'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const uid = typeof body?.uid === 'string' ? body.uid.trim() : ''
    const awbNumber = typeof body?.awbNumber === 'string' ? body.awbNumber.replace(/\s+/g, '').trim() : ''
    const subject = typeof body?.subject === 'string' ? body.subject : null
    const date = typeof body?.date === 'string' ? body.date : null

    if (!uid || !awbNumber) {
      return NextResponse.json({ error: 'uid and awbNumber are required.' }, { status: 400 })
    }

    const saved = await upsertWormEmailAwbCache({
      uid,
      subject,
      date,
      awbNumber,
    })

    return NextResponse.json({
      uid: saved.uid,
      awbNumber: saved.awbNumber,
      updatedAt: saved.updatedAt.toISOString(),
    })
  } catch (error: unknown) {
    console.error('AWB cache save error:', error)
    const message = error instanceof Error ? error.message : 'Failed to save AWB cache.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
