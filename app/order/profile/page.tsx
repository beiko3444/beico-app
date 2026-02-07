import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import ChangePasswordForm from "@/components/ChangePasswordForm"

export default async function ProfilePage() {
    const session = await getServerSession(authOptions)
    if (!session) redirect('/login')

    return (
        <div className="space-y-8">
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                <span className="w-2 h-8 bg-[var(--color-brand-blue)] rounded-full"></span>
                마이페이지
            </h1>

            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-brand-blue)]/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
                <h2 className="text-base font-black mb-6 text-gray-900 flex items-center gap-2">
                    <span className="text-lg">📋</span> 계정 정보
                </h2>
                <div className="space-y-4 text-sm relative z-10">
                    <div className="flex items-center p-3 rounded-xl bg-gray-50/50 border border-gray-100">
                        <span className="w-32 text-gray-400 font-black text-[11px] uppercase tracking-wider">이름</span>
                        <span className="font-bold text-gray-900">{session.user.name}</span>
                    </div>
                    <div className="flex items-center p-3 rounded-xl bg-gray-50/50 border border-gray-100">
                        <span className="w-32 text-gray-400 font-black text-[11px] uppercase tracking-wider">아이디</span>
                        <span className="font-bold text-gray-900">{session.user.email}</span>
                    </div>
                    <div className="flex items-center p-3 rounded-xl bg-gray-50/50 border border-gray-100">
                        <span className="w-32 text-gray-400 font-black text-[11px] uppercase tracking-wider">권한</span>
                        <span className="px-2 py-0.5 bg-gray-900 text-white text-[9px] font-black rounded uppercase">
                            {session.user.role === 'ADMIN' ? '관리자' : '파트너'}
                        </span>
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
                <h2 className="text-base font-black mb-6 text-gray-900 flex items-center gap-2">
                    <span className="text-lg">🔒</span> 비밀번호 변경
                </h2>
                <ChangePasswordForm />
            </div>
        </div>
    )
}
