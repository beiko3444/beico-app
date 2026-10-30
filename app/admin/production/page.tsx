import { prisma } from '@/lib/prisma'
import ProductionClient from "./ProductionClient"

export const metadata = { title: '생산 관리' }

export const dynamic = 'force-dynamic'

export default async function ProductionPage() {
    // Batch counts per category so empty tabs read as empty before they are opened.
    let initialCounts: Record<string, number> = {}
    try {
        const rows = await prisma.productionBatch.groupBy({ by: ['category'], _count: { _all: true } })
        initialCounts = Object.fromEntries(rows.map(row => [row.category, row._count._all]))
    } catch (error) {
        console.error('[production page]', error)
    }
    return <ProductionClient initialCounts={initialCounts} />
}
