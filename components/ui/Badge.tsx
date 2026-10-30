import type { ReactNode } from 'react'

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'progress'

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  info: 'bg-blue-50 text-blue-700',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-800',
  danger: 'bg-red-50 text-red-700',
  // Under way (e.g. shipping) — between waiting and done.
  progress: 'bg-violet-50 text-violet-700',
}

/**
 * Status pill. Tones carry state only (done, waiting, failed); labels that merely tell
 * things apart — grade, channel, bait type — use `outline` so they don't read as a status.
 */
export default function Badge({ tone = 'neutral', outline = false, children, className = '' }: {
  tone?: BadgeTone
  outline?: boolean
  children: ReactNode
  className?: string
}) {
  const look = outline ? 'border border-slate-300 bg-white text-slate-700' : tones[tone]
  return (
    <span className={`inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded-full px-2 text-[11px] font-bold leading-none ${look} ${className}`}>
      {children}
    </span>
  )
}
