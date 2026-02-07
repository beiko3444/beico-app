'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
    { href: '/order', label: '주문하기', icon: '🛒' },
    { href: '/order/history', label: '주문내역', icon: '📋' },
    { href: '/order/profile', label: '마이페이지', icon: '👤' },
]

export default function UserNavbar() {
    const pathname = usePathname()

    return (
        <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/order' && pathname.startsWith(item.href))

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`
                            px-5 py-2 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2
                            ${isActive
                                ? 'bg-white text-[var(--color-brand-blue)] shadow-sm'
                                : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'}
                        `}
                    >
                        <span className={`text-base ${isActive ? 'opacity-100' : 'opacity-40'}`}>
                            {item.icon}
                        </span>
                        {item.label}
                    </Link>
                )
            })}
        </nav>
    )
}
