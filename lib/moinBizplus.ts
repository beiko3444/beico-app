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
    evaluate: (fn: string | ((...args: unknown[]) => unknown), ...args: unknown[]) => Promise<unknown>
}

type LocatorLike = {
    first: () => LocatorLike
    locator: (selector: string) => LocatorLike
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

        // ── Step 4: Navigate to recipient page ─────────────────────────────
        // After login, we should be on /transfer/recipient.
        // If not, navigate there via the "송금하기" nav link.

        const postLoginPage = page.url()

        if (!postLoginPage.includes('/transfer/recipient')) {
            steps.push('navigating-to-recipient-page')

            const recipientNavSelectors = [
                `a:has-text("${KO_REMIT}")`,      // "송금하기" nav link
                'a[href*="/transfer/recipient"]',
                'a[href*="/transfer"]',
                'a:has-text("송금")',
            ]

            let navigated = false
            for (const selector of recipientNavSelectors) {
                try {
                    const link = page.locator(selector).first()
                    const isVisible = await link.isVisible()
                    if (isVisible) {
                        await link.click({ timeout: 8000 })
                        await page.waitForTimeout(2000)
                        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined)
                        navigated = true
                        steps.push(`nav-to-recipient:${selector}`)
                        break
                    }
                } catch {
                    // Try next
                }
            }

            if (!navigated) {
                steps.push('nav-failed-staying-on-current')
            }
        } else {
            steps.push('already-on-recipient-page')
        }

        // Wait for the recipient list to load
        await page.waitForTimeout(2000)
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined)

        // ── Step 4.5: Find the company card and click it ────────────────────
        // The recipient page shows cards with company names.
        // Clicking a card opens a MODAL POPUP (not a page navigation!).
        // The modal shows recipient details and has "수정하기" / "송금하기" buttons.

        // First, check if company name is visible (may need to scroll)
        let companyTextEl
        try {
            companyTextEl = page.getByText(TARGET_COMPANY_NAME, { exact: false }).first()
            await companyTextEl.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT_MS })
            steps.push('company-text-visible')
        } catch {
            // Maybe not visible due to scrolling — try JS scroll
            try {
                await page.evaluate(`
                    (() => {
                        const companyName = ${JSON.stringify(TARGET_COMPANY_NAME)};
                        const walker = document.createTreeWalker(
                            document.body, NodeFilter.SHOW_TEXT,
                            { acceptNode: (n) => n.textContent && n.textContent.includes(companyName) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT }
                        );
                        const node = walker.nextNode();
                        if (node && node.parentElement) node.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    })()
                `)
                await page.waitForTimeout(1000)
                companyTextEl = page.getByText(TARGET_COMPANY_NAME, { exact: false }).first()
                await companyTextEl.waitFor({ state: 'visible', timeout: 10000 })
                steps.push('company-text-visible-after-scroll')
            } catch {
                let pageInfo = `url: ${page.url()}`
                try {
                    const html = await page.content()
                    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
                    if (bodyMatch) {
                        const textContent = bodyMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
                        pageInfo += ` | page-text(first 800): ${textContent.slice(0, 800)}`
                    }
                } catch { /* ignore */ }

                throw new MoinAutomationError(
                    'Select company',
                    `Could not find "${TARGET_COMPANY_NAME}" on page. ${pageInfo}`
                )
            }
        }

        // Click the company card to open the modal popup
        // The card area containing the company name is clickable (cursor:pointer)
        let modalOpened = false

        // Strategy 1: Click the company text directly — this should open the modal
        try {
            await companyTextEl.click({ timeout: 5000 })
            await page.waitForTimeout(1500)
            steps.push('clicked-company-text')
        } catch {
            steps.push('company-text-click-failed')
        }

        // ── Step 5: Wait for the modal popup and click "송금하기" ────────────
        // After clicking a recipient card, a modal popup appears with:
        //   - Title: company name
        //   - Recipient details (수취인 정보)
        //   - Bottom buttons: "수정하기" (edit) and "송금하기" (remit)
        // The "송금하기" button inside the modal advances to Step 2 (금액 입력).

        // Wait for the modal to appear
        const modalSelectors = [
            // The "송금하기" button inside the modal
            `button:has-text("${KO_REMIT}")`,
            // Modal overlay/dialog patterns
            '[role="dialog"]',
            '[class*="modal"]',
            '[class*="Modal"]',
            '[class*="popup"]',
            '[class*="Popup"]',
            '[class*="overlay"]',
            '[class*="Overlay"]',
        ]

        // Check if modal appeared (look for "송금하기" button)
        const remitBtnInModal = page.getByText(KO_REMIT, { exact: false }).first()
        try {
            await remitBtnInModal.waitFor({ state: 'visible', timeout: 8000 })
            modalOpened = true
            steps.push('modal-opened-remit-btn-visible')
        } catch {
            // Modal may not have opened — try clicking the parent card element
            steps.push('modal-not-opened-retrying')

            // Try clicking parent card with JavaScript
            try {
                const jsClickResult = await page.evaluate(`
                    (() => {
                        const companyName = ${JSON.stringify(TARGET_COMPANY_NAME)};
                        const walker = document.createTreeWalker(
                            document.body, NodeFilter.SHOW_TEXT,
                            { acceptNode: (n) => n.textContent && n.textContent.includes(companyName) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT }
                        );
                        const node = walker.nextNode();
                        if (!node) return 'no-text-node';
                        // Walk up to find the clickable card element
                        let el = node.parentElement;
                        let depth = 0;
                        while (el && depth < 10) {
                            const cursor = window.getComputedStyle(el).cursor;
                            if (cursor === 'pointer') {
                                el.click();
                                return 'clicked-pointer-' + el.tagName + '-depth-' + depth;
                            }
                            el = el.parentElement;
                            depth++;
                        }
                        // Fallback: click the text's parent anyway
                        if (node.parentElement) {
                            node.parentElement.click();
                            return 'clicked-parent-fallback';
                        }
                        return 'nothing-clicked';
                    })()
                `) as string
                steps.push(`js-card-click:${jsClickResult}`)
                await page.waitForTimeout(2000)

                // Check again for the modal
                try {
                    await remitBtnInModal.waitFor({ state: 'visible', timeout: 8000 })
                    modalOpened = true
                    steps.push('modal-opened-after-js-click')
                } catch {
                    steps.push('modal-still-not-opened')
                }
            } catch (err) {
                steps.push(`js-card-click-error:${err instanceof Error ? err.message : 'unknown'}`)
            }
        }

        if (!modalOpened) {
            // Last resort: look for the 송금하기 button anywhere on the page
            // (maybe the UI changed and there's no modal, just inline buttons)
            const fallbackBtnSelectors = [
                `button:has-text("${KO_REMIT}")`,
                `a:has-text("${KO_REMIT}")`,
                `[role="button"]:has-text("${KO_REMIT}")`,
                'button:has-text("송금")',
            ]

            for (const selector of fallbackBtnSelectors) {
                try {
                    const btn = page.locator(selector).first()
                    const isVisible = await btn.isVisible()
                    if (isVisible) {
                        modalOpened = true
                        steps.push(`remit-btn-found-without-modal:${selector}`)
                        break
                    }
                } catch {
                    // Continue
                }
            }
        }

        if (!modalOpened) {
            let pageInfo = `url: ${page.url()}`
            try {
                const html = await page.content()
                const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
                if (bodyMatch) {
                    const textContent = bodyMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
                    pageInfo += ` | page-text(first 800): ${textContent.slice(0, 800)}`
                }
            } catch { /* ignore */ }

            throw new MoinAutomationError(
                'Open recipient modal',
                `Could not open the recipient modal popup after clicking "${TARGET_COMPANY_NAME}". ${pageInfo}`
            )
        }

        // ── Step 5.5: Click "송금하기" button in the modal ──────────────────
        // This transitions from Step 1 (수취인 선택) to Step 2 (금액 입력)
        // The element may not be a <button> — could be <a>, <div>, <span>, etc.
        let remitClicked = false

        // Strategy A: Try clicking any element with the text (broader than just button)
        const remitSelectors = [
            `button:has-text("${KO_REMIT}")`,
            `a:has-text("${KO_REMIT}")`,
            `[role="button"]:has-text("${KO_REMIT}")`,
            `div:has-text("${KO_REMIT}")`,
        ]

        for (const sel of remitSelectors) {
            if (remitClicked) break
            try {
                const el = page.locator(sel).first()
                const isVis = await el.isVisible().catch(() => false)
                if (isVis) {
                    await el.click({ timeout: 5000, force: true })
                    remitClicked = true
                    steps.push(`clicked-remit:${sel}`)
                }
            } catch {
                // Continue to next selector
            }
        }

        // Strategy B: Use getByText with force click
        if (!remitClicked) {
            try {
                const anyRemitBtn = page.getByText(KO_REMIT, { exact: false }).first()
                await anyRemitBtn.click({ timeout: 5000, force: true })
                remitClicked = true
                steps.push('clicked-remit-getByText-force')
            } catch {
                // Continue
            }
        }

        // Strategy C: JavaScript force-click — find the element with "송금하기" text and click it
        if (!remitClicked) {
            try {
                const jsResult = await page.evaluate(`
                    (() => {
                        const remitText = ${JSON.stringify(KO_REMIT)};
                        // Find all elements containing the text
                        const walker = document.createTreeWalker(
                            document.body, NodeFilter.SHOW_TEXT,
                            { acceptNode: (n) => n.textContent && n.textContent.includes(remitText) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT }
                        );
                        const textNode = walker.nextNode();
                        if (!textNode) return 'no-text-node';
                        // Walk up to find a clickable parent
                        let el = textNode.parentElement;
                        let depth = 0;
                        while (el && depth < 8) {
                            const tag = el.tagName.toLowerCase();
                            const role = el.getAttribute('role');
                            const cursor = window.getComputedStyle(el).cursor;
                            if (tag === 'button' || tag === 'a' || role === 'button' || cursor === 'pointer') {
                                el.click();
                                return 'js-clicked-' + tag + '-depth-' + depth;
                            }
                            el = el.parentElement;
                            depth++;
                        }
                        // Fallback: click the text node's direct parent
                        if (textNode.parentElement) {
                            textNode.parentElement.click();
                            return 'js-clicked-parent-fallback';
                        }
                        return 'no-clickable-parent';
                    })()
                `) as string
                if (jsResult && !jsResult.startsWith('no-')) {
                    remitClicked = true
                    steps.push(`remit-js-click:${jsResult}`)
                }
            } catch {
                // Continue
            }
        }

        if (!remitClicked) {
            throw new MoinAutomationError(
                'Click remit button in modal',
                `Could not click the "송금하기" button in the modal. (url: ${page.url()})`
            )
        }

        // Wait for Step 2 (금액 입력) to load
        await page.waitForTimeout(3000)
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined)

        // Check if URL changed after clicking 송금하기
        const urlAfterRemit = page.url()
        steps.push(`url-after-remit:${urlAfterRemit.replace('https://www.moinbizplus.com', '')}`)

        // Wait for the amount form to appear — it may load via SPA
        // Try multiple indicators that the amount page is ready
        let step2Ready = false
        for (let attempt = 0; attempt < 5; attempt++) {
            const hasAmountText = await page.getByText('금액 입력').first().isVisible().catch(() => false)
                || await page.getByText('받는 금액').first().isVisible().catch(() => false)
                || await page.getByText('보내는 금액').first().isVisible().catch(() => false)
                || await page.getByText('USD').first().isVisible().catch(() => false)
                || await page.getByText('KRW').first().isVisible().catch(() => false)

            if (hasAmountText) {
                step2Ready = true
                break
            }
            await page.waitForTimeout(2000)
        }

        if (!step2Ready) {
            // Maybe the page navigated to a different URL
            await page.waitForTimeout(3000)
            steps.push('step2-text-not-found-continuing')
        }
        steps.push('step2-amount-form-loaded')

        // Give the input fields extra time to render (React hydration)
        await page.waitForTimeout(2000)

        // ── Step 6: Fill USD amount ────────────────────────────────────────
        // The amount page has two sections:
        //   - "보내는 금액" (KRW) — auto-calculated
        //   - "받는 금액" (USD) — this is where we enter our amount
        // We need to fill the USD/receiving amount input.

        // First, try to find any visible input and log diagnostic info
        const inputDiag = await page.evaluate(`
            (() => {
                const inputs = document.querySelectorAll('input');
                const info = [];
                inputs.forEach((inp, i) => {
                    if (i < 15) {
                        const rect = inp.getBoundingClientRect();
                        const visible = rect.width > 0 && rect.height > 0;
                        info.push({
                            i,
                            type: inp.type,
                            name: inp.name,
                            id: inp.id,
                            placeholder: inp.placeholder,
                            visible,
                            cls: (inp.className || '').slice(0, 50),
                        });
                    }
                });
                return JSON.stringify(info);
            })()
        `).catch(() => '[]') as string
        steps.push(`inputs-on-page:${inputDiag.slice(0, 300)}`)

        // Try to fill the USD amount with various selectors
        let amountFilled = false

        // Strategy 1: Specific selectors for the receiving amount
        const usdSelectors = [
            // Near "받는 금액" / "USD" text
            'xpath=//*[contains(normalize-space(),"받는 금액")]/following::input[1]',
            'xpath=//*[contains(normalize-space(),"USD")]/ancestor::*[contains(@class,"amount") or contains(@class,"input")][1]//input',
            'xpath=//*[contains(normalize-space(),"USD")]/following::input[1]',
            // By attribute
            'input[name*="usd" i]',
            'input[id*="usd" i]',
            'input[placeholder*="USD"]',
            'input[aria-label*="USD"]',
            'input[name*="receive" i]',
            'input[name*="amount" i]',
            'input[id*="amount" i]',
            // By label/text proximity
            'xpath=//label[contains(normalize-space(),"USD")]/following::input[1]',
            'xpath=//*[contains(normalize-space(),"금액")]/following::input[1]',
        ]

        for (const sel of usdSelectors) {
            if (amountFilled) break
            try {
                const target = page.locator(sel).first()
                await target.waitFor({ state: 'visible', timeout: 3000 })
                await target.click({ timeout: 3000 })
                await target.fill(input.amountUsd)
                amountFilled = true
                steps.push(`fill-usd:${sel.slice(0, 40)}`)
            } catch {
                // Continue
            }
        }

        // Strategy 2: Find the second visible text/number input on the page
        // (first is usually KRW, second is USD)
        if (!amountFilled) {
            try {
                const result = await page.evaluate(`
                    (() => {
                        const inputs = Array.from(document.querySelectorAll('input'));
                        const visible = inputs.filter(inp => {
                            const rect = inp.getBoundingClientRect();
                            const style = window.getComputedStyle(inp);
                            return rect.width > 0 && rect.height > 0 
                                && style.display !== 'none' && style.visibility !== 'hidden'
                                && (inp.type === 'text' || inp.type === 'number' || inp.type === 'tel' || inp.type === '');
                        });
                        // Return info about visible inputs
                        return JSON.stringify(visible.map((inp, i) => ({
                            i, type: inp.type, name: inp.name, id: inp.id, 
                            placeholder: inp.placeholder
                        })));
                    })()
                `) as string
                steps.push(`visible-fillable-inputs:${result.slice(0, 200)}`)

                // Try to fill the second visible input (assumed USD)
                // or the first if there's only one
                const visibleInputs = JSON.parse(result) as Array<{i: number; type: string; name: string; id: string; placeholder: string}>
                
                if (visibleInputs.length > 0) {
                    // Try the second input first (usually USD), then the first
                    const targetIndex = visibleInputs.length >= 2 ? 1 : 0
                    const targetInfo = visibleInputs[targetIndex]
                    
                    let selector = ''
                    if (targetInfo.id) {
                        selector = `input#${targetInfo.id}`
                    } else if (targetInfo.name) {
                        selector = `input[name="${targetInfo.name}"]`
                    } else {
                        // Use nth-of-type or generic
                        selector = `input[type="${targetInfo.type || 'text'}"]`
                    }

                    const target = page.locator(selector).first()
                    await target.click({ timeout: 3000, force: true })
                    await target.fill(input.amountUsd)
                    amountFilled = true
                    steps.push(`fill-usd-generic:${selector}:idx${targetIndex}`)
                }
            } catch (err) {
                steps.push(`fill-usd-generic-error:${err instanceof Error ? err.message.slice(0, 100) : 'unknown'}`)
            }
        }

        // Strategy 3: JavaScript direct value set on the input
        if (!amountFilled) {
            try {
                const jsResult = await page.evaluate(`
                    (() => {
                        const amount = ${JSON.stringify(input.amountUsd)};
                        const inputs = Array.from(document.querySelectorAll('input'));
                        const visible = inputs.filter(inp => {
                            const rect = inp.getBoundingClientRect();
                            return rect.width > 0 && rect.height > 0 
                                && (inp.type === 'text' || inp.type === 'number' || inp.type === 'tel' || inp.type === '');
                        });
                        if (visible.length === 0) return 'no-visible-inputs';
                        // Try second input (USD) or first
                        const target = visible.length >= 2 ? visible[1] : visible[0];
                        // Set value using React-compatible method
                        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                        nativeInputValueSetter.call(target, amount);
                        target.dispatchEvent(new Event('input', { bubbles: true }));
                        target.dispatchEvent(new Event('change', { bubbles: true }));
                        return 'js-filled-' + (target.name || target.id || 'unknown');
                    })()
                `) as string
                if (jsResult && !jsResult.startsWith('no-')) {
                    amountFilled = true
                    steps.push(`fill-usd-js:${jsResult}`)
                }
            } catch {
                // Continue
            }
        }

        if (!amountFilled) {
            throw new MoinAutomationError(
                'Fill USD amount',
                `Could not find a fillable input for step: Fill USD amount (url: ${page.url()})`
            )
        }
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
        // On the 정보 확인 page, the submit button says "송금 신청" (not "다음 단계")
        await clickFirstVisible(
            page,
            [
                'button:has-text("송금 신청")',
                'button:has-text("송금신청")',
                `button:has-text("${KO_REMIT}")`,
                `button:has-text("${KO_NEXT_STEP}")`,
                `button:has-text("${KO_NEXT_STEP_SPACED}")`,
                'button:has-text("신청")',
                'button:has-text("제출")',
            ],
            'Submit remittance',
            DEFAULT_TIMEOUT_MS
        )
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
