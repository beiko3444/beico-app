'use client'

import { signOut } from 'next-auth/react'

export default function LogoutButton() {
    return (
        <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-sm font-medium hover:text-[var(--color-brand-orange)] transition-colors opacity-80 hover:opacity-100"
        >
            로그아웃
        </button>
    )
}
