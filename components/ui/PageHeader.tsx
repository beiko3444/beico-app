import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

type PageHeaderProps = {
  title: string
  description?: ReactNode
  count?: number | string | null
  actions?: ReactNode
  /** Only for sub-pages (e.g. 파트너 공지 under 파트너관리); top-level pages have no back arrow. */
  backHref?: string
  backLabel?: string
  className?: string
}

/**
 * One header pattern for every admin page: title (+count) and one-line description on the left,
 * actions on the right with the primary one last. No eyebrow or breadcrumb — the sidebar carries location.
 */
export default function PageHeader({ title, description, count, actions, backHref, backLabel = '뒤로', className = '' }: PageHeaderProps) {
  return (
    <div className={`mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between ${className}`}>
      <div className="flex min-w-0 items-start gap-2 lg:min-w-[240px] lg:flex-1">
        {backHref ? (
          <Link
            href={backHref}
            aria-label={backLabel}
            title={backLabel}
            className="-ml-1 mt-[-2px] inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <ArrowLeft size={18} />
          </Link>
        ) : null}
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-[22px] font-black leading-tight text-slate-900">
            <span className="truncate">{title}</span>
            {count !== undefined && count !== null ? (
              <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-white px-2 text-[11px] font-bold tabular-nums text-slate-600 ring-1 ring-slate-200">
                {count}
              </span>
            ) : null}
          </h1>
          {description ? <p className="mt-1 max-w-[70ch] break-keep text-[13px] text-slate-500">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex max-w-full flex-wrap items-center gap-2 lg:justify-end">{actions}</div> : null}
    </div>
  )
}
