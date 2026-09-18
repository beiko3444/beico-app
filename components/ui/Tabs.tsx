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

/** Pill tabs — the one tab/segment style used across the admin console. */
export default function Tabs<K extends string>({ items, value, onChange, className = '', ...rest }: TabsProps<K>) {
  return (
    <div role="tablist" aria-label={rest['aria-label']} className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {items.map((item) => {
        const active = item.key === value
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.key)}
            className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3.5 text-[13px] font-bold transition-colors ${
              active
                ? 'border-brand-orange bg-brand-orange text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            {item.label}
            {item.count !== undefined && item.count !== null ? (
              <span
                className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-extrabold ${
                  active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
