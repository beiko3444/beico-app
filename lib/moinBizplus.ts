const MOIN_BIZPLUS_HOME_URL = 'https://www.moinbizplus.com/'
const TARGET_COMPANY_NAME = 'Shanghai Oikki Trading Co.,Ltd'
const DEFAULT_TIMEOUT_MS = 45000

const KO_LOGIN = '\uB85C\uADF8\uC778'
const KO_REMIT = '\uC1A1\uAE08\uD558\uAE30'
const KO_NEXT_STEP = '\uB2E4\uC74C\uB2E8\uACC4'
const KO_NEXT_STEP_SPACED = '\uB2E4\uC74C \uB2E8\uACC4'
const KO_NEXT = '\uB2E4\uC74C'
const KO_AGREEMENT = '\uD658\uBD88 \uADDC\uC815\uC5D0 \uB3D9\uC758'
const KO_AGREEMENT_DESCRIPTION = '\uC1A1\uAE08 \uC815\uBCF4\uB97C \uD655\uC778\uD558\uC600\uC73C\uBA70'
const KO_SUCCESS_PATTERN =
    /\uC2E0\uCCAD \uC644\uB8CC|\uC1A1\uAE08 \uC2E0\uCCAD|\uC811\uC218 \uC644\uB8CC|\uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4/

type BrowserLike = {
    newContext: (options?: Record<string, unknown>) => Promise<BrowserContextLike>
    close: () => Promise<void>
}

type BrowserContextLike = {
    newPage: () => Promise<PageLike>
}

type PageLike = {
    goto: (url: string, options?: Record<string, unknown>) => Promise<void>
    url: () => string
    locator: (selector: string) => LocatorLike
    getByText: (text: string | RegExp, options?: Record<string, unknown>) => LocatorLike
    setDefaultTimeout: (timeout: number) => void
    setDefaultNavigationTimeout: (timeout: number) => void
    waitForLoadState: (state?: string, options?: Record<string, unknown>) => Promise<void>
}

type LocatorLike = {
    first: () => LocatorLike
    waitFor: (options?: Record<string, unknown>) => Promise<void>
    click: (options?: Record<string, unknown>) => Promise<void>
    fill: (value: string) => Promise<void>
    setInputFiles: (files: { name: string; mimeType: string; buffer: Buffer }) => Promise<void>
    check: (options?: Record<string, unknown>) => Promise<void>
}

export type MoinRemittanceInput = {
    loginId: string
    loginPassword: string
    amountUsd: string
    invoiceFileName: string
    invoiceMimeType: string
    invoiceBuffer: Buffer
    headless?: boolean
}

export type MoinRemittanceResult = {
    finalUrl: string
    completedAt: string
    steps: string[]
}

export class MoinAutomationError extends Error {
    step: string

    constructor(step: string, message: string) {
        super(message)
        this.name = 'MoinAutomationError'
        this.step = step
    }
}

const getErrorMessage = (error: unknown) => {
    if (error instanceof Error && error.message) return error.message
    return String(error)
}

const launchBrowser = async (headless: boolean): Promise<{ browser: BrowserLike; runtime: string }> => {
    const runtimeErrors: string[] = []

    // Attempt 1: @sparticuz/chromium (for Vercel/AWS Lambda)
    try {
        const { chromium: playwrightCoreChromium } = await import('playwright-core')
        const chromium = (await import('@sparticuz/chromium')).default

        const executablePath = await chromium.executablePath()

        const browser = await playwrightCoreChromium.launch({
            headless,
            executablePath,
            args: chromium.args?.length ? chromium.args : ['--no-sandbox', '--disable-setuid-sandbox'],
        })

        return { browser: browser as unknown as BrowserLike, runtime: 'playwright-core+sparticuz' }
    } catch (error) {
        runtimeErrors.push(`playwright-core+sparticuz: ${getErrorMessage(error)}`)
    }

    // Attempt 2: Custom path fallback for self-hosted environments
    try {
        const customExecutablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || process.env.CHROMIUM_EXECUTABLE_PATH
        if (!customExecutablePath) {
            throw new Error('PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH is not set')
        }

        const { chromium: playwrightCoreChromium } = await import('playwright-core')

        const browser = await playwrightCoreChromium.launch({
            headless,
            executablePath: customExecutablePath,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        })

        return { browser: browser as unknown as BrowserLike, runtime: 'playwright-core-custom-path' }
    } catch (error) {
        runtimeErrors.push(`playwright-core-custom-path: ${getErrorMessage(error)}`)
    }

    throw new MoinAutomationError(
        'Launch Browser',
        `No server browser runtime available. Ensure playwright-core and @sparticuz/chromium are installed and redeployed. Details: ${runtimeErrors.join(' | ')}`
    )
}

