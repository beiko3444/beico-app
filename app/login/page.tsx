'use client'

import { useEffect, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import AuthShell, { useAuthLanguage } from './AuthShell'

const messages = {
    ko: { title: '파트너 로그인', intro: '베이코 도매 주문과 거래 내역을 확인하세요.', id: '로그인 아이디', password: '비밀번호', remember: '아이디 기억', login: '로그인', busy: '로그인 중…', show: '비밀번호 표시', hide: '비밀번호 숨기기', invalid: '아이디 또는 비밀번호를 확인해 주세요.', pending: '가입 신청이 접수되어 관리자 승인 대기 중입니다. 승인 후 로그인할 수 있습니다.', error: '로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.', help: '로그인에 문제가 있나요?', contact: '관리자에게 계정 문의', newTitle: '처음 거래하시나요?', newIntro: '도매 계정을 신청하면 승인 후 주문할 수 있습니다.', signup: '도매 계정 신청' },
    ja: { title: 'パートナーログイン', intro: '卸売注文とお取引履歴をご確認いただけます。', id: 'ユーザーID', password: 'パスワード', remember: 'ユーザーIDを保存', login: 'ログイン', busy: 'ログイン中…', show: 'パスワードを表示', hide: 'パスワードを隠す', invalid: 'ユーザーIDまたはパスワードをご確認ください。', pending: '申請を受け付けました。管理者の承認後にログインできます。', error: 'ログインできませんでした。時間をおいて再度お試しください。', help: 'ログインでお困りですか？', contact: 'アカウントについて問い合わせ', newTitle: '新規パートナー様', newIntro: '卸売アカウントの申請・承認後にご注文いただけます。', signup: '卸売アカウントを申請' },
    en: { title: 'Partner sign in', intro: 'Access wholesale orders and your order history.', id: 'User ID', password: 'Password', remember: 'Remember my user ID', login: 'Sign in', busy: 'Signing in…', show: 'Show password', hide: 'Hide password', invalid: 'Check your user ID and password.', pending: 'Your application is awaiting administrator approval. You can sign in once approved.', error: 'Unable to sign in. Please try again shortly.', help: 'Need help signing in?', contact: 'Contact account support', newTitle: 'New to BEIKO?', newIntro: 'Apply for a wholesale account to place orders after approval.', signup: 'Apply for a wholesale account' },
} as const

export default function LoginPage() {
    const router = useRouter()
    const [language, setLanguage] = useAuthLanguage()
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [rememberMe, setRememberMe] = useState(false)
    const [error, setError] = useState<'invalid' | 'pending' | 'error' | null>(null)
    const [loading, setLoading] = useState(false)
    const t = messages[language]

    useEffect(() => {
        try {
            const saved = localStorage.getItem('savedUsername')
            if (saved) { setUsername(saved); setRememberMe(true) }
        } catch { /* Storage is optional. */ }
    }, [])

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault()
        if (loading) return
        setLoading(true)
        setError(null)
        try {
            const result = await signIn('credentials', { username, password, redirect: false })
            if (!result?.ok || result.error) {
                setError(result?.error?.startsWith('PENDING_APPROVAL') ? 'pending' : result?.error === 'CredentialsSignin' ? 'invalid' : 'error')
                return
            }
            try {
                if (rememberMe) localStorage.setItem('savedUsername', username)
                else localStorage.removeItem('savedUsername')
            } catch { /* Sign in still succeeds when storage is unavailable. */ }
            router.push('/')
            router.refresh()
        } catch { setError('error') }
        finally { setLoading(false) }
    }

    return <AuthShell language={language} onLanguageChange={setLanguage} title={t.title} intro={t.intro}>
        <form onSubmit={handleSubmit} className="ux-panel space-y-5 p-5 sm:p-7" aria-busy={loading}>
            <div className="space-y-2">
                <label htmlFor="username" className="text-sm font-semibold">{t.id}</label>
                <input id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={event => { setUsername(event.target.value); setError(null) }} required className="ux-input" aria-invalid={error === 'invalid'} aria-describedby={error ? 'login-error' : undefined} />
            </div>
            <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-semibold">{t.password}</label>
                <div className="relative">
                    <input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={event => { setPassword(event.target.value); setError(null) }} required className="ux-input pr-14" aria-invalid={error === 'invalid'} aria-describedby={error ? 'login-error' : undefined} />
                    <button type="button" aria-label={showPassword ? t.hide : t.show} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)} className="absolute right-0 top-0 flex h-full min-h-11 w-12 items-center justify-center rounded-r-lg text-[var(--muted-foreground)]">
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                </div>
            </div>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-[var(--muted-foreground)]">
                <input type="checkbox" checked={rememberMe} onChange={event => setRememberMe(event.target.checked)} className="h-5 w-5 accent-brand-orange" />{t.remember}
            </label>
            {error && <p id="login-error" role="alert" className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">{t[error]}</p>}
            <button type="submit" disabled={loading} className="ux-button-primary min-h-12 w-full text-[15px] disabled:opacity-60">{loading ? t.busy : t.login}<ArrowRight size={18} /></button>
            <div className="border-t border-[var(--border)] pt-4 text-center text-sm">
                <p className="text-[var(--muted-foreground)]">{t.help}</p>
                <a href="mailto:contact@beiko.co.kr?subject=BEIKO%20account%20support" className="inline-flex min-h-11 items-center font-semibold">{t.contact}</a>
            </div>
        </form>
        <section className="mt-6 text-center">
            <h2 className="text-base font-bold">{t.newTitle}</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">{t.newIntro}</p>
            <Link href="/signup" className="ux-button mt-4 min-h-12 w-full text-[15px]">{t.signup}</Link>
        </section>
    </AuthShell>
}
