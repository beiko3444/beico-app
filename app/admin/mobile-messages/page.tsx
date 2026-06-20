import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { MessageSquareText, Search, Smartphone, X } from "lucide-react"

export const dynamic = 'force-dynamic'

type PageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const formatDateTime = (date: Date) =>
    new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date)

function firstParam(value: string | string[] | undefined) {
    if (Array.isArray(value)) return value[0] || ''
    return value || ''
}

export default async function MobileMessagesPage({ searchParams }: PageProps) {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
        redirect('/login')
    }

    const params = (await searchParams) || {}
    const query = firstParam(params.q).trim()
    const where = query
        ? {
            OR: [
                { sender: { contains: query, mode: 'insensitive' as const } },
                { senderName: { contains: query, mode: 'insensitive' as const } },
                { body: { contains: query, mode: 'insensitive' as const } },
                { sourceDevice: { contains: query, mode: 'insensitive' as const } },
                { user: { name: { contains: query, mode: 'insensitive' as const } } },
                { user: { username: { contains: query, mode: 'insensitive' as const } } },
            ],
        }
        : undefined

    const [messages, totalCount, matchedCount] = await Promise.all([
        prisma.mobileMessage.findMany({
            where,
            orderBy: { receivedAt: 'desc' },
            take: 200,
            select: {
                id: true,
                messageType: true,
                sender: true,
                senderName: true,
                body: true,
                receivedAt: true,
                sourceDevice: true,
                user: {
                    select: {
                        name: true,
                        username: true,
                    },
                },
            },
        }),
        prisma.mobileMessage.count(),
        prisma.mobileMessage.count({ where }),
    ])

    const latest = messages[0]?.receivedAt

    return (
        <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-sm font-bold text-blue-700">
                        <MessageSquareText size={18} />
                        Android SMS/MMS
                    </div>
                    <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">수신문자함</h1>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                        전체 {totalCount.toLocaleString()}건
                        {query ? ` · 검색결과 ${matchedCount.toLocaleString()}건` : ''}
                        {' '}· 최근 {messages.length.toLocaleString()}건 표시
                        {latest ? ` · 최신 ${formatDateTime(latest)}` : ''}
                    </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-600 shadow-sm">
                    저장 API: /api/mobile/messages/batch
                </div>
            </div>

            <form action="/admin/mobile-messages" className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row">
                <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        name="q"
                        defaultValue={query}
                        placeholder="발신번호, 연락처명, 본문, 기기명 검색"
                        className="h-12 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 focus:bg-white"
                    />
                </div>
                <div className="flex gap-2">
                    <button
                        type="submit"
                        className="h-12 rounded-lg bg-slate-950 px-5 text-sm font-black text-white"
                    >
                        검색
                    </button>
                    {query ? (
                        <a
                            href="/admin/mobile-messages"
                            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-black text-slate-600"
                        >
                            <X size={16} />
                            초기화
                        </a>
                    ) : null}
                </div>
            </form>

            {messages.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
                    <Smartphone className="mx-auto mb-3 text-slate-400" size={34} />
                    <p className="font-black text-slate-700">저장된 문자가 없습니다.</p>
                    <p className="mt-1 text-sm font-semibold text-slate-400">안드로이드 앱에서 테스트 전송을 먼저 눌러보세요.</p>
                </div>
            ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="hidden md:block">
                        <table className="w-full border-collapse text-left text-sm">
                            <thead className="bg-slate-950 text-white">
                                <tr>
                                    <th className="w-44 px-4 py-3 text-xs font-black">수신시간</th>
                                    <th className="w-32 px-4 py-3 text-xs font-black">발신번호</th>
                                    <th className="px-4 py-3 text-xs font-black">본문</th>
                                    <th className="w-36 px-4 py-3 text-xs font-black">기기</th>
                                    <th className="w-28 px-4 py-3 text-xs font-black">사용자</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {messages.map((message) => (
                                    <tr key={message.id} className="align-top hover:bg-slate-50">
                                        <td className="px-4 py-3 text-xs font-bold tabular-nums text-slate-500">
                                            {formatDateTime(message.receivedAt)}
                                        </td>
                                        <td className="px-4 py-3 text-sm font-black text-slate-900">
                                            {message.senderName || message.sender || '-'}
                                            {message.senderName && message.sender ? (
                                                <div className="mt-1 text-[11px] font-bold text-slate-500">{message.sender}</div>
                                            ) : null}
                                            <div className="mt-1 text-[10px] font-bold text-slate-400">{message.messageType}</div>
                                        </td>
                                        <td className="whitespace-pre-wrap px-4 py-3 text-sm font-semibold leading-6 text-slate-800">
                                            {message.body}
                                        </td>
                                        <td className="break-all px-4 py-3 text-xs font-semibold text-slate-500">
                                            {message.sourceDevice || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-xs font-bold text-slate-500">
                                            {message.user.name || message.user.username || '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="divide-y divide-slate-100 md:hidden">
                        {messages.map((message) => (
                            <article key={message.id} className="space-y-2 p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-base font-black text-slate-950">{message.senderName || message.sender || '-'}</p>
                                        {message.senderName && message.sender ? (
                                            <p className="text-xs font-bold text-slate-500">{message.sender}</p>
                                        ) : null}
                                        <p className="text-xs font-bold text-slate-400">{formatDateTime(message.receivedAt)} · {message.messageType}</p>
                                    </div>
                                    <span className="shrink-0 rounded bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500">
                                        {message.user.name || message.user.username || '-'}
                                    </span>
                                </div>
                                <p className="whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-800">{message.body}</p>
                                <p className="break-all text-[11px] font-semibold text-slate-400">{message.sourceDevice || '-'}</p>
                            </article>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
