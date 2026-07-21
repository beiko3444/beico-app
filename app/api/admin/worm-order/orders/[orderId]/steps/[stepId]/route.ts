import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/requireAdmin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MANUAL_STEP_IDS = new Set([6, 8, 9, 10])

export async function PATCH(
  request: Request,
  context: { params: Promise<{ orderId: string; stepId: string }> },
) {
  const { session, unauthorized } = await requireAdminSession()
  if (unauthorized || !session) return unauthorized

  const { orderId, stepId: rawStepId } = await context.params
  const stepId = Number.parseInt(rawStepId, 10)
  if (!orderId || !MANUAL_STEP_IDS.has(stepId)) {
    return NextResponse.json({ error: '지원하지 않는 수동 단계입니다.' }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  if (typeof body?.completed !== 'boolean') {
    return NextResponse.json({ error: 'completed 값이 필요합니다.' }, { status: 400 })
  }

  const existingOrder = await prisma.wormOrder.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, remittanceAppliedAt: true },
  })
  if (!existingOrder) {
    return NextResponse.json({ error: '발주를 찾을 수 없습니다.' }, { status: 404 })
  }

  const now = new Date()
  const result = await prisma.$transaction(async (tx) => {
    const step = await tx.wormOrderPipelineStep.upsert({
      where: { orderId_stepId: { orderId, stepId } },
      create: {
        orderId,
        stepId,
        completed: body.completed,
        completedAt: body.completed ? now : null,
        completedById: body.completed ? session.user.id || null : null,
      },
      update: {
        completed: body.completed,
        completedAt: body.completed ? now : null,
        completedById: body.completed ? session.user.id || null : null,
      },
      select: { stepId: true, completed: true, completedAt: true },
    })

    const order = stepId === 10
      ? await tx.wormOrder.update({
          where: { id: orderId },
          data: {
            status: body.completed
              ? 'COMPLETED'
              : existingOrder.remittanceAppliedAt
                ? 'REMITTANCE_APPLIED'
                : 'DRAFT',
          },
          select: { id: true, status: true, updatedAt: true },
        })
      : await tx.wormOrder.findUniqueOrThrow({
          where: { id: orderId },
          select: { id: true, status: true, updatedAt: true },
        })

    return { step, order }
  })

  return NextResponse.json({
    success: true,
    step: {
      ...result.step,
      completedAt: result.step.completedAt?.toISOString() || null,
    },
    order: {
      ...result.order,
      updatedAt: result.order.updatedAt.toISOString(),
    },
  })
}
