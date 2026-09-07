import { prisma } from '@/lib/prisma'
import PartnerNoticesClient, { type PartnerNoticeItem } from './PartnerNoticesClient'

export const dynamic = 'force-dynamic'

export default async function PartnerNoticesPage() {
  let notices: PartnerNoticeItem[] = []

  try {
    const rows = await prisma.partnerNotice.findMany({ orderBy: { updatedAt: 'desc' } })
    notices = rows.map((notice) => ({
      ...notice,
      startsAt: notice.startsAt?.toISOString() || null,
      endsAt: notice.endsAt?.toISOString() || null,
      createdAt: notice.createdAt.toISOString(),
      updatedAt: notice.updatedAt.toISOString(),
    }))
  } catch (error) {
    console.error('Failed to load partner notices:', error)
  }

  return <PartnerNoticesClient initialNotices={notices} />
}
