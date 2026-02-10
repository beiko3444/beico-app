'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
    { href: '/order', label: '注文', subLabel: 'Order' },
    { href: '/order/history', label: '注文履歴', subLabel: 'History' },
    { href: '/order/profile', label: 'マイページ', subLabel: 'My Page' },
]

export default function UserNavbar() {
    const pathname = usePathname()

    return (
        <nav className="flex items-center gap-6">
            {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/order' && pathname.startsWith(item.href))

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`
                            flex flex-col items-center group transition-colors duration-200
                            ${isActive ? 'text-[#e34219]' : 'text-gray-400 hover:text-gray-600'}
                        `}
                    >
                        <span className="text-sm font-bold leading-none mb-0.5">
                            {item.label}
                        </span>
                        <span className="text-[10px] font-medium opacity-80 leading-none">
                            {item.subLabel}
                        </span>
                    </Link>
                )
            })}
        </nav>
    )
}
