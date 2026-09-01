'use client'

import { signOut } from 'next-auth/react'
import { LogOut } from 'lucide-react'

export default function LogoutButton({
    className,
    children,
    vertical = false
}: {
    className?: string,
    children?: React.ReactNode,
    vertical?: boolean
}) {
    return (
        <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className={`
                group inline-flex items-center justify-center transition-colors
                ${vertical ? 'min-h-10 min-w-[72px] gap-2 px-3 text-[12px] font-bold' : 'min-h-10 gap-2 px-3 text-sm font-semibold'}
                ${className || ''}
            `}
            aria-label="로그아웃"
        >
            {children || (
                <>
                    <LogOut size={18} strokeWidth={2.2} />
                    {vertical ? (
                        <span className="leading-none">ログアウト</span>
                    ) : (
                        <span>로그아웃</span>
                    )}
                </>
            )}
        </button>
    )
}
