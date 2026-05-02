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
        <div className="min-h-screen bg-[#f9f9f9] dark:bg-[#111111] flex flex-col items-center justify-center p-4 font-sans text-[#333] dark:text-gray-200 relative">
            {/* Theme toggle */}
            <div className="absolute top-6 right-6">
                <ThemeToggle className="bg-gray-100 dark:bg-[#2a2a2a] hover:bg-gray-200 dark:hover:bg-[#333]" />
            </div>
            {/* Real-time Japanese Clock */}
            <div className="absolute top-8 text-[11px] font-bold text-gray-800 dark:text-gray-400 tracking-widest" suppressHydrationWarning>
                {time ? formatJapaneseDate(time) : ''}
            </div>

            {/* Logo Section */}
            <div className="mb-5 flex flex-col items-center">
                <div className="w-[110px] h-auto mb-4 relative">
                    <img
                        src="/logo.png"
                        alt="BEIKO BAIT"
                        className="w-full h-full object-contain"
                    />
                </div>

                <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 tracking-tight mb-1">卸売専用ポータル</h1>
                <div className="flex flex-col items-center gap-1.5">
                    <p className="text-[9px] font-bold tracking-[0.4em] uppercase text-gray-400 leading-none">
                        Wholesale Portal
                    </p>
                    <p className="text-[9px] font-bold tracking-[0.4em] uppercase text-[#e34219] leading-none">
                        For retailers & distributors
                    </p>
                </div>
            </div>

            {/* Login Form */}
            <div className="w-full max-w-[360px]">
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">

                    {/* User ID Input */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[12px] font-semibold text-[#1e293b] dark:text-gray-300 tracking-tight ml-1">ユーザーID / User ID</label>
                        <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                                <User size={18} className="stroke-[1.5]" />
                            </div>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full h-12 pl-12 pr-4 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#333] rounded-lg outline-none focus:border-gray-300 dark:focus:border-[#555] shadow-sm transition-all text-[14px] font-medium placeholder:text-gray-300 dark:placeholder:text-gray-600 dark:text-white"
                                placeholder="Enter ID"
                                required
                            />
                        </div>
                    </div>

                    {/* Password Input */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[12px] font-semibold text-[#1e293b] dark:text-gray-300 tracking-tight ml-1">パスワード / Password</label>
                        <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                                <Lock size={18} className="stroke-[1.5]" />
                            </div>
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full h-12 pl-12 pr-12 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#333] rounded-lg outline-none focus:border-gray-300 dark:focus:border-[#555] shadow-sm transition-all text-[14px] font-medium placeholder:text-gray-300 dark:placeholder:text-gray-600 dark:text-white tracking-wider"
                                placeholder="••••••••"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                {showPassword ? <EyeOff size={18} className="stroke-[1.5]" /> : <Eye size={18} className="stroke-[1.5]" />}
                            </button>
                        </div>
                    </div>

                    {/* Remember Me */}
                    <div className="flex items-center gap-2 cursor-pointer group px-1 mt-0.5" onClick={() => setRememberMe(!rememberMe)}>
                        <div className={`w-4 h-4 border rounded flex items-center justify-center transition-all ${rememberMe ? 'bg-white dark:bg-[#1e1e1e] border-gray-300 dark:border-[#555]' : 'bg-white dark:bg-[#1e1e1e] border-gray-200 dark:border-[#333] group-hover:border-gray-300'}`}>
                            {rememberMe && <ArrowRight size={10} className="text-[#333] rotate-[-45deg]" strokeWidth={2.5} />}
                        </div>
                        <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 tracking-tight transition-colors group-hover:text-gray-800 dark:group-hover:text-gray-200">ログイン状態を保持 / Remember Me</span>
                    </div>

                    {error && (
                        <div className="text-red-500 dark:text-red-400 text-xs bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-lg border border-red-100 dark:border-red-800 flex flex-col items-center justify-center">
                            {typeof error === 'string' ? <span className="font-bold">{error}</span> : error}
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-12 mt-1 bg-[#e34219] hover:bg-[#d03a15] text-white rounded-lg shadow-[0_4px_14px_0_rgba(227,66,25,0.12)] hover:shadow-[0_6px_20px_0_rgba(227,66,25,0.18)] transition-all active:scale-[0.98] flex items-center justify-center gap-2 font-bold text-[15px] tracking-wide disabled:opacity-70"
                    >
                        {loading ? 'Processing...' : (
                            <>
                                ログイン / Login <ArrowRight size={18} strokeWidth={2.5} />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-3 text-center">
                    <button type="button" className="text-[13px] font-bold text-[#e34219] hover:underline tracking-tight">
                        パスワードをお忘れですか？ / Forgot Password?
                    </button>
                </div>
            </div>

            {/* New Partners Section */}
            <div className="mt-4 w-full max-w-[360px] text-center">
                <div className="border-t border-gray-200 dark:border-[#333] pt-2 mb-1 w-full"></div>

                <h3 className="text-[19px] font-black text-[#111827] dark:text-white mb-1 tracking-tight">新規パートナー様 / New Partners</h3>
                <p className="text-[10.5px] text-gray-400 leading-normal mb-4 font-medium px-6">
                    Partner with BEIKO for professional-grade tackle & bait solutions.
                </p>

                <Link href="/signup" className="block w-full">
                    <button className="w-full h-12 bg-[#111827] dark:bg-white border-2 border-[#111827] dark:border-white text-white dark:text-[#111827] rounded-lg font-bold text-[14px] hover:bg-white hover:text-[#111827] dark:hover:bg-[#111827] dark:hover:text-white transition-all tracking-tight shadow-sm leading-normal">
                        卸売アカウントの申請 / Apply for Wholesale Account
                    </button>
                </Link>
            </div>

        </div>
    )
}
