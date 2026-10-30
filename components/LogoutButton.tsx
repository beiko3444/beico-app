'use client'

import { signOut } from 'next-auth/react'
import { LogOut } from 'lucide-react'
import { twMerge } from 'tailwind-merge'

export default function LogoutButton({
    className,
    children,
    vertical = false,
    label = '로그아웃'
}: {
    className?: string,
    children?: React.ReactNode,
    vertical?: boolean,
    label?: string
}) {
    return (
        <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            // twMerge so a caller's size classes (e.g. buttonClass icon sizes) replace the defaults instead of fighting them.
            className={twMerge(
                'group inline-flex items-center justify-center transition-colors',
                vertical ? 'min-h-10 min-w-[72px] gap-2 px-3 text-[12px] font-bold' : 'min-h-10 gap-2 px-3 text-sm font-semibold',
                className,
            )}
            aria-label={label}
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
