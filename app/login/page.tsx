'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { User, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function LoginPage() {
    const router = useRouter()
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [rememberMe, setRememberMe] = useState(false)
    const [error, setError] = useState('')
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
                    setError('Invalid ID or Password')
                } else if (result.error === 'PENDING_APPROVAL') {
                    setError('Account is pending approval.')
                } else {
                    setError('Login failed. Please try again.')
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
            setError('An error occurred during login.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-4 font-sans text-[#333]">

            {/* Logo Section */}
            <div className="mb-5 flex flex-col items-center">
                <div className="w-[110px] h-auto mb-4 relative">
                    <img
                        src="/logo.png"
                        alt="BEIKO BAIT"
                        className="w-full h-full object-contain"
                    />
                </div>

                <h1 className="text-xl font-bold text-gray-800 tracking-tight mb-1">卸売専用ポータル</h1>
                <p className="text-[10px] font-bold tracking-tight uppercase">
                    <span className="text-gray-500">Wholesale Portal</span>
                    <span className="mx-1 text-gray-300">:</span>
                    <span className="text-[#e34219]">Professional Bait Solutions</span>
                </p>
            </div>

            {/* Login Form */}
            <div className="w-full max-w-[360px]">
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">

                    {/* User ID Input */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[12px] font-semibold text-[#1e293b] tracking-tight ml-1">ユーザーID / User ID</label>
                        <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                                <User size={18} className="stroke-[1.5]" />
                            </div>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full h-12 pl-12 pr-4 bg-white border border-gray-200 rounded-lg outline-none focus:border-gray-300 shadow-sm transition-all text-[14px] font-medium placeholder:text-gray-300"
                                placeholder="Enter ID"
                                required
                            />
                        </div>
                    </div>

                    {/* Password Input */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[12px] font-semibold text-[#1e293b] tracking-tight ml-1">パスワード / Password</label>
                        <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                                <Lock size={18} className="stroke-[1.5]" />
                            </div>
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full h-12 pl-12 pr-12 bg-white border border-gray-200 rounded-lg outline-none focus:border-gray-300 shadow-sm transition-all text-[14px] font-medium placeholder:text-gray-300 tracking-wider"
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
                        <div className={`w-4 h-4 border rounded flex items-center justify-center transition-all ${rememberMe ? 'bg-white border-gray-300' : 'bg-white border-gray-200 group-hover:border-gray-300'}`}>
                            {rememberMe && <ArrowRight size={10} className="text-[#333] rotate-[-45deg]" strokeWidth={2.5} />}
                        </div>
                        <span className="text-[11px] font-medium text-gray-500 tracking-tight transition-colors group-hover:text-gray-800">ログイン状態を保持 / Remember Me</span>
                    </div>

                    {error && (
                        <div className="text-red-500 text-xs font-bold bg-red-50 px-4 py-2.5 rounded-lg border border-red-100">
                            {error}
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
                <div className="border-t border-gray-200 pt-2 mb-1 w-full"></div>

                <h3 className="text-[19px] font-black text-[#111827] mb-1 tracking-tight">新規パートナー様 / New Partners</h3>
                <p className="text-[13px] text-gray-500 leading-normal mb-4 font-medium px-4">
                    Partner with BEIKO for professional-grade tackle & bait solutions.
                </p>

                <Link href="/signup" className="block w-full">
                    <button className="w-full h-12 bg-white border-2 border-[#111827] text-[#111827] rounded-lg font-bold text-[14px] hover:bg-[#111827] hover:text-white transition-all tracking-tight shadow-sm leading-normal">
                        卸売アカウントの申請 / Apply for Wholesale Account
                    </button>
                </Link>
            </div>

        </div>
    )
}
