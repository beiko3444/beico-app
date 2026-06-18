import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/requireAdmin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { unauthorized } = await requireAdminSession()
  if (unauthorized) return unauthorized

  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: '삭제할 입고 기록이 없습니다.' }, { status: 400 })
  }

  try {
    await prisma.$transaction(async (tx) => {
      const inbound = await tx.inventoryInbound.delete({
        where: { id },
        select: { productId: true, quantity: true },
      })

      if (inbound.productId) {
        const product = await tx.product.findUnique({
          where: { id: inbound.productId },
          select: { stock: true },
        })

        if (product) {
          await tx.product.update({
            where: { id: inbound.productId },
            data: { stock: Math.max(0, product.stock - inbound.quantity) },
          })
        }
      }
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: '이미 삭제된 입고 기록입니다.' }, { status: 404 })
    }
    throw error
  }

  return NextResponse.json({ success: true }, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
