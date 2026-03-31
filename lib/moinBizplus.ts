const MOIN_BIZPLUS_LOGIN_URL = 'https://www.moinbizplus.com/login'
const TARGET_COMPANY_NAME = 'Shanghai Oikki Trading Co.,Ltd'
const DEFAULT_TIMEOUT_MS = 45000
const LONG_TIMEOUT_MS = 60000

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
    waitForURL: (url: string | RegExp, options?: Record<string, unknown>) => Promise<void>
    waitForTimeout: (ms: number) => Promise<void>
    content: () => Promise<string>
}

type LocatorLike = {
    first: () => LocatorLike
    waitFor: (options?: Record<string, unknown>) => Promise<void>
    click: (options?: Record<string, unknown>) => Promise<void>
    fill: (value: string) => Promise<void>
    pressSequentially: (text: string, options?: Record<string, unknown>) => Promise<void>
    setInputFiles: (files: { name: string; mimeType: string; buffer: Buffer }) => Promise<void>
    check: (options?: Record<string, unknown>) => Promise<void>
    isVisible: () => Promise<boolean>
    isEnabled: () => Promise<boolean>
    isDisabled: () => Promise<boolean>
    count: () => Promise<number>
    textContent: () => Promise<string | null>
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

    throw new MoinAutomationError(step, `Could not find a clickable element for step: ${step} (url: ${page.url()})`)
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

    throw new MoinAutomationError(step, `Could not find a fillable input for step: ${step} (url: ${page.url()})`)
}

/**
 * Type characters one-by-one into an input field.
 * This triggers proper React synthetic onChange events that fill() may miss.
 * Used for login forms where React state controls button enabled/disabled.
 */
const typeFirstVisible = async (
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
            // Clear any existing value first
            await target.fill('')
            // Type character-by-character to trigger React onChange and avoid bot detection
            // Randomize delay between 80ms and 150ms per character to mimic human typing
            const typingDelay = 80 + Math.floor(Math.random() * 70)
            await target.pressSequentially(value, { delay: typingDelay })
            return
        } catch {
            // Try next selector.
        }
    }

    throw new MoinAutomationError(step, `Could not find a typeable input for step: ${step} (url: ${page.url()})`)
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

    throw new MoinAutomationError('Upload invoice', `Could not find file upload input. (url: ${page.url()})`)
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

    throw new MoinAutomationError('Agreement', `Could not find the agreement checkbox. (url: ${page.url()})`)
}

/** Wait for URL to move away from `startUrl` within `timeoutMs`. */
const waitForUrlChange = async (page: PageLike, startUrl: string, timeoutMs: number) => {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        const currentUrl = page.url()
        if (currentUrl !== startUrl && !currentUrl.includes('/login')) {
            return currentUrl
        }
        await page.waitForTimeout(500)
    }
    return page.url()
}

