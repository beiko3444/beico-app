'use client'

import { useEffect } from 'react'
import { signOut } from 'next-auth/react'
import { AlertTriangle, Home, LogOut, RotateCcw } from 'lucide-react'
import { buttonClass } from '@/components/ui/buttonClass'
import { themedSecondary } from './partner-ui'

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
        <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-5 py-16">
            <div className="w-full max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-sm">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--danger-soft)] text-[var(--danger)]">
                    <AlertTriangle size={24} strokeWidth={2.5} aria-hidden />
                </div>
                <h1 className="mb-3 text-2xl font-extrabold text-[var(--foreground)]">
                    파트너 화면을 다시 불러와야 합니다
                </h1>
                <p className="mb-7 break-keep text-sm leading-6 text-[var(--muted-foreground)]">
                    화면 오류가 감지됐습니다. 오류 내용은 서버 로그에 기록되므로 흰 화면으로 멈추지 않고 바로 복구할 수 있습니다.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <button type="button" onClick={reset} className={buttonClass('primary', 'md')}>
                        <RotateCcw size={16} aria-hidden />
                        다시 시도
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            window.location.href = '/order'
                        }}
                        className={buttonClass('secondary', 'md', themedSecondary)}
                    >
                        <Home size={16} aria-hidden />
                        주문 화면
                    </button>
                    <button
                        type="button"
                        onClick={() => signOut({ callbackUrl: '/login' })}
                        className={buttonClass('secondary', 'md', themedSecondary)}
                    >
                        <LogOut size={16} aria-hidden />
                        로그아웃
                    </button>
                </div>
                {error?.digest && (
                    <p className="mt-5 text-xs text-[var(--muted-foreground)]">Error digest: {error.digest}</p>
                )}
            </div>
        </div>
    )
}
