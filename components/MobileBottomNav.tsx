'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, ShoppingCart, History, User, Bug } from 'lucide-react'

const NAV_ITEMS = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/order', label: 'Order', icon: ShoppingCart },
    { href: '/order/history', label: 'History', icon: History },
    { href: '/order/worm-order', label: 'Worm', icon: Bug },
    { href: '/order/profile', label: 'My Page', icon: User },
]

export default function MobileBottomNav() {
    const pathname = usePathname()

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3 z-[100] flex justify-between items-center shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.05)]">
            {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                const Icon = item.icon

                return (
                    <Link
                        key={item.href}
                        href={item.href}
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
                        <span className={`text-[10px] font-bold tracking-tight ${isActive ? 'text-[#e34219]' : 'text-gray-400'}`}>
                            {item.label}
                        </span>
                    </Link>
                )}
            )}
        </div>
    )
}
