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
    <aside className="fixed bottom-0 left-0 top-0 z-[1000] flex h-screen w-[260px] flex-col overflow-hidden box-border bg-gradient-to-b from-[#0B1220] to-[#080E1A] px-6 pb-6 pt-8">
      <div className="mb-7 shrink-0">
        <div className="text-[34px] font-black leading-none tracking-[-0.05em] text-[#EF3B1D]">beiko</div>
        <div className="mt-3 text-[12px] font-extrabold uppercase tracking-[0.22em] text-white/55">WHOLESALE PORTAL</div>
      </div>
      <div className="mb-[22px] h-px shrink-0 bg-white/10" />

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto pb-5">
        {navItems.map((item) => (
          <Link
            key={item.path}
            href={item.path}
            prefetch={false}
            className={`flex h-[42px] min-h-[42px] items-center justify-between rounded-xl border px-[14px] text-[15px] font-bold tracking-[-0.02em] no-underline transition-all duration-150 ${
              isActive(item.path)
                ? 'border-[#EF3B1D] bg-[#EF3B1D] text-white shadow-[0_10px_24px_rgba(239,59,29,0.28)]'
                : 'border-transparent bg-transparent text-white/70 hover:bg-white/10 hover:text-white'
            }`}
            style={{ color: isActive(item.path) ? '#FFFFFF' : 'rgba(255,255,255,0.72)' }}
          >
            <span className="text-inherit">{item.name}</span>
            {isActive(item.path) ? (
              <span className="inline-flex items-center justify-center rounded-full bg-white/20 px-2 py-1 text-[10px] font-black tracking-[0.08em] text-white">
                ACTIVE
              </span>
            ) : null}
          </Link>
        ))}
      </nav>

      <div className="mt-4 shrink-0 border-t border-white/10 pt-[18px]">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex h-11 w-full items-center justify-center rounded-full border border-[rgba(239,59,29,0.75)] bg-transparent px-[18px] text-[15px] font-bold tracking-[-0.02em] text-white transition-all duration-150 hover:border-[#EF3B1D] hover:bg-[rgba(239,59,29,0.1)] hover:text-[#EF3B1D]"
        >
          로그아웃
        </button>
      </div>
    </aside>
  )
}
