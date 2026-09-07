'use client'

import { AlertTriangle, BellRing, ChevronDown, Info, Megaphone } from 'lucide-react'
import { usePathname } from 'next/navigation'
import type { PartnerNoticePopupItem } from '@/components/PartnerNoticePopup'

const toneStyles = {
  INFO: {
    badge: 'bg-blue-100 text-blue-700',
    panel: 'border-blue-100 bg-blue-50/60',
    icon: Info,
    label: 'NOTICE',
  },
  IMPORTANT: {
    badge: 'bg-amber-100 text-amber-800',
    panel: 'border-amber-200 bg-amber-50/70',
    icon: BellRing,
    label: 'IMPORTANT',
  },
  URGENT: {
    badge: 'bg-rose-100 text-rose-700',
    panel: 'border-rose-200 bg-rose-50/70',
    icon: AlertTriangle,
    label: 'URGENT',
  },
} as const

export default function PartnerNoticeBoard({ notices }: { notices: PartnerNoticePopupItem[] }) {
  const pathname = usePathname()

  if (pathname !== '/order' || notices.length === 0) return null

  return (
    <section aria-labelledby="partner-notice-board-title" className="mb-4 overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-sm dark:border-orange-950 dark:bg-[#1e1e1e]">
      <div className="flex items-center justify-between gap-3 border-b border-orange-100 bg-gradient-to-r from-orange-50 to-white px-4 py-3 sm:px-5 dark:border-orange-950 dark:from-orange-950/30 dark:to-[#1e1e1e]">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#d9361b] text-white shadow-sm">
            <Megaphone size={18} />
          </div>
          <div className="min-w-0">
            <h2 id="partner-notice-board-title" className="text-sm font-black text-slate-950 dark:text-white">お知らせ</h2>
            <p className="text-[10px] font-bold tracking-[0.12em] text-slate-400">PARTNER NOTICE</p>
          </div>
        </div>
        {notices.length > 1 ? <span className="shrink-0 rounded-full bg-orange-100 px-2.5 py-1 text-[10px] font-black text-[#d9361b]">{notices.length}件</span> : null}
      </div>

      <div className="divide-y divide-slate-100 dark:divide-[#303030]">
        {notices.map((notice, index) => {
          const tone = toneStyles[notice.tone as keyof typeof toneStyles] || toneStyles.INFO
          const Icon = tone.icon
          return (
            <details key={notice.id} open={index === 0} className="group px-4 py-1 sm:px-5">
              <summary className="flex cursor-pointer list-none items-center gap-3 py-3 [&::-webkit-details-marker]:hidden">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tone.badge}`}>
                  <Icon size={14} />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-black text-slate-800 dark:text-slate-100">{notice.title}</span>
                <span className={`hidden rounded-full px-2 py-0.5 text-[9px] font-black tracking-wide sm:inline ${tone.badge}`}>{tone.label}</span>
                <ChevronDown size={16} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
              </summary>
              <div className={`mb-3 ml-10 whitespace-pre-wrap break-words rounded-xl border px-4 py-3 text-sm font-medium leading-6 text-slate-700 dark:border-[#383838] dark:bg-[#252525] dark:text-slate-200 ${tone.panel}`}>
                {notice.content}
              </div>
            </details>
          )
        })}
      </div>
    </section>
  )
}
