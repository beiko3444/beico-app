import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { submitMoinRemittance } from '../lib/moinBizplus'

const ensureEnv = (key: string) => {
    const value = process.env[key]
    if (!value) {
        throw new Error(`Missing required env: ${key}`)
    }
    return value
}

async function main() {
    const loginId = ensureEnv('MOIN_BIZPLUS_LOGIN_ID')
    const loginPassword = ensureEnv('MOIN_BIZPLUS_LOGIN_PASSWORD')
    const amountUsd = process.env.MOIN_TEST_AMOUNT_USD || '1234.00'
    const invoicePath = process.env.MOIN_TEST_INVOICE_PATH || join(process.cwd(), 'tmp', 'test-invoice.pdf')
    const headless = process.env.MOIN_BIZPLUS_HEADLESS !== 'false'

    const invoiceBuffer = readFileSync(invoicePath)
    const result = await submitMoinRemittance({
        loginId,
        loginPassword,
        amountUsd,
        invoiceFileName: 'test-invoice.pdf',
        invoiceMimeType: 'application/pdf',
        invoiceBuffer,
        headless,
    })

    console.log('TEST_RESULT_OK')
    console.log(JSON.stringify({
        finalUrl: result.finalUrl,
        completedAt: result.completedAt,
        stepCount: result.steps.length,
        lastSteps: result.steps.slice(-12),
    }, null, 2))
}

main().catch((error) => {
    console.error('TEST_RESULT_ERROR')
    if (error instanceof Error) {
        console.error(error.message)
    } else {
        console.error(String(error))
    }
    process.exit(1)
})

