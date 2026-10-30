'use client'

import { AlertTriangle, BellRing, ChevronDown, Info } from 'lucide-react'
import { usePathname } from 'next/navigation'
import Badge, { type BadgeTone } from '@/components/ui/Badge'

export type PartnerNoticeBoardItem = {
  id: string
  title: string
  content: string
  tone: string
  updatedAt: string
}

// Icon, badge and panel all follow the notice tone, so an ordinary notice doesn't read as a warning.
const toneStyles: Record<'INFO' | 'IMPORTANT' | 'URGENT', { badge: BadgeTone; icon: typeof Info; iconWrap: string; panel: string; ko: string; ja: string }> = {
  INFO: {
    badge: 'neutral',
    icon: Info,
    iconWrap: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300',
    panel: 'border-[var(--border)] bg-[var(--surface)]',
    ko: '일반',
    ja: '一般',
  },
  IMPORTANT: {
    badge: 'warning',
    icon: BellRing,
    iconWrap: 'bg-amber-50 text-amber-700',
    panel: 'border-amber-200 bg-amber-50/70',
    ko: '중요',
    ja: '重要',
  },
  URGENT: {
    badge: 'danger',
    icon: AlertTriangle,
    iconWrap: 'bg-red-50 text-red-700',
    panel: 'border-red-200 bg-red-50/70',
    ko: '긴급',
    ja: '緊急',
  },
}

const formatNoticeDate = (value: string, isKorean: boolean) => new Intl.DateTimeFormat(isKorean ? 'ko-KR' : 'ja-JP', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'Asia/Seoul',
}).format(new Date(value))

export default function PartnerNoticeBoard({ notices, isKorean = false }: { notices: PartnerNoticeBoardItem[]; isKorean?: boolean }) {
  const pathname = usePathname()

  if (pathname !== '/order' || notices.length === 0) return null

  return (
    <section aria-labelledby="partner-notice-board-title" className="mb-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
      <h2 id="partner-notice-board-title" className="sr-only">{isKorean ? '공지사항' : 'お知らせ'}</h2>
      <div className="divide-y divide-[var(--border)]">
        {notices.map((notice) => {
          const tone = toneStyles[notice.tone as keyof typeof toneStyles] || toneStyles.INFO
          const Icon = tone.icon
          const date = formatNoticeDate(notice.updatedAt, isKorean)
          return (
            <details key={notice.id} className="group">
              {/* Icon column + content: date and chevron follow the title itself, so the expand control sits by what it expands. */}
              <summary className="grid cursor-pointer list-none gap-3 px-4 py-2.5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-x-3 sm:px-6 sm:py-3 lg:px-7 [&::-webkit-details-marker]:hidden">
                <span className={`hidden h-9 w-9 shrink-0 items-center justify-center rounded-full sm:flex ${tone.iconWrap}`}>
                  <Icon size={18} aria-hidden />
                </span>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {/* Only a notice that differs from the default gets a label. */}
                    {notice.tone === 'IMPORTANT' || notice.tone === 'URGENT' ? <Badge tone={tone.badge}>{isKorean ? tone.ko : tone.ja}</Badge> : null}
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--foreground)] sm:flex-initial sm:whitespace-normal sm:break-words sm:text-base">{notice.title}</p>
                    <time dateTime={notice.updatedAt} className="shrink-0 text-xs text-[var(--muted-foreground)] tabular-nums">{date}</time>
                    <ChevronDown size={16} aria-hidden className="shrink-0 text-[var(--muted-foreground)] transition-transform group-open:rotate-180" />
                    <span className="sr-only">{isKorean ? '자세히 보기' : '詳細を見る'}</span>
                  </div>
                  <p className="mt-1 hidden whitespace-pre-wrap text-sm leading-6 text-[var(--muted-foreground)] sm:line-clamp-1 group-open:sm:hidden">{notice.content}</p>
                </div>
              </summary>
              <div className={`mx-4 mb-4 whitespace-pre-wrap break-words rounded-xl border px-5 py-4 text-base leading-7 text-[var(--foreground)] sm:ml-[72px] sm:mr-6 lg:ml-[76px] lg:mr-7 dark:border-[var(--border)] dark:bg-[var(--surface)] ${tone.panel}`}>
                {notice.content}
              </div>
            </details>
          )
        })}
      </div>
    </section>
  )
}
