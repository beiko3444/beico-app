'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, ShoppingCart, History, User } from 'lucide-react'

const NAV_ITEMS = [
    { href: '/', label: 'ホーム', icon: Home },
    { href: '/order', label: '注文', icon: ShoppingCart },
    { href: '/order/history', label: '履歴', icon: History },
    { href: '/order/profile', label: 'マイページ', icon: User },
]

export default function MobileBottomNav() {
    const pathname = usePathname()

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-[#1a1a1a] border-t border-gray-100 dark:border-[#2a2a2a] px-6 py-3 z-[100] flex justify-between items-center shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.05)] dark:shadow-none">
            {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                const Icon = item.icon

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        style={{ color: 'inherit' }}
                        className={`
                            flex flex-col items-center gap-1.5 transition-all duration-300
                            ${isActive ? 'text-[#e34219]' : 'text-gray-400'}
                        `}
                    >
                        <Icon
                            size={22}
                            strokeWidth={isActive ? 2.5 : 2}
                            className={`${isActive ? 'scale-110' : 'scale-100'} transition-transform`}
                        />
                        <span className={`text-[10px] font-bold tracking-tight ${isActive ? 'text-[#e34219]' : 'text-gray-400 dark:text-gray-500'}`}>
                            {item.label}
                        </span>
                    </Link>
                )}
            )}
        </div>
    )
}
