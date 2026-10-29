// Pure class-name helper — no 'use client', so Server Components can call it too.
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md'

const base =
  'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap font-bold transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40 focus-visible:ring-offset-1 ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

const variants: Record<ButtonVariant, string> = {
  // A disabled primary turns grey so it doesn't read as a lighter primary.
  primary: 'bg-brand-orange font-extrabold text-white hover:bg-brand-orange-hover disabled:bg-slate-200 disabled:text-slate-500 disabled:opacity-100',
  secondary: 'border border-[#cfd6df] bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50',
  danger: 'border border-[#f3b7b2] bg-white text-red-700 hover:bg-red-50',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 rounded-lg px-3 text-xs',
  md: 'h-10 rounded-[10px] px-4 text-sm',
}

export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', extra = '') {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`.trim()
}
