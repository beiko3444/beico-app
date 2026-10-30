import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'

type EmptyStateProps = {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  compact?: boolean
  /** Inside a panel or table that already has a border: no second border or tint. */
  bare?: boolean
  className?: string
}

/** One empty-state pattern: icon, one-line title, optional description, at most one action. */
export default function EmptyState({ icon, title, description, action, compact = false, bare = false, className = '' }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        bare ? '' : 'rounded-2xl border border-dashed border-slate-200 bg-slate-50/60'
      } ${compact ? 'px-4 py-8' : 'px-6 py-14'} ${className}`}
    >
      <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-300 shadow-sm">
        {icon ?? <Inbox size={20} />}
      </div>
      <p className="text-sm font-bold text-slate-800 [text-wrap:balance]">{title}</p>
      {description ? <p className="mt-1 max-w-md break-keep text-[12px] text-slate-500 [text-wrap:balance]">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
