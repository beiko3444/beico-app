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

    if (session?.user?.id) {
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { partnerProfile: true }
        })
        if (user) {
            businessName = user.partnerProfile?.businessName || user.name
            businessNameJP = user.name // Using user.name as JP name fallback or primary
        }
    }

    return (
        <div className="min-h-screen bg-gray-50/50">
            {/* Sophisticated Top Navigation Bar */}
            <header className="sticky top-0 z-50 bg-white shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)]">
                {/* Main White Header */}
                <div className="max-w-6xl mx-auto px-4 md:px-8">
                    <div className="h-20 flex justify-between items-center">
                        <div className="flex items-center gap-8">
                            <Link href="/order" className="flex items-center group">
                                <div className="w-20 h-auto transition-all duration-300 group-hover:scale-105">
                                    <img
                                        src="/logo.png"
                                        alt="BEIKO BAIT"
                                        className="w-full h-full object-contain"
                                    />
                                </div>
                            </Link>

                            <Clock />
                        </div>

                        {/* Navigation Tabs */}
                        <div className="flex items-center">
                            <UserNavbar />
                        </div>
                    </div>
                </div>

                {/* Dark User Info Bar */}
                <div className="bg-[#1e293b] text-white/90 border-t border-[#334155]">
                    <div className="max-w-6xl mx-auto px-4 md:px-8 h-12 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-1.5 bg-white/10 rounded-md">
                                <Building2 size={16} className="text-white" />
                            </div>
                            <div className="flex flex-col leading-[1.1]">
                                <span className="text-[13px] text-gray-300 font-medium">Logged in as: <span className="text-white font-black">{businessName}</span></span>
                                <span className="text-[10px] text-gray-400">ログイン中: {businessNameJP}</span>
                            </div>
                        </div>

                        <LogoutButton className="text-gray-400 hover:text-white" />
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="max-w-6xl mx-auto py-8 px-4 md:px-8">
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {children}
                </div>
            </main>
        </div>
    )
}
