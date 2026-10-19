'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useCallback, useEffect, useState } from 'react'
import {
  type LucideIcon,
  Boxes,
  ChevronRight,
  Clock3,
  CreditCard,
  Factory,
  Fish,
  FileText,
  Globe2,
  Handshake,
  LayoutGrid,
  Languages,
  LogOut,
  Menu,
  Package,
  PackagePlus,
  PlugZap,
  Send,
  Ship,
  ShoppingCart,
  Star,
  StickyNote,
  Truck,
  Warehouse,
  X,
} from 'lucide-react'
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
  const [coupangStale, setCoupangStale] = useState(false)
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

      setCoupangStale(payload.channelHealth?.coupang?.status === 'stale')
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
        <Link href="/admin/inventory" prefetch={null} onClick={onNavigate} className="text-[10px] font-black text-brand-orange no-underline">
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
              prefetch={null}
              onClick={onNavigate}
              className="flex items-center gap-2 px-2 py-1.5 text-inherit no-underline transition hover:bg-slate-50"
            >
              <SidebarProductImage src={row.imageUrl} alt={row.name} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-black leading-tight text-slate-900" title={row.name}>
                  {row.name}
                </div>
                <table className="mt-1.5 w-full table-fixed border-collapse text-[12px] font-black tabular-nums">
                  <tbody>
                    <tr>
                      <td className="w-[38%] overflow-hidden whitespace-nowrap pr-1 text-left text-emerald-700">
                        <span className="mr-1 inline-flex h-4 min-w-4 items-center justify-center rounded-[3px] bg-emerald-600 px-1 text-[10px] font-black leading-none text-white">N</span>
                        <span>{formatSidebarStock(row.naverStock)}</span>
                      </td>
                      <td className="w-[34%] overflow-hidden whitespace-nowrap px-1 text-left text-red-700">
                        <span className="mr-1 inline-flex h-4 min-w-4 items-center justify-center rounded-[3px] bg-red-600 px-1 text-[10px] font-black leading-none text-white">C</span>
                        <span>{coupangStale ? '오류' : formatSidebarStock(row.coupangStock)}</span>
                      </td>
                      <td
                        className="w-[28%] overflow-hidden whitespace-nowrap pl-1 text-right text-[12px] font-black text-slate-950"
                        title="상품관리 현재고"
                      >
                        {formatSidebarStock(row.productStock)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}

type NavItem = { name: string; path: string; icon: LucideIcon }
type NavGroup = { label: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    label: '주문·거래',
    items: [
      { name: '주문관리', path: '/admin/orders', icon: ShoppingCart },
      { name: '파트너관리', path: '/admin/partners', icon: Handshake },
      { name: 'PI발급', path: '/admin/proforma', icon: FileText },
      { name: '수출신고', path: '/admin/export-declaration', icon: Ship },
      { name: '인도 위임장', path: '/admin/cargo-delivery', icon: Truck },
    ],
  },
  {
    label: '상품·재고',
    items: [
      { name: '상품관리', path: '/admin/products', icon: Package },
      { name: '재고관리', path: '/admin/inventory', icon: Warehouse },
      { name: '부자재 주문', path: '/admin/material-supplies', icon: PackagePlus },
      { name: '1688 구매내역', path: '/admin/1688', icon: Globe2 },
      { name: '지렁이 발주', path: '/admin/worm-order', icon: Send },
    ],
  },
  {
    label: '운영',
    items: [
      { name: '생산관리', path: '/admin/production', icon: Factory },
      { name: '근태관리', path: '/admin/tasks', icon: Clock3 },
      { name: '카드사용내역', path: '/admin/card-usage', icon: CreditCard },
      { name: '전력관리', path: '/admin/electricity', icon: PlugZap },
    ],
  },
  {
    label: '도구',
    items: [
      { name: '메모', path: '/admin/memos', icon: StickyNote },
      { name: '마인드보드', path: '/admin/mindboard', icon: LayoutGrid },
      { name: '시즌레이더', path: '/admin/season-radar', icon: Fish },
      { name: '번역기', path: '/translator', icon: Languages },
    ],
  },
]

