import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getBarobillSmsFromNumbers, getBarobillSmsSendMessagesByPaging, sendBarobillMessage } from '@/lib/barobillSms'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function normalizeDigits(value: string) {
  return value.replace(/\D/g, '')
}

function convertDatetimeLocalToBarobill(value: string) {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 12) return `${digits}00`
  if (digits.length === 14) return digits
  return ''
}

function createRefKey() {
  const now = new Date()
  const y = String(now.getFullYear())
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const time = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
  return `SMS${y}${m}${d}${time}${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

function toCompactDate(value: string) {
  const digits = value.replace(/\D/g, '')
  return digits.length === 8 ? digits : ''
}

function formatDate(date: Date) {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

function getDefaultHistoryRange() {
  const toDate = new Date()
  const fromDate = new Date()
  fromDate.setDate(fromDate.getDate() - 30)

  return {
    fromDate: formatDate(fromDate),
    toDate: formatDate(toDate),
  }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const defaultRange = getDefaultHistoryRange()
    const fromDate = toCompactDate(searchParams.get('fromDate') || '') || defaultRange.fromDate
    const toDate = toCompactDate(searchParams.get('toDate') || '') || defaultRange.toDate
    const countPerPage = Math.min(Math.max(Number.parseInt(searchParams.get('countPerPage') || '20', 10) || 20, 1), 100)
    const currentPage = Math.max(Number.parseInt(searchParams.get('currentPage') || '1', 10) || 1, 1)

    if (fromDate > toDate) {
      return NextResponse.json({ error: '조회 시작일은 종료일보다 늦을 수 없습니다.' }, { status: 400 })
    }

    const [senderInfo, history, recipients] = await Promise.all([
      getBarobillSmsFromNumbers(),
      getBarobillSmsSendMessagesByPaging({
        fromDate,
        toDate,
        countPerPage,
        currentPage,
      }),
      prisma.smsRecipient.findMany({
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      }),
    ])

    return NextResponse.json({
      ...senderInfo,
      history: {
        ...history,
        fromDate,
        toDate,
      },
      recipients,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '발신번호 목록을 불러오지 못했습니다.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()

    const fromNumber = normalizeDigits(typeof body?.fromNumber === 'string' ? body.fromNumber : '')
    const toName = typeof body?.toName === 'string' ? body.toName.trim() : ''
    const toNumber = normalizeDigits(typeof body?.toNumber === 'string' ? body.toNumber : '')
    const contents = typeof body?.contents === 'string' ? body.contents.trim() : ''
    const sendDT = convertDatetimeLocalToBarobill(typeof body?.sendAt === 'string' ? body.sendAt : '')

    if (!fromNumber) {
      return NextResponse.json({ error: '발신번호를 선택해주세요.' }, { status: 400 })
    }
    if (!toName) {
      return NextResponse.json({ error: '수신자명을 입력해주세요.' }, { status: 400 })
    }
    if (!toNumber) {
      return NextResponse.json({ error: '수신번호를 입력해주세요.' }, { status: 400 })
    }
    if (!contents) {
      return NextResponse.json({ error: '문자 내용을 입력해주세요.' }, { status: 400 })
    }

    const result = await sendBarobillMessage({
      fromNumber,
      toName,
      toNumber,
      contents,
      sendDT,
      refKey: createRefKey(),
    })

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.message,
          resultCode: result.resultCode,
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      receiptNum: result.receiptNum,
      message: result.message,
      sendType: Buffer.byteLength(contents, 'utf8') <= 90 ? 'SMS' : 'LMS',
      scheduled: Boolean(sendDT),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '문자 발송에 실패했습니다.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
