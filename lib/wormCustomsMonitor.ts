import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { normalizeBlNo } from '@/lib/unipassCustoms'
import {
  customsProgressLabel,
  isImportDeclarationAccepted,
  lookupUnipassCustomsProgress,
  type UnipassCustomsProgressPayload,
} from '@/lib/unipassCustomsLookup'

const MONITOR_INTERVAL_MS = 10 * 60 * 1000
const ERROR_RETRY_MS = 10 * 60 * 1000
const CLAIM_STALE_MS = 30 * 60 * 1000
const COMPLETION_EMAIL = 'contact@beiko.com'

function asJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function registerWormAwbCustomsMonitor(input: {
  awbNumber: string
  emailUid?: string | null
  sourceSubject?: string | null
}) {
  const awbNumber = normalizeBlNo(input.awbNumber)
  const emailUid = input.emailUid?.trim() || null
  if (!awbNumber) throw new Error('모니터링할 AWB 번호가 없습니다.')

  const matchedOrder = emailUid
    ? await prisma.wormOrderEmailMatch.findUnique({ where: { uid: emailUid }, select: { orderId: true } })
    : null

  if (emailUid) {
    await prisma.wormAwbCustomsMonitor.updateMany({
      where: { emailUid, awbNumber: { not: awbNumber }, notifiedAt: null },
      data: { status: 'CANCELLED', lastError: '동일 메일에서 새 AWB가 등록되어 감시를 종료했습니다.' },
    })
  }

  const existing = await prisma.wormAwbCustomsMonitor.findUnique({ where: { awbNumber } })
  if (existing?.notifiedAt) return existing

  return prisma.wormAwbCustomsMonitor.upsert({
    where: { awbNumber },
    create: {
      awbNumber,
      emailUid,
      orderId: matchedOrder?.orderId || null,
      sourceSubject: input.sourceSubject?.trim() || null,
      nextCheckAt: new Date(),
    },
    update: {
      emailUid,
      orderId: matchedOrder?.orderId || existing?.orderId || null,
      sourceSubject: input.sourceSubject?.trim() || existing?.sourceSubject || null,
      status: 'MONITORING',
      nextCheckAt: new Date(),
      lastError: null,
      notificationClaimedAt: null,
    },
  })
}

async function sendCompletionEmail(input: {
  awbNumber: string
  orderNumber: string | null
  sourceSubject: string | null
  statusLabel: string
  detectedAt: Date
}) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('SMTP_USER 또는 SMTP_PASS가 설정되지 않아 완료 이메일을 발송할 수 없습니다.')
  }

  const detectedText = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(input.detectedAt)
  const orderLine = input.orderNumber ? `발주번호: ${input.orderNumber}\n` : ''
  const sourceLine = input.sourceSubject ? `AWB 메일: ${input.sourceSubject}\n` : ''

  await sendEmail({
    to: COMPLETION_EMAIL,
    subject: `[수입신고 수리 완료] AWB ${input.awbNumber}`,
    text: [
      '유니패스 모니터링에서 수입신고 수리 완료를 확인했습니다.',
      '',
      `AWB: ${input.awbNumber}`,
      orderLine.trimEnd(),
      sourceLine.trimEnd(),
      `통관 상태: ${input.statusLabel}`,
      `확인 시각: ${detectedText}`,
    ].filter(Boolean).join('\n'),
    html: `
      <h2>수입신고 수리 완료</h2>
      <p>유니패스 모니터링에서 수입신고 수리 완료를 확인했습니다.</p>
      <table style="border-collapse:collapse">
        <tr><th style="padding:6px 12px;text-align:left">AWB</th><td style="padding:6px 12px">${escapeHtml(input.awbNumber)}</td></tr>
        ${input.orderNumber ? `<tr><th style="padding:6px 12px;text-align:left">발주번호</th><td style="padding:6px 12px">${escapeHtml(input.orderNumber)}</td></tr>` : ''}
        ${input.sourceSubject ? `<tr><th style="padding:6px 12px;text-align:left">AWB 메일</th><td style="padding:6px 12px">${escapeHtml(input.sourceSubject)}</td></tr>` : ''}
        <tr><th style="padding:6px 12px;text-align:left">통관 상태</th><td style="padding:6px 12px">${escapeHtml(input.statusLabel)}</td></tr>
        <tr><th style="padding:6px 12px;text-align:left">확인 시각</th><td style="padding:6px 12px">${escapeHtml(detectedText)}</td></tr>
      </table>
    `,
  })
}