const clickFirstVisible = async (
    page: PageLike,
    selectors: string[],
    step: string,
    timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<void> => {
    for (const selector of selectors) {
        try {
            const target = page.locator(selector).first()
            await target.waitFor({ state: 'visible', timeout: Math.min(timeoutMs, 9000) })
            await target.click({ timeout: 5000 })
            return
        } catch {
            // Try next selector.
        }
    }

    throw new MoinAutomationError(step, `Could not find a clickable element for step: ${step}`)
}

const fillFirstVisible = async (
    page: PageLike,
    selectors: string[],
    value: string,
    step: string,
    timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<void> => {
    for (const selector of selectors) {
        try {
            const target = page.locator(selector).first()
            await target.waitFor({ state: 'visible', timeout: Math.min(timeoutMs, 9000) })
            await target.click({ timeout: 5000 })
            await target.fill(value)
            return
        } catch {
            // Try next selector.
        }
    }

    throw new MoinAutomationError(step, `Could not find a fillable input for step: ${step}`)
}

const uploadFirstFileInput = async (
    page: PageLike,
    selectors: string[],
    file: { name: string; mimeType: string; buffer: Buffer },
    timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<void> => {
    for (const selector of selectors) {
        try {
            const target = page.locator(selector).first()
            await target.waitFor({ state: 'attached', timeout: Math.min(timeoutMs, 12000) })
            await target.setInputFiles(file)
            return
        } catch {
            // Try next selector.
        }
    }

    throw new MoinAutomationError('Upload invoice', 'Could not find file upload input.')
}

const clickNextStep = async (page: PageLike, timeoutMs = DEFAULT_TIMEOUT_MS) => {
    await clickFirstVisible(
        page,
        [
            `button:has-text("${KO_NEXT_STEP}")`,
            `button:has-text("${KO_NEXT_STEP_SPACED}")`,
            `[role="button"]:has-text("${KO_NEXT_STEP}")`,
            `button:has-text("${KO_NEXT}")`,
        ],
        'Click next step',
        timeoutMs
    )
}

const checkAgreement = async (page: PageLike, timeoutMs = DEFAULT_TIMEOUT_MS) => {
    const labelSelectors = [
        `label:has-text("${KO_AGREEMENT}")`,
        `label:has-text("${KO_AGREEMENT_DESCRIPTION}")`,
        `div:has-text("${KO_AGREEMENT}")`,
    ]

    for (const selector of labelSelectors) {
        try {
            const target = page.locator(selector).first()
            await target.waitFor({ state: 'visible', timeout: Math.min(timeoutMs, 12000) })
            await target.click({ timeout: 5000 })
            return
        } catch {
            // Try next selector.
        }
    }

    const checkboxSelectors = [
        'input[type="checkbox"]',
        `xpath=//*[contains(normalize-space(),"${KO_AGREEMENT}")]/preceding::input[@type="checkbox"][1]`,
    ]

    for (const selector of checkboxSelectors) {
        try {
            const target = page.locator(selector).first()
            await target.waitFor({ state: 'visible', timeout: Math.min(timeoutMs, 12000) })
            await target.check({ force: true })
            return
        } catch {
            // Try next selector.
        }
    }

    throw new MoinAutomationError('Agreement', 'Could not find the agreement checkbox.')
}

export const submitMoinRemittance = async (input: MoinRemittanceInput): Promise<MoinRemittanceResult> => {
    let browser: BrowserLike | null = null
    const steps: string[] = []

    try {
        const launched = await launchBrowser(input.headless ?? true)
        browser = launched.browser
        steps.push(`runtime:${launched.runtime}`)

        const context = await browser.newContext({ locale: 'ko-KR' })
        const page = await context.newPage()
        page.setDefaultTimeout(DEFAULT_TIMEOUT_MS)
        page.setDefaultNavigationTimeout(DEFAULT_TIMEOUT_MS)

        await page.goto(MOIN_BIZPLUS_HOME_URL, { waitUntil: 'domcontentloaded' })
        steps.push('open-home')

        await clickFirstVisible(
            page,
            [
                'button[data-testid="nav-login"]',
                `button:has-text("${KO_LOGIN}")`,
                `a:has-text("${KO_LOGIN}")`,
            ],
            'Open login',
            DEFAULT_TIMEOUT_MS
        )
        steps.push('click-login-button')

        await fillFirstVisible(
            page,
            [
                'input[name="email"]',
                'input[name="username"]',
                'input[name="id"]',
                'input[autocomplete="username"]',
                'input[type="text"]',
            ],
            input.loginId,
            'Fill login ID',
            DEFAULT_TIMEOUT_MS
        )
        steps.push('fill-login-id')

        await fillFirstVisible(
            page,
            ['input[name="password"]', 'input[type="password"]', 'input[autocomplete="current-password"]'],
            input.loginPassword,
            'Fill login password',
            DEFAULT_TIMEOUT_MS
        )
        steps.push('fill-login-password')

        await clickFirstVisible(
            page,
            [
                `button[type="submit"]:has-text("${KO_LOGIN}")`,
                `button:has-text("${KO_LOGIN}")`,
                `[role="button"]:has-text("${KO_LOGIN}")`,
                'button[type="submit"]',
            ],
            'Submit login',
            DEFAULT_TIMEOUT_MS
        )
        steps.push('submit-login')
        await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT_MS }).catch(() => undefined)

        const companyCandidate = page.getByText(TARGET_COMPANY_NAME, { exact: false }).first()
        await companyCandidate.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT_MS })
        await companyCandidate.click({ timeout: DEFAULT_TIMEOUT_MS })
        steps.push('select-company')

        await clickFirstVisible(
            page,
            [
                `button:has-text("${KO_REMIT}")`,
                `a:has-text("${KO_REMIT}")`,
                `[role="button"]:has-text("${KO_REMIT}")`,
            ],
            'Click remittance button',
            DEFAULT_TIMEOUT_MS
        )
        steps.push('open-remittance-popup')

        await fillFirstVisible(
            page,
            [
                'input[name*="usd" i]',
                'input[id*="usd" i]',
                'input[placeholder*="USD"]',
                'input[aria-label*="USD"]',
                'xpath=//label[contains(normalize-space(),"USD")]/following::input[1]',
                'xpath=//*[contains(normalize-space(),"USD")]/following::input[1]',
            ],
            input.amountUsd,
            'Fill USD amount',
            DEFAULT_TIMEOUT_MS
        )
        steps.push('fill-usd-amount')

        await clickNextStep(page, DEFAULT_TIMEOUT_MS)
        steps.push('next-after-amount')

        await uploadFirstFileInput(
            page,
            ['input[type="file"][accept*="pdf" i]', 'input[type="file"]'],
            {
                name: input.invoiceFileName,
                mimeType: input.invoiceMimeType,
                buffer: input.invoiceBuffer,
            },
            DEFAULT_TIMEOUT_MS
        )
        steps.push('upload-invoice')

        await clickNextStep(page, DEFAULT_TIMEOUT_MS)
        steps.push('next-after-upload')

        await checkAgreement(page, DEFAULT_TIMEOUT_MS)
        steps.push('check-agreement')

        await clickNextStep(page, DEFAULT_TIMEOUT_MS)
        steps.push('submit-remittance')

        await Promise.race([
            page.getByText(KO_SUCCESS_PATTERN).first().waitFor({
                state: 'visible',
                timeout: 20000,
            }),
            page.waitForLoadState('networkidle', { timeout: 20000 }),
        ]).catch(() => undefined)

        return {
            finalUrl: page.url(),
            completedAt: new Date().toISOString(),
            steps,
        }
    } catch (error) {
        if (error instanceof MoinAutomationError) {
            throw error
        }

        throw new MoinAutomationError(
            'Automation',
            error instanceof Error ? error.message : 'Unknown automation error.'
        )
    } finally {
        if (browser) {
            await browser.close().catch(() => undefined)
        }
    }
}
