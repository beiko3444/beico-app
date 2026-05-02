'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShoppingCart, History, User } from 'lucide-react'

const NAV_ITEMS = [
    { href: '/order', label: '注文', subLabel: 'Order', icon: ShoppingCart },
    { href: '/order/history', label: '履歴', subLabel: 'History', icon: History },
    { href: '/order/profile', label: 'マイページ', subLabel: 'My Page', icon: User },
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
                        style={{ color: 'inherit' }}
                        className={`
                            flex flex-col items-center group transition-colors duration-200 min-w-[60px]
                            ${isActive ? 'text-[#e34219]' : 'text-[#9aa3b2] hover:text-[#7f8897] dark:text-[#9aa3b2] dark:hover:text-[#c4cad4]'}
                        `}
                    >
                        <Icon size={26} strokeWidth={isActive ? 2.5 : 2} className="mb-0.5" />
                        <span className="mb-1 text-[12.5px] font-black leading-none">
                            {item.label}
                        </span>
                        <span className="text-[9px] font-bold uppercase tracking-[0.2em] leading-none">
                            {item.subLabel}
                        </span>
                    </Link>
                )
            })}
        </nav>
    )
}
