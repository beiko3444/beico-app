// Pure class-name helper — no 'use client', so Server Components can call it too.
import { twMerge } from 'tailwind-merge'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'dangerGhost'
export type ButtonSize = 'sm' | 'md' | 'icon' | 'iconMd'

const base =
  'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap font-bold transition-colors [&>svg]:shrink-0 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40 focus-visible:ring-offset-1 ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

const variants: Record<ButtonVariant, string> = {
  // A disabled primary turns grey so it doesn't read as a lighter primary.
  primary: 'bg-brand-orange font-extrabold text-white hover:bg-brand-orange-hover disabled:bg-slate-200 disabled:text-slate-500 disabled:opacity-100',
  secondary: 'border border-[#cfd6df] bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50',
  danger: 'border border-[#f3b7b2] bg-white text-red-700 hover:bg-red-50',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100',
  // Delete/remove actions shown as a quiet icon or text button.
  dangerGhost: 'bg-transparent text-red-600 hover:bg-red-50 hover:text-red-700',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 rounded-lg px-3 text-xs',
  md: 'h-10 rounded-lg px-4 text-sm',
  // Icon-only buttons: square, no padding, so the 16px icon keeps its size.
  icon: 'h-8 w-8 rounded-lg p-0',
  iconMd: 'h-9 w-9 rounded-lg p-0',
}

// twMerge lets `extra` override the variant and size (px-0, text-red-600, rounded-full …),
// which plain string concatenation could not: the later Tailwind rule always won.
export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', extra = '') {
  return twMerge(base, variants[variant], sizes[size], extra)
}
