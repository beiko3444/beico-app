import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function normalizeDigits(value: string) {
  return value.replace(/\D/g, '')
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const phoneNumber = normalizeDigits(typeof body?.phoneNumber === 'string' ? body.phoneNumber : '')

    if (!name) {
      return NextResponse.json({ error: '수신자명을 입력해주세요.' }, { status: 400 })
    }
    if (!phoneNumber) {
      return NextResponse.json({ error: '수신번호를 입력해주세요.' }, { status: 400 })
    }

    const recipient = await prisma.smsRecipient.upsert({
      where: { phoneNumber },
      update: { name },
      create: { name, phoneNumber },
    })

    return NextResponse.json({
      success: true,
      recipient,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '수신자 저장에 실패했습니다.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
