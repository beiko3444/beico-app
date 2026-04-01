import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function getTodayKstString() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const year = parts.find((part) => part.type === 'year')?.value ?? '1970'
  const month = parts.find((part) => part.type === 'month')?.value ?? '01'
  const day = parts.find((part) => part.type === 'day')?.value ?? '01'
  return `${year}-${month}-${day}`
}

function resolveReceiveDate(input: unknown) {
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
    return input.trim()
  }
  return getTodayKstString()
}

function resolveListLimit(input: string | null) {
  if (!input) return 30
  const parsed = Number(input)
  if (!Number.isFinite(parsed) || parsed <= 0) return 30
  return Math.min(Math.floor(parsed), 100)
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const limit = resolveListLimit(searchParams.get('limit'))

    const orders = await prisma.wormOrder.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        orderNumber: true,
        receiveDate: true,
        status: true,
        remittanceAppliedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ success: true, orders })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '발주 리스트 조회 중 오류가 발생했습니다.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const receiveDateText = resolveReceiveDate(body?.receiveDate)

    const dayStart = new Date(`${receiveDateText}T00:00:00+09:00`)
    const dayEnd = new Date(`${receiveDateText}T23:59:59.999+09:00`)
    const compactDate = receiveDateText.replace(/-/g, '')

    const existingCount = await prisma.wormOrder.count({
      where: {
        receiveDate: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
    })

    let order:
      | {
          id: string
          orderNumber: string
          receiveDate: Date
          status: string
          createdAt: Date
        }
      | null = null

    for (let offset = 1; offset <= 20; offset += 1) {
      const nextSeq = String(existingCount + offset).padStart(3, '0')
      const orderNumber = `WO-${compactDate}-${nextSeq}`

      try {
        order = await prisma.wormOrder.create({
          data: {
            orderNumber,
            receiveDate: dayStart,
            status: 'DRAFT',
            createdById: session.user.id || null,
          },
          select: {
            id: true,
            orderNumber: true,
            receiveDate: true,
            status: true,
            createdAt: true,
          },
        })
        break
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          continue
        }
        throw error
      }
    }

    if (!order) {
      throw new Error('새 발주 번호 생성에 실패했습니다. 다시 시도해주세요.')
    }

    return NextResponse.json({ success: true, order })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '새 발주 생성 중 오류가 발생했습니다.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
