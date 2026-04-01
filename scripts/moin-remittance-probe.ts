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

  const headless = process.env.MOIN_BIZPLUS_HEADLESS !== 'false'
  const amountUsd = process.argv[2] || '7777.00'
  const invoiceBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n', 'utf8')

  const startedAt = new Date().toISOString()
  console.log(`[probe] started=${startedAt} headless=${headless} amountUsd=${amountUsd}`)

  const result = await submitMoinRemittance({
    loginId,
    loginPassword,
    amountUsd,
    invoiceFileName: 'probe-invoice.pdf',
    invoiceMimeType: 'application/pdf',
    invoiceBuffer,
    headless,
  })

  console.log(
    JSON.stringify(
      {
        ok: true,
        startedAt,
        completedAt: result.completedAt,
        finalUrl: result.finalUrl,
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
  process.exit(1)
})
