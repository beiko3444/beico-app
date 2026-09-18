import type { ReactNode } from 'react'

type PageHeaderProps = {
  title: string
  description?: string
  count?: number | string | null
  actions?: ReactNode
  className?: string
}

/**
 * One header pattern for every admin page: title (+count) and one-line description on the left,
 * primary action(s) on the right. No eyebrow, no back arrow, no breadcrumb — the sidebar carries location.
 */
export default function PageHeader({ title, description, count, actions, className = '' }: PageHeaderProps) {
  return (
    <div className={`mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between ${className}`}>
      <div className="min-w-0 lg:min-w-[240px] lg:flex-1">
        <h1 className="flex items-center gap-2 text-[22px] font-black leading-tight tracking-tight text-slate-900">
          <span className="truncate">{title}</span>
          {count !== undefined && count !== null ? (
            <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-slate-100 px-2 text-[11px] font-bold text-slate-600">
              {count}
            </span>
          ) : null}
        </h1>
        {description ? <p className="mt-1 text-[13px] text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex max-w-full flex-wrap items-center gap-2 lg:justify-end">{actions}</div> : null}
    </div>
  )
}
