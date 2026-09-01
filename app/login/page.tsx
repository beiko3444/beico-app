'use client'

import Image from 'next/image'
import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { User, Lock, Eye, EyeOff, ArrowRight, Check } from 'lucide-react'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'

export default function LoginPage() {
    const router = useRouter()
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [rememberMe, setRememberMe] = useState(false)
    const [error, setError] = useState<React.ReactNode>('')
    const [loading, setLoading] = useState(false)
    useEffect(() => {
        const savedUsername = localStorage.getItem('savedUsername')
        if (savedUsername) {
            setUsername(savedUsername)
            setRememberMe(true)
        }
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            const result = await signIn('credentials', {
                username,
                password,
                redirect: false,
            })

            if (result?.error) {
                if (result.error === 'CredentialsSignin') {
                    setError('ユーザーIDまたはパスワードが正しくありません。 / Invalid ID or Password')
                } else if (result.error.startsWith('PENDING_APPROVAL')) {
                    setError(
                        <div className="flex flex-col gap-1.5 mt-0.5 text-center px-1">
                            <span className="font-bold text-[13px] text-[#e34219] tracking-tight">
                                アカウントの承認待ちです。承認されるまでお待ちください。
                            </span>
                            <span className="text-[10px] font-normal text-[#e34219] tracking-tight leading-snug">
                                Account is pending admin approval. Please wait for authorization.
                            </span>
                            <span className="text-[10px] font-normal text-[#e34219] tracking-tight leading-snug">
                                관리자 승인 대기중입니다. 승인 후 이용해 주세요.
                            </span>
                        </div>
                    );
                } else {
                    setError('ログインに失敗しました。 / Login failed. Please try again.')
                }
            } else {
                if (rememberMe) {
                    localStorage.setItem('savedUsername', username)
                } else {
                    localStorage.removeItem('savedUsername')
                }
                router.push('/')
            }
        } catch (err) {
            setError('ログイン中にエラーが発生しました。 / An error occurred during login.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <main className="relative flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-10 text-[var(--foreground)] sm:px-6">
            <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
                <ThemeToggle />
            </div>

            <section className="w-full max-w-[440px]" aria-labelledby="login-heading">
                <div className="mb-6 flex flex-col items-center text-center">
                    <div className="mb-3 flex justify-center">
                    <Image
                        src="/logo.png"
                        alt="beiko"
                        width={150}
                        height={105}
                        priority
                        className="h-auto w-[128px]"
                    />
                    </div>
                    <h1 id="login-heading" className="text-2xl font-black text-[var(--foreground)]">卸売専用ポータル</h1>
                    <p className="mt-1 text-sm font-semibold text-[var(--muted-foreground)]">Retailer &amp; distributor portal</p>
                </div>

                <div className="ux-panel p-5 sm:p-7">
                    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                    <div className="flex flex-col gap-2">
                        <label htmlFor="username" className="text-sm font-bold text-[var(--foreground)]">ユーザーID / User ID</label>
                        <div className="relative">
                            <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]">
                                <User size={18} className="stroke-[1.5]" />
                            </div>
                            <input
                                id="username"
                                type="text"
                                name="username"
                                autoComplete="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="ux-input h-12 w-full pl-12 pr-4"
                                placeholder="Enter ID"
                                required
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label htmlFor="password" className="text-sm font-bold text-[var(--foreground)]">パスワード / Password</label>
                        <div className="relative">
                            <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]">
                                <Lock size={18} className="stroke-[1.5]" />
                            </div>
                            <input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                name="password"
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="ux-input h-12 w-full pl-12 pr-12"
                                placeholder="••••••••"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-[var(--muted-foreground)] hover:bg-[var(--card-hover)] hover:text-[var(--foreground)]"
                                aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
                                aria-pressed={showPassword}
                            >
                                {showPassword ? <EyeOff size={18} className="stroke-[1.5]" /> : <Eye size={18} className="stroke-[1.5]" />}
                            </button>
                        </div>
                    </div>

                    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-[var(--muted-foreground)]">
                        <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                            <input
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(event) => setRememberMe(event.target.checked)}
                                className="peer h-5 w-5 appearance-none rounded border border-[var(--border-strong)] bg-[var(--card)] checked:border-[var(--primary)] checked:bg-[var(--primary)]"
                            />
                            <Check size={14} strokeWidth={3} className="pointer-events-none absolute text-white opacity-0 peer-checked:opacity-100" />
                        </span>
                        ログイン状態を保持 / Remember me
                    </label>

                    {error && (
                        <div role="alert" aria-live="polite" className="flex flex-col items-center justify-center rounded-md border border-[var(--danger-border)] bg-[var(--danger-soft)] px-4 py-3 text-center text-xs text-[var(--danger)]">
                            {typeof error === 'string' ? <span className="font-bold">{error}</span> : error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="ux-button ux-button-primary h-12 w-full text-[15px] disabled:opacity-60"
                    >
                        {loading ? 'Processing...' : (
                            <>
                                ログイン / Login <ArrowRight size={18} strokeWidth={2.5} />
                            </>
                        )}
                    </button>
                    </form>

                    <div className="mt-6 border-t border-[var(--border)] pt-5 text-center">
                        <h2 className="text-base font-extrabold text-[var(--foreground)]">新規パートナー様 / New Partners</h2>
                        <p className="mt-1 text-xs text-[var(--muted-foreground)]">卸売アカウントを申請して審査を開始します。</p>
                        <Link href="/signup" className="ux-button mt-4 h-12 w-full border border-[var(--border-strong)] bg-[var(--card)] text-[var(--foreground)] no-underline hover:bg-[var(--card-hover)]">
                            卸売アカウントの申請 / Apply
                        </Link>
                    </div>
                </div>
            </section>
        </main>
    )
}
