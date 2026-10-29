'use client'

import Image from 'next/image'
import { useState, useSyncExternalStore, type ReactNode } from 'react'
import ThemeToggle from '@/components/ThemeToggle'

export type AuthLanguage = 'ko' | 'ja' | 'en'

const LANGUAGE_KEY = 'beiko-login-language'
const translatorLabel: Record<AuthLanguage, string> = { ko: '번역기', ja: '翻訳', en: 'Translator' }
const languageListeners = new Set<() => void>()

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

/** One frame for the sign-in and sign-up screens: utilities top right, centred logo and title, same card width. */
export default function AuthShell({ language, onLanguageChange, title, intro, children }: {
    language: AuthLanguage
    onLanguageChange: (language: AuthLanguage) => void
    title: string
    intro?: string
    children: ReactNode
}) {
    return <main className="flex min-h-screen flex-col bg-[var(--background)] p-4 text-[var(--foreground)] sm:p-8" lang={language}>
        <div className="mx-auto flex w-full max-w-md items-center justify-end gap-2">
            <label className="sr-only" htmlFor="auth-language">Language / 언어 / 言語</label>
            <select id="auth-language" value={language} onChange={event => onLanguageChange(event.target.value as AuthLanguage)} className="ux-input w-auto">
                <option value="ko">한국어</option><option value="ja">日本語</option><option value="en">English</option>
            </select>
            <a href="/translator" target="_blank" rel="noopener noreferrer" className="ux-button shrink-0">{translatorLabel[language]}</a>
            <ThemeToggle />
        </div>
        <div className="mx-auto my-auto w-full max-w-md py-8 sm:py-12">
            <header className="mb-7 text-center">
                <Image src="/logo.png" alt="BEIKO BAIT" width={142} height={100} priority className="mx-auto mb-5 h-auto w-[120px]" />
                <h1 className="text-2xl font-bold">{title}</h1>
                {intro ? <p className="mt-2 break-keep text-sm text-[var(--muted-foreground)]">{intro}</p> : null}
            </header>
            {children}
        </div>
    </main>
}
