'use client'

import { useEffect } from 'react'
import Button from '@/components/ui/Button'

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

    const handleClearCacheAndRetry = () => {
        clearWormOrderBrowserState()
        reset()
    }

    const hasDetails = Boolean(error.message || error.digest)

    return (
        <div className="px-4 py-16 text-slate-900 lg:px-8">
            <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h1 className="text-xl font-black tracking-tight">지렁이 발주 화면을 불러오지 못했습니다</h1>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                    일시적인 브라우저 상태 문제일 수 있습니다. 다시 시도해 주세요.
                </p>
                {hasDetails ? (
                    <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
                        <summary className="cursor-pointer font-bold text-slate-700">자세히</summary>
                        <div className="mt-2 space-y-1 break-all">
                            {error.message ? <p>오류 내용: {error.message}</p> : null}
                            {error.digest ? <p>오류 코드: {error.digest}</p> : null}
                        </div>
                    </details>
                ) : null}
                <div className="mt-6 flex flex-wrap gap-2">
                    <Button variant="primary" onClick={reset}>
                        다시 시도
                    </Button>
                    <Button variant="secondary" onClick={handleClearCacheAndRetry}>
                        캐시 정리 후 다시 열기
                    </Button>
                </div>
            </div>
        </div>
    )
}
