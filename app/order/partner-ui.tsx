import type { ReactNode } from 'react'
import { ImageOff } from 'lucide-react'

const COUNTRY_LABELS: Record<string, string> = {
    Korea: '🇰🇷 대한민국',
    Japan: '🇯🇵 日本',
    USA: '🇺🇸 米国',
    China: '🇨🇳 中国',
    Turkey: '🇹🇷 Türkiye',
    Indonesia: '🇮🇩 Indonesia',
}

// buttonClass colours are fixed light-theme values; the partner and sign-in screens follow the dark theme too,
// so these `extra` overrides swap them for the theme tokens (tailwind-merge drops the fixed ones).
export const themedSecondary = 'border-[var(--border-strong)] bg-[var(--card)] text-[var(--foreground)] hover:border-[var(--muted-foreground)] hover:bg-[var(--card-hover)]'
export const themedGhost = 'text-[var(--muted-foreground)] hover:bg-[var(--card-hover)] hover:text-[var(--foreground)]'

export const partnerCountryLabel =(country?: string | null) => (country ? COUNTRY_LABELS[country] || country : '')

/** One heading for 주문 / 주문내역 / 내 정보, so the title keeps its size and left edge when switching tabs. */
export function PartnerPageHeader({ id, title, description, children }: {
    id?: string
    title: string
    description?: ReactNode
    children?: ReactNode
}) {
    return (
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
                <h1 id={id} className="text-2xl font-extrabold text-[var(--foreground)] sm:text-3xl">{title}</h1>
                {description ? <p className="mt-1 hidden break-keep text-sm text-[var(--muted-foreground)] sm:block">{description}</p> : null}
            </div>
            {children}
        </header>
    )
}

/** Product image, or an icon placeholder with a visible edge on white cards. */
export function ProductThumb({ src, alt = '', className = '' }: { src?: string | null; alt?: string; className?: string }) {
    return (
        <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--border)] ${src ? 'bg-white p-1' : 'bg-[var(--muted)] text-[var(--muted-foreground)]'} ${className}`}>
            {src ? <img src={src} alt={alt} className="max-h-full max-w-full object-contain" loading="lazy" /> : <ImageOff size={20} aria-hidden />}
        </div>
    )
}
