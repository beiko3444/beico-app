// Pure class-name helpers for form controls — one look for every admin form.
import { twMerge } from 'tailwind-merge'

const base =
  'h-10 w-full rounded-lg border border-[var(--input-border)] bg-white px-3 text-[13px] font-normal text-slate-900 ' +
  'placeholder:font-normal placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-400 ' +
  'focus:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/15'

/** Text, number and date inputs. Read-only values are plain text, not a grey input. */
export function fieldClass(extra = '') {
  return twMerge(base, extra)
}

/** Selects: the "choose…" prompt and empty date fields stay grey until a value is picked. */
export function selectClass(hasValue: boolean, extra = '') {
  return twMerge(base, 'pr-8 [&_option]:text-slate-900', hasValue ? '' : 'text-slate-400', extra)
}

export const labelClass = 'mb-1.5 block text-[12px] font-bold text-slate-700'
