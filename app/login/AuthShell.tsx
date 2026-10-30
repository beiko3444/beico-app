'use client'

import Image from 'next/image'
import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { Languages } from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import { buttonClass } from '@/components/ui/buttonClass'
import { fieldClass, selectClass } from '@/components/ui/field'
import { themedGhost, themedSecondary } from '@/app/order/partner-ui'

export type AuthLanguage = 'ko' | 'ja' | 'en'

const LANGUAGE_KEY = 'beiko-login-language'
const translatorLabel: Record<AuthLanguage, string> = { ko: '번역기 (새 탭)', ja: '翻訳ツール（新しいタブ）', en: 'Translator (new tab)' }
const languageListeners = new Set<() => void>()

// Both auth forms use the same 48px, 16px, icon-led input (16px also stops iOS zooming in on focus).
export const authInput = (extra = '') => fieldClass(`h-12 bg-[var(--input-bg)] pl-11 text-base text-[var(--foreground)] ${extra}`)
// Full-width touch CTAs on the auth screens keep 48px; colour, radius, weight and the grey disabled state come from buttonClass.
export const authPrimaryClass = buttonClass('primary', 'md', 'h-12 w-full text-[15px]')
export const authSecondaryClass = buttonClass('secondary', 'md', `h-12 w-full text-[15px] ${themedSecondary}`)

/** Saved choice, else Korean for Korean browsers, else Japanese. */
function readStoredLanguage(): AuthLanguage {
    try {
        const saved = localStorage.getItem(LANGUAGE_KEY)
        if (saved === 'ko' || saved === 'ja' || saved === 'en') return saved
        if (navigator.language.startsWith('ko')) return 'ko'
    } catch { /* Storage is optional. */ }
    return 'ja'
}

function subscribeLanguage(listener: () => void) {
    languageListeners.add(listener)
    window.addEventListener('storage', listener)
    return () => {
        languageListeners.delete(listener)
        window.removeEventListener('storage', listener)
    }
}

/** Language shared by /login and /signup. `remember: false` changes this page only (e.g. after picking a country). */
export function useAuthLanguage() {
    const stored = useSyncExternalStore(subscribeLanguage, readStoredLanguage, (): AuthLanguage => 'ja')
    const [override, setOverride] = useState<AuthLanguage | null>(null)

    const setLanguage = (next: AuthLanguage, remember = true) => {
        if (!remember) {
            setOverride(next)
            return
        }
        setOverride(null)
        try {
            localStorage.setItem(LANGUAGE_KEY, next)
        } catch {
            setOverride(next) // Storage blocked: keep the choice for this page.
        }
        languageListeners.forEach(listener => listener())
    }

    return [override ?? stored, setLanguage] as const
}

/** Label, optional hint and an icon-led input. A block label, so the 6px gap holds (space-y on an inline label collapses). */
export function AuthField({ id, label, required = false, hint, icon, after, children }: {
    id: string
    label: string
    required?: boolean
    hint?: string
    icon: ReactNode
    after?: ReactNode
    children: ReactNode
}) {
    return (
        <div className="space-y-1.5">
            <label htmlFor={id} className="block text-sm font-semibold">
                {label}
                {required ? <span aria-hidden className="ml-0.5 text-[var(--danger)]">*</span> : null}
            </label>
            {hint ? <p id={`${id}-hint`} className="text-xs text-[var(--muted-foreground)]">{hint}</p> : null}
            <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]">{icon}</span>
                {children}
            </div>
            {after}
        </div>
    )
}

/** One frame for the sign-in and sign-up screens: utilities top right, centred logo and title, same card width. */
export default function AuthShell({ language, onLanguageChange, title, intro, children }: {
    language: AuthLanguage
    onLanguageChange: (language: AuthLanguage) => void
    title: string
    intro?: string
    children: ReactNode
}) {
    const iconButton = buttonClass('ghost', 'iconMd', themedGhost)
    return <main className="flex min-h-screen flex-col bg-[var(--background)] p-4 text-[var(--foreground)] sm:p-8" lang={language}>
        <div className="mx-auto flex w-full max-w-md items-center justify-end gap-1">
            <label className="sr-only" htmlFor="auth-language">Language / 언어 / 言語</label>
            <select id="auth-language" value={language} onChange={event => onLanguageChange(event.target.value as AuthLanguage)} className={selectClass(true, 'mr-1 h-9 w-auto bg-[var(--input-bg)] text-[13px] font-semibold text-[var(--foreground)]')}>
                <option value="ko">한국어</option><option value="ja">日本語</option><option value="en">English</option>
            </select>
            <a href="/translator" target="_blank" rel="noopener noreferrer" className={iconButton} aria-label={translatorLabel[language]} title={translatorLabel[language]}>
                <Languages size={18} aria-hidden />
            </a>
            {/* ThemeToggle brings the bordered .ux-icon-button; these utilities turn it into the same ghost icon button. */}
            <ThemeToggle className={`${iconButton} min-h-0 border-transparent bg-transparent`} />
        </div>
        {/* A fixed top offset, not vertical centring, so the logo and title sit at the same height on /login and /signup. */}
        <div className="mx-auto w-full max-w-md pb-8 pt-6 sm:pt-[4vh]">
            <header className="mb-6 text-center">
                <Image src="/logo.png" alt="BEIKO BAIT" width={142} height={100} priority className="mx-auto mb-4 h-auto w-[104px]" />
                <h1 className="text-2xl font-extrabold">{title}</h1>
                {intro ? <p className="mt-2 break-keep text-sm text-[var(--muted-foreground)]">{intro}</p> : null}
            </header>
            {children}
        </div>
    </main>
}
