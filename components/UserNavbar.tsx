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
        <nav className="fixed inset-x-0 bottom-0 z-[100] grid min-h-[68px] grid-cols-3 border-t border-[var(--border)] bg-[var(--card)] px-2 pb-[max(6px,env(safe-area-inset-bottom))] pt-1 shadow-[0_-6px_20px_rgba(16,24,40,0.08)] sm:static sm:flex sm:min-h-0 sm:items-center sm:gap-1 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none" aria-label="파트너 메뉴">
            {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/order' && pathname.startsWith(item.href))
                const Icon = item.icon

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        style={{ color: 'inherit' }}
                        aria-current={isActive ? 'page' : undefined}
                        className={`group relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-md px-3 text-center no-underline transition-colors sm:min-h-10 sm:min-w-[98px] sm:flex-row sm:gap-2 ${
                            isActive
                                ? 'bg-[#FFF2EE] text-[#D9341A]'
                                : 'text-[var(--muted-foreground)] hover:bg-[var(--card-hover)] hover:text-[var(--foreground)]'
                        }`}
                    >
                        {isActive ? <span className="absolute inset-x-4 top-0 h-0.5 rounded-b bg-[#E43D20] sm:inset-y-2 sm:left-0 sm:right-auto sm:h-auto sm:w-0.5" /> : null}
                        <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                        <span className="text-[11px] font-extrabold leading-none sm:text-[12px]">
                            {item.label}
                        </span>
                        <span className="hidden text-[9px] font-semibold leading-none lg:inline">
                            {item.subLabel}
                        </span>
                    </Link>
                )
            })}
        </nav>
    )
}
