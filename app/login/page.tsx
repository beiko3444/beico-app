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
                <div className="w-72 h-48 mb-4 relative drop-shadow-sm">
                    <img
                        src="/bko.png"
                        alt="BEIKO BAIT"
                        className="w-full h-full object-contain"
                    />
                </div>

                <h1 className="text-2xl font-black text-gray-900 tracking-tight mb-2">卸売専用ポータル</h1>
                <p className="text-lg text-gray-400 font-semibold mb-3 tracking-wide">Wholesale Portal</p>
                <p className="text-[11px] font-black text-[#e34219] tracking-[0.15em] uppercase">Professional Bait Solutions</p>
            </div>

            {/* Login Form */}
            <div className="w-full max-w-[380px]">
                <form onSubmit={handleSubmit} className="flex flex-col gap-6">

                    {/* User ID Input */}
                    <div className="flex flex-col gap-2">
                        <label className="text-[13px] font-bold text-gray-700 tracking-tight ml-1">ユーザーID / User ID</label>
                        <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-gray-500 transition-colors">
                                <User size={20} />
                            </div>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full h-14 pl-12 pr-4 bg-white border border-gray-200 rounded-2xl outline-none focus:border-gray-400 shadow-sm transition-all text-base font-medium placeholder:text-gray-300"
                                placeholder="Enter ID"
                                required
                            />
                        </div>
                    </div>

                    {/* Password Input */}
                    <div className="flex flex-col gap-2">
                        <label className="text-[13px] font-bold text-gray-700 tracking-tight ml-1">パスワード / Password</label>
                        <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-gray-500 transition-colors">
                                <Lock size={20} />
                            </div>
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full h-14 pl-12 pr-14 bg-white border border-gray-200 rounded-2xl outline-none focus:border-gray-400 shadow-sm transition-all text-base font-medium placeholder:text-gray-300 tracking-wider"
                                placeholder="••••••••"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>

                    {/* Remember Me */}
                    <div className="flex items-center gap-3 cursor-pointer group px-1" onClick={() => setRememberMe(!rememberMe)}>
                        <div className={`w-6 h-6 border-2 rounded-lg flex items-center justify-center transition-all ${rememberMe ? 'bg-[#e34219] border-[#e34219]' : 'bg-white border-gray-200 group-hover:border-gray-300'}`}>
                            {rememberMe && <ArrowRight size={14} className="text-white rotate-[-45deg]" />}
                        </div>
                        <span className="text-sm font-semibold text-gray-500 tracking-tight transition-colors group-hover:text-gray-700">ログイン状態を保持 / Remember Me</span>
                    </div>

                    {error && (
                        <div className="text-red-500 text-sm font-bold bg-red-50 px-4 py-3 rounded-xl border border-red-100 animate-in fade-in slide-in-from-top-1">
                            {error}
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-14 bg-[#e34219] hover:bg-[#d03a15] text-white rounded-[20px] shadow-lg shadow-orange-100 transition-all active:scale-[0.98] flex items-center justify-center gap-3 font-black text-lg tracking-wide disabled:opacity-70"
                    >
                        {loading ? 'Processing...' : (
                            <>
                                ログイン / Login <ArrowRight size={22} strokeWidth={2.5} />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <button type="button" className="text-sm font-bold text-[#e34219] hover:underline tracking-tight opacity-90 hover:opacity-100">
                        パスワードをお忘れですか？ / Forgot Password?
                    </button>
                </div>
            </div>

            {/* New Partners Section */}
            <div className="mt-16 w-full max-w-[380px] text-center">
                <div className="border-t border-dashed border-gray-200 pt-10 mb-8 w-full"></div>

                <h3 className="text-xl font-black text-gray-900 mb-3 tracking-tight">新規パートナー様 / New Partners</h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-10 font-medium px-4">
                    Partner with BEIKO for professional-grade tackle & bait solutions.
                </p>

                <Link href="/signup" className="block w-full">
                    <button className="w-full py-4 px-6 bg-white border-2 border-gray-900 text-gray-900 rounded-2xl font-black text-base hover:bg-gray-900 hover:text-white transition-all tracking-tight shadow-sm">
                        卸売アカウントの申請 / Apply for Wholesale Account
                    </button>
                </Link>
            </div>

        </div>
    )
}
