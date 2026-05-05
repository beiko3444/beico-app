'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useEffect, useMemo, useState } from 'react'

export default function AdminNav({
  counts,
}: {
  counts?: { pendingOrders: number; lowStock: number; pendingPartners: number; missingBill: number }
  userName?: string
}) {
  const pathname = usePathname()
  const [shipmentCount, setShipmentCount] = useState('1')
  const [fromNumber, setFromNumber] = useState('')
  const [loadingFromNumber, setLoadingFromNumber] = useState(true)
  const [sendingSms, setSendingSms] = useState(false)

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

  useEffect(() => {
    let mounted = true

    async function loadFromNumber() {
      setLoadingFromNumber(true)
      try {
        const response = await fetch('/api/admin/sms?mode=sender')
        const result: {
          defaultFromNumber?: string
          fromNumbers?: Array<{ number?: string }>
          error?: string
        } = await response.json()

        if (!mounted) return
        if (!response.ok) throw new Error(result.error || '발신번호를 불러오지 못했습니다.')

        const defaultFrom = typeof result.defaultFromNumber === 'string' ? result.defaultFromNumber : ''
        const firstFrom = Array.isArray(result.fromNumbers) ? (result.fromNumbers[0]?.number || '') : ''
        setFromNumber(defaultFrom || firstFrom)
      } catch (error) {
        if (!mounted) return
        alert(error instanceof Error ? error.message : '발신번호를 불러오지 못했습니다.')
      } finally {
        if (mounted) setLoadingFromNumber(false)
      }
    }

    loadFromNumber()
    return () => {
      mounted = false
    }
  }, [])

  const parsedShipmentCount = useMemo(() => {
    const value = Number.parseInt(shipmentCount, 10)
    return Number.isFinite(value) && value > 0 ? value : 0
  }, [shipmentCount])

  const handleSendPickupSms = async () => {
    if (!fromNumber) {
      alert('발신번호를 찾지 못했습니다. 문자발송서비스에서 발신번호를 먼저 확인해 주세요.')
      return
    }
    if (!parsedShipmentCount) {
      alert('출고 건수를 1 이상으로 입력해 주세요.')
      return
    }

    const now = new Date()
    const contents = [
      '소장님, 엑스트래커입니다.',
      `${now.getMonth() + 1}/${now.getDate()} 출고 ${parsedShipmentCount}건 집하 부탁드립니다.`,
      '감사합니다.',
    ].join('\n')

    try {
      setSendingSms(true)
      const response = await fetch('/api/admin/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromNumber,
          toName: '소장님',
          toNumber: '01027104466',
          contents,
        }),
      })
      const result: { error?: string } = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || '문자 발송에 실패했습니다.')
      alert(`집하요청 문자 발송 완료 (${parsedShipmentCount}건)`)
    } catch (error) {
      alert(error instanceof Error ? error.message : '문자 발송에 실패했습니다.')
    } finally {
      setSendingSms(false)
    }
  }

  return (
    <aside className="fixed bottom-0 left-0 top-0 z-[1000] box-border flex h-screen w-[260px] flex-col overflow-hidden border-r border-[#E5E7EB] bg-white px-[26px] pb-6 pt-7 shadow-[12px_0_34px_rgba(15,23,42,0.06)]">
      <div className="shrink-0">
        <div className="text-[36px] font-black leading-none tracking-[-0.055em] text-[#EF3B1D]">beiko</div>
        <div className="mt-[13px] text-[12px] font-extrabold uppercase tracking-[0.24em] text-[#7D8491]">WHOLESALE PORTAL</div>
      </div>
      <div className="mb-7 mt-8 h-px shrink-0 bg-[#E5E7EB]" />

      <nav className="flex min-h-0 flex-1 flex-col gap-[10px] overflow-y-auto pb-5 pr-0.5">
        {navItems.map((item) => (
          <Link
            key={item.path}
            href={item.path}
            prefetch={false}
            className={`flex h-[46px] min-h-[46px] items-center justify-between rounded-[15px] border px-[18px] text-[16px] font-extrabold tracking-[-0.035em] no-underline transition-all duration-150 ${
              isActive(item.path)
                ? 'border-[#EF3B1D] bg-[#EF3B1D] text-white shadow-[0_14px_28px_rgba(239,59,29,0.24)]'
                : 'border-transparent bg-transparent text-[#1F2937] hover:border-[#E5E7EB] hover:bg-[#F4F5F7] hover:text-[#111827]'
            }`}
            style={{ color: isActive(item.path) ? '#FFFFFF' : '#1F2937' }}
          >
            <span className="text-inherit">{item.name}</span>
            {isActive(item.path) ? (
              <span className="inline-flex items-center justify-center rounded-full bg-white/20 px-3 py-1.5 text-[10px] font-black tracking-[0.1em] text-white">
                ACTIVE
              </span>
            ) : null}
          </Link>
        ))}
      </nav>

      <div className="mt-2 shrink-0 rounded-[18px] border border-[#E5E7EB] bg-[#FAFAFB] p-3 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-extrabold tracking-[-0.01em] text-[#111827]">집하 문자</span>
          <span className="text-[11px] font-bold text-[#8A93A3]">기사 전송</span>
        </div>
        <div className="mt-2 flex h-10 items-center rounded-full border border-[#D1D5DB] bg-white px-2 text-slate-900">
          <input
            type="number"
            min={1}
            inputMode="numeric"
            value={shipmentCount}
            onChange={(event) => setShipmentCount(event.target.value)}
            className="h-full w-12 border-none bg-transparent text-center text-[15px] font-extrabold outline-none"
            aria-label="출고 건수"
          />
          <span className="pr-2 text-[12px] font-extrabold text-[#374151]">건 출고</span>
        </div>
        <button
          type="button"
          onClick={handleSendPickupSms}
          disabled={sendingSms || loadingFromNumber}
          className="mt-2 flex h-10 w-full items-center justify-center rounded-full bg-[#EF3B1D] text-[13px] font-extrabold text-white shadow-[0_8px_18px_rgba(239,59,29,0.18)] transition hover:bg-[#D92F16] disabled:opacity-50"
        >
          {sendingSms ? '요청중...' : '문자발송'}
        </button>
      </div>

      <div className="mt-5 shrink-0 border-t border-[#E5E7EB] pt-6">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex h-[46px] w-full items-center justify-center rounded-full border-none bg-[#0B1220] px-[18px] text-[15px] font-extrabold tracking-[-0.02em] text-white shadow-[0_10px_22px_rgba(11,18,32,0.18)] transition-all duration-150 hover:bg-[#111827]"
        >
          로그아웃
        </button>
      </div>
    </aside>
  )
}
