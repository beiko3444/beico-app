import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'
import UserNavbar from '@/components/UserNavbar'
import PartnerNoticeBoard, { type PartnerNoticeBoardItem } from '@/components/PartnerNoticeBoard'
import { Languages, LogOut } from 'lucide-react'
import { buttonClass } from '@/components/ui/buttonClass'
import { partnerCountryLabel, themedGhost } from './partner-ui'

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

    const countryDisplay = partnerCountryLabel(country)
    const isKorean = country === 'Korea'

    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
            <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--card)] shadow-[0_2px_10px_rgba(16,24,40,0.05)]">
                {/* Equal side columns keep the tabs on the page's centre line, the same axis as the content and the order bar. */}
                <div className="mx-auto grid h-[72px] max-w-[1440px] grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-3 sm:h-[78px] sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:px-5 lg:px-7">
                    <Link href="/order" className="flex shrink-0 items-center justify-self-start no-underline" aria-label={isKorean ? '주문 홈' : '注文ホーム'}>
                        {/* Sized by height so the logo keeps clear space inside the bar. */}
                        <img src="/logo.png" alt="BEIKO BAIT" className="h-12 w-auto object-contain sm:h-14" />
                    </Link>

                    <div className="hidden items-center justify-center sm:flex">
                        <UserNavbar isKorean={isKorean} />
                    </div>

                    <div className="flex min-w-0 items-center justify-self-end gap-1">
                        <div className="mr-2 min-w-0 text-right leading-tight">
                            <div className="max-w-[128px] truncate text-sm font-bold text-[var(--foreground)] sm:max-w-[170px]">{businessNameJP}</div>
                            {countryDisplay ? (
                                <div className="mt-0.5 text-xs text-[var(--muted-foreground)]">{countryDisplay}</div>
                            ) : null}
                        </div>
                        {/* Opens a separate tool in a new tab, so it sits with the account utilities instead of the page tabs. */}
                        <a
                            href="/translator"
                            target="_blank"
                            rel="noopener noreferrer"
                            className={buttonClass('ghost', 'iconMd', themedGhost)}
                            aria-label={isKorean ? '번역기 (새 탭)' : '翻訳ツール（新しいタブ）'}
                            title={isKorean ? '번역기' : '翻訳ツール'}
                        >
                            <Languages size={18} aria-hidden />
                        </a>
                        <LogoutButton
                            label={isKorean ? '로그아웃' : 'ログアウト'}
                            className={buttonClass('ghost', 'iconMd', `min-h-0 font-semibold md:w-auto md:px-3 md:text-sm ${themedGhost}`)}
                        >
                            <LogOut size={17} className="md:hidden" aria-hidden />
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
