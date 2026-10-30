'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Lock } from 'lucide-react'

export type TabItem<K extends string = string> = {
  key: K
  label: string
  count?: number | null
  /** Locked tabs stay visible but can't be selected; `reason` is shown as the tooltip. */
  disabled?: boolean
  reason?: string
}

type TabsProps<K extends string> = {
  items: TabItem<K>[]
  value: K
  onChange: (key: K) => void
  className?: string
  'aria-label'?: string
}

// Fades the edge(s) that have more tabs behind them, so a cut-off row reads as scrollable.
const FADE = {
  none: '',
  right: '[mask-image:linear-gradient(to_right,#000_calc(100%-28px),transparent)]',
  left: '[mask-image:linear-gradient(to_left,#000_calc(100%-28px),transparent)]',
  both: '[mask-image:linear-gradient(to_right,transparent,#000_28px,#000_calc(100%-28px),transparent)]',
} as const

/**
 * Segmented tabs — the one tab/segment style used across the admin console. Orange stays reserved for the primary button.
 * On phones the row scrolls sideways instead of wrapping onto ragged extra rows; a faded edge shows there is more.
 * Empty tabs (count 0) stay clickable and only dim their count; locked tabs show a lock and can't be selected.
 */
export default function Tabs<K extends string>({ items, value, onChange, className = '', ...rest }: TabsProps<K>) {
  const listRef = useRef<HTMLDivElement>(null)
  const [fade, setFade] = useState<keyof typeof FADE>('none')

  const syncFade = useCallback(() => {
    const list = listRef.current
    if (!list || list.scrollWidth <= list.clientWidth + 1) { setFade('none'); return }
    const left = list.scrollLeft > 1
    const right = list.scrollLeft + list.clientWidth < list.scrollWidth - 1
    setFade(left && right ? 'both' : left ? 'left' : right ? 'right' : 'none')
  }, [])

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    syncFade()
    const observer = new ResizeObserver(syncFade)
    observer.observe(list)
    return () => observer.disconnect()
  }, [syncFade, items.length])

  // When the row scrolls sideways, keep the selected tab in view (e.g. a filter opened from a link).
  useEffect(() => {
    const list = listRef.current
    const active = list?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!list || !active || list.scrollWidth <= list.clientWidth) return
    const listRect = list.getBoundingClientRect()
    const activeRect = active.getBoundingClientRect()
    list.scrollLeft += activeRect.left - listRect.left - (listRect.width - activeRect.width) / 2
    syncFade()
  }, [value, syncFade])

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={rest['aria-label']}
      onScroll={syncFade}
      className={`inline-flex max-w-full snap-x flex-nowrap items-center gap-1 overflow-x-auto rounded-[10px] bg-[#f1f3f6] p-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:[mask-image:none] [&::-webkit-scrollbar]:hidden ${FADE[fade]} ${className}`}
    >
      {items.map((item) => {
        const active = item.key === value
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            aria-disabled={item.disabled || undefined}
            title={item.disabled ? item.reason : undefined}
            onClick={() => { if (!item.disabled) onChange(item.key) }}
            className={`inline-flex h-8 shrink-0 snap-start items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[13px] transition-colors ${
              active
                ? 'bg-white font-extrabold text-slate-900 shadow-[0_1px_2px_rgba(16,24,40,0.12)]'
                : item.disabled
                  ? 'cursor-not-allowed font-semibold text-slate-300'
                  : 'font-semibold text-slate-600 hover:bg-white/60 hover:text-slate-900'
            }`}
          >
            {item.disabled ? <Lock size={12} aria-hidden="true" /> : null}
            {item.label}
            {item.count !== undefined && item.count !== null ? (
              <span className={`text-[11px] font-bold tabular-nums ${active ? 'text-slate-600' : item.count === 0 ? 'text-slate-300' : 'text-slate-400'}`}>
                {item.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
