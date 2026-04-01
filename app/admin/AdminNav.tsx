'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useEffect, useMemo, useState } from 'react'

export default function AdminNav({ counts }: { counts?: { pendingOrders: number, lowStock: number, pendingPartners: number, missingBill: number } }) {
    const pathname = usePathname()
    const [shipmentCount, setShipmentCount] = useState('1')
    const [fromNumber, setFromNumber] = useState('')
    const [loadingFromNumber, setLoadingFromNumber] = useState(true)
    const [sendingSms, setSendingSms] = useState(false)
    const [smsStatus, setSmsStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null)

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

    const parsedShipmentCount = useMemo(() => {
        const value = Number.parseInt(shipmentCount, 10)
        return Number.isFinite(value) && value > 0 ? value : 0
    }, [shipmentCount])

    async function handleSendSms() {
        if (!fromNumber) {
            setSmsStatus({ type: 'error', message: '발신번호를 찾지 못했습니다. 문자발송서비스에서 발신번호를 먼저 확인해주세요.' })
            return
        }
        if (!parsedShipmentCount) {
            setSmsStatus({ type: 'error', message: '출고 건수를 1 이상으로 입력해주세요.' })
            return
        }

        const now = new Date()
        const dateLine = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`
        const contents = [
            '안녕하세요 소장님, 엑스트래커 입니다.',
            dateLine,
            `${parsedShipmentCount}건 출고 집하 부탁드립니다.`,
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
            const result: { error?: string } = await response.json()
            if (!response.ok) {
                throw new Error(result.error || '문자 발송에 실패했습니다.')
            }
            setSmsStatus({ type: 'success', message: '문자 발송 완료' })
        } catch (error) {
            const message = error instanceof Error ? error.message : '문자 발송에 실패했습니다.'
            setSmsStatus({ type: 'error', message })
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
        </div>
    )
}
