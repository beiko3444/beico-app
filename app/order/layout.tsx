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

    return (
        <div className="min-h-screen bg-gray-50/50">
            {/* Sophisticated Top Navigation Bar */}
            <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)]">
                <div className="max-w-6xl mx-auto px-4 md:px-8">
                    <div className="h-20 flex justify-between items-center">
                        {/* Logo & Brand Identity */}
                        <Link href="/order" className="flex items-center group">
                            <div className="w-14 h-14 relative transition-all duration-300 group-hover:scale-105">
                                <img
                                    src="/bko.png"
                                    alt="BEIKO BAIT"
                                    className="w-full h-full object-contain"
                                />
                            </div>
                        </Link>

                        {/* Navigation Tabs (Hidden on small screens, but we can make it scrollable if needed) */}
                        <div className="hidden md:flex items-center bg-gray-100/80 p-1.5 rounded-2xl border border-gray-100">
                            <UserNavbar />
                        </div>

                        {/* User Actions & Profile */}
                        <div className="flex items-center gap-6">
                            <div className="hidden lg:flex flex-col items-end">
                                <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest leading-none mb-1 opacity-60">
                                    파트너 계정
                                </span>
                                <span className="text-xs font-black text-gray-800 flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                                    {session.user.name || session.user.email}
                                </span>
                            </div>

                            <div className="h-10 w-px bg-gray-100 hidden sm:block"></div>

                            <LogoutButton />
                        </div>
                    </div>
                </div>

                {/* Mobile Navigation (Shown only on small screens) */}
                <div className="md:hidden flex justify-center p-2 border-t border-gray-50 bg-white/50">
                    <UserNavbar />
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
