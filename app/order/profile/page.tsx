import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import ChangePasswordForm from "@/components/ChangePasswordForm"

export default async function ProfilePage() {
    const session = await getServerSession(authOptions)
    if (!session) redirect('/login')

    return (
        <div className="space-y-8">
            <h1 className="text-2xl font-bold text-gray-800">My Profile</h1>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-semibold mb-4 text-[var(--color-brand-blue)]">Account Info</h2>
                <div className="space-y-2 text-sm">
                    <div className="flex"><span className="w-24 text-gray-500">Name:</span> <span className="font-medium">{session.user.name}</span></div>
                    <div className="flex"><span className="w-24 text-gray-500">Username:</span> <span className="font-medium">{session.user.email}</span></div>
                    <div className="flex"><span className="w-24 text-gray-500">Role:</span> <span className="font-medium">{session.user.role}</span></div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-semibold mb-4 text-[var(--color-brand-blue)]">Change Password</h2>
                <ChangePasswordForm />
            </div>
        </div>
    )
}
