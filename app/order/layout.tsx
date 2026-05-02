import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'
import UserNavbar from '@/components/UserNavbar'
import { Building2 } from 'lucide-react'
import Clock from '@/components/Clock'

export default async function OrderLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await getServerSession(authOptions)

    if (!session) {
        redirect('/login')
    }

    let businessName = session.user.name || session.user.email
    let businessNameJP = session.user.name || session.user.email

    let businessRegNumber = ""
    let address = ""
    let country = ""

    if (session?.user?.id) {
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                name: true,
                country: true,
                partnerProfile: {
                    select: {
                        businessName: true,
                        businessRegNumber: true,
                        address: true,
                    },
                },
            },
        }) as any
        if (user) {
            businessName = user.partnerProfile?.businessName || user.name
            businessNameJP = user.name
            businessRegNumber = user.partnerProfile?.businessRegNumber || ""
            address = user.partnerProfile?.address || ""
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
        <div className="apple-admin-shell">
            <header className="sticky top-0 z-50 border-b border-[var(--hairline)] bg-white/92 backdrop-blur-md">
                <div className="mx-auto max-w-[1200px] px-4 md:px-8">
                    <div className="h-20 flex justify-between items-center">
                        <Link href="/order" className="flex items-center group">
                            <div className="w-16 h-auto transition-all duration-300 group-hover:scale-105">
                                <img
                                    src="/logo.png"
                                    alt="BEIKO BAIT"
                                    className="w-full h-full object-contain"
                                />
                            </div>
                        </Link>

                        {/* Navigation Tabs */}
                        <div className="flex items-center">
                            <UserNavbar />
                        </div>
                    </div>
                </div>

                <div className="bg-[var(--surface-dark)] text-white">
                    <div className="mx-auto flex h-[64px] max-w-[1200px] items-center justify-between px-4 md:px-8">
                        <div className="flex items-center gap-8">
                            <div className="flex flex-col gap-1.5">
                                <div className="flex flex-col">
                                    <span className="text-[13px] font-semibold tracking-tight leading-none">小売店・卸売業者向け</span>
                                    <span className="mt-1.5 text-[7.5px] font-medium uppercase tracking-[0.28em] leading-none text-white/72">For retailers & distributors</span>
                                </div>
                                <Clock className="text-white/80 text-[11px] leading-none" />
                            </div>
                        </div>

                        <div className="flex items-center">
                            <div className="flex flex-col items-end gap-1 border-r border-white/16 pr-5">
                                <span className="mb-0.5 text-[8.5px] font-medium uppercase tracking-[0.18em] leading-none text-white/62">ログイン中</span>
                                <span className="mb-0.5 text-[17px] font-semibold leading-none">{businessNameJP}</span>
                                {countryDisplay && (
                                    <div className="flex items-center rounded-full bg-white/12 px-2 py-1 text-[9.5px] font-medium leading-none text-white">
                                        {countryDisplay}
                                    </div>
                                )}
                            </div>
                            <div className="pl-5">
                                <LogoutButton vertical className="text-white hover:text-white" />
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-[1200px] px-4 pb-10 pt-5 md:px-8">
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {children}
                </div>
            </main>

        </div>
    )
}
