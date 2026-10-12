import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPartnerProductStatusWrite, PARTNER_PRODUCT_STATUSES } from '@/lib/partnerProductStatus'

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: '로그인이 만료되었습니다. 다시 로그인해 주세요.' }, { status: 401 })
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: '관리자만 노출상태를 변경할 수 있습니다.' }, { status: 403 })
    const { id } = await context.params
    let body
    try { body = await request.json() } catch {
        return NextResponse.json({ error: '올바른 저장 요청이 아닙니다.' }, { status: 400 })
    }
    if (!body || !PARTNER_PRODUCT_STATUSES.includes(body.partnerSaleStatus)) {
        return NextResponse.json({ error: '노출, 비노출, 품절 중 하나를 선택해 주세요.' }, { status: 400 })
    }
    try {
        // Save both visibility fields atomically without a stock-history transaction.
        const product = await prisma.product.update({
            where: { id }, data: getPartnerProductStatusWrite(body.partnerSaleStatus),
            select: { id: true, partnerSaleStatus: true, wholesaleAvailable: true },
        })
        // Cache failure must not report an already-persisted update as failed.
        try {
            revalidatePath('/admin/products')
            revalidatePath('/order')
        } catch (error) {
            console.error('Product visibility cache invalidation failed', { id, error })
        }
        return NextResponse.json(product)
    } catch (error: any) {
        console.error('Product visibility save failed', { id, code: error?.code, error })
        if (error?.code === 'P2025') return NextResponse.json({ error: '상품이 삭제되었거나 존재하지 않습니다. 새로고침해 주세요.' }, { status: 404 })
        const transient = ['P1001', 'P1002', 'P1008', 'P1017', 'P2024'].includes(error?.code)
        return NextResponse.json({
            error: transient ? 'DB 연결이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.' : '노출상태 저장 중 서버 오류가 발생했습니다.',
        }, { status: transient ? 503 : 500 })
    }
}
