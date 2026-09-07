'use client'

import { AlertTriangle, BellRing, ChevronDown, Info, Megaphone } from 'lucide-react'
import { usePathname } from 'next/navigation'

export type PartnerNoticeBoardItem = {
  id: string
  title: string
  content: string
  tone: string
  updatedAt: string
}

const toneStyles = {
  INFO: {
    badge: 'border-blue-200 bg-blue-50 text-blue-700',
    panel: 'border-blue-100 bg-blue-50/60',
    icon: Info,
    label: 'NOTICE',
  },
  IMPORTANT: {
    badge: 'border-amber-300 bg-amber-50 text-amber-800',
    panel: 'border-amber-200 bg-amber-50/70',
    icon: BellRing,
    label: 'IMPORTANT',
  },
  URGENT: {
    badge: 'border-rose-300 bg-rose-50 text-rose-700',
    panel: 'border-rose-200 bg-rose-50/70',
    icon: AlertTriangle,
    label: 'URGENT',
  },
} as const

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
    <section aria-labelledby="partner-notice-board-title" className="mb-7 overflow-hidden rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50/80 via-white to-white shadow-[0_8px_30px_rgba(190,24,93,0.05)] dark:border-rose-950 dark:from-rose-950/20 dark:via-[#1e1e1e] dark:to-[#1e1e1e]">
      <h2 id="partner-notice-board-title" className="sr-only">{isKorean ? '공지사항' : 'お知らせ'}</h2>
      <div className="divide-y divide-rose-100 dark:divide-rose-950/60">
        {notices.map((notice, index) => {
          const tone = toneStyles[notice.tone as keyof typeof toneStyles] || toneStyles.INFO
          const Icon = tone.icon
          return (
            <details key={notice.id} className="group">
              <summary className="grid cursor-pointer list-none gap-4 px-4 py-5 sm:grid-cols-[180px_minmax(0,1fr)_110px] sm:items-center sm:px-6 lg:px-7 [&::-webkit-details-marker]:hidden">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-100 text-[#d9361b]">
                    {index === 0 ? <Megaphone size={21} /> : <Icon size={19} />}
                  </span>
                  <div>
                    <p className="text-base font-black text-[#d9361b]">{isKorean ? '공지사항' : 'お知らせ'}</p>
                    <p className="mt-0.5 text-sm font-bold tracking-[0.12em] text-slate-400">{isKorean ? '파트너 안내' : 'PARTNER NOTICE'}</p>
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`shrink-0 rounded-lg border px-2.5 py-1 text-sm font-black ${tone.badge}`}>{isKorean ? notice.tone === 'URGENT' ? '긴급' : notice.tone === 'IMPORTANT' ? '중요' : '일반' : tone.label}</span>
                    <p className="break-words text-lg font-bold text-slate-900 dark:text-white sm:text-xl">{notice.title}</p>
                  </div>
                  <p className="mt-1.5 line-clamp-2 whitespace-pre-wrap text-base font-normal leading-7 text-slate-600 dark:text-slate-400">{notice.content}</p>
                </div>

                <div className="flex items-center justify-between gap-3 text-sm font-bold text-slate-400 sm:flex-col sm:items-end">
                  <time dateTime={notice.updatedAt}>{formatNoticeDate(notice.updatedAt, isKorean)}</time>
                  <span className="flex items-center gap-1 text-slate-700 dark:text-slate-200">
                    {isKorean ? '자세히 보기' : '詳細を見る'}
                    <ChevronDown size={15} className="transition-transform group-open:rotate-180" />
                  </span>
                </div>
              </summary>
              <div className={`mx-4 mb-5 whitespace-pre-wrap break-words rounded-xl border px-5 py-4 text-base font-normal leading-7 text-slate-700 sm:ml-[210px] sm:mr-6 dark:border-[#383838] dark:bg-[#252525] dark:text-slate-200 ${tone.panel}`}>
                {notice.content}
              </div>
            </details>
          )
        })}
      </div>
    </section>
  )
}
