'use client'

import { useEffect } from 'react'

const WORM_EMAIL_CACHE_STORAGE_KEY = 'beico-worm-order-email-cache-v1'
const WORM_ORDER_AUTO_RECOVERY_KEY = 'beico-worm-order-auto-recovery-v1'

function clearWormOrderBrowserState() {
    try {
        window.localStorage.removeItem(WORM_EMAIL_CACHE_STORAGE_KEY)
    } catch {
        // Ignore storage access failures and still retry the route.
    }

    try {
        for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
            const key = window.sessionStorage.key(index)
            if (key && key !== WORM_ORDER_AUTO_RECOVERY_KEY && key.startsWith('beico-worm-order')) {
                window.sessionStorage.removeItem(key)
            }
        }
    } catch {
        // Session storage can be unavailable in restricted browser states.
    }
}

export default function WormOrderError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error('Worm order page crashed:', error)
    }, [error])

    useEffect(() => {
        try {
            if (window.sessionStorage.getItem(WORM_ORDER_AUTO_RECOVERY_KEY) === '1') return
            window.sessionStorage.setItem(WORM_ORDER_AUTO_RECOVERY_KEY, '1')
            clearWormOrderBrowserState()
            reset()
        } catch {
            // Manual buttons below remain available if automatic recovery cannot run.
        }
    }, [reset])

    const handleClearCacheAndRetry = () => {
        clearWormOrderBrowserState()
        reset()
    }

    return (
        <div className="min-h-screen bg-[#F7F7F8] px-4 py-20 text-[#111827] lg:px-8">
            <div className="mx-auto max-w-xl rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
                <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#EF3B1D]">
                    Worm Order
                </p>
                <h1 className="mt-3 text-2xl font-black tracking-[-0.03em]">
                    지렁이 발주 화면을 다시 불러와야 합니다
                </h1>
                <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
                    저장된 메일 캐시나 일시적인 브라우저 상태 때문에 화면 렌더링이 중단되었습니다.
                    캐시를 정리한 뒤 다시 시도하면 대부분 복구됩니다.
                </p>
                {error.message ? (
                    <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700">
                        오류 내용: {error.message}
                    </p>
                ) : null}
                {error.digest && (
                    <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500">
                        오류 코드: {error.digest}
                    </p>
                )}
                <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                    <button
                        type="button"
                        onClick={handleClearCacheAndRetry}
                        className="inline-flex h-11 items-center justify-center rounded-full border-none bg-[#EF3B1D] px-5 text-sm font-extrabold text-white transition hover:bg-[#D92F16]"
                    >
                        캐시 정리 후 다시 열기
                    </button>
                    <button
                        type="button"
                        onClick={reset}
                        className="inline-flex h-11 items-center justify-center rounded-full border border-[#E5E7EB] bg-white px-5 text-sm font-extrabold text-[#111827] transition hover:bg-[#F4F5F7]"
                    >
                        다시 시도
                    </button>
                </div>
            </div>
        </div>
    )
}
