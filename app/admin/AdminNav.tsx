'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useEffect, useMemo, useState } from 'react'

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
}: {
    counts?: { pendingOrders: number, lowStock: number, pendingPartners: number, missingBill: number }
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
        { name: '재고관리', path: '/admin/inventory' },
    ]

    useEffect(() => {
        let mounted = true

        async function loadFromNumber() {
            setLoadingFromNumber(true)
            try {
                const response = await fetch('/api/admin/sms', { cache: 'no-store' })
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
                    toNumber: '01034443467',
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
                                prefetch={false}
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

                <div className="shrink-0 flex items-center gap-2">
                    <input
                        type="number"
                        min={1}
                        inputMode="numeric"
                        value={shipmentCount}
                        onChange={(event) => setShipmentCount(event.target.value)}
                        className="w-[92px] px-3 py-2 text-xs font-black rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500/30"
                        placeholder="건수"
                        aria-label="출고 건수"
                    />

                    <button
                        onClick={handleSendSms}
                        disabled={sendingSms || loadingFromNumber}
                        className="px-3 py-2 text-xs font-black text-white bg-red-500 hover:bg-red-600 disabled:bg-gray-300 rounded-xl transition-all"
                    >
                        {sendingSms ? '발송중...' : '문자발송'}
                    </button>

                    <button
                        onClick={() => signOut({ callbackUrl: '/login' })}
                        className="px-3 py-2 text-xs font-black text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    >
                        로그아웃
                    </button>
                </div>
            </div>

            {smsStatus ? (
                <div className={`max-w-7xl mx-auto mt-1 text-[11px] font-semibold ${smsStatus.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                    {smsStatus.message}
                </div>
            ) : null}

            {smsSendLogs.length > 0 ? (
                <div className="max-w-7xl mx-auto mt-1 flex flex-wrap gap-1.5">
                    {smsSendLogs.slice(0, 6).map((log) => (
                        <div
                            key={`${log.seq}-${log.completedAt}`}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${log.status === 'success'
                                ? 'border-green-200 bg-green-50 text-green-700'
                                : 'border-red-200 bg-red-50 text-red-700'
                                }`}
                            title={log.detail}
                        >
                            <span className="font-black text-slate-700">{log.seq}번</span>
                            <span className="font-semibold text-slate-500">{formatSmsCompletedHm(log.completedAt)} 완료</span>
                            <span className="font-black">{log.status === 'success' ? '성공' : '실패'}</span>
                        </div>
                    ))}
                </div>
            ) : null}
        </div>
    )
}
