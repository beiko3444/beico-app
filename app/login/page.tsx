'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { User, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
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
    const [time, setTime] = useState(new Date())

    useEffect(() => {
        const timer = setInterval(() => {
            setTime(new Date())
        }, 1000)
        return () => clearInterval(timer)
    }, [])

    const formatJapaneseDate = (date: Date) => {
        const weekdays = ['日', '月', '火', '水', '木', '金', '土']
        const year = date.getFullYear()
        const month = date.getMonth() + 1
        const day = date.getDate()
        const weekday = weekdays[date.getDay()]
        const hours = String(date.getHours()).padStart(2, '0')
        const minutes = String(date.getMinutes()).padStart(2, '0')
        const seconds = String(date.getSeconds()).padStart(2, '0')
        return `${year}年${month}月${day}日(${weekday}) ${hours}:${minutes}:${seconds}`
    }

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
        <div className="min-h-screen apple-page flex flex-col items-center justify-center p-4 text-[var(--foreground)] relative overflow-hidden">
            <div className="absolute inset-0 bg-[var(--surface-parchment)]" />
            <div className="absolute inset-x-0 top-0 h-[42vh] bg-white" />
            <div className="absolute top-6 right-6 z-10">
                <ThemeToggle className="bg-white/90 hover:bg-white border border-[var(--hairline)] rounded-full" />
            </div>
            <div className="absolute top-8 text-[11px] font-medium text-[#6e6e73] tracking-[0.08em] z-10" suppressHydrationWarning>
                {time ? formatJapaneseDate(time) : ''}
            </div>

            <div className="relative z-10 w-full max-w-[980px] grid lg:grid-cols-[1.2fr_420px] gap-8 items-center">
                <div className="px-2 lg:px-0 text-center lg:text-left">
                    <p className="text-[12px] tracking-[0.18em] uppercase text-[#6e6e73] mb-4">BEIKO BAIT WHOLESALE PORTAL</p>
                    <h1 className="apple-hero-title mb-4">도구보다 먼저 제품이 보이는 관리 화면.</h1>
                    <p className="apple-lead max-w-[620px] mx-auto lg:mx-0">
                        파트너, 주문, 송금, 발주 흐름을 Apple식의 차분한 캔버스 위에 정리했습니다.
                        과한 장식 대신 읽기 쉬운 타이포와 명확한 행동만 남겼습니다.
                    </p>
                </div>

                <div className="apple-panel w-full max-w-[420px] mx-auto p-8 md:p-10">
                <div className="mb-6 flex flex-col items-center">
                    <div className="w-[110px] h-auto mb-4 relative">
                        <img
                            src="/logo.png"
                            alt="BEIKO BAIT"
                            className="w-full h-full object-contain"
                        />
                    </div>

                    <h1 className="text-[32px] font-semibold text-[var(--foreground)] tracking-[-0.03em] mb-1">卸売専用ポータル</h1>
                    <div className="flex flex-col items-center gap-1.5">
                        <p className="text-[10px] font-medium tracking-[0.32em] uppercase text-[#6e6e73] leading-none">
                            Wholesale Portal
                        </p>
                        <p className="text-[10px] font-medium tracking-[0.32em] uppercase text-[var(--primary)] leading-none">
                            For retailers & distributors
                        </p>
                    </div>
                </div>

                <div className="w-full">
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">

                    {/* User ID Input */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[12px] font-medium text-[#6e6e73] tracking-tight ml-1">ユーザーID / User ID</label>
                        <div className="relative group">
                            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-[#8d8d92]">
                                <User size={18} className="stroke-[1.5]" />
                            </div>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="apple-input w-full pl-12 pr-4 text-[15px] font-normal placeholder:text-[#b3b3b8]"
                                placeholder="Enter ID"
                                required
                            />
                        </div>
                    </div>

                    {/* Password Input */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[12px] font-medium text-[#6e6e73] tracking-tight ml-1">パスワード / Password</label>
                        <div className="relative group">
                            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-[#8d8d92]">
                                <Lock size={18} className="stroke-[1.5]" />
                            </div>
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="apple-input w-full pl-12 pr-12 text-[15px] font-normal placeholder:text-[#b3b3b8] tracking-wider"
                                placeholder="••••••••"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-5 top-1/2 -translate-y-1/2 text-[#8d8d92] hover:text-[var(--foreground)] transition-colors"
                            >
                                {showPassword ? <EyeOff size={18} className="stroke-[1.5]" /> : <Eye size={18} className="stroke-[1.5]" />}
                            </button>
                        </div>
                    </div>

                    {/* Remember Me */}
                    <div className="flex items-center gap-2 cursor-pointer group px-1 mt-0.5" onClick={() => setRememberMe(!rememberMe)}>
                        <div className={`w-4 h-4 border rounded flex items-center justify-center transition-all ${rememberMe ? 'bg-white border-[#6e6e73]' : 'bg-white border-[var(--hairline)] group-hover:border-[#8d8d92]'}`}>
                            {rememberMe && <ArrowRight size={10} className="text-[var(--foreground)] rotate-[-45deg]" strokeWidth={2.5} />}
                        </div>
                        <span className="text-[11px] font-normal text-[#6e6e73] tracking-tight transition-colors group-hover:text-[var(--foreground)]">ログイン状態を保持 / Remember Me</span>
                    </div>

                    {error && (
                        <div className="text-red-500 text-xs bg-red-50 px-4 py-3 rounded-[11px] border border-red-100 flex flex-col items-center justify-center">
                            {typeof error === 'string' ? <span className="font-bold">{error}</span> : error}
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="apple-button w-full mt-1 active:scale-[0.99] disabled:opacity-70"
                    >
                        {loading ? 'Processing...' : (
                            <>
                                ログイン / Login <ArrowRight size={18} strokeWidth={2.5} />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-3 text-center">
                    <button type="button" className="text-[13px] font-medium text-[var(--primary)] hover:underline tracking-tight">
                        パスワードをお忘れですか？ / Forgot Password?
                    </button>
                </div>
                </div>

                <div className="mt-6 w-full text-center">
                    <div className="border-t border-[var(--hairline)] pt-4 mb-1 w-full"></div>

                    <h3 className="text-[24px] font-semibold text-[var(--foreground)] mb-1 tracking-[-0.03em]">新規パートナー様 / New Partners</h3>
                    <p className="text-[11px] text-[#6e6e73] leading-normal mb-4 font-normal px-6">
                        Partner with BEIKO for professional-grade tackle & bait solutions.
                    </p>

                    <Link href="/signup" className="block w-full">
                        <button className="w-full h-12 bg-[var(--foreground)] border border-[var(--foreground)] text-white rounded-full font-medium text-[14px] hover:bg-black transition-all tracking-tight leading-normal">
                            卸売アカウントの申請 / Apply for Wholesale Account
                        </button>
                    </Link>
                </div>
                </div>
            </div>
        </div>
    )
}
