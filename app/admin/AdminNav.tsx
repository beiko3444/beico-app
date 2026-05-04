'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, Download, LayoutGrid, Plus, User } from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'

type SmsStatusType = 'success' | 'error'

type SmsStatus = {
    type: SmsStatusType
    message: string
}

type SmsSendResultLog = {
    seq: number
    completedAt: string
    status: SmsStatusType
    detail: string
}

const SMS_SEND_LOG_STORAGE_KEY = 'beico-admin-sms-send-log-v1'
const SMS_SEND_LOG_MAX = 20

function formatSmsCompletedHm(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '--:--'
    return new Intl.DateTimeFormat('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(date)
}

export default function AdminNav({
    counts,
    userName: _userName,
}: {
    counts?: { pendingOrders: number, lowStock: number, pendingPartners: number, missingBill: number }
    userName?: string
}) {
    const pathname = usePathname()
    const [shipmentCount, setShipmentCount] = useState('1')
    const [fromNumber, setFromNumber] = useState('')
    const [loadingFromNumber, setLoadingFromNumber] = useState(true)
    const [sendingSms, setSendingSms] = useState(false)
    const [smsStatus, setSmsStatus] = useState<SmsStatus | null>(null)
    const [smsSendLogs, setSmsSendLogs] = useState<SmsSendResultLog[]>([])

    const navItems = [
        { name: '주문관리', path: '/admin/orders', count: counts?.pendingOrders },
        { name: '상품관리', path: '/admin/products', count: counts?.lowStock },
        { name: '파트너관리', path: '/admin/partners', count: counts?.pendingPartners },
        { name: '생산관리', path: '/admin/production' },
        { name: '업무관리', path: '/admin/tasks' },
        { name: '카드사용내역', path: '/admin/card-usage' },
        { name: '문자발송서비스', path: '/admin/sms' },
        { name: '지렁이 발주', path: '/admin/worm-order' },
        { name: 'P.I발급', path: '/admin/proforma' },
        { name: '전력관리', path: '/admin/electricity', alert: counts?.missingBill && counts.missingBill > 0 },
    ]

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

                if (!response.ok) {
                    throw new Error(result.error || '발신번호를 불러오지 못했습니다.')
                }

                const defaultFrom = typeof result.defaultFromNumber === 'string' ? result.defaultFromNumber : ''
                const firstFrom = Array.isArray(result.fromNumbers) ? (result.fromNumbers[0]?.number || '') : ''
                setFromNumber(defaultFrom || firstFrom)
            } catch (error) {
                if (!mounted) return
                const message = error instanceof Error ? error.message : '발신번호를 불러오지 못했습니다.'
                setSmsStatus({ type: 'error', message })
            } finally {
                if (mounted) {
                    setLoadingFromNumber(false)
                }
            }
        }

        loadFromNumber()

        return () => {
            mounted = false
        }
    }, [])

    useEffect(() => {
        try {
            const raw = window.localStorage.getItem(SMS_SEND_LOG_STORAGE_KEY)
            if (!raw) return
            const parsed = JSON.parse(raw) as unknown
            if (!Array.isArray(parsed)) return

            const restored = parsed
                .map((entry) => {
                    if (!entry || typeof entry !== 'object') return null
                    const candidate = entry as Partial<SmsSendResultLog>
                    if (
                        typeof candidate.seq !== 'number' ||
                        typeof candidate.completedAt !== 'string' ||
                        (candidate.status !== 'success' && candidate.status !== 'error') ||
                        typeof candidate.detail !== 'string'
                    ) {
                        return null
                    }
                    return candidate as SmsSendResultLog
                })
                .filter((entry): entry is SmsSendResultLog => entry !== null)
                .slice(0, SMS_SEND_LOG_MAX)

            setSmsSendLogs(restored)
        } catch {
            // Ignore storage parse errors.
        }
    }, [])

    useEffect(() => {
        try {
            window.localStorage.setItem(
                SMS_SEND_LOG_STORAGE_KEY,
                JSON.stringify(smsSendLogs.slice(0, SMS_SEND_LOG_MAX)),
            )
        } catch {
            // Ignore storage write errors.
        }
    }, [smsSendLogs])

    const parsedShipmentCount = useMemo(() => {
        const value = Number.parseInt(shipmentCount, 10)
        return Number.isFinite(value) && value > 0 ? value : 0
    }, [shipmentCount])

    function appendSmsSendLog(status: SmsStatusType, detail: string, completedAt?: string) {
        const at = completedAt && !Number.isNaN(new Date(completedAt).getTime())
            ? completedAt
            : new Date().toISOString()

        setSmsSendLogs((prev) => {
            const maxSeq = prev.reduce((acc, item) => Math.max(acc, item.seq), 0)
            const next: SmsSendResultLog = {
                seq: maxSeq + 1,
                completedAt: at,
                status,
                detail,
            }
            return [next, ...prev].slice(0, SMS_SEND_LOG_MAX)
        })
    }

    async function handleSendSms() {
        if (!fromNumber) {
            const message = '발신번호를 찾지 못했습니다. 문자발송서비스에서 발신번호를 먼저 확인해 주세요.'
            setSmsStatus({ type: 'error', message })
            appendSmsSendLog('error', message)
            return
        }

        if (!parsedShipmentCount) {
            const message = '출고 건수를 1 이상으로 입력해 주세요.'
            setSmsStatus({ type: 'error', message })
            appendSmsSendLog('error', message)
            return
        }

        const now = new Date()
        const contents = [
            '소장님, 엑스트래커입니다.',
            `${now.getMonth() + 1}/${now.getDate()} 출고 ${parsedShipmentCount}건 집하 부탁드립니다.`,
            '감사합니다.',
        ].join('\n')

        setSendingSms(true)
        setSmsStatus(null)

        try {
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

            const result: {
                error?: string
                completedAt?: string
                sendType?: string
                receiptNum?: string
            } = await response.json()

            if (!response.ok) {
                throw new Error(result.error || '문자 발송에 실패했습니다.')
            }

            const completedAt = typeof result.completedAt === 'string' ? result.completedAt : new Date().toISOString()
            const sendTypeLabel = result.sendType || 'SMS'
            const successMessage = `문자 발송 완료 (${formatSmsCompletedHm(completedAt)})`
            const detail = `${sendTypeLabel} 완료${result.receiptNum ? ` / receipt:${result.receiptNum}` : ''}`

            setSmsStatus({ type: 'success', message: successMessage })
            appendSmsSendLog('success', detail, completedAt)
        } catch (error) {
            const message = error instanceof Error ? error.message : '문자 발송에 실패했습니다.'
            setSmsStatus({ type: 'error', message })
            appendSmsSendLog('error', message)
        } finally {
            setSendingSms(false)
        }
    }

    const totalAlerts = (counts?.pendingOrders || 0) + (counts?.lowStock || 0) + (counts?.pendingPartners || 0) + (counts?.missingBill || 0)
    const activeTabRef = useRef<HTMLAnchorElement>(null)
    const tabContainerRef = useRef<HTMLDivElement>(null)
    const navLinkBaseClass = 'inline-flex h-[42px] min-w-[92px] items-center justify-center gap-1.5 rounded-full px-[14px] text-[15px] font-bold leading-none tracking-[-0.02em] transition-all duration-150'
    const navLinkActiveClass = 'bg-white text-[#1F6FE5] shadow-[0_8px_22px_rgba(0,0,0,0.18)]'
    const navLinkIdleClass = 'text-[rgba(255,255,255,0.78)] hover:bg-white/10 hover:text-white'
    const navBadgeBaseClass = 'flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none'

    useEffect(() => {
        if (activeTabRef.current && tabContainerRef.current) {
            const container = tabContainerRef.current
            const tab = activeTabRef.current
            const containerRect = container.getBoundingClientRect()
            const tabRect = tab.getBoundingClientRect()
            if (tabRect.left < containerRect.left || tabRect.right > containerRect.right) {
                tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
            }
        }
    }, [pathname])

    return (
        <div className="sticky top-[14px] z-[1000] px-[18px] text-white">
            <div
                className="rounded-[18px] border border-white/10 bg-gradient-to-b from-[#0F1A2E] to-[#081225] shadow-[0_18px_45px_rgba(8,18,37,0.22)]"
                style={{
                    ['--nav-bg-start' as string]: '#0F1A2E',
                    ['--nav-bg-end' as string]: '#081225',
                    ['--nav-text' as string]: 'rgba(255,255,255,0.78)',
                    ['--nav-text-hover' as string]: '#FFFFFF',
                    ['--nav-active-bg' as string]: '#FFFFFF',
                    ['--nav-active-text' as string]: '#1F6FE5',
                    ['--primary-blue' as string]: '#2F80ED',
                    ['--primary-blue-dark' as string]: '#1769D9',
                    ['--nav-radius' as string]: '18px',
                    ['--pill-radius' as string]: '999px',
                    ['--nav-height' as string]: '74px',
                }}
            >
                <div className="mx-auto flex h-[74px] max-w-[1400px] items-center justify-between gap-4 px-[22px]">
                    <div className="flex min-w-0 items-center gap-7">
                        <div className="flex shrink-0 items-center">
                            <button
                                type="button"
                                aria-label="메뉴"
                                className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-white/10 transition-colors hover:bg-white/15"
                            >
                                <LayoutGrid size={22} className="text-white/90" />
                            </button>
                        </div>

                        <div ref={tabContainerRef} className="hidden min-w-0 flex-1 overflow-x-auto scrollbar-hide lg:block">
                            <nav className="flex items-center gap-2 whitespace-nowrap">
                                {navItems.map((item) => {
                                    const isActive = pathname === item.path || (item.path !== '/admin' && pathname.startsWith(item.path))

                                    return (
                                        <Link
                                            key={item.path}
                                            ref={isActive ? activeTabRef : undefined}
                                            href={item.path}
                                            prefetch={false}
                                            className={`${navLinkBaseClass} ${isActive ? navLinkActiveClass : navLinkIdleClass}`}
                                        >
                                            {item.name}
                                            {item.count && item.count > 0 ? (
                                                <span className={`${navBadgeBaseClass} ${isActive ? 'bg-slate-950 text-white' : 'bg-white/16 text-white'}`}>
                                                    {item.count}
                                                </span>
                                            ) : null}
                                            {item.alert ? (
                                                <span className={`${navBadgeBaseClass} ${isActive ? 'bg-slate-950 text-white' : 'bg-white/16 text-white'}`}>
                                                    !
                                                </span>
                                            ) : null}
                                        </Link>
                                    )
                                })}
                            </nav>
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2.5">
                        <ThemeToggle className="h-[46px] w-[46px] rounded-full border border-white/10 bg-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)] hover:bg-white/15" />

                        <button className="relative flex h-[46px] w-[46px] items-center justify-center rounded-full border border-white/10 bg-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)] transition-colors hover:bg-white/15">
                            <Bell size={18} className="text-white/90" />
                            {totalAlerts > 0 && (
                                <span className="absolute -right-[3px] -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#0F1A2E] bg-[#2F80ED] px-1 text-[11px] font-extrabold leading-none text-white">
                                    {totalAlerts}
                                </span>
                            )}
                        </button>

                        <div className="inline-flex h-[46px] items-stretch overflow-hidden rounded-full border border-white/12 bg-white text-slate-950 shadow-[0_8px_20px_rgba(0,0,0,0.14)]">
                            <span className="inline-flex h-full items-center pl-4 pr-1 text-slate-500">
                                <Plus size={18} />
                            </span>
                            <input
                                type="number"
                                min={1}
                                inputMode="numeric"
                                value={shipmentCount}
                                onChange={(event) => setShipmentCount(event.target.value)}
                                className="h-full w-[42px] border-none bg-transparent text-center text-[18px] font-black leading-none text-slate-950 outline-none focus:outline-none"
                                placeholder="1"
                                aria-label="출고 건수"
                            />
                            <span className="inline-flex h-full items-center gap-2 pr-4 text-[15px] font-bold leading-none text-slate-800 whitespace-nowrap">건 출고</span>
                        </div>

                        <button
                            onClick={handleSendSms}
                            disabled={sendingSms || loadingFromNumber}
                            className="flex h-[46px] items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#2F80ED] to-[#1769D9] px-5 text-[15px] font-extrabold leading-none text-white shadow-[0_10px_24px_rgba(47,128,237,0.35)] transition-all hover:from-[#3B8DF5] hover:to-[#1F6FE5] disabled:opacity-40"
                        >
                            <Download size={16} />
                            <span>{sendingSms ? '요청중...' : '집하요청'}</span>
                        </button>

                        <button
                            onClick={() => signOut({ callbackUrl: '/login' })}
                            className="flex h-[46px] items-center justify-center gap-2 rounded-full border border-white/15 bg-white/10 px-[18px] text-[15px] font-bold leading-none text-white transition-colors hover:bg-white/15 whitespace-nowrap"
                            title="로그아웃"
                        >
                            <User size={16} className="text-white/90" />
                            로그아웃
                        </button>
                    </div>
                </div>

                {(smsStatus || smsSendLogs.length > 0) && (
                    <div className="mx-auto flex max-w-[1400px] items-center justify-end gap-2 px-[22px] py-2">
                        {smsStatus ? (
                            <span className={`text-[11px] font-medium ${smsStatus.type === 'success' ? 'text-white/78' : 'text-[#ffb4b4]'}`}>
                                {smsStatus.message}
                            </span>
                        ) : null}
                        {smsSendLogs.length > 0 ? (
                            <span
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] ${smsSendLogs[0].status === 'success'
                                    ? 'border-white/10 bg-white/8 text-white/88'
                                    : 'border-[#6b1f1f] bg-[#3a1111] text-[#ffd6d6]'
                                    }`}
                                title={smsSendLogs[0].detail}
                            >
                                <span className="font-bold">{smsSendLogs[0].seq}번</span>
                                <span className="font-medium opacity-70">{formatSmsCompletedHm(smsSendLogs[0].completedAt)} 완료</span>
                                <span className="font-bold">{smsSendLogs[0].status === 'success' ? '성공' : '실패'}</span>
                            </span>
                        ) : null}
                    </div>
                )}

                <div className="mx-auto max-w-[1400px] px-[22px] pb-3 lg:hidden">
                    <nav ref={tabContainerRef} className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide whitespace-nowrap pb-1">
                        {navItems.map((item) => {
                            const isActive = pathname === item.path || (item.path !== '/admin' && pathname.startsWith(item.path))

                            return (
                                <Link
                                    key={item.path}
                                    ref={isActive ? activeTabRef : undefined}
                                    href={item.path}
                                    prefetch={false}
                                    className={`${navLinkBaseClass} ${isActive ? navLinkActiveClass : navLinkIdleClass}`}
                                >
                                    {item.name}
                                    {item.count && item.count > 0 ? (
                                        <span className={`${navBadgeBaseClass} ${isActive ? 'bg-slate-950 text-white' : 'bg-white/16 text-white'}`}>
                                            {item.count}
                                        </span>
                                    ) : null}
                                    {item.alert ? (
                                        <span className={`${navBadgeBaseClass} ${isActive ? 'bg-slate-950 text-white' : 'bg-white/16 text-white'}`}>
                                            !
                                        </span>
                                    ) : null}
                                </Link>
                            )
                        })}
                    </nav>
                </div>
            </div>
        </div>
    )
}
