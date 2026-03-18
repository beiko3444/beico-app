'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'

export default function AdminNav({ counts }: { counts?: { pendingOrders: number, lowStock: number, pendingPartners: number, missingBill: number } }) {
    const pathname = usePathname()

    const navItems = [
        { name: '대시보드', path: '/admin' },
        { name: '주문관리', path: '/admin/orders', count: counts?.pendingOrders },
        { name: '상품관리', path: '/admin/products', count: counts?.lowStock },
        { name: '파트너관리', path: '/admin/partners', count: counts?.pendingPartners },
        { name: '생산관리', path: '/admin/production' },
        { name: '업무관리', path: '/admin/tasks' },
        { name: 'P.I발급', path: '/admin/proforma' },
        { name: '전력관리', path: '/admin/electricity', alert: counts?.missingBill && counts.missingBill > 0 },
        { name: '재고관리', path: '/admin/inventory' },
    ]

    return (
        <div className="fixed top-0 left-0 right-0 z-[100] px-4 py-2 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
            <div className="max-w-7xl mx-auto flex items-center justify-between min-h-[40px] gap-4">
                <nav className="flex items-center gap-1 overflow-x-auto scrollbar-hide flex-1 pb-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.path || (item.path !== '/admin' && pathname.startsWith(item.path))

                        return (
                            <Link
                                key={item.path}
                                href={item.path}
                                className={`px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap tracking-tight flex items-center gap-1.5 ${isActive
                                    ? 'bg-black text-white'
                                    : 'text-gray-400 hover:text-black hover:bg-gray-50'
                                    }`}
                            >
                                {item.name}
                                {item.count && item.count > 0 ? (
                                    <span className={`flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[9px] font-bold ${isActive ? 'bg-red-500 text-white' : 'bg-red-500 text-white'}`}>
                                        {item.count}
                                    </span>
                                ) : null}
                                {item.alert ? (
                                    <span className={`flex items-center justify-center h-4 w-4 rounded-full text-[10px] font-bold ${isActive ? 'bg-red-500 text-white' : 'bg-red-500 text-white'}`}>
                                        !
                                    </span>
                                ) : null}
                            </Link>
                        )
                    })}
                </nav>

                <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className="shrink-0 px-3 py-2 text-xs font-black text-red-500 hover:bg-red-50 rounded-xl transition-all"
                >
                    로그아웃
                </button>
            </div>
        </div>
    )
}
