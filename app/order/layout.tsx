import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'
import UserNavbar from '@/components/UserNavbar'

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

    if (session?.user?.id) {
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                name: true,
                country: true,
                partnerProfile: { select: { businessName: true } },
            },
        }) as any
        if (user) {
            businessName = user.partnerProfile?.businessName || user.name || "Partner"
            businessNameJP = user.name || businessName
            country = user.country || ""
        }
    }

    const countryDisplay =
        country === 'Korea' ? '🇰🇷 韓国 KR' :
            country === 'Japan' ? '🇯🇵 日本 JP' :
                country === 'USA' ? '🇺🇸 米国 US' :
                    country === 'China' ? '🇨🇳 中国 CN' :
                        country === 'Turkey' ? '🇹🇷 Türkiye TR' :
                            country === 'Indonesia' ? '🇮🇩 ID' :
                                country

    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
            <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--card)]/95 shadow-[0_1px_2px_rgba(16,24,40,0.06)] backdrop-blur">
                <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-3 sm:px-5 lg:px-7">
                    <Link href="/order" className="flex shrink-0 items-center no-underline" aria-label="주문 홈">
                        <img src="/logo.png" alt="BEIKO BAIT" className="h-auto w-[62px] object-contain" />
                    </Link>

                    <div className="hidden min-w-0 flex-1 items-center justify-center sm:flex">
                        <UserNavbar />
                    </div>

                    <div className="ml-auto flex min-w-0 items-center gap-2 sm:ml-0">
                        <div className="min-w-0 text-right">
                            <div className="max-w-[170px] truncate text-[12px] font-extrabold text-[var(--foreground)]">{businessNameJP}</div>
                            {(countryDisplay || country) ? (
                                <div className="mt-0.5 text-[10px] font-semibold text-[var(--muted-foreground)]">{countryDisplay || country}</div>
                            ) : null}
                        </div>
                        <LogoutButton className="rounded-md border border-[var(--border-strong)] bg-[var(--card)] text-[var(--muted-foreground)] hover:bg-[var(--card-hover)] hover:text-[var(--foreground)]">
                            <span className="hidden md:inline">ログアウト</span>
                        </LogoutButton>
                    </div>
                </div>
            </header>

            <main className="ux-page mx-auto max-w-[1440px] px-3 pb-24 pt-4 sm:px-5 sm:pb-10 lg:px-7">
                {children}
            </main>
            <div className="sm:hidden">
                <UserNavbar />
            </div>
        </div>
    )
}
