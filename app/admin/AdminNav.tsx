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
  return (
    <aside className="fixed inset-y-0 left-0 z-[1000] w-[260px] min-h-screen border-r border-white/10 bg-gradient-to-b from-[#0B1220] to-[#080E1A] px-[22px] pb-6 pt-[34px] shadow-[18px_0_50px_rgba(11,18,32,0.18)]">
      <div className="border-b border-white/10 px-3 pb-7">
        <div className="text-[34px] font-black leading-none tracking-[-0.05em] text-[#EF3B1D]">beiko</div>
        <div className="mt-3 text-[12px] font-extrabold uppercase tracking-[0.22em] text-white/55">WHOLESALE PORTAL</div>
      </div>

      <nav className="mt-7 flex flex-col gap-2">
        {navItems.map((item) => (
          <Link
            key={item.path}
            href={item.path}
            prefetch={false}
            className={`flex h-12 items-center justify-between rounded-full border px-[18px] text-[15px] font-extrabold tracking-[-0.02em] transition-all duration-150 ${
              isActive(item.path)
                ? 'border-[#EF3B1D] bg-[#EF3B1D] text-white shadow-[0_14px_28px_rgba(239,59,29,0.32)]'
                : 'border-transparent bg-transparent text-white/70 hover:border-white/10 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span>{item.name}</span>
            {isActive(item.path) ? (
              <span className="inline-flex h-[22px] items-center justify-center rounded-full bg-white/20 px-2 text-[10px] font-black tracking-[0.08em] text-white">
                ACTIVE
              </span>
            ) : null}
          </Link>
        ))}
      </nav>

      <div className="absolute bottom-6 left-[22px] right-[22px] border-t border-white/10 pt-[18px]">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex h-12 w-full items-center justify-center rounded-full border border-[rgba(239,59,29,0.7)] bg-transparent px-[18px] text-[15px] font-extrabold tracking-[-0.02em] text-white transition-all duration-150 hover:border-[#EF3B1D] hover:bg-[rgba(239,59,29,0.1)] hover:text-[#EF3B1D]"
        >
          로그아웃
        </button>
      </div>
    </aside>
  )
}
