'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useCallback, useEffect, useState } from 'react'
import { Boxes, Menu, Star, X } from 'lucide-react'
import {
  INVENTORY_FAVORITES_EVENT,
  type InventoryPreferencesPayload,
  uniqueInventoryIds,
} from '@/lib/smartInventoryPrefs'
import type { SmartInventoryDashboardPayload, SmartInventoryMasterRow } from '@/lib/smartInventoryClient'

function formatSidebarStock(value: number | null | undefined) {
  if (value === null || value === undefined) return '-'
  return value.toLocaleString('ko-KR')
}

function SidebarProductImage({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-300">
        <Boxes size={14} />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className="h-9 w-9 shrink-0 rounded-md border border-slate-200 bg-white object-cover"
      onError={() => setFailed(true)}
    />
  )
}

function FavoriteInventoryPanel({ onNavigate }: { onNavigate?: () => void }) {
  const [favoriteRows, setFavoriteRows] = useState<SmartInventoryMasterRow[]>([])
  const [loading, setLoading] = useState(false)

  const applyRows = useCallback((ids: number[], rows: SmartInventoryMasterRow[]) => {
    const byId = new Map(rows.map((row) => [row.id, row]))
    setFavoriteRows(ids.map((id) => byId.get(id)).filter((row): row is SmartInventoryMasterRow => Boolean(row)))
  }, [])

  const loadFavorites = useCallback(async () => {
    setLoading(true)
    try {
      const preferencesResponse = await fetch('/api/admin/inventory/preferences', { cache: 'no-store' })
      const preferences: InventoryPreferencesPayload | null = await preferencesResponse.json().catch(() => null)
      if (!preferencesResponse.ok) throw new Error('failed')

      const ids = uniqueInventoryIds(preferences?.favoriteMasterIds)
      if (!ids.length) {
        setFavoriteRows([])
        return
      }

      const response = await fetch('/api/admin/inventory', { cache: 'no-store' })
      const payload: SmartInventoryDashboardPayload = await response.json()
      if (!response.ok || !Array.isArray(payload.rows)) throw new Error('failed')

      applyRows(ids, payload.rows)
    } catch {
      setFavoriteRows([])
    } finally {
      setLoading(false)
    }
  }, [applyRows])

  useEffect(() => {
    loadFavorites()

    const handleFavoriteEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ favoriteMasterIds?: number[]; rows?: SmartInventoryMasterRow[] }>).detail
      const ids = uniqueInventoryIds(detail?.favoriteMasterIds)
      if (ids.length && Array.isArray(detail?.rows)) {
        applyRows(ids, detail.rows)
        return
      }
      if (!ids.length && Array.isArray(detail?.rows)) {
        setFavoriteRows([])
        return
      }
      loadFavorites()
    }

    window.addEventListener(INVENTORY_FAVORITES_EVENT, handleFavoriteEvent)
    return () => window.removeEventListener(INVENTORY_FAVORITES_EVENT, handleFavoriteEvent)
  }, [applyRows, loadFavorites])

  if (!favoriteRows.length && !loading) return null

  return (
    <div className="mt-2 shrink-0 border-t border-[#E5E7EB] pt-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[12px] font-black text-[#111827]">
          <Star size={14} className="text-amber-500" fill="currentColor" />
          즐겨찾기 재고
        </div>
        <Link href="/admin/inventory" prefetch={false} onClick={onNavigate} className="text-[10px] font-black text-[#EF3B1D] no-underline">
          열기
        </Link>
      </div>
      <div className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {loading ? (
          <div className="px-2 py-2 text-[11px] font-bold text-slate-500">불러오는 중</div>
        ) : (
          favoriteRows.slice(0, 5).map((row) => (
            <Link
              key={row.id}
              href="/admin/inventory"
              prefetch={false}
              onClick={onNavigate}
              className="flex items-center gap-2 px-2 py-1.5 text-inherit no-underline transition hover:bg-slate-50"
            >
              <SidebarProductImage src={row.imageUrl} alt={row.name} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-black leading-tight text-slate-900" title={row.name}>
                  {row.name}
                </div>
                <div className="mt-1 grid grid-cols-[1fr_1fr_auto] items-center gap-1 text-[10px] font-extrabold tabular-nums">
                  <span className="truncate text-emerald-600">N {formatSidebarStock(row.naverStock)}</span>
                  <span className="truncate text-red-600">C {formatSidebarStock(row.coupangStock)}</span>
                  <span className="text-right text-slate-950">{formatSidebarStock(row.totalStock)}</span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const navItems = [
    { name: '주문관리', path: '/admin/orders' },
    { name: '상품관리', path: '/admin/products' },
    { name: '재고관리', path: '/admin/inventory' },
    { name: '파트너관리', path: '/admin/partners' },
    { name: '생산관리', path: '/admin/production' },
    { name: '근태관리', path: '/admin/tasks' },
    { name: '카드사용내역', path: '/admin/card-usage' },
    { name: '문자발송서비스', path: '/admin/sms' },
    { name: '지렁이 발주', path: '/admin/worm-order' },
    { name: 'PI발급', path: '/admin/proforma' },
    { name: '전력관리', path: '/admin/electricity' },
  ]

  const alertCountByPath: Record<string, number> = {
    '/admin/orders': counts?.pendingOrders ?? 0,
    '/admin/products': counts?.lowStock ?? 0,
    '/admin/partners': counts?.pendingPartners ?? 0,
    '/admin/electricity': counts?.missingBill ?? 0,
  }

  const isActive = (path: string) => pathname === path || (path !== '/admin' && pathname.startsWith(path))
  const activeItem = navItems.find((item) => isActive(item.path))

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!isMobileMenuOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMobileMenuOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMobileMenuOpen])

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

  const handleSendPickupSms = async () => {
    if (!fromNumber) {
      alert('발신번호를 찾지 못했습니다. 문자발송서비스에서 발신번호를 먼저 확인해 주세요.')
      return
    }
    const pickupCount = Number.parseInt(shipmentCount, 10)
    if (!Number.isFinite(pickupCount) || pickupCount < 1) {
      alert('발송 건수를 1 이상으로 입력해 주세요.')
      return
    }
    if (!confirm(`집하요청 문자 ${pickupCount}건을 발송하시겠습니까?`)) return

    const now = new Date()
    const contents = [
      '도매장님, 익스트래커입니다.',
      `${now.getMonth() + 1}/${now.getDate()} 출고 ${pickupCount}건 집하 부탁드립니다.`,
      '감사합니다.',
    ].join('\n')

    try {
      setSendingSms(true)
      const response = await fetch('/api/admin/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromNumber,
          toName: '도매장',
          toNumber: '01027104466',
          contents,
        }),
      })
      const result: { error?: string } = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || '문자 발송에 실패했습니다.')
      alert(`집하요청 문자 발송 완료 (${pickupCount}건)`)
    } catch (error) {
      alert(error instanceof Error ? error.message : '문자 발송에 실패했습니다.')
    } finally {
      setSendingSms(false)
    }
  }

  const renderNavItems = (mobile = false) => (
    <>
      {navItems.map((item) => (
        <Link
          key={item.path}
          href={item.path}
          prefetch={false}
          onClick={() => setIsMobileMenuOpen(false)}
          className={`flex ${mobile ? 'h-11' : 'h-[38px] min-h-[38px]'} min-w-0 items-center justify-between rounded-[12px] border px-4 text-[14px] font-extrabold tracking-[-0.025em] no-underline transition-all duration-150 ${
            isActive(item.path)
              ? 'border-[#EF3B1D] bg-[#EF3B1D] text-white shadow-[0_10px_20px_rgba(239,59,29,0.22)]'
              : 'border-transparent bg-transparent text-[#1F2937] hover:border-[#E5E7EB] hover:bg-[#F4F5F7] hover:text-[#111827]'
          }`}
          style={{ color: isActive(item.path) ? '#FFFFFF' : '#1F2937' }}
        >
          <span className="truncate text-inherit">{item.name}</span>
          <span className="inline-flex items-center gap-1.5">
            {alertCountByPath[item.path] > 0 ? (
              <span
                className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-extrabold leading-none ${
                  isActive(item.path) ? 'bg-white/25 text-white' : 'bg-[#EF3B1D] text-white'
                }`}
                aria-label={`${alertCountByPath[item.path]}건 알림`}
              >
                {alertCountByPath[item.path] > 99 ? '99+' : alertCountByPath[item.path]}
              </span>
            ) : null}
            {isActive(item.path) && !mobile ? (
              <span className="inline-flex items-center justify-center rounded-full bg-white/20 px-2 py-1 text-[9px] font-black tracking-[0.08em] text-white">
                ACTIVE
              </span>
            ) : null}
          </span>
        </Link>
      ))}
    </>
  )

  const desktopSidebarContent = (
    <>
      <div className="shrink-0">
        <div className="text-[30px] font-black leading-none tracking-[-0.055em] text-[#EF3B1D]">beiko</div>
        <div className="mt-2 text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#7D8491]">WHOLESALE PORTAL</div>
      </div>
      <div className="mb-4 mt-5 h-px shrink-0 bg-[#E5E7EB]" />

      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pb-3">{renderNavItems()}</nav>

      <FavoriteInventoryPanel />

      <div className="mt-1 flex h-16 shrink-0 items-center justify-between gap-2.5 rounded-2xl border border-[#FFD4C8] bg-[#FFF6F3] px-[14px] py-3 transition-colors hover:bg-[#FFF1EC]">
        <div className="min-w-0">
          <div className="text-[13px] font-extrabold leading-none tracking-[-0.01em] text-[#111827]">집하 문자</div>
          <div className="mt-1 flex items-center gap-1 text-[12px] font-bold leading-none text-[#EF3B1D]">
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={shipmentCount}
              onChange={(event) => setShipmentCount(event.target.value)}
              className="h-[18px] w-[30px] rounded border border-[#FFD4C8] bg-white px-1 text-center text-[11px] font-extrabold text-[#EF3B1D] outline-none"
              aria-label="발송 건수"
            />
            <span>건 대기</span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSendPickupSms}
          disabled={sendingSms || loadingFromNumber}
          className="inline-flex h-8 shrink-0 items-center justify-center rounded-full border-none bg-[#EF3B1D] px-3 text-[13px] font-extrabold text-white transition hover:bg-[#D92F16] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sendingSms ? '요청중' : '발송'}
        </button>
      </div>

      <div className="mt-3 shrink-0 border-t border-[#E5E7EB] pt-4">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex h-[44px] w-full items-center justify-center rounded-full border-none bg-[#0B1220] px-[18px] text-[15px] font-extrabold tracking-[-0.02em] text-white shadow-[0_10px_22px_rgba(11,18,32,0.18)] transition-all duration-150 hover:bg-[#111827]"
        >
          로그아웃
        </button>
      </div>
    </>
  )

  const mobileMenuContent = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[14px] font-black leading-none text-[#EF3B1D]">관리자 메뉴</div>
          <div className="mt-1 truncate text-[12px] font-extrabold text-[#111827]">{activeItem?.name || '관리자'}</div>
        </div>
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(false)}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#111827] transition hover:bg-[#F4F5F7]"
          aria-label="관리자 메뉴 닫기"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="mt-4 grid max-h-[calc(100vh-260px)] grid-cols-2 gap-2 overflow-y-auto pr-1">{renderNavItems(true)}</nav>

      <FavoriteInventoryPanel onNavigate={() => setIsMobileMenuOpen(false)} />

      <div className="mt-4 border-t border-[#E5E7EB] pt-3">
        <div className="flex items-center justify-between gap-2">
          <div className="shrink-0 text-[13px] font-extrabold leading-none text-[#111827]">집하 문자</div>
          <div className="flex min-w-0 items-center justify-end gap-1.5 text-[12px] font-bold leading-none text-[#EF3B1D]">
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={shipmentCount}
              onChange={(event) => setShipmentCount(event.target.value)}
              className="h-8 w-11 rounded-lg border border-[#FFD4C8] bg-white px-1 text-center text-[12px] font-extrabold text-[#EF3B1D] outline-none"
              aria-label="발송 건수"
            />
            <span className="shrink-0">건</span>
            <button
              type="button"
              onClick={handleSendPickupSms}
              disabled={sendingSms || loadingFromNumber}
              className="inline-flex h-8 shrink-0 items-center justify-center rounded-full border-none bg-[#EF3B1D] px-3 text-[12px] font-extrabold text-white transition hover:bg-[#D92F16] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sendingSms ? '요청중' : '발송'}
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="mt-3 flex h-10 w-full items-center justify-center rounded-full border-none bg-[#0B1220] px-[18px] text-[14px] font-extrabold text-white shadow-[0_8px_18px_rgba(11,18,32,0.14)] transition-all duration-150 hover:bg-[#111827]"
        >
          로그아웃
        </button>
      </div>
    </>
  )

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-[1000] flex h-14 items-center justify-between border-b border-[#E5E7EB] bg-white/95 px-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)] backdrop-blur print:hidden lg:hidden">
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(true)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3 text-[#111827] transition hover:bg-[#F4F5F7]"
          aria-label="관리자 메뉴 열기"
          aria-expanded={isMobileMenuOpen}
          aria-controls="admin-mobile-menu"
        >
          <Menu size={18} />
          <span className="text-[13px] font-extrabold">메뉴</span>
        </button>
        <div className="min-w-0 text-center">
          <div className="text-[18px] font-black leading-none tracking-[-0.055em] text-[#EF3B1D]">beiko</div>
          <div className="mt-1 truncate text-[11px] font-extrabold tracking-[-0.02em] text-[#111827]">{activeItem?.name || '관리자'}</div>
        </div>
        <div className="h-10 w-10" aria-hidden="true" />
      </header>

      {isMobileMenuOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[1001] bg-black/30 backdrop-blur-[1px] print:hidden lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="관리자 메뉴 닫기"
          />
          <aside
            id="admin-mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="관리자 메뉴"
            className="fixed left-3 top-16 z-[1002] box-border max-h-[calc(100vh-76px)] w-[calc(100vw-24px)] max-w-[420px] overflow-y-auto rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_18px_46px_rgba(15,23,42,0.22)] print:hidden lg:hidden"
          >
            {mobileMenuContent}
          </aside>
        </>
      ) : null}

      <aside
        id="admin-desktop-sidebar"
        className="fixed bottom-0 left-0 top-0 z-[1000] box-border hidden h-screen w-[260px] flex-col overflow-hidden border-r border-[#E5E7EB] bg-white px-5 pb-5 pt-6 shadow-[12px_0_34px_rgba(15,23,42,0.06)] print:hidden lg:flex"
      >
        {desktopSidebarContent}
      </aside>
    </>
  )
}
