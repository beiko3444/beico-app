import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import ChangePasswordForm from "@/components/ChangePasswordForm"
import LogoutButton from "@/components/LogoutButton"
import { User, Bell, ShieldCheck, History, LogOut } from 'lucide-react'

export default async function ProfilePage() {
    const session = await getServerSession(authOptions)
    if (!session) redirect('/login')

    let businessName = session.user.name || session.user.email
    let role = session.user.role === 'ADMIN' ? '관리자 / Admin' : '파트너 / Partner'

    if (session?.user?.id) {
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { partnerProfile: true }
        })
        if (user) {
            businessName = user.partnerProfile?.businessName || user.name
        }
    }

    return (
        <div className="max-w-[400px] mx-auto space-y-8 pb-20">
            {/* Logo & Title Section - Matching Login Style */}
            <div className="flex flex-col items-center mt-4">
                <div className="w-[110px] h-auto mb-4 relative">
                    <img
                        src="/logo.png"
                        alt="BEIKO BAIT"
                        className="w-full h-full object-contain"
                    />
                </div>

                <h1 className="text-xl font-bold text-gray-800 tracking-tight mb-1">マイページ / My Page</h1>
                <div className="flex flex-col items-center gap-1.5">
                    <p className="text-[9px] font-bold tracking-[0.4em] uppercase text-gray-400 leading-none">
                        Account Settings
                    </p>
                    <p className="text-[9px] font-bold tracking-[0.4em] uppercase text-[#e34219] leading-none">
                        Partner Profile
                    </p>
                </div>
            </div>

            {/* Account Info Section */}
            <div className="space-y-5">
                <div className="flex items-center gap-2 ml-1">
                    <div className="w-5 h-5 flex items-center justify-center text-gray-400">
                        <User size={16} className="stroke-[2.5]" />
                    </div>
                    <h2 className="text-[12px] font-semibold text-[#1e293b] tracking-tight">アカウント情報 / Account Info</h2>
                </div>

                <div className="flex flex-col gap-4">
                    {/* Name Field Style Card */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[12px] font-semibold text-[#1e293b] tracking-tight ml-1">氏名 / Name</label>
                        <div className="w-full h-12 px-4 bg-white border border-gray-200 rounded-lg flex items-center shadow-sm text-[14px] font-medium text-gray-800">
                            {session.user.name}
                        </div>
                    </div>

                    {/* Email Field Style Card */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[12px] font-semibold text-[#1e293b] tracking-tight ml-1">ユーザーID / User ID</label>
                        <div className="w-full h-12 px-4 bg-white border border-gray-200 rounded-lg flex items-center shadow-sm text-[14px] font-medium text-gray-800">
                            {session.user.email}
                        </div>
                    </div>

                    {/* Status Field Style Card */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[12px] font-semibold text-[#1e293b] tracking-tight ml-1">権限 / Status</label>
                        <div className="w-full h-12 px-4 bg-white border border-gray-200 rounded-lg flex items-center shadow-sm text-[14px] font-bold text-[#e34219]">
                            {role}
                        </div>
                    </div>
                </div>
            </div>

            {/* Separator */}
            <div className="border-t border-gray-200 w-full pt-1"></div>

            {/* Password Change Section */}
            <div className="space-y-5">
                <div className="flex items-center gap-2 ml-1">
                    <div className="w-5 h-5 flex items-center justify-center text-gray-400">
                        <History size={16} className="stroke-[2.5]" />
                    </div>
                    <h2 className="text-[12px] font-semibold text-[#1e293b] tracking-tight">パスワード変更 / Password Change</h2>
                </div>

                <ChangePasswordForm />
            </div>

            {/* Footer / Logout */}
            <div className="flex flex-col items-center gap-4 py-4 pt-2">
                <LogoutButton className="text-gray-400 hover:text-[#e34219] transition-colors flex items-center gap-2 group">
                    <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="text-[11px] font-bold tracking-tight">ログアウト / Logout</span>
                </LogoutButton>
            </div>
        </div>
    )
}