const openMoinLoginPage = async (page: PageLike, timeoutMs = LONG_TIMEOUT_MS) => {
    const navigationErrors: string[] = []
    const waitStrategies: Array<'domcontentloaded' | 'load'> = ['domcontentloaded', 'load']
    const loginSelectors = [
        'input[name="email"]',
        'input[type="email"]',
        'input[name="username"]',
        'input[autocomplete="username"]',
        'input[autocomplete="email"]',
    ]

    for (const waitUntil of waitStrategies) {
        try {
            await page.goto(MOIN_BIZPLUS_LOGIN_URL, {
                waitUntil,
                timeout: timeoutMs,
            })

            let loginInputVisible = false
            for (const selector of loginSelectors) {
                try {
                    await page.locator(selector).first().waitFor({ state: 'visible', timeout: 8000 })
                    loginInputVisible = true
                    break
                } catch {
                    // Try the next selector.
                }
            }

            if (!loginInputVisible) {
                throw new Error('Login input fields were not visible after navigation.')
            }

            return waitUntil
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error)
            navigationErrors.push(`${waitUntil}: ${reason}`)
        }
    }

    throw new MoinAutomationError(
        'Open login page',
        `Could not open MOIN login page. ${navigationErrors.join(' | ')}`
    )
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
        page.setDefaultNavigationTimeout(LONG_TIMEOUT_MS)

        // ── Step 1: Go directly to login page ─────────────────────────────
        const loginWaitUntil = await openMoinLoginPage(page, LONG_TIMEOUT_MS)
        steps.push(`open-login-page:${loginWaitUntil}`)

        // ── Step 2: Fill login credentials (type char-by-char for React) ──
        await typeFirstVisible(
            page,
            [
                'input[name="email"]',
                'input[type="email"]',
                'input[name="username"]',
                'input[autocomplete="username"]',
                'input[autocomplete="email"]',
            ],
            input.loginId,
            'Fill login ID',
            DEFAULT_TIMEOUT_MS
        )
        steps.push('fill-login-id')

        await typeFirstVisible(
            page,
            ['input[name="password"]', 'input[type="password"]', 'input[autocomplete="current-password"]'],
            input.loginPassword,
            'Fill login password',
            DEFAULT_TIMEOUT_MS
        )
        steps.push('fill-login-password')

        // Wait for React to process input events and enable the login button
        // Add a random human-like delay before clicking submit (1.5 to 2.5 seconds)
        const clickDelay = 1500 + Math.floor(Math.random() * 1000)
        await page.waitForTimeout(clickDelay)

        // ── Step 3: Submit login ───────────────────────────────────────────
        const loginUrlBefore = page.url()

        // Wait for login button to become enabled
        const loginBtnSelectors = [
            `button[type="submit"]:has-text("${KO_LOGIN}")`,
            `button:has-text("${KO_LOGIN}")`,
            `[role="button"]:has-text("${KO_LOGIN}")`,
            'button[type="submit"]',
        ]

        let loginClicked = false
        for (const selector of loginBtnSelectors) {
            try {
                const btn = page.locator(selector).first()
                await btn.waitFor({ state: 'visible', timeout: 5000 })

                // Wait up to 3 seconds for button to become enabled
                for (let attempt = 0; attempt < 6; attempt++) {
                    try {
                        const disabled = await btn.isDisabled()
                        if (!disabled) break
                    } catch {
                        break // isDisabled not available, just proceed
                    }
                    await page.waitForTimeout(500)
                }

                await btn.click({ timeout: 5000 })
                loginClicked = true
                break
            } catch {
                // Try next selector
            }
        }

        if (!loginClicked) {
            throw new MoinAutomationError('Submit login', `Could not click login button. (url: ${page.url()})`)
        }
        steps.push('submit-login')

        // ── Step 3.5: Check for explicit login errors ───────────────────────
        // MOIN bizplus shows a red banner for invalid password or locked accounts.
        // We wait up to 10 seconds to see if the URL changes OR an error banner appears.
        let loginFailed = false
        try {
            await Promise.race([
                waitForUrlChange(page, loginUrlBefore, 10000).then((url) => {
                    if (url.includes('/login')) loginFailed = true
                }),
                page.getByText('비밀번호가 일치하지 않습니다').first().waitFor({ state: 'visible', timeout: 10000 }).then(() => { loginFailed = true }),
                page.getByText('초과').first().waitFor({ state: 'visible', timeout: 10000 }).then(() => { loginFailed = true }),
                page.getByText('잠금').first().waitFor({ state: 'visible', timeout: 10000 }).then(() => { loginFailed = true }),
                page.getByText('잠겨').first().waitFor({ state: 'visible', timeout: 10000 }).then(() => { loginFailed = true })
            ])
        } catch {
            // Ignore timeouts from race
        }

        // Wait for page to settle
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined)

        if (loginFailed || page.url().includes('/login')) {
            // Extract text from the page to see the exact error for the user
            const bodyText = await page.locator('body').textContent().catch(() => '') || ''

            if (bodyText.includes('초과') || bodyText.includes('잠금') || bodyText.includes('잠겨')) {
                throw new MoinAutomationError(
                    'Login Failed',
                    '[계정 잠금] 로그인 시도 횟수를 초과했습니다. 보안을 위해 모인 비즈플러스 웹사이트(www.moinbizplus.com)에 직접 접속하여 "비밀번호 재설정"을 진행해 주세요.'
                )
            } else if (bodyText.includes('비밀번호가 일치하지 않습니다')) {
                throw new MoinAutomationError(
                    'Login Failed',
                    '[비밀번호 오류] 비밀번호가 일치하지 않습니다. 정확한 비밀번호를 입력해 주세요. (계속 틀리면 계정이 잠깁니다)'
                )
            } else {
                throw new MoinAutomationError(
                    'Login Failed',
                    `로그인에 실패했습니다 (URL: ${page.url()}). 계정 정보를 확인해 주세요.`
                )
            }
        }

        const postLoginUrl = page.url()
        steps.push(`post-login-url:${postLoginUrl}`)

        // ── Step 4: Find and select the company/recipient ──────────────────
        // After login, the company might be visible on the dashboard, or we may
        // need to look for a "송금하기" or transfer link first.
        try {
            const companyCandidate = page.getByText(TARGET_COMPANY_NAME, { exact: false }).first()
            await companyCandidate.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT_MS })
            await companyCandidate.click({ timeout: DEFAULT_TIMEOUT_MS })
            steps.push('select-company')
        } catch {
            // Company not visible on current page. Try navigating to remittance page
            // or looking for transfer/recipient navigation links.
            steps.push('company-not-on-dashboard')

            // Try clicking "송금하기" or a transfer tab/link first
            const transferSelectors = [
                `a:has-text("${KO_REMIT}")`,
                `button:has-text("${KO_REMIT}")`,
                `[role="button"]:has-text("${KO_REMIT}")`,
                'a:has-text("송금")',
                'button:has-text("송금")',
                'a:has-text("해외송금")',
                'a:has-text("수취인")',
                'a[href*="transfer"]',
                'a[href*="remit"]',
                'a[href*="recipient"]',
                'a[href*="beneficiary"]',
            ]

            let navigatedToTransfer = false
            for (const selector of transferSelectors) {
                try {
                    const link = page.locator(selector).first()
                    const isVisible = await link.isVisible()
                    if (isVisible) {
                        await link.click({ timeout: 5000 })
                        await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT_MS }).catch(() => undefined)
                        navigatedToTransfer = true
                        steps.push(`nav-transfer:${selector}`)
                        break
                    }
                } catch {
                    // Next selector
                }
            }

            if (!navigatedToTransfer) {
                steps.push('no-transfer-link-found')
            }

            // Now try to find the company again after navigating
            try {
                const companyCandidate = page.getByText(TARGET_COMPANY_NAME, { exact: false }).first()
                await companyCandidate.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT_MS })
                await companyCandidate.click({ timeout: DEFAULT_TIMEOUT_MS })
                steps.push('select-company-after-nav')
            } catch {
                // Include page URL and partial content for debugging
                let pageInfo = `url: ${page.url()}`
                try {
                    const html = await page.content()
                    // Extract first 500 chars of body text for debugging
                    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
                    if (bodyMatch) {
                        const textContent = bodyMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
                        pageInfo += ` | page-text(first 500): ${textContent.slice(0, 500)}`
                    }
                } catch {
                    // Ignore content extraction errors
                }

                throw new MoinAutomationError(
                    'Select company',
                    `Could not find "${TARGET_COMPANY_NAME}" on page after login. ${pageInfo}`
                )
            }
        }

        // ── Step 5: Click "송금하기" (remittance button in popup/detail) ────
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

        // ── Step 6: Fill USD amount ────────────────────────────────────────
        await fillFirstVisible(
            page,
            [
                'input[name*="usd" i]',
                'input[id*="usd" i]',
                'input[placeholder*="USD"]',
                'input[aria-label*="USD"]',
                'input[name*="amount" i]',
                'input[id*="amount" i]',
                'xpath=//label[contains(normalize-space(),"USD")]/following::input[1]',
                'xpath=//*[contains(normalize-space(),"USD")]/following::input[1]',
                'xpath=//*[contains(normalize-space(),"금액")]/following::input[1]',
            ],
            input.amountUsd,
            'Fill USD amount',
            DEFAULT_TIMEOUT_MS
        )
        steps.push('fill-usd-amount')

        // ── Step 7: Next step after amount ─────────────────────────────────
        await clickNextStep(page, DEFAULT_TIMEOUT_MS)
        steps.push('next-after-amount')

        // ── Step 8: Upload invoice PDF ─────────────────────────────────────
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

        // ── Step 9: Next step after upload ─────────────────────────────────
        await clickNextStep(page, DEFAULT_TIMEOUT_MS)
        steps.push('next-after-upload')

        // ── Step 10: Check agreement ───────────────────────────────────────
        await checkAgreement(page, DEFAULT_TIMEOUT_MS)
        steps.push('check-agreement')

        // ── Step 11: Submit remittance ─────────────────────────────────────
        await clickNextStep(page, DEFAULT_TIMEOUT_MS)
        steps.push('submit-remittance')

        // ── Step 12: Wait for completion ───────────────────────────────────
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
            // Append accumulated steps to help debugging
            error.message = `${error.message} [steps: ${steps.join(' → ')}]`
            throw error
        }

        throw new MoinAutomationError(
            'Automation',
            `${error instanceof Error ? error.message : 'Unknown automation error.'} [steps: ${steps.join(' → ')}] [url: ${browser ? 'see-steps' : 'no-browser'}]`
        )
    } finally {
        if (browser) {
            await browser.close().catch(() => undefined)
        }
    }
}