const EXTERNAL_PATHS = new Set(['/translator'])

export default function AdminNav({
  counts,
  userName,
}: {
  counts?: { pendingOrders: number; pendingPartners: number; missingBill: number }
  userName?: string
}) {
  const pathname = usePathname()
  const [shipmentCount, setShipmentCount] = useState('1')
  const [fromNumber, setFromNumber] = useState('01081193313')
  const [loadingFromNumber, setLoadingFromNumber] = useState(true)
  const [sendingSms, setSendingSms] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const alertCountByPath: Record<string, number> = {
    '/admin/orders': counts?.pendingOrders ?? 0,
    '/admin/partners': counts?.pendingPartners ?? 0,
    '/admin/electricity': counts?.missingBill ?? 0,
  }

  const isActive = (path: string) => pathname === path || (path !== '/admin' && pathname.startsWith(path))
  const activeGroup = NAV_GROUPS.find((group) => group.items.some((item) => isActive(item.path)))
  const activeItem = activeGroup?.items.find((item) => isActive(item.path))
  const displayName = userName || '관리자'

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  // Keep the active menu item visible when the grouped list overflows the sidebar height.
  useEffect(() => {
    const el = document.querySelector<HTMLElement>('#admin-desktop-sidebar [data-active="true"]')
    el?.scrollIntoView({ block: 'nearest' })
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
      alert('발신번호를 찾지 못했습니다. 등록된 발신번호 설정을 확인해 주세요.')
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
      '소장님, 엑스트래커 입니다.',
      `${now.getMonth() + 1}/${now.getDate()}, 출고 ${pickupCount}건 집하부탁드립니다.`,
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

  const renderBadge = (path: string) => {
    const count = alertCountByPath[path] ?? 0
    if (count <= 0) return null
    return (
      <span
        className="ml-2 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-orange px-1.5 text-[11px] font-extrabold leading-none text-white"
        aria-label={`${count}건 알림`}
      >
        {count > 99 ? '99+' : count}
      </span>
    )
  }

  const renderNavLink = (item: NavItem, mobile: boolean) => {
    const active = isActive(item.path)
    const Icon = item.icon
    const external = EXTERNAL_PATHS.has(item.path)
    return (
      <Link
        key={item.path}
        href={item.path}
        prefetch={external ? false : null}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
        data-active={active ? 'true' : undefined}
        aria-current={active ? 'page' : undefined}
        onClick={() => setIsMobileMenuOpen(false)}
        className={
          mobile
            ? `flex min-h-11 min-w-0 items-center justify-between gap-1.5 rounded-[10px] border px-3 text-[13px] no-underline transition-colors ${
                active
                  ? 'border-[#ffd5cc] bg-brand-orange-soft font-extrabold'
                  : 'border-[#eef2f6] bg-[#f8fafc] font-semibold hover:bg-[#f1f3f6]'
              }`
            : `group relative flex h-9 min-w-0 items-center justify-between rounded-lg px-2.5 text-[13px] no-underline transition-colors duration-150 ${
                active ? 'bg-brand-orange-soft font-extrabold' : 'font-semibold hover:bg-[#f4f6f8]'
              }`
        }
        style={{ color: active ? 'var(--color-brand-orange-strong)' : '#344054' }}
      >
        {active && !mobile ? <span className="absolute left-0 top-2 h-5 w-[3px] rounded-r-full bg-brand-orange" /> : null}
        <span className="flex min-w-0 items-center gap-2.5">
          {mobile ? null : (
            <Icon
              size={16}
              strokeWidth={2.2}
              className={`shrink-0 ${active ? 'text-current' : 'text-[#98a2b3] group-hover:text-[#667085]'}`}
              aria-hidden="true"
            />
          )}
          <span className="truncate leading-none">{item.name}</span>
        </span>
        {renderBadge(item.path)}
      </Link>
    )
  }

  const renderGroups = (mobile = false) =>
    NAV_GROUPS.map((group) => (
      <div key={group.label} className={mobile ? 'flex flex-col gap-1.5' : 'flex flex-col gap-0.5'}>
        <div className={`text-[11px] font-bold text-[#667085] ${mobile ? '' : 'px-2.5 pb-1'}`}>{group.label}</div>
        <div className={mobile ? 'grid grid-cols-2 gap-1.5' : 'flex flex-col gap-0.5'}>
          {group.items.map((item) => renderNavLink(item, mobile))}
        </div>
      </div>
    ))

  const pickupControl = (
    <div className="flex h-10 shrink-0 items-center gap-2 rounded-[10px] border border-[#e5e9ef] bg-white pl-3 pr-1.5">
      <Truck size={16} className="shrink-0 text-[#667085]" aria-hidden="true" />
      <label htmlFor="admin-pickup-count" className="whitespace-nowrap text-[13px] font-bold text-[#344054]">
        집하 요청
      </label>
      <input
        id="admin-pickup-count"
        type="number"
        min={1}
        inputMode="numeric"
        value={shipmentCount}
        onChange={(event) => setShipmentCount(event.target.value)}
        className="h-7 w-11 rounded-md border border-[#cfd6df] bg-white px-1 text-center text-[13px] font-extrabold text-[#172033] outline-none"
      />
      <span className="text-[12px] font-semibold text-[#667085]">건</span>
      <button
        type="button"
        onClick={handleSendPickupSms}
        disabled={sendingSms || loadingFromNumber}
        className="inline-flex h-[30px] shrink-0 items-center justify-center rounded-lg border-none bg-brand-orange px-3 text-[12px] font-extrabold text-white transition hover:bg-brand-orange-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {sendingSms ? '요청중' : '문자 발송'}
      </button>
    </div>
  )

  return (
    <>
      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-[1000] flex h-14 items-center justify-between border-b border-[#E5E9EF] bg-white/95 px-3 backdrop-blur print:hidden lg:hidden">
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen((open) => !open)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] bg-[#f4f6f8] text-[#172033] transition-colors hover:bg-[#eef2f6]"
          aria-label={isMobileMenuOpen ? '관리자 메뉴 닫기' : '관리자 메뉴 열기'}
          aria-expanded={isMobileMenuOpen}
          aria-controls="admin-mobile-menu"
        >
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div className="flex min-w-0 items-center gap-2">
          <Image src="/logo.png" alt="beiko" width={74} height={66} priority className="h-auto w-[34px]" />
          <span className="truncate text-[15px] font-extrabold text-[#172033]">{activeItem?.name || '관리자'}</span>
        </div>
        <a
          href="/translator"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="번역기 열기"
          title="번역기"
          className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] text-[#344054] transition-colors hover:bg-[#F4F6F8]"
        >
          <Languages size={20} />
        </a>
      </header>

      {isMobileMenuOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-x-0 bottom-0 top-14 z-[1001] bg-[rgba(16,24,40,0.32)] print:hidden lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="관리자 메뉴 닫기"
            tabIndex={-1}
          />
          <aside
            id="admin-mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="관리자 메뉴"
            className="ux-scrollbar fixed inset-x-0 top-14 z-[1002] box-border max-h-[calc(100vh-56px)] overflow-y-auto rounded-b-2xl bg-white px-4 pb-5 pt-4 shadow-[0_18px_46px_rgba(15,23,42,0.18)] print:hidden lg:hidden"
          >
            <nav className="flex flex-col gap-3.5" aria-label="모바일 관리자 메뉴">
              {renderGroups(true)}
            </nav>

            <FavoriteInventoryPanel onNavigate={() => setIsMobileMenuOpen(false)} />

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#E5E9EF] pt-3">
              <div className="flex items-center gap-1.5">
                <label htmlFor="admin-pickup-count-mobile" className="text-[13px] font-bold text-[#344054]">
                  집하 요청
                </label>
                <input
                  id="admin-pickup-count-mobile"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={shipmentCount}
                  onChange={(event) => setShipmentCount(event.target.value)}
                  className="h-9 w-12 rounded-lg border border-[#cfd6df] bg-white px-1 text-center text-[14px] font-extrabold text-[#172033] outline-none"
                />
                <span className="text-[12px] text-[#667085]">건</span>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={handleSendPickupSms}
                  disabled={sendingSms || loadingFromNumber}
                  className="inline-flex h-11 items-center justify-center rounded-[10px] border-none bg-brand-orange px-3.5 text-[13px] font-extrabold text-white transition hover:bg-brand-orange-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sendingSms ? '요청중' : '문자 발송'}
                </button>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] border border-[#E5E9EF] bg-white text-[#667085] transition-colors hover:bg-[#F8FAFC]"
                  aria-label="로그아웃"
                >
                  <LogOut size={18} />
                </button>
              </div>
            </div>
          </aside>
        </>
      ) : null}

      {/* Desktop sidebar */}
      <aside
        id="admin-desktop-sidebar"
        className="fixed bottom-0 left-0 top-0 z-[1000] box-border hidden h-screen w-[240px] flex-col overflow-hidden border-r border-[#E5E9EF] bg-white px-3 pb-4 pt-5 print:hidden lg:flex"
      >
        <Link href="/admin/orders" prefetch={null} className="flex shrink-0 items-center gap-2.5 px-2 no-underline">
          <Image src="/logo.png" alt="beiko" width={104} height={93} priority className="h-auto w-[52px]" />
          <span className="flex flex-col gap-0.5">
            <span className="text-[13px] font-extrabold leading-tight text-[#172033]">관리자 콘솔</span>
            <span className="text-[11px] font-semibold leading-tight text-[#667085]">beiko.co.kr</span>
          </span>
        </Link>

        <nav className="ux-scrollbar ux-nav-scroll mt-5 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-7" aria-label="관리자 메뉴">
          {renderGroups()}
        </nav>

        <FavoriteInventoryPanel />
      </aside>

      {/* Desktop top bar */}
      <header className="fixed left-[240px] right-0 top-0 z-[999] hidden h-[60px] items-center justify-between gap-3 border-b border-[#E5E9EF] bg-white/95 px-6 backdrop-blur print:hidden lg:flex">
        <div className="flex min-w-0 items-center gap-2 text-[13px]">
          {activeGroup ? (
            <>
              <span className="whitespace-nowrap font-bold text-[#667085]">{activeGroup.label}</span>
              <ChevronRight size={14} className="shrink-0 text-[#98a2b3]" aria-hidden="true" />
            </>
          ) : null}
          <span className="truncate font-extrabold text-[#172033]">{activeItem?.name || '관리자'}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          {pickupControl}
          <a
            href="/translator"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="번역기 열기"
            title="번역기"
            className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-[#E5E9EF] text-[#344054] transition-colors hover:bg-[#F4F6F8]"
          >
            <Languages size={18} />
          </a>
          <div className="h-6 w-px bg-[#E5E9EF]" aria-hidden="true" />
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#172033] text-[12px] font-extrabold text-white"
              aria-hidden="true"
            >
              {displayName.slice(0, 1)}
            </span>
            <span className="max-w-[120px] truncate text-[13px] font-bold text-[#344054]">{displayName}</span>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] text-[#667085] transition-colors hover:bg-[#F4F6F8] hover:text-[#172033]"
              aria-label="로그아웃"
              title="로그아웃"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>
    </>
  )
}
