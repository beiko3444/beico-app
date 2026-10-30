'use client'

import { twMerge } from 'tailwind-merge'

export type FilterChipItem<K extends string = string> = {
  key: K
  label: string
  count?: number | null
}

/**
 * Secondary filters inside a panel that already has a Tabs row: outline pills, the active one filled with ink.
 * Keeps "which view am I in" (Tabs) visibly above "what am I narrowing it to" (chips).
 */
export default function FilterChips<K extends string>({ items, value, onChange, className = '', ...rest }: {
  items: FilterChipItem<K>[]
  value: K
  onChange: (key: K) => void
  className?: string
  'aria-label'?: string
}) {
  return (
    <div role="group" aria-label={rest['aria-label']} className={twMerge('flex flex-wrap items-center gap-1.5', className)}>
      {items.map((item) => {
        const active = item.key === value
        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(item.key)}
            className={`inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[12px] font-bold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40 ${
              active
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'
            }`}
          >
            {item.label}
            {item.count !== undefined && item.count !== null ? (
              <span className={`text-[11px] ${active ? 'text-white/70' : item.count === 0 ? 'text-slate-300' : 'text-slate-400'}`}>{item.count}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
