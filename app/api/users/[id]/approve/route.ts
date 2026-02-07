import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const resolvedParams = await params
    const id = resolvedParams.id
    console.log('[API] Approve User Request:', id)
    try {
        const session = await getServerSession(authOptions)
        console.log('[API] Session:', JSON.stringify(session, null, 2))

        if (!session || session.user.role !== 'ADMIN') {
            console.log('[API] Unauthorized access attempt')
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const { status } = body
        console.log('[API] Target ID:', id, 'New Status:', status)

        if (!status || !['APPROVED', 'REJECTED', 'PENDING'].includes(status)) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
        }

        const user = await prisma.user.update({
            where: { id },
            data: { status }
        })

        return NextResponse.json(user)
    } catch (error) {
        console.error('Error updating status:', error)
        return NextResponse.json(
            { error: 'Failed to update user status' },
            { status: 500 }
        )
    }
}
