'use client'

export type TabItem<K extends string = string> = {
  key: K
  label: string
  count?: number | null
}

type TabsProps<K extends string> = {
  items: TabItem<K>[]
  value: K
  onChange: (key: K) => void
  className?: string
  'aria-label'?: string
}

/** Segmented tabs — the one tab/segment style used across the admin console. Orange stays reserved for the primary button. */
export default function Tabs<K extends string>({ items, value, onChange, className = '', ...rest }: TabsProps<K>) {
  return (
    <div
      role="tablist"
      aria-label={rest['aria-label']}
      className={`inline-flex max-w-full flex-wrap items-center gap-1 rounded-[10px] bg-[#f1f3f6] p-1 ${className}`}
    >
      {items.map((item) => {
        const active = item.key === value
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.key)}
            className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[13px] transition-colors ${
              active
                ? 'bg-white font-extrabold text-brand-orange shadow-[0_1px_2px_rgba(16,24,40,0.12)]'
                : 'font-semibold text-slate-600 hover:bg-white/60 hover:text-slate-900'
            }`}
          >
            {item.label}
            {item.count !== undefined && item.count !== null ? (
              <span className="text-[11px] font-bold tabular-nums text-slate-500">
                {item.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
