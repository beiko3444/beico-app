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
                    setError('관리자 승인 대기 중입니다. (Approval Pending)')
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
        <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] relative overflow-hidden font-sans">
            {/* Background Accent - Red bar at the top half */}
            <div className="absolute top-0 left-0 w-full h-[50vh] bg-[#d9361b] z-0">
                <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
            </div>

            <div className="w-full max-w-[440px] px-6 z-10 animate-in fade-in zoom-in duration-500">
                <div className="bg-white rounded-[2.5rem] shadow-[0_30px_60px_rgba(0,0,0,0.12)] overflow-hidden border border-white/20">
                    {/* Brand Header Section with White Logo */}
                    <div className="bg-[#d9361b] pt-14 pb-12 px-8 flex flex-col items-center relative overflow-hidden">
                        {/* Decorative subtle highlights */}
                        <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                        <div className="absolute bottom-[-20%] left-[-10%] w-32 h-32 bg-black/10 rounded-full blur-2xl"></div>

                        <div className="w-48 mb-6 relative z-10 transition-transform hover:scale-105 duration-300">
                            <img
                                src="/bko_white.png"
                                alt="Beiko Brand"
                                className="w-full h-auto object-contain drop-shadow-2xl"
                            />
                        </div>
                        <div className="relative z-10 text-center">
                            <h2 className="text-white text-lg font-bold tracking-tight">Partner Access Portal</h2>
                            <p className="text-white/60 text-xs mt-1 font-medium tracking-widest uppercase">Secure Authentication</p>
                        </div>
                    </div>

                    <div className="px-10 py-12">
                        {error && (
                            <div className="bg-red-50 border-l-4 border-[#d9361b] text-[#d9361b] text-sm px-4 py-3 rounded-r-xl mb-8 animate-in slide-in-from-left-2 duration-300">
                                <p className="font-bold flex items-center gap-2 text-xs">
                                    <span>⚠️</span> {error}
                                </p>
                            </div>
                        )}

                        <form
                            onSubmit={handleSubmit}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    const target = e.target as HTMLElement;
                                    if (target.tagName === 'INPUT') {
                                        e.preventDefault();
                                        handleSubmit(e as any);
                                    }
                                }
                            }}
                            className="space-y-6"
                        >
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Account ID</label>
                                <div className="relative group">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-[#d9361b] transition-colors text-lg">
                                        👤
                                    </span>
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="w-full pl-11 pr-5 py-4.5 rounded-2xl bg-gray-50 border-2 border-transparent focus:bg-white focus:border-[#d9361b] outline-none transition-all duration-300 text-gray-800 placeholder-gray-300 shadow-sm"
                                        placeholder="아이디를 입력하세요"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Access Token</label>
                                <div className="relative group">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-[#d9361b] transition-colors text-lg">
                                        🔒
                                    </span>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-11 pr-5 py-4.5 rounded-2xl bg-gray-50 border-2 border-transparent focus:bg-white focus:border-[#d9361b] outline-none transition-all duration-300 text-gray-800 placeholder-gray-300 shadow-sm"
                                        placeholder="비밀번호를 입력하세요"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full mt-4 py-5 px-6 rounded-2xl bg-[#d9361b] text-white font-extrabold text-lg shadow-[0_12px_24px_rgba(217,54,27,0.25)] hover:shadow-[0_18px_32px_rgba(217,54,27,0.35)] hover:-translate-y-1 active:translate-y-0 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group overflow-hidden relative"
                            >
                                <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-[-20deg]"></div>
                                {loading ? (
                                    <span className="flex items-center justify-center gap-3">
                                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        인증 확인 중...
                                    </span>
                                ) : '시스템 접속하기'}
                            </button>

                            <div className="mt-6 text-center">
                                <p className="text-xs text-gray-400 mb-3">아직 계정이 없으신가요?</p>
                                <a
                                    href="/signup"
                                    className="block w-full py-4 rounded-2xl border-2 border-gray-200 text-gray-600 font-bold hover:border-[#d9361b] hover:text-[#d9361b] transition-all duration-300 text-sm"
                                >
                                    파트너 회원가입 (Register as Partner)
                                </a>
                            </div>
                        </form>
                    </div>
                </div>

                <div className="flex flex-col items-center mt-12 space-y-4">
                    <p className="text-gray-400 text-[10px] font-bold tracking-[0.3em] uppercase">
                        &copy; {new Date().getFullYear()} Beico Ecosystem &bull; All Rights Reserved
                    </p>
                    <div className="flex gap-4">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-200"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-[#d9361b] animate-pulse"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-200"></div>
                    </div>
                </div>
            </div>
        </div>
    )
}
