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
            include: { partnerProfile: true }
        }) as any
        if (user) {
            businessName = user.partnerProfile?.businessName || user.name
            businessNameJP = user.name
            businessRegNumber = user.partnerProfile?.businessRegNumber || ""
            address = user.partnerProfile?.address || ""
            country = user.country || ""
        }
    }

    const countryDisplay = country === 'Korea' ? '韓国 KR' : country === 'Japan' ? '日本 JP' : country === 'USA' ? '米国 US' : country

    return (
        <div className="min-h-screen bg-[#f9f9f9]">
            {/* Sophisticated Top Navigation Bar */}
            <header className="sticky top-0 z-50 bg-white shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)]">
                {/* Main White Header */}
                <div className="max-w-6xl mx-auto px-4 md:px-8">
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

                {/* Brand Red User Info Bar */}
                <div className="bg-[#e34219] text-white border-t border-white/10 shadow-sm">
                    <div className="max-w-6xl mx-auto px-4 md:px-8 h-[64px] flex items-center justify-between">
                        {/* LEFT: Retailer Info & Clock */}
                        <div className="flex items-center gap-8">
                            <div className="flex flex-col gap-1.5">
                                <div className="flex flex-col">
                                    <span className="text-[13px] font-black text-white tracking-tight leading-none">小売店・卸売業者向け</span>
                                    <span className="text-[7.5px] font-bold text-white/80 uppercase tracking-widest leading-none mt-1.5">For retailers & distributors</span>
                                </div>
                                <Clock className="text-white text-[11px] leading-none" />
                            </div>
                        </div>

                        {/* RIGHT: User Information & Logout */}
                        <div className="flex items-center">
                            <div className="flex flex-col items-end border-r border-white/20 pr-5 gap-1.5">
                                <span className="text-[9px] text-white/70 font-bold leading-none uppercase tracking-wider">ログイン中:</span>
                                <span className="text-[17px] text-white font-black leading-none">{businessNameJP}</span>
                                {countryDisplay && (
                                    <span className="bg-white px-2 py-0.5 rounded text-[10px] font-black text-[#e34219] shadow-sm">
                                        {countryDisplay}
                                    </span>
                                )}
                            </div>
                            <div className="pl-5">
                                <LogoutButton vertical className="text-white hover:text-white" />
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="max-w-6xl mx-auto pt-3 pb-8 px-4 md:px-8">
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {children}
                </div>
            </main>

        </div>
    )
}
