'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'

export default function AdminNav({
  counts,
}: {
  counts?: { pendingOrders: number; lowStock: number; pendingPartners: number; missingBill: number }
  userName?: string
}) {
  const pathname = usePathname()

  const navItems = [
    { name: '주문관리', path: '/admin/orders' },
    { name: '상품관리', path: '/admin/products' },
    { name: '파트너관리', path: '/admin/partners' },
    { name: '생산관리', path: '/admin/production' },
    { name: '업무관리', path: '/admin/tasks' },
    { name: '카드사용내역', path: '/admin/card-usage' },
    { name: '문자발송서비스', path: '/admin/sms' },
    { name: '지렁이 발주', path: '/admin/worm-order' },
    { name: 'P.발급', path: '/admin/proforma' },
    { name: '전력관리', path: '/admin/electricity' },
  ]

  const isActive = (path: string) => pathname === path || (path !== '/admin' && pathname.startsWith(path))
  const missingBill = (counts?.missingBill || 0) > 0

  return (
    <aside className="fixed inset-y-0 left-0 z-[1000] flex w-[220px] flex-col border-r border-white/10 bg-gradient-to-b from-[#081225] to-[#06101F] p-4 shadow-[12px_0_40px_rgba(15,23,42,0.12)] md:w-[260px] md:px-[18px] md:py-6">
      <div className="mb-6 border-b border-white/10 pb-5">
        <div className="text-[22px] font-black tracking-[-0.04em] text-white">Xtracker</div>
        <div className="mt-1 text-[12px] font-medium text-white/60">Admin Console</div>
      </div>

      <nav className="space-y-1.5">
        {navItems.map((item) => (
          <Link
            key={item.path}
            href={item.path}
            prefetch={false}
            className={`flex h-12 items-center rounded-xl px-4 text-[15px] font-bold tracking-[-0.02em] transition ${
              isActive(item.path)
                ? 'bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] text-white shadow-[0_12px_24px_rgba(37,99,235,0.32)]'
                : 'text-white/70 hover:bg-white/5 hover:text-white'
            }`}
          >
            {item.name}
            {item.path === '/admin/electricity' && missingBill ? (
              <span className="ml-2 text-[12px] text-white/90">*</span>
            ) : null}
          </Link>
        ))}
      </nav>

      <div className="mt-auto border-t border-white/10 pt-4">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex h-12 w-full items-center rounded-xl px-4 text-left text-[15px] font-bold tracking-[-0.02em] text-white/70 transition hover:bg-white/5 hover:text-white"
        >
          로그아웃
        </button>
      </div>
    </aside>
  )
}
