import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parsePartnerProfileInput } from '@/lib/partnerProfileInput'

export async function PATCH(request: Request) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    let data: ReturnType<typeof parsePartnerProfileInput>
    try { data = parsePartnerProfileInput(await request.json()) }
    catch { return NextResponse.json({ error: 'INVALID' }, { status: 400 }) }
    try {
        const saved = await prisma.$transaction(async tx => {
            const user = await tx.user.findUnique({ where: { id: session.user.id }, select: { role: true, status: true } })
            if (!user || user.role !== 'PARTNER' || user.status !== 'APPROVED') return false
            const { name, ...profile } = data
            await tx.user.update({ where: { id: session.user.id }, data: {
                name,
                partnerProfile: { upsert: { create: profile, update: profile } },
            } })
            return true
        })
        if (!saved) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Partner profile update failed', error)
        return NextResponse.json({ error: 'FAILED' }, { status: 500 })
    }
}
