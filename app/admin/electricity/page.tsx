import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import ElectricityClient from "./ElectricityClient"

export const dynamic = 'force-dynamic'

export default async function ElectricityPage() {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
        redirect('/login')
    }

    return (
        <ElectricityClient />
    )
}
