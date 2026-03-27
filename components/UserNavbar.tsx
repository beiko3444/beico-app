'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShoppingCart, History, User, Bug } from 'lucide-react'

const NAV_ITEMS = [
    { href: '/order', label: 'Order', subLabel: 'Order', icon: ShoppingCart },
    { href: '/order/history', label: 'History', subLabel: 'History', icon: History },
    { href: '/order/worm-order', label: 'Worm', subLabel: 'Worm Order Form', icon: Bug },
    { href: '/order/profile', label: 'My Page', subLabel: 'My Page', icon: User },
]

export default function UserNavbar() {
    const pathname = usePathname()

    return (
        <nav className="flex items-center gap-2 md:gap-8">
            {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/order' && pathname.startsWith(item.href))
                const Icon = item.icon

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`
                            flex flex-col items-center group transition-colors duration-200 min-w-[60px]
                            ${isActive ? 'text-[#e34219]' : 'text-gray-400 hover:text-gray-600'}
                        `}
                    >
                        <Icon size={26} strokeWidth={isActive ? 2.5 : 2} className="mb-0.5" />
                        <span className={`text-[12.5px] font-black leading-none mb-1 ${isActive ? 'text-[#e34219]' : 'text-gray-400'}`}>
                            {item.subLabel}
                        </span>
                        <span className={`text-[9px] font-bold uppercase tracking-[0.2em] leading-none ${isActive ? 'text-[#e34219]' : 'text-gray-400'}`}>
                            {item.label}
                        </span>
                    </Link>
                )
            })}
        </nav>
    )
}
