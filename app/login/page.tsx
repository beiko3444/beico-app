'use client'

import { useState } from 'react'
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
            <div className="mb-6 flex flex-col items-center">
                <div className="w-24 h-24 bg-[#395c46] flex flex-col items-center justify-center text-white mb-6 shadow-sm">
                    <span className="text-lg font-bold tracking-[0.2em] leading-none mb-1">BEIKO</span>
                    <span className="text-[0.5em] tracking-[0.3em] font-light opacity-80">NATURAL</span>
                </div>

                <h1 className="text-xl font-bold text-gray-900 tracking-wide mb-1">卸売専用ポータル</h1>
                <p className="text-sm text-gray-500 font-medium mb-2 tracking-wide">Wholesale Portal</p>
                <p className="text-[10px] font-bold text-[#ea4318] tracking-[0.2em] uppercase">Professional Bait Solutions</p>
            </div>

            {/* Login Form */}
            <div className="w-full max-w-[360px]">
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">

                    {/* User ID Input */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-gray-700 tracking-wide">ユーザーID / User ID</label>
                        <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                <User size={18} strokeWidth={2.5} />
                            </div>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full h-12 pl-12 pr-4 bg-white border border-gray-200 rounded-xl outline-none focus:border-gray-400 transition-colors text-sm font-medium placeholder:text-gray-300 shadow-sm"
                                placeholder="Enter ID"
                                required
                            />
                        </div>
                    </div>

                    {/* Password Input */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-gray-700 tracking-wide">パスワード / Password</label>
                        <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors">
                                <Lock size={18} strokeWidth={2.5} />
                            </div>
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full h-12 pl-12 pr-12 bg-white border border-gray-200 rounded-xl outline-none focus:border-gray-400 transition-colors text-sm font-medium placeholder:text-gray-300 shadow-sm tracking-widest"
                                placeholder="••••••••"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    {/* Remember Me */}
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => setRememberMe(!rememberMe)}>
                        <div className={`w-5 h-5 border rounded flex items-center justify-center transition-colors ${rememberMe ? 'bg-gray-800 border-gray-800 text-white' : 'bg-white border-gray-300 text-transparent'}`}>
                            <div className={`w-2.5 h-2.5 bg-current rounded-[1px] ${rememberMe ? 'opacity-100' : 'opacity-0'}`} />
                        </div>
                        <span className="text-xs font-medium text-gray-600 tracking-tight">ログイン状態を保持 / Remember Me</span>
                    </div>

                    {error && (
                        <div className="text-red-500 text-xs font-bold bg-red-50 p-3 rounded-lg border border-red-100">
                            {error}
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-12 bg-[#e34219] hover:bg-[#d03a15] text-white rounded-xl shadow-[0_4px_14px_0_rgba(227,66,25,0.39)] transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 font-bold text-sm tracking-wide disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Processing...' : (
                            <>
                                ログイン / Login <ArrowRight size={18} strokeWidth={2.5} />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button type="button" className="text-xs font-bold text-[#e34219] hover:underline tracking-wide">
                        パスワードをお忘れですか？ / Forgot Password?
                    </button>
                </div>
            </div>

            {/* New Partners Section */}
            <div className="mt-12 w-full max-w-[360px] text-center border-t border-dashed border-gray-200 pt-8">
                <h3 className="text-lg font-bold text-gray-900 mb-1">新規パートナー様 / New Partners</h3>
                <p className="text-xs text-gray-500 leading-relaxed mb-6">
                    Partner with BEIKO for professional-grade tackle & bait solutions.
                </p>

                <Link href="/signup" className="block w-full">
                    <button className="w-full py-3 px-4 bg-transparent border-2 border-[#1f2937] text-[#1f2937] rounded-xl font-bold text-sm hover:bg-[#1f2937] hover:text-white transition-colors tracking-tight">
                        卸売アカウントの申請 / Apply for Wholesale Account
                    </button>
                </Link>
            </div>

        </div>
    )
}
