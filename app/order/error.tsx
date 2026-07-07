'use client'

import { useEffect } from 'react'
import { signOut } from 'next-auth/react'
import { AlertTriangle, Home, LogOut, RotateCcw } from 'lucide-react'

export default function OrderError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error('[order-error-boundary]', error)
    }, [error])

    return (
        <div className="min-h-screen bg-[#f6f8fb] px-5 py-16 flex items-center justify-center">
            <div className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#fff2ee] text-[#e34219]">
                    <AlertTriangle size={24} strokeWidth={2.5} />
                </div>
                <p className="mb-2 text-xs font-black uppercase tracking-[0.28em] text-[#e34219]">
                    Partner Screen Error
                </p>
                <h1 className="mb-3 text-2xl font-black tracking-tight text-[#111827]">
                    파트너 화면을 다시 불러와야 합니다
                </h1>
                <p className="mb-7 text-sm leading-6 text-gray-600">
                    화면 오류가 감지됐습니다. 오류 내용은 서버 로그에 기록되므로 흰 화면으로 멈추지 않고 바로 복구할 수 있습니다.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                        type="button"
                        onClick={reset}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#e34219] px-4 text-sm font-bold text-white hover:bg-[#d03a15]"
                    >
                        <RotateCcw size={16} />
                        다시 시도
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            window.location.href = '/order'
                        }}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-800 hover:bg-gray-50"
                    >
                        <Home size={16} />
                        주문 화면
                    </button>
                    <button
                        type="button"
                        onClick={() => signOut({ callbackUrl: '/login' })}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-800 hover:bg-gray-50"
                    >
                        <LogOut size={16} />
                        로그아웃
                    </button>
                </div>
                {error?.digest && (
                    <p className="mt-5 text-xs text-gray-400">Error digest: {error.digest}</p>
                )}
            </div>
        </div>
    )
}
