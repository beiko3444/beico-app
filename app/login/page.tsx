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
            <div className="mb-10 flex flex-col items-center">
                <div className="w-64 h-auto mb-4 relative drop-shadow-sm">
                    <img
                        src="/logo.png"
                        alt="BEIKO BAIT"
                        className="w-full h-full object-contain"
                    />
                </div>

                <h1 className="text-2xl font-bold text-gray-800 tracking-tight mb-2">卸売専用ポータル</h1>
                <p className="text-base text-gray-500 font-medium mb-4 tracking-wide">Wholesale Portal</p>
                <p className="text-[10px] font-bold text-[#e34219] tracking-[0.2em] uppercase">Professional Bait Solutions</p>
            </div>

            {/* Login Form */}
            <div className="w-full max-w-[380px]">
                <form onSubmit={handleSubmit} className="flex flex-col gap-6">

                    {/* User ID Input */}
                    <div className="flex flex-col gap-2.5">
                        <label className="text-[13px] font-semibold text-[#1e293b] tracking-tight ml-1">ユーザーID / User ID</label>
                        <div className="relative group">
                            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400">
                                <User size={20} className="stroke-[1.5]" />
                            </div>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full h-14 pl-14 pr-4 bg-white border border-gray-200 rounded-2xl outline-none focus:border-gray-300 shadow-sm transition-all text-[15px] font-medium placeholder:text-gray-300"
                                placeholder="Enter ID"
                                required
                            />
                        </div>
                    </div>

                    {/* Password Input */}
                    <div className="flex flex-col gap-2.5">
                        <label className="text-[13px] font-semibold text-[#1e293b] tracking-tight ml-1">パスワード / Password</label>
                        <div className="relative group">
                            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400">
                                <Lock size={20} className="stroke-[1.5]" />
                            </div>
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full h-14 pl-14 pr-16 bg-white border border-gray-200 rounded-2xl outline-none focus:border-gray-300 shadow-sm transition-all text-[15px] font-medium placeholder:text-gray-300 tracking-wider"
                                placeholder="••••••••"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                {showPassword ? <EyeOff size={20} className="stroke-[1.5]" /> : <Eye size={20} className="stroke-[1.5]" />}
                            </button>
                        </div>
                    </div>

                    {/* Remember Me */}
                    <div className="flex items-center gap-3 cursor-pointer group px-2 mt-2" onClick={() => setRememberMe(!rememberMe)}>
                        <div className={`w-5 h-5 border rounded-lg flex items-center justify-center transition-all ${rememberMe ? 'bg-white border-gray-300' : 'bg-white border-gray-200 group-hover:border-gray-300'}`}>
                            {rememberMe && <ArrowRight size={12} className="text-[#333] rotate-[-45deg]" strokeWidth={2.5} />}
                        </div>
                        <span className="text-[12px] font-medium text-gray-500 tracking-tight transition-colors group-hover:text-gray-800">ログイン状態を保持 / Remember Me</span>
                    </div>

                    {error && (
                        <div className="text-red-500 text-xs font-bold bg-red-50 px-4 py-3 rounded-xl border border-red-100">
                            {error}
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-14 mt-4 bg-[#e34219] hover:bg-[#d03a15] text-white rounded-2xl shadow-lg shadow-orange-200/50 transition-all active:scale-[0.98] flex items-center justify-center gap-3 font-bold text-[16px] tracking-wide disabled:opacity-70"
                    >
                        {loading ? 'Processing...' : (
                            <>
                                ログイン / Login <ArrowRight size={20} strokeWidth={2.5} />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-10 text-center">
                    <button type="button" className="text-[12px] font-semibold text-[#e34219] hover:underline tracking-tight">
                        パスワードをお忘れですか？ / Forgot Password?
                    </button>
                </div>
            </div>

            {/* New Partners Section */}
            <div className="mt-16 w-full max-w-[380px] text-center">
                <div className="border-t border-gray-100 pt-8 mb-6 w-full"></div>

                <h3 className="text-lg font-bold text-gray-900 mb-2 tracking-tight">新規パートナー様 / New Partners</h3>
                <p className="text-xs text-gray-500 leading-relaxed mb-8 font-medium px-4">
                    Partner with BEIKO for professional-grade tackle & bait solutions.
                </p>

                <Link href="/signup" className="block w-full">
                    <button className="w-full py-4 px-6 bg-white border border-[#111827] text-[#111827] rounded-2xl font-bold text-[13px] hover:bg-[#111827] hover:text-white transition-all tracking-tight shadow-sm leading-normal">
                        卸売アカウントの申請 / Apply for Wholesale<br />Account
                    </button>
                </Link>
            </div>

        </div>
    )
}
