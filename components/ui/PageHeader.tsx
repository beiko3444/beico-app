import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { formatCount } from '@/lib/format'

type PageHeaderProps = {
  title: string
  description?: ReactNode
  /** A plain number; the header formats it and adds no unit. */
  count?: number | null
  /** Put `data-primary` on the primary action: on phones it moves to the first row at full width. */
  actions?: ReactNode
  /** Only for sub-pages (e.g. 파트너 공지 under 파트너 관리); shown as a small link above the title. */
  backHref?: string
  backLabel?: string
  className?: string
}

/**
 * One header pattern for every admin page: title (+count) and one-line description on the left,
 * actions on the right with the primary one last. The title always starts on the page's left edge.
 */
export default function PageHeader({ title, description, count, actions, backHref, backLabel = '뒤로', className = '' }: PageHeaderProps) {
  return (
    <div className={`mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between ${className}`}>
      <div className="min-w-0 lg:min-w-[240px] lg:flex-1">
        {backHref ? (
          <Link
            href={backHref}
            className="mb-1 inline-flex items-center gap-1 text-[12px] font-bold text-slate-500 no-underline transition-colors hover:text-slate-900"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            {backLabel}
          </Link>
        ) : null}
        <h1 className="flex items-center gap-2 text-[22px] font-extrabold leading-tight text-slate-900">
          <span className="truncate">{title}</span>
          {typeof count === 'number' ? (
            <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-white px-2 text-[11px] font-bold tabular-nums text-slate-600 ring-1 ring-slate-200">
              {formatCount(count)}
            </span>
          ) : null}
        </h1>
        {description ? <p className="mt-1 max-w-[70ch] break-keep text-[13px] text-slate-500 [text-wrap:pretty]">{description}</p> : null}
      </div>
      {actions ? (
        <div className="flex max-w-full flex-wrap items-center gap-2 max-sm:[&>*]:flex-1 max-sm:[&>[data-primary]]:order-first max-sm:[&>[data-primary]]:basis-full lg:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  )
}
