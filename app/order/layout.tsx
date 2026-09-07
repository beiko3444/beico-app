import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'
import UserNavbar from '@/components/UserNavbar'
import PartnerNoticeBoard, { type PartnerNoticeBoardItem } from '@/components/PartnerNoticeBoard'
import { LogOut } from 'lucide-react'

export default async function OrderLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await getServerSession(authOptions)

    if (!session) {
        redirect('/login')
    }

    let businessName = session.user.name || session.user.email || "Partner"
    let businessNameJP = session.user.name || session.user.email || "Partner"

    let country = ""
    let activeNotices: PartnerNoticeBoardItem[] = []

    if (session?.user?.id) {
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                name: true,
                country: true,
                partnerProfile: { select: { businessName: true } },
            },
        })
        if (user) {
            businessName = user.partnerProfile?.businessName || user.name || "Partner"
            businessNameJP = user.name || businessName
            country = user.country || ""
        }
    }

    if (session.user.role === 'PARTNER') {
        try {
            const now = new Date()
            const notices = await prisma.partnerNotice.findMany({
                where: {
                    isActive: true,
                    AND: [
                        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
                        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
                    ],
                },
                orderBy: { updatedAt: 'desc' },
                take: 5,
                select: {
                    id: true,
                    title: true,
                    content: true,
                    tone: true,
                    updatedAt: true,
                },
            })

            activeNotices = notices.map((notice) => ({
                ...notice,
                updatedAt: notice.updatedAt.toISOString(),
            }))
        } catch (error) {
            console.error('Failed to load partner notice:', error)
        }
    }

    const countryDisplay =
        country === 'Korea' ? '🇰🇷 대한민국 KR' :
            country === 'Japan' ? '🇯🇵 日本 JP' :
                country === 'USA' ? '🇺🇸 米国 US' :
                    country === 'China' ? '🇨🇳 中国 CN' :
                        country === 'Turkey' ? '🇹🇷 Türkiye TR' :
                            country === 'Indonesia' ? '🇮🇩 ID' :
                                country
    const isKorean = country === 'Korea'

    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
            <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--card)]/95 shadow-[0_2px_10px_rgba(16,24,40,0.05)] backdrop-blur">
                <div className="mx-auto flex h-[72px] max-w-[1440px] items-center gap-3 px-3 sm:h-[78px] sm:px-5 lg:px-7">
                    <Link href="/order" className="flex shrink-0 items-center no-underline" aria-label="주문 홈">
                        <img src="/logo.png" alt="BEIKO BAIT" className="h-auto w-[68px] object-contain sm:w-[84px]" />
                    </Link>

                    <div className="hidden min-w-0 flex-1 items-center justify-center sm:flex">
                        <UserNavbar isKorean={isKorean} />
                    </div>

                    <div className="ml-auto flex min-w-0 items-center gap-2 sm:ml-0 sm:gap-3">
                        <div className="min-w-0 text-right leading-tight">
                            <div className="max-w-[128px] truncate text-[11px] font-extrabold text-[var(--foreground)] sm:max-w-[170px] sm:text-[12px]">{businessNameJP}</div>
                            {(countryDisplay || country) ? (
                                <div className="mt-1 text-[9px] font-semibold text-[var(--muted-foreground)] sm:text-[10px]">{countryDisplay || country}</div>
                            ) : null}
                        </div>
                        <LogoutButton className="h-10 rounded-xl border border-[var(--border-strong)] bg-[var(--card)] px-3 text-[var(--muted-foreground)] hover:bg-[var(--card-hover)] hover:text-[var(--foreground)] sm:h-12 sm:px-5">
                            <LogOut size={17} className="md:hidden" />
                            <span className="hidden md:inline">{isKorean ? '로그아웃' : 'ログアウト'}</span>
                        </LogoutButton>
                    </div>
                </div>
            </header>

            <main className="ux-page mx-auto max-w-[1440px] px-3 pb-24 pt-5 sm:px-5 sm:pb-10 sm:pt-7 lg:px-7">
                <PartnerNoticeBoard notices={activeNotices} isKorean={isKorean} />
                {children}
            </main>
            <div className="sm:hidden">
                <UserNavbar isKorean={isKorean} />
            </div>
        </div>
    )
}
