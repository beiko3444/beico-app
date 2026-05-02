'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShoppingCart, History, User } from 'lucide-react'

const NAV_ITEMS = [
    { href: '/order', label: 'Order', subLabel: 'Order', icon: ShoppingCart },
    { href: '/order/history', label: 'History', subLabel: 'History', icon: History },
    { href: '/order/profile', label: 'My Page', subLabel: 'My Page', icon: User },
]

export default function UserNavbar() {
    const pathname = usePathname()

    return (
        <nav className="flex items-center gap-2 md:gap-6">
            {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/order' && pathname.startsWith(item.href))
                const Icon = item.icon

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`
                            relative flex min-w-[72px] flex-col items-center rounded-[18px] px-3 py-2 transition-colors duration-200
                            ${isActive ? 'bg-[var(--surface-parchment)] text-[var(--foreground)]' : 'text-[#6e6e73] hover:text-[var(--foreground)]'}
                        `}
                    >
                        <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} className="mb-1" />
                        <span className={`mb-1 text-[12px] font-medium leading-none ${isActive ? 'text-[var(--foreground)]' : 'text-[#6e6e73]'}`}>
                            {item.subLabel}
                        </span>
                        <span className={`text-[9px] font-medium uppercase tracking-[0.18em] leading-none ${isActive ? 'text-[var(--primary)]' : 'text-[#8d8d92]'}`}>
                            {item.label}
                        </span>
                        {isActive && <span className="absolute inset-x-4 bottom-0 h-[2px] rounded-full bg-[var(--foreground)]" />}
                    </Link>
                )
            })}
        </nav>
    )
}
