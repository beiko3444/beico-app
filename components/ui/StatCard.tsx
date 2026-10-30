import type { ReactNode } from 'react'

/**
 * The one KPI card: label, value with a smaller unit, optional caption and icon (top left).
 * Use `value="—"` when the number is unknown (e.g. a failed fetch), never 0.
 */
export default function StatCard({ label, value, unit, caption, icon, className = '' }: {
  label: string
  value: ReactNode
  unit?: string
  caption?: ReactNode
  icon?: ReactNode
  className?: string
}) {
  return (
    <div className={`ux-panel flex min-w-0 flex-col gap-1 p-4 ${className}`}>
      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-500">
        {icon ? <span className="text-slate-400 [&>svg]:h-3.5 [&>svg]:w-3.5" aria-hidden="true">{icon}</span> : null}
        <span className="truncate">{label}</span>
      </div>
      <div className="flex items-baseline gap-0.5 text-[24px] font-extrabold leading-tight tabular-nums text-slate-900">
        {value}
        {unit ? <span className="text-[14px] font-semibold text-slate-500">{unit}</span> : null}
      </div>
      {caption ? <div className="truncate text-[12px] text-slate-500">{caption}</div> : null}
    </div>
  )
}
