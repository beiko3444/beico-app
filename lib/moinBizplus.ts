const MOIN_BIZPLUS_LOGIN_URL = 'https://www.moinbizplus.com/login'
const TARGET_COMPANY_NAME = 'Shanghai Oikki Trading Co.,Ltd'
const DEFAULT_TIMEOUT_MS = 45000
const LONG_TIMEOUT_MS = 60000

const KO_LOGIN = '\uB85C\uADF8\uC778'
const KO_REMIT = '\uC1A1\uAE08\uD558\uAE30'
const KO_REMIT_SHORT = '\uC1A1\uAE08'
const KO_PASSWORD_MISMATCH = '\uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4'
const KO_ATTEMPT_EXCEEDED = '\uCD08\uACFC'
const KO_LOCK = '\uC7A0\uAE08'
const KO_LOCKED = '\uC7A0\uACA8'
const KO_REMIT_REQUEST = '\uC1A1\uAE08 \uC2E0\uCCAD'
const KO_REMIT_REQUEST_COMPACT = '\uC1A1\uAE08\uC2E0\uCCAD'
const KO_APPLY = '\uC2E0\uCCAD'
const KO_SUBMIT = '\uC81C\uCD9C'
const KO_AMOUNT = '\uAE08\uC561'
const KO_NEXT_STEP = '\uB2E4\uC74C\uB2E8\uACC4'
const KO_NEXT_STEP_SPACED = '\uB2E4\uC74C \uB2E8\uACC4'
const KO_NEXT = '\uB2E4\uC74C'
const KO_AGREEMENT = '\uD658\uBD88 \uADDC\uC815\uC5D0 \uB3D9\uC758'
const KO_AGREEMENT_DESCRIPTION = '\uC1A1\uAE08 \uC815\uBCF4\uB97C \uD655\uC778\uD558\uC600\uC73C\uBA70'
const KO_AMOUNT_ENTRY = '\uAE08\uC561 \uC785\uB825'
const KO_RECEIVE_AMOUNT = '\uBC1B\uB294 \uAE08\uC561'
const KO_SEND_AMOUNT = '\uBCF4\uB0B4\uB294 \uAE08\uC561'
const KO_RECIPIENT_SEARCH_PLACEHOLDER = '\uBC1B\uB294 \uBD84 \uC774\uB984, \uD68C\uC0AC\uBA85, \uC218\uCDE8\uC778 \uBCC4\uCE6D'
const KO_SUCCESS_PATTERN =
    /\uC2E0\uCCAD \uC644\uB8CC|\uC811\uC218 \uC644\uB8CC|\uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4|\uC1A1\uAE08 \uC644\uB8CC|\uC2E0\uCCAD\uC774 \uC644\uB8CC|\uC811\uC218\uB418\uC5C8/
