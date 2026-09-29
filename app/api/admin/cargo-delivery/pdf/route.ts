import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { toProxyRecord } from "@/lib/cargoDeliveryProxy"
import { renderCargoProxyPdf } from "@/lib/cargoDeliveryProxyPdf"

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** 서버에서 렌더링한 위임장 PDF (팩스로 나가는 파일과 동일) */
export async function GET(request: Request) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')?.trim() || ''
    if (!id) {
        return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const row = await prisma.cargoDeliveryProxy.findUnique({ where: { id } })
    if (!row) {
        return NextResponse.json({ error: '위임장을 찾을 수 없습니다.' }, { status: 404 })
    }

    try {
        const pdf = await renderCargoProxyPdf(toProxyRecord(row))
        return new NextResponse(new Uint8Array(pdf), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${row.documentNo}.pdf"`,
                'Cache-Control': 'no-store',
            },
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('Failed to render cargo proxy PDF:', error)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
