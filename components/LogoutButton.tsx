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
            onClick={() => signOut({ callbackUrl: '/login' })}
            className={`
                flex transition-colors group
                ${vertical ? 'flex-col items-center min-w-[60px] gap-1' : 'items-center gap-2 text-sm font-medium'}
                opacity-80 hover:opacity-100 ${className}
            `}
        >
            {children || (
                <>
                    <LogOut size={vertical ? 26 : 18} strokeWidth={2.5} className={vertical ? 'mb-0.5' : ''} />
                    {vertical ? (
                        <>
                            <span className="text-[11.5px] font-black leading-none">ログアウト</span>
                        </>
                    ) : (
                        <span>로그아웃</span>
                    )}
                </>
            )}
        </button>
    )
}