const KO_SUCCESS_KEYWORDS = [
    '\uC2E0\uCCAD \uC644\uB8CC',
    '\uC811\uC218 \uC644\uB8CC',
    '\uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4',
    '\uC1A1\uAE08 \uC644\uB8CC',
    '\uC2E0\uCCAD\uC774 \uC644\uB8CC',
    '\uC811\uC218\uB418\uC5C8',
]

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
            await target.fill(')
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

const inspectTransferInputs = async (page: PageLike) => {
    const result = await page.evaluate(`
        (() => {
            const isVisible = (el) => {
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
            };

            const getText = () => (document.body?.innerText || ').replace(/\\s+/g, ' ').trim();
            const bodyText = getText();
            const inputs = Array.from(document.querySelectorAll('input'));
            const visibleInputs = inputs
                .filter((inp) => isVisible(inp))
                .map((inp, i) => ({
                    i,
                    type: inp.type || ',
                    name: inp.name || ',
                    id: inp.id || ',
                    placeholder: inp.placeholder || ',
                }));

            const nextButtons = Array.from(document.querySelectorAll('button, [role="button"], a'))
                .filter((el) => isVisible(el))
                .map((el) => (el.textContent || ').replace(/\\s+/g, ' ').trim())
                .filter(Boolean)
                .slice(0, 20);

            return JSON.stringify({
                bodyText: bodyText.slice(0, 1200),
                visibleInputs,
                nextButtons,
                aliasSearchVisible: visibleInputs.some((inp) => (inp.placeholder || ').includes(${JSON.stringify(KO_RECIPIENT_SEARCH_PLACEHOLDER)})),
                amountKeywordVisible:
                    bodyText.includes(${JSON.stringify(KO_AMOUNT_ENTRY)}) ||
                    bodyText.includes(${JSON.stringify(KO_RECEIVE_AMOUNT)}) ||
                    bodyText.includes(${JSON.stringify(KO_SEND_AMOUNT)}) ||
                    bodyText.includes('USD') ||
                    bodyText.includes('KRW'),
            });
        })()
    `) as string

    return JSON.parse(result) as {
        bodyText: string
        visibleInputs: Array<{ i: number; type: string; name: string; id: string; placeholder: string }>
        nextButtons: string[]
        aliasSearchVisible: boolean
        amountKeywordVisible: boolean
    }
}

const inspectRemittanceCompletion = async (page: PageLike) => {
    const result = await page.evaluate(`
        (() => {
            const isVisible = (el) => {
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
            };
            const normalize = (s) => (s || ').replace(/\\s+/g, ' ').trim();
            const bodyText = normalize(document.body?.innerText || ');

            const buttons = Array.from(document.querySelectorAll('button, [role="button"], a'))
                .filter((el) => isVisible(el))
                .map((el) => normalize(el.textContent || '))
                .filter(Boolean)
                .slice(0, 30);

            const visibleInputs = Array.from(document.querySelectorAll('input'))
                .filter((el) => isVisible(el))
                .map((el) => ({
                    type: el.type || ',
                    name: el.name || ',
                    id: el.id || ',
                    placeholder: el.placeholder || ',
                }));

            const hasSuccessKeyword = ${JSON.stringify(KO_SUCCESS_KEYWORDS)}.some((kw) => bodyText.includes(String(kw)));
            const hasRecipientSearchInput = visibleInputs.some((inp) =>
                (inp.placeholder || ').includes(${JSON.stringify(KO_RECIPIENT_SEARCH_PLACEHOLDER)})
            );
            const hasSubmitLikeButton = buttons.some((txt) =>
                txt.includes(${JSON.stringify(KO_REMIT_REQUEST)}) ||
                txt.includes(${JSON.stringify(KO_REMIT_REQUEST_COMPACT)}) ||
                txt.includes(${JSON.stringify(KO_NEXT_STEP)}) ||
                txt.includes(${JSON.stringify(KO_NEXT_STEP_SPACED)}) ||
                txt === ${JSON.stringify(KO_APPLY)} ||
                txt === ${JSON.stringify(KO_SUBMIT)}
            );

            return JSON.stringify({
                url: location.href,
                hasSuccessKeyword,
                hasRecipientSearchInput,
                hasSubmitLikeButton,
                buttons,
                bodyPreview: bodyText.slice(0, 500),
            });
        })()
    `) as string

    return JSON.parse(result) as {
        url: string
        hasSuccessKeyword: boolean
        hasRecipientSearchInput: boolean
        hasSubmitLikeButton: boolean
        buttons: string[]
        bodyPreview: string
    }
}

const isRecipientSearchInputInfo = (input: { type?: string; name?: string; id?: string; placeholder?: string }) => {
    const haystack = `${input.type || '} ${input.name || '} ${input.id || '} ${input.placeholder || '}`.toLowerCase()
    return haystack.includes('\uC218\uCDE8\uC778'.toLowerCase())
        || haystack.includes('\uD68C\uC0AC\uBA85'.toLowerCase())
        || haystack.includes('\uBCC4\uCE6D'.toLowerCase())
        || haystack.includes('\uBC1B\uB294 \uBD84'.toLowerCase())
        || haystack.includes('recipient')
        || haystack.includes('alias')
        || haystack.includes('company')
        || haystack.includes('name')
}

/**
 * Click "송금하기" only within the target company's context (modal/card),
 * to avoid clicking unrelated global nav buttons with the same label.
 */
const clickCompanyScopedRemit = async (
    page: PageLike,
    companyName: string,
    remitText: string
): Promise<string> => {
    const result = await page.evaluate(`
        (() => {
            const company = ${JSON.stringify(companyName)};
            const remit = ${JSON.stringify(remitText)};

            const norm = (s) => (s || ').replace(/\\s+/g, ' ').trim();
            const textOf = (el) => norm(el?.textContent || ');
            const hasText = (el, text) => textOf(el).includes(norm(text));
            const isVisible = (el) => {
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return rect.width > 0
                    && rect.height > 0
                    && style.display !== 'none'
                    && style.visibility !== 'hidden'
                    && style.opacity !== '0';
            };
            const isClickable = (el) => {
                if (!el) return false;
                const tag = (el.tagName || ').toLowerCase();
                const role = (el.getAttribute('role') || ').toLowerCase();
                const cursor = window.getComputedStyle(el).cursor;
                return tag === 'button' || tag === 'a' || role === 'button' || cursor === 'pointer' || !!el.onclick;
            };
            const findRemitInScope = (scope) => {
                if (!scope) return null;
                const candidates = Array.from(
                    scope.querySelectorAll('button, a, [role="button"], div, span')
                );
                for (const el of candidates) {
                    if (!isVisible(el)) continue;
                    if (!isClickable(el)) continue;
                    if (!hasText(el, remit)) continue;
                    return el;
                }
                return null;
            };

            // 1) Prefer a modal/dialog that contains both company and remit text.
            const modalScopes = Array.from(
                document.querySelectorAll(
                    '[role="dialog"], [class*="modal" i], [class*="popup" i], [class*="drawer" i], [class*="overlay" i]'
                )
            ).filter(isVisible);

            for (const scope of modalScopes) {
                if (!hasText(scope, company) || !hasText(scope, remit)) continue;
                const remitEl = findRemitInScope(scope);
                if (remitEl) {
                    remitEl.click();
                    return 'clicked-modal-remit';
                }
            }

            // 2) Try company card scope.
            const companyScopes = Array.from(document.querySelectorAll('article, li, section, div'))
                .filter(isVisible)
                .filter((el) => hasText(el, company))
                .sort((a, b) => {
                    const ra = a.getBoundingClientRect();
                    const rb = b.getBoundingClientRect();
                    return (ra.width * ra.height) - (rb.width * rb.height);
                });

            for (const scope of companyScopes) {
                const directRemit = findRemitInScope(scope);
                if (directRemit) {
                    directRemit.click();
                    return 'clicked-company-scope-remit';
                }
                if (isClickable(scope)) {
                    scope.click();
                    const afterClickRemit = findRemitInScope(scope);
                    if (afterClickRemit) {
                        afterClickRemit.click();
                        return 'clicked-company-scope-then-remit';
                    }
                }
            }

            // 3) Nearest visible remit element to target company text as last resort.
            const companyNode = Array.from(document.querySelectorAll('*'))
                .find((el) => isVisible(el) && hasText(el, company));
            if (companyNode) {
                const baseRect = companyNode.getBoundingClientRect();
                const bx = baseRect.left + baseRect.width / 2;
                const by = baseRect.top + baseRect.height / 2;
                const remitCandidates = Array.from(document.querySelectorAll('button, a, [role="button"], div, span'))
                    .filter((el) => isVisible(el) && isClickable(el) && hasText(el, remit));
                remitCandidates.sort((a, b) => {
                    const ra = a.getBoundingClientRect();
                    const rb = b.getBoundingClientRect();
                    const dax = (ra.left + ra.width / 2) - bx;
                    const day = (ra.top + ra.height / 2) - by;
                    const dbx = (rb.left + rb.width / 2) - bx;
                    const dby = (rb.top + rb.height / 2) - by;
                    return (dax * dax + day * day) - (dbx * dbx + dby * dby);
                });
                if (remitCandidates.length > 0) {
                    remitCandidates[0].click();
                    return 'clicked-nearest-remit-to-company';
                }
            }

            return 'no-company-scoped-remit';
        })()
    `) as string

    return String(result || 'unknown')
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

        // ?? Step 1: Go directly to login page ?????????????????????????????
        const loginWaitUntil = await openMoinLoginPage(page, LONG_TIMEOUT_MS)
        steps.push(`open-login-page:${loginWaitUntil}`)

        // ?? Step 2: Fill login credentials (type char-by-char for React) ??
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

        // ?? Step 3: Submit login ???????????????????????????????????????????
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

        // ?? Step 3.5: Check for explicit login errors ???????????????????????
        // MOIN bizplus shows a red banner for invalid password or locked accounts.
        // We wait up to 10 seconds to see if the URL changes OR an error banner appears.
        let loginFailed = false
        try {
            await Promise.race([
                waitForUrlChange(page, loginUrlBefore, 10000).then((url) => {
                    if (url.includes('/login')) loginFailed = true
                }),
                page.getByText(KO_PASSWORD_MISMATCH).first().waitFor({ state: 'visible', timeout: 10000 }).then(() => { loginFailed = true }),
                page.getByText(KO_ATTEMPT_EXCEEDED).first().waitFor({ state: 'visible', timeout: 10000 }).then(() => { loginFailed = true }),
                page.getByText(KO_LOCK).first().waitFor({ state: 'visible', timeout: 10000 }).then(() => { loginFailed = true }),
                page.getByText(KO_LOCKED).first().waitFor({ state: 'visible', timeout: 10000 }).then(() => { loginFailed = true })
            ])
        } catch {
            // Ignore timeouts from race
        }

        // Wait for page to settle
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined)

        if (loginFailed || page.url().includes('/login')) {
            // Extract text from the page to see the exact error for the user
            const bodyText = await page.locator('body').textContent().catch(() => ') || '

            if (bodyText.includes(KO_ATTEMPT_EXCEEDED) || bodyText.includes(KO_LOCK) || bodyText.includes(KO_LOCKED)) {
                throw new MoinAutomationError(
                    'Login Failed',
                    '[Account locked] Login attempts were exceeded. Please reset the password directly on MOIN Bizplus before trying again.'
                )
            } else if (bodyText.includes(KO_PASSWORD_MISMATCH)) {
                throw new MoinAutomationError(
                    'Login Failed',
                    '[Password mismatch] The password is incorrect. Please verify the password before trying again.'
                )
            } else {
                throw new MoinAutomationError(
                    'Login Failed',
                    `Login failed (URL: ${page.url()}). Please verify the account credentials.`
                )
            }
        }

        const postLoginUrl = page.url()
        steps.push(`post-login-url:${postLoginUrl}`)

        // ?? Step 4: Navigate to recipient page ?????????????????????????????
        // After login, we should be on /transfer/recipient.
        // If not, navigate there via the "?↔툑?섍린" nav link.

        const postLoginPage = page.url()

        if (!postLoginPage.includes('/transfer/recipient')) {
            steps.push('navigating-to-recipient-page')

            const recipientNavSelectors = [
                `a:has-text("${KO_REMIT}")`,      // "?↔툑?섍린" nav link
                'a[href*="/transfer/recipient"]',
                'a[href*="/transfer"]',
                `a:has-text("${KO_REMIT_SHORT}")`,
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

        // ?? Step 4.5: Find the company card and click it ????????????????????
        // The recipient page shows cards with company names.
        // Clicking a card opens a MODAL POPUP (not a page navigation!).
        // The modal shows recipient details and has "?섏젙?섍린" / "?↔툑?섍린" buttons.

        // First, check if company name is visible (may need to scroll)
        let companyTextEl
        try {
            companyTextEl = page.getByText(TARGET_COMPANY_NAME, { exact: false }).first()
            await companyTextEl.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT_MS })
            steps.push('company-text-visible')
        } catch {
            // Maybe not visible due to scrolling ??try JS scroll
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
        let remitClicked = false
        let remitClickReason = 'not-attempted'

        for (let attempt = 0; attempt < 3 && !remitClicked; attempt++) {
            try {
                const companyEl = page.getByText(TARGET_COMPANY_NAME, { exact: false }).first()
                await companyEl.waitFor({ state: 'visible', timeout: 5000 })
                await companyEl.click({ timeout: 5000 })
                steps.push(`clicked-company-text:attempt${attempt}`)
            } catch {
                steps.push(`company-text-click-failed:attempt${attempt}`)
            }

            await page.waitForTimeout(1000)

            try {
                remitClickReason = await clickCompanyScopedRemit(page, TARGET_COMPANY_NAME, KO_REMIT)
                steps.push(`company-scoped-remit:${remitClickReason}:attempt${attempt}`)
                if (remitClickReason.startsWith('clicked-')) {
                    remitClicked = true
                    break
                }
            } catch (err) {
                steps.push(`company-scoped-remit-error:${err instanceof Error ? err.message.slice(0, 120) : 'unknown'}:attempt${attempt}`)
            }

            await page.waitForTimeout(1000)
        }

        if (!remitClicked) {
            throw new MoinAutomationError(
                'Click remit button in modal',
                `Could not click the "${KO_REMIT}" button in the target company context. Last result: ${remitClickReason}. (url: ${page.url()})`
            )
        }

        // Wait for Step 2 (amount entry) to load and recover if we are still on recipient search.
        let step2Ready = false
        let transferInspection = await inspectTransferInputs(page)

        for (let attempt = 0; attempt < 4; attempt++) {
            await page.waitForTimeout(2000)
            await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => undefined)

            const urlAfterRemit = page.url()
            transferInspection = await inspectTransferInputs(page)
            steps.push(`url-after-remit:${urlAfterRemit.replace('https://www.moinbizplus.com', ')}:attempt${attempt}`)
            steps.push(`transfer-inspection:${JSON.stringify({
                aliasSearchVisible: transferInspection.aliasSearchVisible,
                amountKeywordVisible: transferInspection.amountKeywordVisible,
                visibleInputs: transferInspection.visibleInputs.slice(0, 5),
                nextButtons: transferInspection.nextButtons.slice(0, 6),
            }).slice(0, 350)}`)

            const nonRecipientInputs = transferInspection.visibleInputs.filter((visibleInput) => !isRecipientSearchInputInfo(visibleInput))
            if (transferInspection.amountKeywordVisible && nonRecipientInputs.length > 0) {
                step2Ready = true
                break
            }

            if (transferInspection.aliasSearchVisible && attempt < 3) {
                steps.push(`step2-recovery-attempt:${attempt + 1}`)

                try {
                    const recoveryReason = await clickCompanyScopedRemit(page, TARGET_COMPANY_NAME, KO_REMIT)
                    steps.push(`recovery-company-scoped-remit:${recoveryReason}`)
                    if (!recoveryReason.startsWith('clicked-')) {
                        const recoveryCompanyEl = page.getByText(TARGET_COMPANY_NAME, { exact: false }).first()
                        await recoveryCompanyEl.click({ timeout: 3000 })
                        steps.push('recovery-clicked-company-text')
                    }
                } catch (err) {
                    steps.push(`recovery-remit-click-error:${err instanceof Error ? err.message.slice(0, 120) : 'unknown'}`)
                }

                try {
                    const secondRecoveryReason = await clickCompanyScopedRemit(page, TARGET_COMPANY_NAME, KO_REMIT)
                    steps.push(`recovery-company-scoped-remit-2:${secondRecoveryReason}`)
                    if (!secondRecoveryReason.startsWith('clicked-')) {
                        steps.push('recovery-remit-click-not-found')
                    }
                } catch (err) {
                    steps.push(`recovery-remit-click-error-2:${err instanceof Error ? err.message.slice(0, 120) : 'unknown'}`)
                    steps.push('recovery-remit-click-not-found')
                }
            }
        }

        if (!step2Ready) {
            throw new MoinAutomationError(
                'Open amount step',
                `Could not reach the amount-entry step after clicking remit. Visible inputs: ${JSON.stringify(transferInspection.visibleInputs.slice(0, 5))}`
            )
        }
        steps.push('step2-amount-form-loaded')

        // Give the input fields extra time to render (React hydration)
        await page.waitForTimeout(2000)

        // ?? Step 6: Fill USD amount ????????????????????????????????????????
        // The amount page has two sections:
        //   - "蹂대궡??湲덉븸" (KRW) ??auto-calculated
        //   - "諛쏅뒗 湲덉븸" (USD) ??this is where we enter our amount
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
                            cls: (inp.className || ').slice(0, 50),
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
            // Near "諛쏅뒗 湲덉븸" / "USD" text
            `xpath=//*[contains(normalize-space(),"${KO_RECEIVE_AMOUNT}")]/following::input[1]`,
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
            `xpath=//*[contains(normalize-space(),"${KO_AMOUNT}")]/following::input[1]`,
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
                                && (inp.type === 'text' || inp.type === 'number' || inp.type === 'tel' || inp.type === ');
                        });
                        // Return info about visible inputs
                        return JSON.stringify(visible.map((inp, i) => ({
                            i, type: inp.type, name: inp.name, id: inp.id, 
                            placeholder: inp.placeholder
                        })));
                    })()
                `) as string
                steps.push(`visible-fillable-inputs:${result.slice(0, 200)}`)

                // Try to fill a visible input that does not look like the recipient search box.
                const visibleInputs = JSON.parse(result) as Array<{i: number; type: string; name: string; id: string; placeholder: string}>
                const candidateInputs = visibleInputs.filter((visibleInput) => !isRecipientSearchInputInfo(visibleInput))
                if (candidateInputs.length > 0) {
                    const targetInfo = candidateInputs.find((visibleInput) => {
                        const hint = `${visibleInput.name} ${visibleInput.id} ${visibleInput.placeholder}`.toLowerCase()
                        return hint.includes('usd') || hint.includes('amount') || hint.includes('receive')
                    }) || candidateInputs[Math.min(1, candidateInputs.length - 1)]
                    
                    let selector = '
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
                    steps.push(`fill-usd-generic:${selector}:candidate`)
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
                                && (inp.type === 'text' || inp.type === 'number' || inp.type === 'tel' || inp.type === ');
                        });
                        if (visible.length === 0) return 'no-visible-inputs';
                        const blocked = [${JSON.stringify(KO_RECIPIENT_SEARCH_PLACEHOLDER)}, 'recipient', 'alias', 'company', 'name'];
                        const target = visible.find((inp) => {
                            const hint = [inp.name || ', inp.id || ', inp.placeholder || '].join(' ').toLowerCase();
                            return !blocked.some((token) => hint.includes(String(token).toLowerCase()));
                        });
                        if (!target) return 'no-amount-candidate';
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

        // ?? Step 7: Next step after amount ?????????????????????????????????
        await clickNextStep(page, DEFAULT_TIMEOUT_MS)
        steps.push('next-after-amount')

        // ?? Step 8: Upload invoice PDF ?????????????????????????????????????
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

        // ?? Step 9: Next step after upload ?????????????????????????????????
        await clickNextStep(page, DEFAULT_TIMEOUT_MS)
        steps.push('next-after-upload')

        // ?? Step 10: Check agreement ???????????????????????????????????????
        await checkAgreement(page, DEFAULT_TIMEOUT_MS)
        steps.push('check-agreement')

        // ?? Step 11: Submit remittance ?????????????????????????????????????
        // On the ?뺣낫 ?뺤씤 page, the submit button says "?↔툑 ?좎껌" (not "?ㅼ쓬 ?④퀎")
        await clickFirstVisible(
            page,
            [
                `button:has-text("${KO_REMIT_REQUEST}")`,
                `button:has-text("${KO_REMIT_REQUEST_COMPACT}")`,
                `button:has-text("${KO_REMIT}")`,
                `button:has-text("${KO_NEXT_STEP}")`,
                `button:has-text("${KO_NEXT_STEP_SPACED}")`,
                `button:has-text("${KO_APPLY}")`,
                `button:has-text("${KO_SUBMIT}")`,
            ],
            'Submit remittance',
            DEFAULT_TIMEOUT_MS
        )
        steps.push('submit-remittance')

        // Step 12: Verify completion strictly to avoid false positives.
        // Do not treat simple network idle as success.
        let completionConfirmed = false
        const submitUrl = page.url()
        let completionSnapshot = await inspectRemittanceCompletion(page)
        for (let attempt = 0; attempt < 8; attempt++) {
            await page.waitForTimeout(2500)
            await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)

            const textMatched = await page.getByText(KO_SUCCESS_PATTERN).first().isVisible().catch(() => false)
            completionSnapshot = await inspectRemittanceCompletion(page)
            steps.push(`completion-check:${JSON.stringify({
                attempt,
                url: completionSnapshot.url.replace('https://www.moinbizplus.com', ''),
                textMatched,
                hasSuccessKeyword: completionSnapshot.hasSuccessKeyword,
                hasRecipientSearchInput: completionSnapshot.hasRecipientSearchInput,
                hasSubmitLikeButton: completionSnapshot.hasSubmitLikeButton,
                buttons: completionSnapshot.buttons.slice(0, 6),
            }).slice(0, 350)}`)

            if (textMatched || completionSnapshot.hasSuccessKeyword) {
                completionConfirmed = true
                break
            }

            const urlChanged = completionSnapshot.url !== submitUrl
            const movedOutOfSubmitState =
                !completionSnapshot.hasRecipientSearchInput &&
                !completionSnapshot.hasSubmitLikeButton
            if (urlChanged && movedOutOfSubmitState) {
                completionConfirmed = true
                steps.push('completion-inferred-by-state-change')
                break
            }
        }

        if (!completionConfirmed) {
            throw new MoinAutomationError(
                'Verify completion',
                `Submission was clicked, but no reliable completion signal was detected. url: ${completionSnapshot.url}, preview: ${completionSnapshot.bodyPreview.slice(0, 220)}`
            )
        }
        steps.push('completion-confirmed')

        return {
            finalUrl: page.url(),
            completedAt: new Date().toISOString(),
            steps,
        }
    } catch (error) {
        if (error instanceof MoinAutomationError) {
            // Append accumulated steps to help debugging
            error.message = `${error.message} [steps: ${steps.join(' -> ')}]`
            throw error
        }

        throw new MoinAutomationError(
            'Automation',
            `${error instanceof Error ? error.message : 'Unknown automation error.'} [steps: ${steps.join(' -> ')}] [url: ${browser ? 'see-steps' : 'no-browser'}]`
        )
    } finally {
        if (browser) {
            await browser.close().catch(() => undefined)
        }
    }
}
