import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import ChangePasswordForm from "@/components/ChangePasswordForm"
import LogoutButton from "@/components/LogoutButton"
import { User, History, LogOut } from 'lucide-react'

export default async function ProfilePage() {
    const session = await getServerSession(authOptions)
    if (!session) redirect('/login')

    let country = session.user.country || ''

    if (session?.user?.id) {
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                country: true,
            },
        })
        if (user) {
            country = user.country || country
        }
    }

    const isKorean = country === 'Korea'
    const role = session.user.role === 'ADMIN'
        ? (isKorean ? '관리자' : '管理者 / Admin')
        : (isKorean ? '파트너' : 'パートナー / Partner')

    return (
        <div className="max-w-[400px] mx-auto space-y-4 pb-20 pt-1.5">
            {/* Account Info Section */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 ml-1">
                    <div className="w-5 h-5 flex items-center justify-center text-gray-400">
                        <User size={16} className="stroke-[2.5]" />
                    </div>
                    <h2 className="text-[12px] font-semibold text-[#1e293b] dark:text-white tracking-tight">{isKorean ? '계정 정보' : 'アカウント情報 / Account Info'}</h2>
                </div>

                <div className="flex flex-col gap-3">
                    {/* Name Field Style Card */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[12px] font-semibold text-[#1e293b] dark:text-white tracking-tight ml-1">{isKorean ? '이름' : '氏名 / Name'}</label>
                        <div className="w-full h-12 px-4 bg-[#f9f9f9] dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] rounded-lg flex items-center shadow-sm dark:shadow-none text-[14px] font-medium text-gray-800 dark:text-gray-400">
                            {session.user.name}
                        </div>
                    </div>

                    {/* Email Field Style Card */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[12px] font-semibold text-[#1e293b] dark:text-white tracking-tight ml-1">{isKorean ? '사용자 아이디' : 'ユーザーID / User ID'}</label>
                        <div className="w-full h-12 px-4 bg-[#f9f9f9] dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] rounded-lg flex items-center shadow-sm dark:shadow-none text-[14px] font-medium text-gray-800 dark:text-gray-400">
                            {session.user.email}
                        </div>
                    </div>

                    {/* Status Field Style Card */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[12px] font-semibold text-[#1e293b] dark:text-white tracking-tight ml-1">{isKorean ? '계정 권한' : '権限 / Status'}</label>
                        <div className="w-full h-12 px-4 bg-[#f9f9f9] dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] rounded-lg flex items-center shadow-sm dark:shadow-none text-[14px] font-bold text-[#e34219]">
                            {role}
                        </div>
                    </div>
                </div>
            </div>

            {/* Separator */}
            <div className="border-t border-gray-100 dark:border-[#2a2a2a] w-full"></div>

            {/* Password Change Section */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 ml-1">
                    <div className="w-5 h-5 flex items-center justify-center text-gray-400">
                        <History size={16} className="stroke-[2.5]" />
                    </div>
                    <h2 className="text-[12px] font-semibold text-[#1e293b] dark:text-white tracking-tight">{isKorean ? '비밀번호 변경' : 'パスワード変更 / Password Change'}</h2>
                </div>

                <ChangePasswordForm isKorean={isKorean} />
            </div>

            {/* Footer / Logout */}
            <div className="flex flex-col items-center gap-4 py-2">
                <LogoutButton className="text-gray-400 hover:text-[#e34219] transition-colors flex items-center gap-2 group">
                    <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="text-[11px] font-bold tracking-tight">{isKorean ? '로그아웃' : 'ログアウト / Logout'}</span>
                </LogoutButton>
            </div>
        </div>
    )
}
