import fs from 'node:fs'
import path from 'node:path'
import { submitMoinRemittance } from '../lib/moinBizplus'

function loadDotEnv(filePath: string) {
  if (!fs.existsSync(filePath)) return
  const raw = fs.readFileSync(filePath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const splitIndex = line.indexOf('=')
    if (splitIndex < 0) continue
    const key = line.slice(0, splitIndex).trim()
    if (!key) continue
    let value = line.slice(splitIndex + 1)
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

async function main() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  loadDotEnv(envPath)

  const loginId = (process.env.MOIN_BIZPLUS_LOGIN_ID || '').trim()
  const loginPassword = process.env.MOIN_BIZPLUS_LOGIN_PASSWORD || ''
  if (!loginId || !loginPassword) {
    throw new Error('MOIN credentials are missing in .env.local')
  }

  const headless = process.env.MOIN_BIZPLUS_HEADLESS
    ? process.env.MOIN_BIZPLUS_HEADLESS !== 'false'
    : false
  const amountUsd = process.env.MOIN_TEST_AMOUNT_USD || process.argv[2] || '1050.00'
  const invoicePath = process.env.MOIN_TEST_INVOICE_PATH || process.argv[3] || path.resolve(process.cwd(), 'tmp', 'test-invoice.pdf')
  const prepareOnly = process.env.MOIN_BIZPLUS_PREPARE_ONLY === 'true'
  const invoiceBuffer = fs.existsSync(invoicePath)
    ? fs.readFileSync(invoicePath)
    : Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n', 'utf8')
  const invoiceFileName = fs.existsSync(invoicePath) ? path.basename(invoicePath) : 'probe-invoice.pdf'

  const startedAt = new Date().toISOString()
  console.log(`[probe] started=${startedAt} headless=${headless} prepareOnly=${prepareOnly} amountUsd=${amountUsd} invoice=${invoiceFileName}`)

  const result = await submitMoinRemittance({
    loginId,
    loginPassword,
    amountUsd,
    invoiceFileName,
    invoiceMimeType: 'application/pdf',
    invoiceBuffer,
    headless,
    prepareOnly,
  })

  console.log(
    JSON.stringify(
      {
        ok: true,
        startedAt,
        completedAt: result.completedAt,
        finalUrl: result.finalUrl,
        submitted: result.submitted,
        stoppedBeforeConfirmation: result.stoppedBeforeConfirmation === true,
        pricingSummary: result.pricingSummary,
        finalActionCandidates: result.finalActionCandidates || [],
        ...(process.env.MOIN_PROBE_PRINT_BODY === 'true'
          ? { finalBodyPreview: result.finalBodyPreview || '' }
          : {}),
        steps: result.steps,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error('[probe] failed:', message)
  if (error instanceof Error && (error as { step?: string }).step) {
    console.error('[probe] step:', (error as { step?: string }).step)
  }
  if (error && typeof error === 'object') {
    const detail = error as { steps?: unknown; diagnostic?: unknown; stack?: unknown }
    if (Array.isArray(detail.steps)) {
      console.error('[probe] lastSteps:', detail.steps.slice(-12).join(' -> '))
    }
    if (detail.diagnostic) {
      console.error('[probe] diagnostic:', JSON.stringify(detail.diagnostic, null, 2))
    }
    if (typeof detail.stack === 'string') {
      console.error('[probe] stack:', detail.stack.split('\n').slice(0, 3).join('\n'))
    }
  }
  process.exit(1)
})
