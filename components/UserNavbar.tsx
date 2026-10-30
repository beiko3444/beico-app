'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShoppingCart, History, User } from 'lucide-react'

// The translator opens in a new tab, so it lives with the header utilities (app/order/layout.tsx), not here.
const JAPANESE_NAV_ITEMS = [
    { href: '/order', label: '注文', icon: ShoppingCart },
    { href: '/order/history', label: '注文履歴', icon: History },
    { href: '/order/profile', label: 'マイページ', icon: User },
]

const KOREAN_NAV_ITEMS = [
    { href: '/order', label: '주문', icon: ShoppingCart },
    { href: '/order/history', label: '주문내역', icon: History },
    { href: '/order/profile', label: '내 정보', icon: User },
]

export default function UserNavbar({ isKorean = false }: { isKorean?: boolean }) {
    const pathname = usePathname()
    const navItems = isKorean ? KOREAN_NAV_ITEMS : JAPANESE_NAV_ITEMS

    return (
        // Phones: a fixed 68px + safe-area bar, the height the order bar in order-interface.tsx sits on. While that bar
        // is showing it carries the shadow, so the two read as one fixed block instead of two stacked layers.
        <nav className="fixed inset-x-0 bottom-0 z-40 grid h-[calc(68px+env(safe-area-inset-bottom))] grid-cols-3 border-t border-[var(--border)] bg-[var(--card)] px-2 pb-[max(6px,env(safe-area-inset-bottom))] pt-1 shadow-[0_-6px_20px_rgba(16,24,40,0.08)] [body:has(#partner-order-bar)_&]:shadow-none sm:static sm:flex sm:h-auto sm:items-center sm:gap-2 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none" aria-label={isKorean ? '파트너 메뉴' : 'パートナーメニュー'}>
            {navItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/order' && pathname.startsWith(item.href))
                const Icon = item.icon

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        aria-current={isActive ? 'page' : undefined}
                        className={`group relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-3 text-center no-underline transition-colors sm:min-h-11 sm:min-w-[118px] sm:flex-row sm:gap-2 sm:px-4 ${
                            isActive
                                ? 'bg-brand-orange-soft font-bold text-brand-orange-strong dark:bg-white/10 dark:text-[var(--brand-accent)]'
                                : 'font-semibold text-[var(--muted-foreground)] hover:bg-[var(--card-hover)] hover:text-[var(--foreground)]'
                        }`}
                    >
                        {isActive ? <span className="absolute inset-x-4 top-0 h-0.5 rounded-b bg-brand-orange sm:hidden" /> : null}
                        <Icon size={20} strokeWidth={isActive ? 2.5 : 2} aria-hidden />
                        <span className="text-sm leading-none sm:text-[15px]">{item.label}</span>
                    </Link>
                )
            })}
        </nav>
    )
}
