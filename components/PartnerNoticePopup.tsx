'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, BellRing, Info, X } from 'lucide-react'

export type PartnerNoticePopupItem = {
  id: string
  title: string
  content: string
  tone: string
  updatedAt: string
}

const getTodayKey = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getDismissKey = (notice: PartnerNoticePopupItem) =>
  `beiko-partner-notice:${notice.id}:${notice.updatedAt}`

const toneStyles = {
  INFO: {
    shell: 'border-blue-200 bg-blue-50 text-blue-700',
    icon: Info,
    label: 'お知らせ · NOTICE',
  },
  IMPORTANT: {
    shell: 'border-amber-200 bg-amber-50 text-amber-800',
    icon: BellRing,
    label: '重要なお知らせ · IMPORTANT',
  },
  URGENT: {
    shell: 'border-rose-200 bg-rose-50 text-rose-700',
    icon: AlertTriangle,
    label: '緊急のお知らせ · URGENT',
  },
} as const

export default function PartnerNoticePopup({ notices }: { notices: PartnerNoticePopupItem[] }) {
  const [queue, setQueue] = useState<PartnerNoticePopupItem[]>([])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setQueue(notices.filter((notice) => {
        try {
          return window.localStorage.getItem(getDismissKey(notice)) !== getTodayKey()
        } catch {
          return true
        }
      }))
    })
    return () => window.cancelAnimationFrame(frame)
  }, [notices])

  const notice = queue[0] || null

  useEffect(() => {
    if (!notice) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setQueue((current) => current.slice(1))
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [notice])

  if (!notice) return null

  const tone = toneStyles[notice.tone as keyof typeof toneStyles] || toneStyles.INFO
  const Icon = tone.icon

  const hideToday = () => {
    try {
      window.localStorage.setItem(getDismissKey(notice), getTodayKey())
    } catch {
      // Storage can be unavailable in private browsing; closing still works.
    }
    setQueue((current) => current.slice(1))
  }

  const closeCurrent = () => setQueue((current) => current.slice(1))

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="partner-notice-title"
        className="relative max-h-[calc(100dvh-32px)] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/60 bg-white shadow-2xl dark:border-[#333] dark:bg-[#1e1e1e]"
      >
        <button
          type="button"
          onClick={closeCurrent}
          aria-label="공지 닫기"
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-500 shadow-sm transition hover:bg-slate-100 hover:text-slate-900 dark:bg-[#292929] dark:text-slate-300"
        >
          <X size={18} />
        </button>

        <div className={`border-b px-6 pb-5 pt-7 sm:px-8 ${tone.shell}`}>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
            <Icon size={24} strokeWidth={2.4} />
          </div>
          <p className="text-[10px] font-black tracking-[0.16em]">{tone.label}</p>
          {queue.length > 1 ? <p className="mt-1 text-[10px] font-bold opacity-70">お知らせがあと {queue.length - 1}件あります</p> : null}
          <h2 id="partner-notice-title" className="mt-2 pr-10 text-2xl font-black leading-tight text-slate-950">
            {notice.title}
          </h2>
        </div>

        <div className="px-6 py-7 sm:px-8">
          <div className="whitespace-pre-wrap break-words text-[15px] font-medium leading-7 text-slate-700 dark:text-slate-200">
            {notice.content}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 border-t border-slate-100 bg-slate-50 p-4 sm:grid-cols-2 dark:border-[#303030] dark:bg-[#181818]">
          <button
            type="button"
            onClick={hideToday}
            className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 transition hover:bg-slate-100 dark:border-[#333] dark:bg-[#242424] dark:text-slate-300"
          >
            今日は表示しない
          </button>
          <button
            type="button"
            onClick={closeCurrent}
            className="min-h-11 rounded-xl bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950"
          >
            確認しました
          </button>
        </div>
      </section>
    </div>
  )
}
