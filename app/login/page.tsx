'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
    const router = useRouter()
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
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
                if (result.error === 'PENDING_APPROVAL') {
                    setError('관리자 승인 대기 중입니다.')
                    alert('관리자 승인 대기 중입니다. 승인 후 로그인이 가능합니다.')
                } else {
                    setError('아이디 또는 비밀번호가 올바르지 않습니다.')
                }
            } else {
                router.push('/')
            }
        } catch (err) {
            setError('로그인 중 오류가 발생했습니다.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-end relative overflow-hidden font-sans bg-[#edeaf3]">
            {/* 3D Dashboard Background (Spline) - Full Coverage */}
            <div className="absolute inset-0 z-0">
                <iframe
                    src='https://my.spline.design/movin-EfB50Sgge6cvgQr4xwAKK2Ys/'
                    frameBorder='0'
                    width='100%'
                    height='100%'
                    className="w-full h-full scale-[1.1] pointer-events-none"
                    style={{ background: 'transparent' }}
                ></iframe>
            </div>

            {/* Login Card - Positioned Right & Small */}
            <div className="w-full max-w-[360px] mr-10 md:mr-32 lg:mr-48 z-10 animate-in fade-in slide-in-from-right-10 duration-1000">
                <div className="bg-white/60 backdrop-blur-2xl rounded-3xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.1)] border border-white/40 p-10">
                    <div className="mb-10 text-center">
                        <h2 className="text-xl font-black text-gray-900 tracking-tight">Partner Login</h2>
                    </div>

                    {error && (
                        <div className="bg-red-50/80 backdrop-blur-sm border-l-4 border-red-500 text-red-600 text-[11px] px-4 py-3 rounded-r-lg mb-6">
                            <p className="font-bold">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Account ID</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full px-5 py-3.5 rounded-xl bg-gray-50/50 border border-gray-100 focus:bg-white focus:border-red-500 outline-none transition-all duration-300 text-sm"
                                placeholder="아이디"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Access Token</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-5 py-3.5 rounded-xl bg-gray-50/50 border border-gray-100 focus:bg-white focus:border-red-500 outline-none transition-all duration-300 text-sm"
                                placeholder="비밀번호"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-4 py-4 px-6 rounded-xl bg-red-600 text-white font-black text-sm shadow-xl shadow-red-600/20 hover:bg-red-700 hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50"
                        >
                            {loading ? '인증 중...' : '시스템 접속하기'}
                        </button>

                        <div className="pt-8 mt-4 border-t border-gray-100 text-center space-y-3">
                            <p className="text-[10px] text-gray-400 font-bold">아직 계정이 없으신가요?</p>
                            <a
                                href="/signup"
                                className="inline-block text-red-600 font-black text-xs hover:underline underline-offset-4"
                            >
                                파트너 회원가입 (Register)
                            </a>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