async function claimAndNotify(
  monitor: { id: string; awbNumber: string; orderId: string | null; sourceSubject: string | null },
  payload: UnipassCustomsProgressPayload,
  statusLabel: string,
) {
  const now = new Date()
  const staleClaimAt = new Date(now.getTime() - CLAIM_STALE_MS)
  const claimed = await prisma.wormAwbCustomsMonitor.updateMany({
    where: {
      id: monitor.id,
      notifiedAt: null,
      OR: [
        { status: 'MONITORING' },
        { status: 'NOTIFYING', notificationClaimedAt: { lte: staleClaimAt } },
      ],
    },
    data: {
      status: 'NOTIFYING',
      notificationClaimedAt: now,
      completionDetectedAt: now,
      lastStatus: statusLabel,
      lastResult: asJson(payload),
      lastCheckedAt: now,
      lastError: null,
      checkCount: { increment: 1 },
    },
  })
  if (claimed.count === 0) return false

  const order = monitor.orderId
    ? await prisma.wormOrder.findUnique({ where: { id: monitor.orderId }, select: { orderNumber: true } })
    : null

  try {
    await sendCompletionEmail({
      awbNumber: monitor.awbNumber,
      orderNumber: order?.orderNumber || null,
      sourceSubject: monitor.sourceSubject,
      statusLabel,
      detectedAt: now,
    })
    await prisma.wormAwbCustomsMonitor.update({
      where: { id: monitor.id },
      data: { status: 'COMPLETED', notifiedAt: new Date(), notificationClaimedAt: null, nextCheckAt: now },
    })
    return true
  } catch (error) {
    await prisma.wormAwbCustomsMonitor.update({
      where: { id: monitor.id },
      data: {
        status: 'MONITORING',
        notificationClaimedAt: null,
        nextCheckAt: new Date(Date.now() + ERROR_RETRY_MS),
        lastError: error instanceof Error ? error.message : '완료 이메일 발송 실패',
      },
    })
    throw error
  }
}

async function checkMonitor(monitor: {
  id: string
  awbNumber: string
  orderId: string | null
  sourceSubject: string | null
}) {
  const outcome = await lookupUnipassCustomsProgress(monitor.awbNumber)
  const now = new Date()

  if (!outcome.ok) {
    await prisma.wormAwbCustomsMonitor.update({
      where: { id: monitor.id },
      data: {
        status: 'MONITORING',
        lastCheckedAt: now,
        nextCheckAt: new Date(now.getTime() + (outcome.status === 502 ? ERROR_RETRY_MS : MONITOR_INTERVAL_MS)),
        lastStatus: outcome.status === 404 ? '유니패스 조회 대기' : '유니패스 요청 실패',
        lastResult: asJson(outcome.payload),
        lastError: outcome.status === 502 ? outcome.payload.error : null,
        checkCount: { increment: 1 },
        notificationClaimedAt: null,
      },
    })
    return { awbNumber: monitor.awbNumber, completed: false, notified: false, status: outcome.status }
  }

  const statusLabel = customsProgressLabel(outcome.payload)
  if (isImportDeclarationAccepted(outcome.payload)) {
    const notified = await claimAndNotify(monitor, outcome.payload, statusLabel)
    return { awbNumber: monitor.awbNumber, completed: true, notified, status: 200 }
  }

  await prisma.wormAwbCustomsMonitor.update({
    where: { id: monitor.id },
    data: {
      status: 'MONITORING',
      lastCheckedAt: now,
      nextCheckAt: new Date(now.getTime() + MONITOR_INTERVAL_MS),
      lastStatus: statusLabel,
      lastResult: asJson(outcome.payload),
      lastError: null,
      checkCount: { increment: 1 },
      notificationClaimedAt: null,
    },
  })
  return { awbNumber: monitor.awbNumber, completed: false, notified: false, status: 200 }
}

export async function processDueWormCustomsMonitors(limit = 10) {
  const now = new Date()
  const staleClaimAt = new Date(now.getTime() - CLAIM_STALE_MS)
  const monitors = await prisma.wormAwbCustomsMonitor.findMany({
    where: {
      notifiedAt: null,
      OR: [
        { status: 'MONITORING', nextCheckAt: { lte: now } },
        { status: 'NOTIFYING', notificationClaimedAt: { lte: staleClaimAt } },
      ],
    },
    orderBy: { nextCheckAt: 'asc' },
    take: Math.max(1, Math.min(limit, 20)),
    select: { id: true, awbNumber: true, orderId: true, sourceSubject: true },
  })

  const results = []
  for (const monitor of monitors) {
    try {
      results.push(await checkMonitor(monitor))
    } catch (error) {
      results.push({
        awbNumber: monitor.awbNumber,
        completed: false,
        notified: false,
        status: 500,
        error: error instanceof Error ? error.message : '모니터링 처리 실패',
      })
    }
  }
  return { checked: monitors.length, results }
}

export async function getWormAwbCustomsMonitor(awbNumber: string) {
  const normalized = normalizeBlNo(awbNumber)
  if (!normalized) return null
  return prisma.wormAwbCustomsMonitor.findUnique({ where: { awbNumber: normalized } })
}
