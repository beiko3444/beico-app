'use client'

import { signOut } from 'next-auth/react'
import { LogOut } from 'lucide-react'

export default function LogoutButton({ className }: { className?: string }) {
    return (
        <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className={`flex items-center gap-2 text-sm font-medium transition-colors opacity-80 hover:opacity-100 ${className}`}
        >
            <LogOut size={18} strokeWidth={2.5} />
            ログアウト
        </button>
    )
}
