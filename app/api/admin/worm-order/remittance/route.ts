import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { MoinAutomationError, submitMoinRemittance } from '@/lib/moinBizplus'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024

const readString = (value: FormDataEntryValue | null) => {
    if (typeof value === 'string') return value.trim()
    return ''
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const formData = await request.formData()

        const moinLoginId = readString(formData.get('moinLoginId'))
        const passwordEntry = formData.get('moinPassword')
        const moinPassword = typeof passwordEntry === 'string' ? passwordEntry : ''
        const amountRaw = readString(formData.get('amountUsd'))
        const invoicePdf = formData.get('invoicePdf')

        if (!moinLoginId || !moinPassword) {
            return NextResponse.json({ error: 'MOIN login ID and password are required.' }, { status: 400 })
        }

        const parsedAmount = Number(amountRaw.replace(/,/g, ''))
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            return NextResponse.json({ error: 'Valid USD amount is required.' }, { status: 400 })
        }

        if (!(invoicePdf instanceof File)) {
            return NextResponse.json({ error: 'Invoice PDF file is required.' }, { status: 400 })
        }

        const isPdf = invoicePdf.type === 'application/pdf' || invoicePdf.name.toLowerCase().endsWith('.pdf')
        if (!isPdf) {
            return NextResponse.json({ error: 'Only PDF file is supported for invoice.' }, { status: 400 })
        }

        if (invoicePdf.size > MAX_PDF_SIZE_BYTES) {
            return NextResponse.json(
                { error: 'Invoice PDF is too large. Maximum size is 10MB.' },
                { status: 400 }
            )
        }

        const invoiceBuffer = Buffer.from(await invoicePdf.arrayBuffer())
        const result = await submitMoinRemittance({
            loginId: moinLoginId,
            loginPassword: moinPassword,
            amountUsd: parsedAmount.toFixed(2),
            invoiceFileName: invoicePdf.name || 'invoice.pdf',
            invoiceMimeType: invoicePdf.type || 'application/pdf',
            invoiceBuffer,
            headless: process.env.MOIN_BIZPLUS_HEADLESS !== 'false',
        })

        return NextResponse.json({
            ok: true,
            message: 'Remittance application completed.',
            result,
        })
    } catch (error) {
        if (error instanceof MoinAutomationError) {
            return NextResponse.json(
                {
                    error: `${error.step}: ${error.message}`,
                },
                { status: 502 }
            )
        }

        console.error('Failed to apply MOIN remittance:', error)
        const detail = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json(
            {
                error: `Failed to complete remittance automation: ${detail}`,
            },
            { status: 500 }
        )
    }
}
