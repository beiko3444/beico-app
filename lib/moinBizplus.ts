const MOIN_BIZPLUS_LOGIN_URL = 'https://www.moinbizplus.com/login'
const MOIN_BIZPLUS_RECIPIENT_URL = 'https://www.moinbizplus.com/transfer/recipient'
const TARGET_COMPANY_NAME = 'Shanghai Oikki Trading Co.,Ltd'
const TARGET_COMPANY_SEARCH_KEYWORD = 'Oikki'
const TARGET_COMPANY_SEARCH_KEYWORDS = [
    TARGET_COMPANY_SEARCH_KEYWORD,
    'Shanghai',
    'Shanghai Oikki Trading',
    'Michael',
    'Michael Lee',
]
const TARGET_COMPANY_NAME_VARIANTS = [
    TARGET_COMPANY_NAME,
    'Shanghai Oikki Trading Co Ltd',
    'Shanghai Oikki Trading Co., Ltd',
    'Shanghai Oikki Trading',
    'Oikki Trading',
    'Oikki',
    'Michael Lee',
    'michael-lee12580',
]
const TARGET_COMPANY_NAME_REGEX = /Shanghai\s*Oikki\s*Trading\s*Co\.?\s*,?\s*Ltd/i
const DEFAULT_TIMEOUT_MS = 18000
const LONG_TIMEOUT_MS = 35000
const FAST_ELEMENT_TIMEOUT_MS = 7000
const SHORT_SETTLE_MS = 350
const COMPLETION_POLL_INTERVAL_MS = 650
const COMPLETION_FAST_TIMEOUT_MS = 6500

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
const KO_PURCHASE_REMIT = '\uAD6C\uB9E4\uB300\uD589\uC1A1\uAE08'
const KO_AMOUNT = '\uAE08\uC561'
const KO_NEXT_STEP = '\uB2E4\uC74C\uB2E8\uACC4'
const KO_NEXT_STEP_SPACED = '\uB2E4\uC74C \uB2E8\uACC4'
const KO_NEXT = '\uB2E4\uC74C'
const KO_AGREEMENT = '\uD658\uBD88 \uADDC\uC815\uC5D0 \uB3D9\uC758'
const KO_AGREEMENT_DESCRIPTION = '\uC1A1\uAE08 \uC815\uBCF4\uB97C \uD655\uC778\uD558\uC600\uC73C\uBA70'
const KO_AMOUNT_ENTRY = '\uAE08\uC561 \uC785\uB825'
const KO_RECEIVE_AMOUNT = '\uBC1B\uB294 \uAE08\uC561'
const KO_SEND_AMOUNT = '\uBCF4\uB0B4\uB294 \uAE08\uC561'
const KO_FINAL_RECEIVE_AMOUNT = '\uCD5C\uC885 \uC218\uCDE8\uAE08\uC561'
const KO_TOTAL_FEE = '\uCD1D\uC218\uC218\uB8CC'
const KO_EXCHANGE_RATE = '\uC801\uC6A9\uD658\uC728'
const KO_RECIPIENT_SEARCH_PLACEHOLDER = '\uBC1B\uB294 \uBD84 \uC774\uB984, \uD68C\uC0AC\uBA85, \uC218\uCDE8\uC778 \uBCC4\uCE6D'
const KO_REMIT_RESTRICTED_NOTICE = '\uC1A1\uAE08 \uC2E0\uCCAD \uC81C\uD55C \uC548\uB0B4'
const KO_REMIT_AVAILABLE_TIME = '\uC1A1\uAE08 \uC2E0\uCCAD \uAC00\uB2A5\uC2DC\uAC04 \uC548\uB0B4'
const KO_REMIT_RESTRICTED = '\uC1A1\uAE08 \uC2E0\uCCAD \uC81C\uD55C'
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
const KO_ACCEPTED_STATE_KEYWORDS = [
    '\uC1A1\uAE08 \uC9C4\uD589',
    '\uC1A1\uAE08\uC9C4\uD589',
    '\uC1A1\uAE08 \uC2E0\uCCAD\uC911',
    '\uC1A1\uAE08\uC2E0\uCCAD\uC911',
    '\uC1A1\uAE08 \uC811\uC218',
    '\uC1A1\uAE08\uC811\uC218',
    '\uC2E0\uCCAD \uC811\uC218',
    '\uC2E0\uCCAD\uC811\uC218',
    '\uC811\uC218\uB418\uC5C8',
    '\uCC98\uB9AC\uC911',
    '\uC9C4\uD589\uC911',
]

const MOIN_REMITTANCE_TIME_ZONE = 'Asia/Seoul'
const MOIN_REMITTANCE_OPEN_WEEK_MINUTE = 1 * 24 * 60 + 4 * 60
const MOIN_REMITTANCE_CLOSE_WEEK_MINUTE = 5 * 24 * 60 + 18 * 60
const WEEKDAY_INDEX: Record<string, number> = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
}

type BrowserLike = {
    newContext: (options?: Record<string, unknown>) => Promise<BrowserContextLike>
    close: () => Promise<void>
}

type BrowserContextLike = {
    newPage: () => Promise<PageLike>
}

type ResponseLike = {
    url: () => string
    status: () => number
    headers: () => Record<string, string>
    request: () => { method: () => string }
    json: () => Promise<unknown>
    text: () => Promise<string>
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
    on: (event: 'response', handler: (response: ResponseLike) => void) => void
    off?: (event: 'response', handler: (response: ResponseLike) => void) => void
}

type LocatorLike = {
    first: () => LocatorLike
    nth: (index: number) => LocatorLike
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
    abortSignal?: AbortSignal
    prepareOnly?: boolean
}

export type MoinRemittanceResult = {
    finalUrl: string
    completedAt: string
    steps: string[]
    pricingSummary: MoinRemittancePricingSummary | null
    submitted: boolean
    stoppedBeforeConfirmation?: boolean
    finalActionCandidates?: string[]
    selectorsUsed?: string[]
    finalPageTitle?: string
    finalBodyPreview?: string
}

export type MoinRemittancePricingSummary = {
    finalReceiveAmount: string
    sendAmount: string
    totalFee: string
    exchangeRate: string
}

export class MoinAutomationError extends Error {
    step: string
    diagnostic?: unknown

    constructor(step: string, message: string, diagnostic?: unknown) {
        super(message)
        this.name = 'MoinAutomationError'
        this.step = step
        this.diagnostic = diagnostic
    }
}

export class MoinAutomationCanceledError extends MoinAutomationError {
    constructor(step: string, message = 'Remittance automation was canceled by user.') {
        super(step, message)
        this.name = 'MoinAutomationCanceledError'
    }
}

const getErrorMessage = (error: unknown) => {
    if (error instanceof Error && error.message) return error.message
    return String(error)
}

const isTargetClosedAutomationError = (error: unknown) =>
    /target page, context or browser has been closed|browser has been closed|context has been closed|target closed/i.test(getErrorMessage(error))

const throwIfAbortRequested = (signal: AbortSignal | undefined, step: string) => {
    if (signal?.aborted) {
        throw new MoinAutomationCanceledError(step)
    }
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
            await target.waitFor({ state: 'visible', timeout: Math.min(timeoutMs, FAST_ELEMENT_TIMEOUT_MS) })
            const disabled = await target.isDisabled().catch(() => false)
            const enabled = await target.isEnabled().catch(() => !disabled)
            if (disabled || !enabled) continue
            await target.click({ timeout: 5000 })
            return
        } catch {
            // Try next selector.
        }
    }

    throw new MoinAutomationError(step, `Could not find a clickable element for step: ${step} (url: ${page.url()})`)
}

const clickLastVisible = async (
    page: PageLike,
    selectors: string[],
    step: string,
    timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<string> => {
    const errors: string[] = []
    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
        for (const selector of selectors) {
            try {
                const matches = page.locator(selector)
                const count = await matches.count().catch(() => 0)

                for (let index = count - 1; index >= 0; index -= 1) {
                    const target = matches.nth(index)
                    try {
                        const visible = await target.isVisible().catch(() => false)
                        if (!visible) continue
                        const disabled = await target.isDisabled().catch(() => false)
                        const enabled = await target.isEnabled().catch(() => !disabled)
                        if (disabled || !enabled) continue
                        await target.click({ timeout: 5000 })
                        return `${selector}#${index}`
                    } catch (error) {
                        errors.push(`${selector}#${index}: ${getErrorMessage(error)}`)
                    }
                }
            } catch (error) {
                errors.push(`${selector}: ${getErrorMessage(error)}`)
            }
        }

        await page.waitForTimeout(250)
    }

    throw new MoinAutomationError(
        step,
        `Could not find a clickable final element for step: ${step} (url: ${page.url()}) selectors=${errors.slice(-8).join(' | ')}`
    )
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
            await target.waitFor({ state: 'visible', timeout: Math.min(timeoutMs, FAST_ELEMENT_TIMEOUT_MS) })
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
            await target.waitFor({ state: 'visible', timeout: Math.min(timeoutMs, FAST_ELEMENT_TIMEOUT_MS) })
            await target.click({ timeout: 5000 })
            // Clear any existing value first
            await target.fill('')
            // Type character-by-character to trigger React onChange and avoid bot detection
            // Fast per-character input keeps React state updates reliable without slow human-delay simulation.
            const typingDelay = 18 + Math.floor(Math.random() * 18)
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
    const trySetFiles = async () => {
        for (const selector of selectors) {
            try {
                const target = page.locator(selector).first()
                await target.waitFor({ state: 'attached', timeout: Math.min(timeoutMs, FAST_ELEMENT_TIMEOUT_MS) })
                await target.setInputFiles(file)
                return true
            } catch {
                // Try next selector.
            }
        }
        return false
    }

    if (await trySetFiles()) return

    // Some screens render file input after clicking an upload/attach trigger.
    for (const trigger of [
        'button:has-text("파일")',
        'button:has-text("첨부")',
        'button:has-text("업로드")',
        '[role="button"]:has-text("파일")',
        '[role="button"]:has-text("첨부")',
        '[role="button"]:has-text("업로드")',
    ]) {
        try {
            const btn = page.locator(trigger).first()
            await btn.waitFor({ state: 'visible', timeout: 2000 })
            const disabled = await btn.isDisabled().catch(() => false)
            if (disabled) continue
            await btn.click({ timeout: 3000 })
            await page.waitForTimeout(SHORT_SETTLE_MS)
            if (await trySetFiles()) return
        } catch {
            // Continue
        }
    }

    // Last attempt after short wait (lazy render).
    await page.waitForTimeout(SHORT_SETTLE_MS)
    if (await trySetFiles()) return

    const uploadDiag = await page.evaluate(`
        (() => {
            const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
            const isVisible = (el) => {
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
            };
            const fileInputs = Array.from(document.querySelectorAll('input[type="file"]')).map((el, i) => ({
                i,
                name: el.getAttribute('name') || '',
                id: el.getAttribute('id') || '',
                accept: el.getAttribute('accept') || '',
                visible: isVisible(el),
            }));
            const candidateButtons = Array.from(document.querySelectorAll('button, [role="button"], a'))
                .filter((el) => isVisible(el))
                .map((el) => ({
                    text: norm(el.textContent || ''),
                    disabled: Boolean(el.disabled) || el.getAttribute('aria-disabled') === 'true',
                }))
                .filter((row) => row.text)
                .slice(0, 20);
            return JSON.stringify({ fileInputs, candidateButtons });
        })()
    `).catch(() => 'diag-failed') as string

    throw new MoinAutomationError('Upload invoice', `Could not find file upload input. (url: ${page.url()}) diag=${uploadDiag}`)
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

const clickFinalRemittanceSubmit = async (page: PageLike, timeoutMs = DEFAULT_TIMEOUT_MS) => {
    const finalSubmitSelectors = [
        `button:has-text("${KO_REMIT_REQUEST}")`,
        `[role="button"]:has-text("${KO_REMIT_REQUEST}")`,
        `a:has-text("${KO_REMIT_REQUEST}")`,
        `input[type="button"][value*="${KO_REMIT_REQUEST}"]`,
        `input[type="submit"][value*="${KO_REMIT_REQUEST}"]`,
        `button:has-text("${KO_REMIT_REQUEST_COMPACT}")`,
        `[role="button"]:has-text("${KO_REMIT_REQUEST_COMPACT}")`,
        `a:has-text("${KO_REMIT_REQUEST_COMPACT}")`,
        `input[type="button"][value*="${KO_REMIT_REQUEST_COMPACT}"]`,
        `input[type="submit"][value*="${KO_REMIT_REQUEST_COMPACT}"]`,
        `button:has-text("${KO_REMIT}")`,
        `[role="button"]:has-text("${KO_REMIT}")`,
        `a:has-text("${KO_REMIT}")`,
        `input[type="button"][value*="${KO_REMIT}"]`,
        `input[type="submit"][value*="${KO_REMIT}"]`,
        `button:has-text("${KO_NEXT_STEP}")`,
        `[role="button"]:has-text("${KO_NEXT_STEP}")`,
        `a:has-text("${KO_NEXT_STEP}")`,
        `button:has-text("${KO_NEXT_STEP_SPACED}")`,
        `[role="button"]:has-text("${KO_NEXT_STEP_SPACED}")`,
        `a:has-text("${KO_NEXT_STEP_SPACED}")`,
        `button:has-text("${KO_APPLY}")`,
        `[role="button"]:has-text("${KO_APPLY}")`,
        `a:has-text("${KO_APPLY}")`,
        `input[type="button"][value*="${KO_APPLY}"]`,
        `input[type="submit"][value*="${KO_APPLY}"]`,
        `button:has-text("${KO_SUBMIT}")`,
        `[role="button"]:has-text("${KO_SUBMIT}")`,
        `a:has-text("${KO_SUBMIT}")`,
        `input[type="button"][value*="${KO_SUBMIT}"]`,
        `input[type="submit"][value*="${KO_SUBMIT}"]`,
    ]

    return clickLastVisible(page, finalSubmitSelectors, 'Submit remittance', timeoutMs)
}

const checkAgreement = async (page: PageLike, timeoutMs = DEFAULT_TIMEOUT_MS) => {
    const clickedByDom = await page.evaluate(`
        (() => {
            const labels = [${JSON.stringify(KO_AGREEMENT)}, ${JSON.stringify(KO_AGREEMENT_DESCRIPTION)}];
            const norm = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
            const isVisible = (el) => {
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
            };
            const clickTarget = (el) => {
                if (!el || !isVisible(el)) return false;
                try { el.scrollIntoView({ behavior: 'instant', block: 'center' }); } catch {}
                if (typeof el.click === 'function') el.click();
                return true;
            };
            const checkbox = Array.from(document.querySelectorAll('input[type="checkbox"]')).find((el) => isVisible(el) && !el.checked);
            if (checkbox && clickTarget(checkbox)) return true;
            const target = Array.from(document.querySelectorAll('label, button, [role="button"], div, span'))
                .find((el) => isVisible(el) && labels.some((label) => norm(el.textContent || '').includes(label)));
            return clickTarget(target);
        })()
    `).catch(() => false)
    if (clickedByDom) return

    const labelSelectors = [
        `label:has-text("${KO_AGREEMENT}")`,
        `label:has-text("${KO_AGREEMENT_DESCRIPTION}")`,
        `div:has-text("${KO_AGREEMENT}")`,
    ]

    for (const selector of labelSelectors) {
        try {
            const target = page.locator(selector).first()
            await target.waitFor({ state: 'visible', timeout: Math.min(timeoutMs, 2500) })
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
            await target.waitFor({ state: 'visible', timeout: Math.min(timeoutMs, 2500) })
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
        await page.waitForTimeout(250)
    }
    return page.url()
}

const waitForFastCondition = async (
    page: PageLike,
    check: () => Promise<boolean>,
    timeoutMs: number,
    intervalMs = 250
) => {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        if (await check().catch(() => false)) return true
        await page.waitForTimeout(intervalMs)
    }
    return false
}

const getMoinRemittanceWindowState = (date = new Date()) => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: MOIN_REMITTANCE_TIME_ZONE,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(date)

    const weekdayToken = parts.find((part) => part.type === 'weekday')?.value.toLowerCase().slice(0, 3)
    const weekday = weekdayToken ? WEEKDAY_INDEX[weekdayToken] : undefined
    const hour = Number(parts.find((part) => part.type === 'hour')?.value)
    const minute = Number(parts.find((part) => part.type === 'minute')?.value)

    if (weekday === undefined || !Number.isFinite(hour) || !Number.isFinite(minute)) {
        return {
            isOpen: true,
            weekMinute: null,
            label: 'unknown KST time',
        }
    }

    const weekMinute = weekday * 24 * 60 + hour * 60 + minute
    return {
        isOpen:
            weekMinute >= MOIN_REMITTANCE_OPEN_WEEK_MINUTE &&
            weekMinute < MOIN_REMITTANCE_CLOSE_WEEK_MINUTE,
        weekMinute,
        label: `${weekdayToken?.toUpperCase() ?? 'UNK'} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} KST`,
    }
}

const assertMoinRemittanceOpen = async (page: PageLike, step = 'Check MOIN operating hours') => {
    const bodyText = await page.locator('body').textContent().catch(() => '') || ''
    const compactText = bodyText.replace(/\s+/g, ' ').trim()
    const isRestricted =
        compactText.includes(KO_REMIT_RESTRICTED_NOTICE) ||
        compactText.includes(KO_REMIT_AVAILABLE_TIME) ||
        compactText.includes(KO_REMIT_RESTRICTED)

    if (!isRestricted) return

    // MOIN keeps the operating-hours guide visible during open hours, so the
    // guide text alone must not be treated as an actual service block.
    const windowState = getMoinRemittanceWindowState()
    if (windowState.isOpen) return

    const hoursMatch = compactText.match(/월요일\s*오전\s*4시\s*~\s*금요일\s*오후\s*6시/)
    const blockedMatch = compactText.match(/금요일\s*오후\s*6시\s*~\s*월요일\s*오전\s*4시/)
    const summary = [
        `current: ${windowState.label}`,
        hoursMatch ? `available: ${hoursMatch[0]}` : null,
        blockedMatch ? `restricted: ${blockedMatch[0]}` : null,
    ].filter(Boolean).join(' | ')

    throw new MoinAutomationError(
        step,
        `MOIN BizPlus is currently blocking remittance applications. ${summary || compactText.slice(0, 260)}`
    )
}

const collectMoinLoginSubmitDiagnostics = async (page: PageLike) => {
    return String(
        await page.evaluate(`
            (() => {
                const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
                const isVisible = (el) => {
                    if (!el) return false;
                    const rect = el.getBoundingClientRect();
                    const style = window.getComputedStyle(el);
                    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
                };
                const inputs = Array.from(document.querySelectorAll('input')).map((el) => ({
                    type: el.getAttribute('type') || '',
                    name: el.getAttribute('name') || '',
                    testid: el.getAttribute('data-testid') || '',
                    visible: isVisible(el),
                    disabled: Boolean(el.disabled),
                    valueLength: String(el.value || '').length,
                }));
                const buttons = Array.from(document.querySelectorAll('button, [role="button"]')).map((el) => ({
                    tag: el.tagName || '',
                    type: el.getAttribute('type') || '',
                    name: el.getAttribute('name') || '',
                    testid: el.getAttribute('data-testid') || '',
                    text: normalize(el.textContent || ''),
                    visible: isVisible(el),
                    disabled: Boolean(el.disabled) || el.getAttribute('aria-disabled') === 'true',
                }));
                return JSON.stringify({ inputs, buttons });
            })()
        `).catch((error) => `diag-failed:${getErrorMessage(error)}`)
    )
}

const clickMoinLoginSubmit = async (
    page: PageLike,
    abortSignal: AbortSignal | undefined,
): Promise<string> => {
    const loginBtnSelectors = [
        'button[data-testid="button-login"]',
        'button[name="login_button"]',
        'form button[type="submit"]',
        `button[type="submit"]:has-text("${KO_LOGIN}")`,
    ]

    let sawVisibleDisabledSubmit = false
    const errors: string[] = []

    for (const selector of loginBtnSelectors) {
        throwIfAbortRequested(abortSignal, 'Submit login')
        try {
            const btn = page.locator(selector).first()
            await btn.waitFor({ state: 'visible', timeout: 3000 })

            for (let attempt = 0; attempt < 8; attempt++) {
                throwIfAbortRequested(abortSignal, 'Submit login')
                const disabled = await btn.isDisabled().catch(() => false)
                const enabled = await btn.isEnabled().catch(() => !disabled)
                if (!disabled && enabled) {
                    await btn.click({ timeout: 5000 })
                    return selector
                }
                sawVisibleDisabledSubmit = true
                await page.waitForTimeout(250)
            }

            const diagnostics = await collectMoinLoginSubmitDiagnostics(page)
            throw new MoinAutomationError(
                'Submit login',
                `MOIN login submit button did not become enabled after credentials were typed. Please verify the configured login ID/password format before retrying. diag=${diagnostics}`,
            )
        } catch (error) {
            if (error instanceof MoinAutomationError) throw error
            errors.push(`${selector}: ${getErrorMessage(error)}`)
        }
    }

    const diagnostics = await collectMoinLoginSubmitDiagnostics(page)
    const reason = sawVisibleDisabledSubmit
        ? 'MOIN login submit button was visible but stayed disabled after credentials were typed.'
        : 'Could not find the MOIN login submit button.'

    throw new MoinAutomationError(
        'Submit login',
        `${reason} Please verify the configured login ID/password format before retrying. diag=${diagnostics} selectors=${errors.join(' | ')}`,
    )
}

const findVisibleCompanyTextLocator = async (page: PageLike, timeoutMs: number): Promise<LocatorLike | null> => {
    const variantCandidates = Array.from(new Set([TARGET_COMPANY_NAME, ...TARGET_COMPANY_NAME_VARIANTS].filter(Boolean)))
    const candidates: Array<string | RegExp> = [TARGET_COMPANY_NAME_REGEX, ...variantCandidates]
    const deadline = Date.now() + Math.max(1000, timeoutMs)

    while (Date.now() < deadline) {
        for (const candidate of candidates) {
            const remaining = deadline - Date.now()
            if (remaining <= 0) break
            try {
                const locator = page.getByText(candidate, { exact: false }).first()
                await locator.waitFor({ state: 'visible', timeout: Math.min(1200, remaining) })
                return locator
            } catch {
                // Try next text pattern.
            }
        }
        await page.waitForTimeout(180)
    }

    return null
}

const scrollToCompanyTextCandidate = async (page: PageLike) => {
    const found = await page.evaluate(`
        (() => {
            const companies = ${JSON.stringify(TARGET_COMPANY_NAME_VARIANTS)};
            const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
            const normalizedCompanies = companies.map(normalize).filter(Boolean);
            const requiredTokens = ['shanghai', 'oikki', 'trading'];
            const matchesCompany = (text) => {
                const normalized = normalize(text);
                if (!normalized) return false;
                if (normalizedCompanies.some((company) => normalized.includes(company))) return true;
                return requiredTokens.every((token) => normalized.includes(token));
            };

            const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode: (node) => matchesCompany(node.textContent || '')
                        ? NodeFilter.FILTER_ACCEPT
                        : NodeFilter.FILTER_REJECT,
                }
            );
            const node = walker.nextNode();
            if (node && node.parentElement) {
                node.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return true;
            }
            return false;
        })()
    `).catch(() => false)

    return Boolean(found)
}

const clickCompanyRowCandidate = async (page: PageLike, companyNames: string[]) => {
    const result = await page.evaluate(`
        (() => {
            const companies = ${JSON.stringify(companyNames)};
            const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
            const normalizedCompanies = companies.map(normalize).filter(Boolean);
            const requiredTokens = ['shanghai', 'oikki', 'trading'];
            const textOf = (el) => String((el && el.textContent) || '').replace(/\\s+/g, ' ').trim();
            const matchesCompany = (el) => {
                const normalized = normalize(textOf(el));
                if (!normalized) return false;
                if (normalizedCompanies.some((company) => normalized.includes(company))) return true;
                return requiredTokens.every((token) => normalized.includes(token));
            };
            const isVisible = (el) => {
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
            };
            const isDisabled = (el) => Boolean(el.disabled) || String(el.getAttribute('aria-disabled') || '').toLowerCase() === 'true';
            const clickWithMouseEvents = (target) => {
                if (!target || !isVisible(target) || isDisabled(target)) return false;
                try {
                    target.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
                } catch {}
                const eventInit = { bubbles: true, cancelable: true, view: window };
                try { target.dispatchEvent(new MouseEvent('pointerdown', eventInit)); } catch {}
                try { target.dispatchEvent(new MouseEvent('mousedown', eventInit)); } catch {}
                try { target.dispatchEvent(new MouseEvent('mouseup', eventInit)); } catch {}
                try { target.dispatchEvent(new MouseEvent('click', eventInit)); } catch {}
                if (typeof target.click === 'function') target.click();
                return true;
            };
            const isClickable = (el) => {
                if (!el) return false;
                const tag = (el.tagName || '').toLowerCase();
                const role = (el.getAttribute('role') || '').toLowerCase();
                const style = window.getComputedStyle(el);
                return tag === 'button' || tag === 'a' || role === 'button' || el.getAttribute('onclick') || style.cursor === 'pointer' || el.tabIndex >= 0;
            };
            const viewportArea = Math.max(1, window.innerWidth * window.innerHeight);
            const leaves = Array.from(document.querySelectorAll('*'))
                .filter((el) => isVisible(el) && matchesCompany(el))
                .sort((a, b) => {
                    const ra = a.getBoundingClientRect();
                    const rb = b.getBoundingClientRect();
                    return (ra.width * ra.height) - (rb.width * rb.height);
                })
                .slice(0, 8);

            for (const leaf of leaves) {
                let scope = leaf;
                for (let depth = 0; depth < 8 && scope; depth += 1) {
                    const rect = scope.getBoundingClientRect();
                    const area = rect.width * rect.height;
                    if (area > viewportArea * 0.65) {
                        scope = scope.parentElement;
                        continue;
                    }

                    const selectable = Array.from(scope.querySelectorAll('input[type="radio"], input[type="checkbox"], [role="radio"], [role="checkbox"]'))
                        .find((el) => isVisible(el) && !isDisabled(el));
                    if (selectable && clickWithMouseEvents(selectable)) return 'clicked-row-select-control';

                    if (isClickable(scope) && clickWithMouseEvents(scope)) return 'clicked-row-clickable-scope';

                    const clickable = Array.from(scope.querySelectorAll('button, a, [role="button"], [onclick]'))
                        .find((el) => isVisible(el) && !isDisabled(el));
                    if (clickable && clickWithMouseEvents(clickable)) return 'clicked-row-child-clickable';

                    if (depth >= 2 && clickWithMouseEvents(scope)) return 'clicked-row-container';

                    scope = scope.parentElement;
                }
            }

            return 'row-select-not-found';
        })()
    `).catch(() => 'row-select-error')

    return String(result || 'row-select-unknown')
}

const clickFirstRecipientSearchResult = async (page: PageLike, keyword: string) => {
    const result = await page.evaluate(`
        (() => {
            const keyword = ${JSON.stringify(keyword)};
            const recipientPlaceholder = ${JSON.stringify(KO_RECIPIENT_SEARCH_PLACEHOLDER)};
            const searchHints = [recipientPlaceholder, '수취인', '회사명', '별칭', '받는 분', '받는분', '검색', 'recipient', 'company', 'alias', 'search'];
            const emptyHints = ['검색 결과가 없습니다', '결과가 없습니다', '수취인이 없습니다', '등록된 수취인이 없습니다', 'no result', 'no recipient'];
            const norm = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
            const normalize = (value) => norm(value).toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
            const keywordNorm = normalize(keyword);
            const isVisible = (el) => {
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
            };
            const isDisabled = (el) => Boolean(el.disabled) || String(el.getAttribute('aria-disabled') || '').toLowerCase() === 'true';
            const textOf = (el) => norm((el && el.textContent) || '');
            const inputHint = (el) => [
                el.placeholder || '',
                el.getAttribute('aria-label') || '',
                el.getAttribute('name') || '',
                el.getAttribute('id') || '',
            ].join(' ').toLowerCase();
            const isRecipientSearch = (el) => {
                const hint = inputHint(el);
                return searchHints.some((token) => token && hint.includes(String(token).toLowerCase()));
            };
            const visibleInputs = Array.from(document.querySelectorAll('input'))
                .filter((el) => isVisible(el) && !el.disabled && !el.readOnly);
            const searchInput = visibleInputs.find((el) => isRecipientSearch(el))
                || visibleInputs.find((el) => ['search', 'text', ''].includes(String(el.type || '').toLowerCase()));
            if (!searchInput) return 'search-result-input-not-found';

            const inputRect = searchInput.getBoundingClientRect();
            const bodyText = normalize((document.body && document.body.innerText) || '');
            if (emptyHints.some((hint) => bodyText.includes(normalize(hint)))) {
                return 'search-result-empty';
            }

            const clickWithMouseEvents = (target) => {
                if (!target || !isVisible(target) || isDisabled(target)) return false;
                try {
                    target.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
                } catch {}
                const eventInit = { bubbles: true, cancelable: true, view: window };
                try { target.dispatchEvent(new MouseEvent('pointerdown', eventInit)); } catch {}
                try { target.dispatchEvent(new MouseEvent('mousedown', eventInit)); } catch {}
                try { target.dispatchEvent(new MouseEvent('mouseup', eventInit)); } catch {}
                try { target.dispatchEvent(new MouseEvent('click', eventInit)); } catch {}
                if (typeof target.click === 'function') target.click();
                return true;
            };
            const isClickable = (el) => {
                if (!el) return false;
                const tag = (el.tagName || '').toLowerCase();
                const role = (el.getAttribute('role') || '').toLowerCase();
                const style = window.getComputedStyle(el);
                return tag === 'button' || tag === 'a' || role === 'button' || el.getAttribute('onclick') || style.cursor === 'pointer' || el.tabIndex >= 0;
            };
            const viewportArea = Math.max(1, window.innerWidth * window.innerHeight);
            const rows = Array.from(document.querySelectorAll('li, tr, label, article, section, [role="row"], [role="option"], div'))
                .filter((el) => isVisible(el))
                .map((el) => {
                    const rect = el.getBoundingClientRect();
                    const text = textOf(el);
                    const area = rect.width * rect.height;
                    const hasSelectable = Boolean(el.querySelector('input[type="radio"], input[type="checkbox"], [role="radio"], [role="checkbox"]'));
                    const hasKeyword = keywordNorm ? normalize(text).includes(keywordNorm) : false;
                    return { el, rect, text, area, hasSelectable, hasKeyword };
                })
                .filter((row) => row.rect.top > inputRect.bottom - 8)
                .filter((row) => row.text.length >= 3 && row.text.length <= 700)
                .filter((row) => row.area > 1200 && row.area < viewportArea * 0.5)
                .filter((row) => !normalize(row.text).includes(normalize('다음단계')))
                .filter((row) => !normalize(row.text).includes(normalize('신규 수취인 등록')))
                .sort((a, b) => {
                    const keywordScore = Number(b.hasKeyword) - Number(a.hasKeyword);
                    if (keywordScore !== 0) return keywordScore;
                    const selectableScore = Number(b.hasSelectable) - Number(a.hasSelectable);
                    if (selectableScore !== 0) return selectableScore;
                    return a.rect.top - b.rect.top || a.area - b.area;
                });

            for (const row of rows.slice(0, 6)) {
                const selectable = Array.from(row.el.querySelectorAll('input[type="radio"], input[type="checkbox"], [role="radio"], [role="checkbox"]'))
                    .find((el) => isVisible(el) && !isDisabled(el));
                if (selectable && clickWithMouseEvents(selectable)) return 'clicked-search-result-select-control';
                if (isClickable(row.el) && clickWithMouseEvents(row.el)) return 'clicked-search-result-row';
                const clickable = Array.from(row.el.querySelectorAll('button, a, [role="button"], [onclick]'))
                    .find((el) => isVisible(el) && !isDisabled(el));
                if (clickable && clickWithMouseEvents(clickable)) return 'clicked-search-result-child-clickable';
            }

            return rows.length > 0 ? 'search-result-click-miss' : 'search-result-row-not-found';
        })()
    `).catch(() => 'search-result-error')

    return String(result || 'search-result-unknown')
}

const fillRecipientSearchKeyword = async (page: PageLike, keyword: string) => {
    const result = await page.evaluate(`
        (() => {
            const recipientPlaceholder = ${JSON.stringify(KO_RECIPIENT_SEARCH_PLACEHOLDER)};
            const keyword = ${JSON.stringify(keyword)};
            const searchHints = [recipientPlaceholder, '수취인', '회사명', '별칭', '받는 분', '받는분', '검색', 'recipient', 'company', 'alias', 'search'];
            const isVisible = (el) => {
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
            };
            const inputHint = (el) => [
                el.placeholder || '',
                el.getAttribute('aria-label') || '',
                el.getAttribute('name') || '',
                el.getAttribute('id') || '',
            ].join(' ').toLowerCase();
            const isRecipientSearch = (el) => {
                const hint = inputHint(el);
                return searchHints.some((token) => token && hint.includes(String(token).toLowerCase()));
            };
            const visibleInputs = Array.from(document.querySelectorAll('input'))
                .filter((el) => isVisible(el) && !el.disabled && !el.readOnly);
            const input = visibleInputs.find((el) => isRecipientSearch(el))
                || visibleInputs.find((el) => ['search', 'text', ''].includes(String(el.type || '').toLowerCase()));
            if (!input) return 'recipient-search-not-found';

            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
            if (!nativeSetter) return 'native-setter-not-found';

            const InputEventCtor = window.InputEvent || Event;
            input.focus();
            input.click();
            nativeSetter.call(input, keyword);
            input.dispatchEvent(new InputEventCtor('input', { bubbles: true, inputType: 'insertText', data: keyword }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true }));
            input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
            return 'recipient-search-filled';
        })()
    `).catch(() => 'recipient-search-error')

    return String(result || 'recipient-search-unknown')
}

const clearRecipientSearchKeyword = async (page: PageLike) => {
    const result = await page.evaluate(`
        (() => {
            const recipientPlaceholder = ${JSON.stringify(KO_RECIPIENT_SEARCH_PLACEHOLDER)};
            const searchHints = [recipientPlaceholder, '수취인', '회사명', '별칭', '받는 분', '받는분', '검색', 'recipient', 'company', 'alias', 'search'];
            const isVisible = (el) => {
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
            };
            const inputHint = (el) => [
                el.placeholder || '',
                el.getAttribute('aria-label') || '',
                el.getAttribute('name') || '',
                el.getAttribute('id') || '',
            ].join(' ').toLowerCase();
            const isRecipientSearch = (el) => {
                const hint = inputHint(el);
                return searchHints.some((token) => token && hint.includes(String(token).toLowerCase()));
            };
            const visibleInputs = Array.from(document.querySelectorAll('input'))
                .filter((el) => isVisible(el) && !el.disabled && !el.readOnly);
            const input = visibleInputs.find((el) => isRecipientSearch(el))
                || visibleInputs.find((el) => ['search', 'text', ''].includes(String(el.type || '').toLowerCase()));
            if (!input) return 'recipient-search-not-found';

            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
            if (!nativeSetter) return 'native-setter-not-found';

            const InputEventCtor = window.InputEvent || Event;
            input.focus();
            nativeSetter.call(input, '');
            input.dispatchEvent(new InputEventCtor('input', { bubbles: true, inputType: 'deleteContentBackward', data: null }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            return 'recipient-search-cleared';
        })()
    `).catch(() => 'recipient-search-clear-error')

    return String(result || 'recipient-search-clear-unknown')
}

const inspectTransferInputs = async (page: PageLike) => {
    const result = await page.evaluate(`
        (() => {
            const recipientPlaceholder = ${JSON.stringify(KO_RECIPIENT_SEARCH_PLACEHOLDER)};
            const amountEntry = ${JSON.stringify(KO_AMOUNT_ENTRY)};
            const receiveAmount = ${JSON.stringify(KO_RECEIVE_AMOUNT)};
            const sendAmount = ${JSON.stringify(KO_SEND_AMOUNT)};

            const isVisible = (el) => {
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
            };

            const bodyText = ((document.body && document.body.innerText) || '').replace(/\\s+/g, ' ').trim();
            const inputNodes = Array.from(document.querySelectorAll('input'));
            const visibleInputs = inputNodes
                .filter((inp) => isVisible(inp))
                .map((inp, i) => ({
                    i,
                    type: inp.type || '',
                    name: inp.name || '',
                    id: inp.id || '',
                    placeholder: inp.placeholder || '',
                }));

            const nextButtons = Array.from(document.querySelectorAll('button, [role="button"], a'))
                .filter((el) => isVisible(el))
                .map((el) => ((el.textContent || '').replace(/\\s+/g, ' ').trim()))
                .filter(Boolean)
                .slice(0, 20);

            return {
                bodyText: bodyText.slice(0, 1200),
                visibleInputs,
                nextButtons,
                aliasSearchVisible: visibleInputs.some((inp) => (inp.placeholder || '').includes(recipientPlaceholder)),
                amountKeywordVisible:
                    bodyText.includes(amountEntry) ||
                    bodyText.includes(receiveAmount) ||
                    bodyText.includes(sendAmount),
            };
        })()
    `) as {
        bodyText: string
        visibleInputs: Array<{ i: number; type: string; name: string; id: string; placeholder: string }>
        nextButtons: string[]
        aliasSearchVisible: boolean
        amountKeywordVisible: boolean
    }

    return result
}

const collectMoinFailureDiagnostic = async (page: PageLike | null, steps: string[]) => {
    if (!page) {
        return {
            url: 'no-page',
            lastSteps: steps.slice(-12),
            pageAvailable: false,
        }
    }

    try {
        const pageSnapshot = await page.evaluate(`
            (() => {
                const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
                const isVisible = (el) => {
                    if (!el) return false;
                    const rect = el.getBoundingClientRect();
                    const style = window.getComputedStyle(el);
                    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
                };
                const buttons = Array.from(document.querySelectorAll('button, [role="button"], a, input[type="button"], input[type="submit"]'))
                    .filter((el) => isVisible(el))
                    .map((el) => ({
                        tag: el.tagName || '',
                        text: normalize(el.textContent || el.value || el.getAttribute('aria-label') || ''),
                        href: el.tagName === 'A' ? el.getAttribute('href') || '' : '',
                        disabled: Boolean(el.disabled) || String(el.getAttribute('aria-disabled') || '').toLowerCase() === 'true',
                    }))
                    .filter((row) => row.text || row.href)
                    .slice(0, 30);
                const inputs = Array.from(document.querySelectorAll('input, textarea, select'))
                    .filter((el) => isVisible(el))
                    .map((el) => ({
                        tag: el.tagName || '',
                        type: el.getAttribute('type') || '',
                        name: el.getAttribute('name') || '',
                        id: el.getAttribute('id') || '',
                        placeholder: el.getAttribute('placeholder') || '',
                    }))
                    .slice(0, 20);
                const bodyPreview = normalize((document.body && document.body.innerText) || '').slice(0, 1200);
                return { url: location.href, buttons, inputs, bodyPreview };
            })()
        `)

        return {
            ...(pageSnapshot as Record<string, unknown>),
            lastSteps: steps.slice(-12),
            pageAvailable: true,
        }
    } catch (error) {
        return {
            url: 'page-unavailable',
            lastSteps: steps.slice(-12),
            pageAvailable: false,
            diagnosticError: getErrorMessage(error),
        }
    }
}

const inspectAmountFieldValue = async (page: PageLike, expectedAmount: string) => {
    const rawResult = await page.evaluate(`
        (() => {
            const recipientPlaceholder = ${JSON.stringify(KO_RECIPIENT_SEARCH_PLACEHOLDER)};
            const expectedAmountText = ${JSON.stringify(expectedAmount)};
            const parseNumeric = (value) => {
                if (value === null || value === undefined) return null;
                const cleaned = String(value).replace(/[^\\d.-]/g, '');
                if (!cleaned || cleaned === '.' || cleaned === '-' || cleaned === '-.') return null;
                const parsed = Number(cleaned);
                return Number.isFinite(parsed) ? parsed : null;
            };
            const isVisible = (el) => {
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
            };

            const expectedNumeric = parseNumeric(expectedAmountText);
            const blockedTokens = [String(recipientPlaceholder || '').toLowerCase(), 'recipient', 'alias', 'company', 'name'];
            const candidates = Array.from(document.querySelectorAll('input'))
                .filter((inp) => isVisible(inp))
                .filter((inp) => ['text', 'number', 'tel', ''].includes((inp.type || '').toLowerCase()))
                .map((inp) => {
                    const hint = [inp.name || '', inp.id || '', inp.placeholder || '', inp.getAttribute('aria-label') || '']
                        .join(' ')
                        .toLowerCase();
                    const value = inp.value || '';
                    const numeric = parseNumeric(value);
                    const blocked = blockedTokens.some((token) => token && hint.includes(token));
                    return {
                        hint: hint.slice(0, 120),
                        value: value.slice(0, 50),
                        numeric,
                        blocked,
                        readOnly: Boolean(inp.readOnly),
                        disabled: Boolean(inp.disabled),
                    };
                });

            const usableCandidates = candidates.filter((row) => !row.blocked && !row.disabled);
            const matched = usableCandidates.some((row) => {
                if (row.numeric === null || expectedNumeric === null) return false;
                return Math.abs(row.numeric - expectedNumeric) < 0.000001;
            });
            const bestCandidate = usableCandidates.find((row) => row.numeric !== null) || usableCandidates[0] || null;
            return JSON.stringify({
                matched,
                expectedNumeric,
                bestValue: bestCandidate ? bestCandidate.value : '',
                bestNumeric: bestCandidate ? bestCandidate.numeric : null,
                candidates: usableCandidates.slice(0, 6),
            });
        })()
    `) as string

    try {
        return JSON.parse(rawResult) as {
            matched: boolean
            expectedNumeric: number | null
            bestValue: string
            bestNumeric: number | null
            candidates: Array<{ hint: string; value: string; numeric: number | null; blocked: boolean; readOnly: boolean; disabled: boolean }>
        }
    } catch {
        return {
            matched: false,
            expectedNumeric: null,
            bestValue: '',
            bestNumeric: null,
            candidates: [],
        }
    }
}

const hasUploadInput = async (page: PageLike) => {
    const result = await page.evaluate(`
        (() => {
            const input = document.querySelector('input[type="file"]');
            return Boolean(input);
        })()
    `).catch(() => false)
    return Boolean(result)
}

const inspectRemittanceCompletion = async (page: PageLike) => {
    const result = await page.evaluate(`
        (() => {
            const successKeywords = ${JSON.stringify(KO_SUCCESS_KEYWORDS)};
            const acceptedStateKeywords = ${JSON.stringify(KO_ACCEPTED_STATE_KEYWORDS)};
            const recipientPlaceholder = ${JSON.stringify(KO_RECIPIENT_SEARCH_PLACEHOLDER)};
            const remitRequest = ${JSON.stringify(KO_REMIT_REQUEST)};
            const remitRequestCompact = ${JSON.stringify(KO_REMIT_REQUEST_COMPACT)};
            const nextStep = ${JSON.stringify(KO_NEXT_STEP)};
            const nextStepSpaced = ${JSON.stringify(KO_NEXT_STEP_SPACED)};
            const applyLabel = ${JSON.stringify(KO_APPLY)};
            const submitLabel = ${JSON.stringify(KO_SUBMIT)};

            const isVisible = (el) => {
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
            };
            const normalize = (s) => (s || '').replace(/\\s+/g, ' ').trim();
            const bodyText = normalize((document.body && document.body.innerText) || '');

            const buttonRows = Array.from(document.querySelectorAll('button, [role="button"], a, input[type="button"], input[type="submit"]'))
                .filter((el) => isVisible(el))
                .map((el) => ({
                    text: normalize(el.textContent || el.value || el.getAttribute('aria-label') || ''),
                    disabled: Boolean(el.disabled) || String(el.getAttribute('aria-disabled') || '').toLowerCase() === 'true',
                }))
                .filter((row) => row.text)
                .slice(0, 30);
            const buttons = buttonRows.map((row) => row.text);

            const visibleInputs = Array.from(document.querySelectorAll('input'))
                .filter((el) => isVisible(el))
                .map((el) => ({
                    type: el.type || '',
                    name: el.name || '',
                    id: el.id || '',
                    placeholder: el.placeholder || '',
                }));

            const hasSuccessKeyword = successKeywords.some((kw) => bodyText.includes(String(kw)));
            const hasAcceptedStateKeyword = acceptedStateKeywords.some((kw) => bodyText.includes(String(kw)));
            const hasRecipientSearchInput = visibleInputs.some((inp) => (inp.placeholder || '').includes(recipientPlaceholder));
            const hasSubmitLikeButton = buttonRows.some((row) =>
                !row.disabled && (
                    row.text.includes(remitRequest) ||
                    row.text.includes(remitRequestCompact) ||
                    row.text.includes(nextStep) ||
                    row.text.includes(nextStepSpaced) ||
                    row.text === applyLabel ||
                    row.text === submitLabel
                )
            );

            return {
                url: location.href,
                hasSuccessKeyword,
                hasAcceptedStateKeyword,
                hasRecipientSearchInput,
                hasSubmitLikeButton,
                buttons,
                bodyPreview: bodyText.slice(0, 500),
            };
        })()
    `) as {
        url: string
        hasSuccessKeyword: boolean
        hasAcceptedStateKeyword: boolean
        hasRecipientSearchInput: boolean
        hasSubmitLikeButton: boolean
        buttons: string[]
        bodyPreview: string
    }

    return result
}

const inspectPreSubmitState = async (page: PageLike) => {
    const result = await page.evaluate(`
        (() => {
            const norm = (value) => (value || '').replace(/\\s+/g, ' ').trim();
            const isVisible = (el) => {
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
            };
            const title = document.title || '';
            const bodyText = norm((document.body && document.body.innerText) || '');
            const buttons = Array.from(document.querySelectorAll('button, [role="button"], a, input[type="button"], input[type="submit"]'))
                .filter((el) => isVisible(el))
                .map((el) => norm([
                    el.textContent || '',
                    el.getAttribute && el.getAttribute('aria-label') || '',
                    el.getAttribute && el.getAttribute('title') || '',
                    el.getAttribute && el.getAttribute('value') || '',
                ].join(' ')))
                .filter(Boolean)
                .slice(0, 30);
            const finalKeywords = [${JSON.stringify(KO_REMIT)}, ${JSON.stringify(KO_REMIT_SHORT)}, ${JSON.stringify(KO_REMIT_REQUEST)}, ${JSON.stringify(KO_REMIT_REQUEST_COMPACT)}, ${JSON.stringify(KO_APPLY)}, ${JSON.stringify(KO_SUBMIT)}, ${JSON.stringify(KO_NEXT)}, ${JSON.stringify(KO_NEXT_STEP)}, ${JSON.stringify(KO_NEXT_STEP_SPACED)}, '확인', '완료', '계속'];
            const finalActionCandidates = buttons.filter((text) => finalKeywords.some((keyword) => keyword && text.includes(keyword))).slice(0, 12);
            return {
                title,
                bodyPreview: bodyText.slice(0, 3000),
                finalActionCandidates,
            };
        })()
    `) as {
        title: string
        bodyPreview: string
        finalActionCandidates: string[]
    }

    return {
        title: typeof result.title === 'string' ? result.title : '',
        bodyPreview: typeof result.bodyPreview === 'string' ? result.bodyPreview : '',
        finalActionCandidates: Array.isArray(result.finalActionCandidates)
            ? result.finalActionCandidates.filter((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0)
            : [],
    }
}

const inspectRemittancePricingSummary = async (page: PageLike): Promise<MoinRemittancePricingSummary> => {
    const rawResult = await page.evaluate(`
        (() => {
            const labels = {
                finalReceiveAmount: [${JSON.stringify(KO_FINAL_RECEIVE_AMOUNT)}, ${JSON.stringify(KO_RECEIVE_AMOUNT)}, 'final receive amount', 'receive amount'],
                sendAmount: [${JSON.stringify(KO_SEND_AMOUNT)}, 'send amount', 'sending amount'],
                totalFee: [${JSON.stringify(KO_TOTAL_FEE)}, 'total fee', 'fee'],
                exchangeRate: [${JSON.stringify(KO_EXCHANGE_RATE)}, 'exchange rate', 'rate'],
            };

            const clean = (value) => (value || '').replace(/\\s+/g, ' ').trim();
            const normalize = (value) => clean(value).toLowerCase().replace(/\\s+/g, '');
            const hasDigit = (value) => /\\d/.test(value || '');
            const isVisible = (el) => {
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
            };

            const extractSameLine = (line, words, key) => {
                const escapeRegex = (input) => String(input).replace(/[\\^$.*+?()[\\]{}|]/g, '\\\\$&');
                for (const word of words) {
                    const pattern = new RegExp(escapeRegex(word) + '\\\\s*[:：-]?\\\\s*(.+)$', 'i');
                    const match = line.match(pattern);
                    if (match && hasDigit(match[1])) return moneySnippet(match[1], key) || clean(match[1]);
                }
                return '';
            };

            const moneySnippet = (line, key) => {
                if (!line) return '';
                if (key === 'exchangeRate') {
                    const exchangeExpr = line.match(/1\\s*USD\\s*=\\s*[0-9][0-9,]*(?:\\.\\d+)?\\s*(?:KRW|원)?/i);
                    if (exchangeExpr) return clean(exchangeExpr[0]);
                    const rateExpr = line.match(/[0-9][0-9,]*(?:\\.\\d+)?\\s*(?:KRW|원|USD|US\\$)?/i);
                    if (rateExpr) return clean(rateExpr[0]);
                    return '';
                }
                const amountExpr = line.match(/(?:US\\$|USD|KRW|₩|원)?\\s*[0-9][0-9,]*(?:\\.\\d+)?\\s*(?:US\\$|USD|KRW|₩|원)?/i);
                return amountExpr ? clean(amountExpr[0]) : '';
            };

            const lines = clean((document.body && document.body.innerText) || '')
                .split(/\\n+/)
                .map((line) => clean(line))
                .filter(Boolean);

            const visibleElements = Array.from(document.querySelectorAll('th,td,dt,dd,label,strong,b,span,p,div,li'))
                .filter((el) => isVisible(el))
                .slice(0, 2000);

            const findByDom = (key, words) => {
                const normalizedWords = words.map((word) => normalize(word));
                const candidates = visibleElements
                    .map((el) => ({ el, text: clean(el.textContent || '') }))
                    .filter((row) => row.text.length > 0 && row.text.length <= 80)
                    .filter((row) => normalizedWords.some((word) => normalize(row.text).includes(word)));

                for (const candidate of candidates) {
                    const direct = extractSameLine(candidate.text, words, key);
                    if (direct) return direct;
                    const directSnippet = moneySnippet(candidate.text, key);
                    if (directSnippet) return directSnippet;

                    const nextSibling = candidate.el.nextElementSibling;
                    if (nextSibling) {
                        const siblingText = clean(nextSibling.textContent || '');
                        if (hasDigit(siblingText)) return siblingText;
                    }

                    const parent = candidate.el.parentElement;
                    if (parent) {
                        const siblings = Array.from(parent.children);
                        const idx = siblings.indexOf(candidate.el);
                        if (idx >= 0 && idx + 1 < siblings.length) {
                            const nextText = clean(siblings[idx + 1].textContent || '');
                            if (hasDigit(nextText)) return nextText;
                        }
                    }
                }

                return '';
            };

            const findByLine = (key, words) => {
                const normalizedWords = words.map((word) => normalize(word));
                for (let i = 0; i < lines.length; i += 1) {
                    const line = lines[i];
                    const normalizedLine = normalize(line);
                    if (!normalizedWords.some((word) => normalizedLine.includes(word))) continue;

                    const sameLine = extractSameLine(line, words, key);
                    if (sameLine) return sameLine;

                    const sameLineSnippet = moneySnippet(line, key);
                    if (sameLineSnippet) return sameLineSnippet;

                    const nextLine = lines[i + 1] || '';
                    if (hasDigit(nextLine)) return nextLine;
                }
                return '';
            };

            const result = {
                finalReceiveAmount: '',
                sendAmount: '',
                totalFee: '',
                exchangeRate: '',
            };

            for (const key of Object.keys(result)) {
                const words = labels[key] || [];
                const domValue = findByDom(key, words);
                if (domValue) {
                    result[key] = domValue;
                    continue;
                }

                const lineValue = findByLine(key, words);
                if (lineValue) {
                    result[key] = lineValue;
                }
            }

            return JSON.stringify(result);
        })()
    `) as string

    try {
        const parsed = JSON.parse(rawResult) as Partial<MoinRemittancePricingSummary>
        return {
            finalReceiveAmount: typeof parsed.finalReceiveAmount === 'string' ? parsed.finalReceiveAmount.trim() : '',
            sendAmount: typeof parsed.sendAmount === 'string' ? parsed.sendAmount.trim() : '',
            totalFee: typeof parsed.totalFee === 'string' ? parsed.totalFee.trim() : '',
            exchangeRate: typeof parsed.exchangeRate === 'string' ? normalizeExchangeRateText(parsed.exchangeRate.trim()) : '',
        }
    } catch {
        return {
            finalReceiveAmount: '',
            sendAmount: '',
            totalFee: '',
            exchangeRate: '',
        }
    }
}

const isRecipientSearchInputInfo = (input: { type?: string; name?: string; id?: string; placeholder?: string }) => {
    const haystack = `${input.type || ''} ${input.name || ''} ${input.id || ''} ${input.placeholder || ''}`.toLowerCase()
    return haystack.includes('\uC218\uCDE8\uC778'.toLowerCase())
        || haystack.includes('\uD68C\uC0AC\uBA85'.toLowerCase())
        || haystack.includes('\uBCC4\uCE6D'.toLowerCase())
        || haystack.includes('\uBC1B\uB294 \uBD84'.toLowerCase())
        || haystack.includes('recipient')
        || haystack.includes('alias')
        || haystack.includes('company')
        || haystack.includes('name')
}

const clickCompanyScopedRemit = async (
    page: PageLike,
    companyNames: string[],
    remitText: string
): Promise<string> => {
    const result = await page.evaluate(`
        (() => {
            const companies = ${JSON.stringify(companyNames)};
            const remit = ${JSON.stringify(remitText)};
            const actionLabels = Array.from(new Set([
                remit,
                ${JSON.stringify(KO_REMIT_SHORT)},
                ${JSON.stringify(KO_REMIT_REQUEST)},
                ${JSON.stringify(KO_REMIT_REQUEST_COMPACT)},
                ${JSON.stringify(KO_NEXT_STEP)},
                ${JSON.stringify(KO_NEXT_STEP_SPACED)},
                ${JSON.stringify(KO_NEXT)},
            ].filter(Boolean)));

            const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
            const normalizeAlphaNum = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
            const textOf = (el) => norm([
                (el && el.textContent) || '',
                (el && el.value) || '',
                (el && el.getAttribute && el.getAttribute('aria-label')) || '',
                (el && el.getAttribute && el.getAttribute('title')) || '',
            ].join(' '));
            const hasText = (el, text) => textOf(el).includes(norm(text));
            const hasActionText = (el) => actionLabels.some((label) => label && hasText(el, label));
            const describe = (el) => {
                if (!el) return 'none';
                const tag = (el.tagName || '').toLowerCase();
                const text = textOf(el).slice(0, 50);
                const href = tag === 'a' ? (el.getAttribute('href') || '') : '';
                const cls = ((el.className || '') + '').replace(/\\s+/g, '.').slice(0, 60);
                return tag + ':' + text + (href ? ':href=' + href : '') + (cls ? ':cls=' + cls : '');
            };
            const normalizedCompanies = (companies || [])
                .map((company) => normalizeAlphaNum(company))
                .filter(Boolean);
            const requiredTokens = ['shanghai', 'oikki', 'trading'];
            const hasCompanyText = (el) => {
                const normalized = normalizeAlphaNum(textOf(el));
                if (!normalized) return false;
                if (normalizedCompanies.some((company) => normalized.includes(company))) return true;
                return requiredTokens.every((token) => normalized.includes(token));
            };
            const isVisible = (el) => {
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
            };
            const isSemanticButton = (el) => {
                if (!el) return false;
                const tag = (el.tagName || '').toLowerCase();
                const role = (el.getAttribute('role') || '').toLowerCase();
                if (tag === 'button' || role === 'button') return true;
                if (tag === 'input') {
                    const type = (el.getAttribute('type') || '').toLowerCase();
                    if (type === 'button' || type === 'submit') return true;
                }
                return false;
            };
            const isLikelyClickable = (el) => {
                if (!el) return false;
                if (isSemanticButton(el)) return true;
                const tag = (el.tagName || '').toLowerCase();
                if (tag === 'a') return true;
                if (el.getAttribute('onclick')) return true;
                if (typeof el.onclick === 'function') return true;
                const style = window.getComputedStyle(el);
                return style.cursor === 'pointer' || el.tabIndex >= 0;
            };
            const toClickable = (el) => {
                if (!el) return null;
                if (isLikelyClickable(el)) return el;
                const parent = el.closest('button, [role="button"], a, input[type="button"], input[type="submit"], [onclick]');
                return parent || null;
            };
            const clickWithMouseEvents = (raw) => {
                const target = toClickable(raw) || raw;
                if (!target || !isVisible(target)) return false;
                const ariaDisabled = String(target.getAttribute('aria-disabled') || '').toLowerCase();
                if (target.disabled || ariaDisabled === 'true') return false;
                try {
                    target.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
                } catch {
                    // Ignore.
                }
                const eventInit = { bubbles: true, cancelable: true, view: window };
                try { target.dispatchEvent(new MouseEvent('pointerdown', eventInit)); } catch {}
                try { target.dispatchEvent(new MouseEvent('mousedown', eventInit)); } catch {}
                try { target.dispatchEvent(new MouseEvent('mouseup', eventInit)); } catch {}
                try { target.dispatchEvent(new MouseEvent('click', eventInit)); } catch {}
                if (typeof target.click === 'function') {
                    target.click();
                }
                return true;
            };
            const scoreRemitCandidate = (target, reference) => {
                const text = textOf(target);
                const tag = (target.tagName || '').toLowerCase();
                const href = tag === 'a' ? String(target.getAttribute('href') || '') : '';
                const exactMatch = text === norm(remit) ? -100000 : 0;
                const hasRemit = text.includes(norm(remit)) ? -10000 : 0;
                const hasShortRemit = text.includes(${JSON.stringify(KO_REMIT_SHORT)}) ? -4000 : 0;
                const hasNext = text.includes(${JSON.stringify(KO_NEXT)}) ? -2000 : 0;
                const semanticBoost = isSemanticButton(target) ? -5000 : 0;
                const tagBoost = tag === 'a' ? -1500 : 0;
                const transferAmountLinkBoost = href.includes('/transfer/amount') ? -60000 : 0;
                let distance = 0;
                if (reference) {
                    const rect = target.getBoundingClientRect();
                    const tx = rect.left + rect.width / 2;
                    const ty = rect.top + rect.height / 2;
                    const dx = tx - reference.x;
                    const dy = ty - reference.y;
                    distance = dx * dx + dy * dy;
                }
                return exactMatch + hasRemit + hasShortRemit + hasNext + semanticBoost + tagBoost + transferAmountLinkBoost + distance;
            };
            const collectRemitCandidates = (scope) => {
                const clickableRemit = Array.from(scope.querySelectorAll('button, [role="button"], a, input[type="button"], input[type="submit"], [onclick]'))
                    .filter((el) => isVisible(el) && hasActionText(el))
                    .map((el) => toClickable(el))
                    .filter(Boolean);
                const textNodes = Array.from(scope.querySelectorAll('div, span, p, strong, b'))
                    .filter((el) => isVisible(el) && hasActionText(el))
                    .map((el) => toClickable(el))
                    .filter(Boolean);
                const merged = clickableRemit.concat(textNodes);
                return merged.filter((el, index, arr) => arr.indexOf(el) === index);
            };

            const modalScopes = Array.from(document.querySelectorAll(
                '[role="dialog"], [class*="modal"], [class*="Modal"], [class*="drawer"], [class*="Drawer"], [class*="popup"], [class*="Popup"]'
            )).filter(isVisible);
            const companyModalScopes = modalScopes.filter((scope) => hasCompanyText(scope));

            for (const scope of companyModalScopes) {
                const companyRef = Array.from(scope.querySelectorAll('*'))
                    .filter((el) => isVisible(el) && hasCompanyText(el))
                    .sort((a, b) => {
                        const ra = a.getBoundingClientRect();
                        const rb = b.getBoundingClientRect();
                        return (ra.width * ra.height) - (rb.width * rb.height);
                    })[0] || null;
                const companyRefPoint = companyRef
                    ? (() => {
                        const rect = companyRef.getBoundingClientRect();
                        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
                    })()
                    : null;
                const remitInModal = collectRemitCandidates(scope)
                    .sort((a, b) => scoreRemitCandidate(a, companyRefPoint) - scoreRemitCandidate(b, companyRefPoint));
                for (const target of remitInModal) {
                    if (clickWithMouseEvents(target)) {
                        return 'clicked-modal-remit:' + describe(target) + ':companyScope=' + (hasCompanyText(scope) ? 'yes' : 'no');
                    }
                }
            }
            const viewportArea = Math.max(1, window.innerWidth * window.innerHeight);
            const companyLeaves = Array.from(document.querySelectorAll('*'))
                .filter((el) => isVisible(el) && hasCompanyText(el))
                .sort((a, b) => {
                    const ra = a.getBoundingClientRect();
                    const rb = b.getBoundingClientRect();
                    return (ra.width * ra.height) - (rb.width * rb.height);
                })
                .slice(0, 8);

            for (const leaf of companyLeaves) {
                let scope = leaf;
                for (let depth = 0; depth < 6 && scope; depth += 1) {
                    const rect = scope.getBoundingClientRect();
                    const area = rect.width * rect.height;
                    // Skip huge containers like page wrapper/header.
                    if (area > viewportArea * 0.55) {
                        scope = scope.parentElement;
                        continue;
                    }

                    const remitCandidates = collectRemitCandidates(scope);

                    if (remitCandidates.length > 0) {
                        // Pick closest button to company text to avoid top banner actions.
                        const baseRect = leaf.getBoundingClientRect();
                        const basePoint = { x: baseRect.left + baseRect.width / 2, y: baseRect.top + baseRect.height / 2 };
                        remitCandidates.sort((a, b) => {
                            return scoreRemitCandidate(a, basePoint) - scoreRemitCandidate(b, basePoint);
                        });
                        for (const target of remitCandidates.slice(0, 3)) {
                            if (clickWithMouseEvents(target)) {
                                return 'clicked-company-scope-remit:' + describe(target);
                            }
                        }
                    }

                    scope = scope.parentElement;
                }
            }

            // Some MOIN layouts select the recipient row first and render the
            // continue/remit button outside the company card. If the recipient
            // has been narrowed to the target company, click the closest safe
            // visible action button instead of failing at the card boundary.
            if (companyLeaves.length > 0) {
                const baseRect = companyLeaves[0].getBoundingClientRect();
                const basePoint = { x: baseRect.left + baseRect.width / 2, y: baseRect.top + baseRect.height / 2 };
                const globalCandidates = Array.from(document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"], a'))
                    .filter((el) => isVisible(el) && hasActionText(el))
                    .map((el) => toClickable(el))
                    .filter(Boolean)
                    .filter((el, index, arr) => arr.indexOf(el) === index)
                    .filter((el) => {
                        const tag = (el.tagName || '').toLowerCase();
                        const href = tag === 'a' ? String(el.getAttribute('href') || '') : '';
                        const text = textOf(el);
                        if (href.includes('/login')) return false;
                        if (href.includes('/transfer/recipient') && text.includes(${JSON.stringify(KO_REMIT)})) return false;
                        if (href.includes('notion.site')) return false;
                        if (/^https?:\\/\\//i.test(href) && !href.includes('moinbizplus.com') && !href.includes('themoin.com')) return false;
                        return true;
                    })
                    .sort((a, b) => scoreRemitCandidate(a, basePoint) - scoreRemitCandidate(b, basePoint));

                for (const target of globalCandidates.slice(0, 5)) {
                    if (clickWithMouseEvents(target)) {
                        return 'clicked-global-recipient-action:' + describe(target);
                    }
                }
            }

            return 'no-company-scoped-remit';
        })()
    `) as string

    return String(result || 'unknown')
}
const openMoinLoginPage = async (page: PageLike, timeoutMs = LONG_TIMEOUT_MS) => {
    const navigationErrors: string[] = []
    const waitStrategies: Array<'domcontentloaded' | 'load'> = ['domcontentloaded']
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
                    await page.locator(selector).first().waitFor({ state: 'visible', timeout: 3000 })
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

const performMoinLogin = async (
    page: PageLike,
    loginId: string,
    loginPassword: string,
    steps: string[],
    abortSignal: AbortSignal | undefined,
): Promise<void> => {
    throwIfAbortRequested(abortSignal, 'Open login page')
    const loginWaitUntil = await openMoinLoginPage(page, LONG_TIMEOUT_MS)
    steps.push(`open-login-page:${loginWaitUntil}`)

    throwIfAbortRequested(abortSignal, 'Fill login ID')
    await typeFirstVisible(
        page,
        [
            'input[name="email"]',
            'input[type="email"]',
            'input[name="username"]',
            'input[autocomplete="username"]',
            'input[autocomplete="email"]',
        ],
        loginId,
        'Fill login ID',
        DEFAULT_TIMEOUT_MS,
    )
    steps.push('fill-login-id')

    throwIfAbortRequested(abortSignal, 'Fill login password')
    await typeFirstVisible(
        page,
        ['input[name="password"]', 'input[type="password"]', 'input[autocomplete="current-password"]'],
        loginPassword,
        'Fill login password',
        DEFAULT_TIMEOUT_MS,
    )
    steps.push('fill-login-password')

    const clickDelay = 1500 + Math.floor(Math.random() * 1000)
    throwIfAbortRequested(abortSignal, 'Submit login')
    await page.waitForTimeout(clickDelay)

    const loginUrlBefore = page.url()
    await clickMoinLoginSubmit(page, abortSignal)
    steps.push('submit-login')

    let loginFailed = false
    try {
        throwIfAbortRequested(abortSignal, 'Verify login')
        await Promise.race([
            waitForUrlChange(page, loginUrlBefore, 10000).then((url) => {
                if (url.includes('/login')) loginFailed = true
            }),
            page.getByText(KO_PASSWORD_MISMATCH).first().waitFor({ state: 'visible', timeout: 10000 }).then(() => { loginFailed = true }),
            page.getByText(KO_ATTEMPT_EXCEEDED).first().waitFor({ state: 'visible', timeout: 10000 }).then(() => { loginFailed = true }),
            page.getByText(KO_LOCK).first().waitFor({ state: 'visible', timeout: 10000 }).then(() => { loginFailed = true }),
            page.getByText(KO_LOCKED).first().waitFor({ state: 'visible', timeout: 10000 }).then(() => { loginFailed = true }),
        ])
    } catch {
        // Ignore timeouts from race
    }

    throwIfAbortRequested(abortSignal, 'Verify login')
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined)

    if (loginFailed || page.url().includes('/login')) {
        const bodyText = (await page.locator('body').textContent().catch(() => '')) || ''
        if (bodyText.includes(KO_ATTEMPT_EXCEEDED) || bodyText.includes(KO_LOCK) || bodyText.includes(KO_LOCKED)) {
            throw new MoinAutomationError(
                'Login Failed',
                '[Account locked] Login attempts were exceeded. Please reset the password directly on MOIN Bizplus before trying again.',
            )
        } else if (bodyText.includes(KO_PASSWORD_MISMATCH)) {
            throw new MoinAutomationError(
                'Login Failed',
                '[Password mismatch] The password is incorrect. Please verify the password before trying again.',
            )
        } else {
            throw new MoinAutomationError(
                'Login Failed',
                `Login failed (URL: ${page.url()}). Please verify the account credentials.`,
            )
        }
    }

    steps.push(`post-login-url:${page.url()}`)
}

export type MoinHistoryItem = {
    detailUrl: string
    rowText: string
    dateText: string
    recipient: string
    amountUsdText: string
    statusText: string
    transactionId?: string | null
    sendAmountKrwText?: string
    totalFeeKrwText?: string
    exchangeRateText?: string
    appliedAtIso?: string | null
    rawTransaction?: Record<string, unknown> | null
}

export type MoinHistoryFetchInput = {
    loginId: string
    loginPassword: string
    targetDate?: string | null
    recipientHint?: string | null
    targetTransactionId?: string | null
    headless?: boolean
    abortSignal?: AbortSignal
}

export type MoinHistoryFetchResult = {
    steps: string[]
    items: MoinHistoryItem[]
    matched: MoinHistoryItem | null
    matchedSummary: MoinRemittancePricingSummary | null
    matchedAppliedAtIso: string | null
    matchedDetailBodyText: string | null
    matchStrategy: 'api' | 'dom' | null
    diagnostic: {
        listUrl: string
        bodyTextPreview: string
        anchorHrefs: string[]
        clickableTextSamples: string[]
        capturedResponseUrls?: string[]
        largestResponseSnippet?: string
    } | null
}

const inspectHistoryListDiagnostic = async (page: PageLike) => {
    const raw = await page.evaluate(`
        (() => {
            const isVisible = (el) => {
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
            };
            const norm = (value) => (value || '').replace(/\\s+/g, ' ').trim();

            const bodyText = norm((document.body && document.body.innerText) || '').slice(0, 1500);
            const anchorHrefs = Array.from(document.querySelectorAll('a[href]'))
                .filter((el) => isVisible(el))
                .map((el) => el.getAttribute('href') || '')
                .filter((href) => href && !href.startsWith('#'))
                .slice(0, 60);
            const clickableTextSamples = Array.from(document.querySelectorAll('[role="button"], button, [onclick], [data-testid]'))
                .filter((el) => isVisible(el))
                .map((el) => norm(el.textContent || ''))
                .filter((text) => text.length > 0 && text.length <= 80)
                .slice(0, 30);

            return JSON.stringify({
                listUrl: window.location.href,
                bodyTextPreview: bodyText,
                anchorHrefs,
                clickableTextSamples,
            });
        })()
    `) as string

    try {
        return JSON.parse(raw || '{}')
    } catch {
        return null
    }
}

const inspectHistoryListItems = async (page: PageLike): Promise<MoinHistoryItem[]> => {
    const result = await page.evaluate(`
        (() => {
            const isVisible = (el) => {
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
            };
            const norm = (value) => (value || '').replace(/\\s+/g, ' ').trim();
            const detailLinks = Array.from(document.querySelectorAll('a[href*="/history/"]'))
                .filter((el) => isVisible(el))
                .filter((el) => {
                    const href = el.getAttribute('href') || '';
                    return /\\/history\\/[^/]+$/i.test(href) && !/\\/history\\/(individual|bulk)$/i.test(href);
                });

            const rows = [];
            const seen = new Set();
            for (const link of detailLinks) {
                const href = link.getAttribute('href') || '';
                if (seen.has(href)) continue;
                seen.add(href);

                const rowEl = link.closest('li, tr, article, [class*="row"], [class*="Row"], [class*="item"], [class*="Item"], [class*="card"], [class*="Card"]') || link;
                const rowText = norm(rowEl.textContent || '');

                const dateMatch = rowText.match(/\\b(20\\d{2})[.\\-/](\\d{1,2})[.\\-/](\\d{1,2})\\b/);
                const dateText = dateMatch
                    ? dateMatch[1] + '-' + String(dateMatch[2]).padStart(2, '0') + '-' + String(dateMatch[3]).padStart(2, '0')
                    : '';

                const usdMatch = rowText.match(/[\\d,]+(?:\\.\\d{1,2})?\\s*(?:US\\$|USD|\\$)/i)
                    || rowText.match(/(?:US\\$|USD|\\$)\\s*[\\d,]+(?:\\.\\d{1,2})?/i);
                const amountUsdText = usdMatch ? norm(usdMatch[0]) : '';

                const statusMatch = rowText.match(/(송금완료|입금완료|진행중|승인대기|작성중|취소|반려|실패|환불|완료)/);
                const statusText = statusMatch ? statusMatch[0] : '';

                let recipient = '';
                const blockedRecipientPatterns = [
                    /송금|수수료|환율|입금|진행|완료|반려|취소|실패|상태/,
                    /\b(?:usd|krw|us\$)\b/i,
                    /^\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}$/,
                    /^[\d,.\s]+(?:usd|krw|원|\$)?$/i,
                ];
                const candidates = Array.from(rowEl.querySelectorAll('h1,h2,h3,h4,h5,h6,strong,b,span,p,div'))
                    .filter((el) => isVisible(el))
                    .map((el) => norm(el.textContent || ''))
                    .filter((text) => text.length > 0 && text.length < 80)
                    .filter((text) => !/^[\\d,.\\s]+$/.test(text));
                for (const text of candidates) {
                    const blocked = blockedRecipientPatterns.some((pattern) => pattern.test(text));
                    const hasLetterLikeContent = /[A-Za-z\u00C0-\u024F\u0400-\u04FF\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/.test(text);
                    if (hasLetterLikeContent && !blocked) {
                        recipient = text;
                        break;
                    }
                }

                const absoluteUrl = href.startsWith('http')
                    ? href
                    : new URL(href, window.location.origin).toString();

                rows.push({
                    detailUrl: absoluteUrl,
                    rowText: rowText.slice(0, 400),
                    dateText,
                    recipient,
                    amountUsdText,
                    statusText,
                });
            }

            return JSON.stringify(rows.slice(0, 30));
        })()
    `) as string

    try {
        const parsed = JSON.parse(result || '[]')
        if (!Array.isArray(parsed)) return []
        return parsed as MoinHistoryItem[]
    } catch {
        return []
    }
}

const inspectHistoryDetailAppliedAt = async (page: PageLike): Promise<string | null> => {
    const raw = await page.evaluate(`
        (() => {
            const isVisible = (el) => {
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
            };
            const norm = (value) => (value || '').replace(/\\s+/g, ' ').trim();
            const bodyText = norm((document.body && document.body.innerText) || '');

            const dateTimeMatch = bodyText.match(/(20\\d{2})[.\\-/](\\d{1,2})[.\\-/](\\d{1,2})\\s+(\\d{1,2}):(\\d{2})(?::(\\d{2}))?/);
            if (dateTimeMatch) {
                const year = dateTimeMatch[1];
                const month = String(dateTimeMatch[2]).padStart(2, '0');
                const day = String(dateTimeMatch[3]).padStart(2, '0');
                const hour = String(dateTimeMatch[4]).padStart(2, '0');
                const minute = dateTimeMatch[5];
                const second = dateTimeMatch[6] ? dateTimeMatch[6] : '00';
                return year + '-' + month + '-' + day + 'T' + hour + ':' + minute + ':' + second + '+09:00';
            }

            const dateOnlyMatch = bodyText.match(/(20\\d{2})[.\\-/](\\d{1,2})[.\\-/](\\d{1,2})/);
            if (dateOnlyMatch) {
                const year = dateOnlyMatch[1];
                const month = String(dateOnlyMatch[2]).padStart(2, '0');
                const day = String(dateOnlyMatch[3]).padStart(2, '0');
                return year + '-' + month + '-' + day + 'T00:00:00+09:00';
            }

            return '';
        })()
    `) as string

    if (!raw) return null
    const parsed = new Date(raw)
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

const matchHistoryItem = (
    items: MoinHistoryItem[],
    targetDate: string | null,
    recipientHint: string | null,
): MoinHistoryItem | null => {
    if (items.length === 0) return null

    const recipientNorm = recipientHint
        ? recipientHint.toLowerCase().replace(/[^a-z0-9]/g, '')
        : ''

    const targetTime = targetDate ? new Date(`${targetDate}T00:00:00+09:00`).getTime() : null
    const autoMatchEndTime = targetTime !== null ? targetTime + 2 * 24 * 60 * 60 * 1000 : null

    const scored = items
        .map((item) => {
            let score = 0
            if (targetTime !== null) {
                if (!item.dateText) return { item, score: Number.NEGATIVE_INFINITY }
                const itemTime = new Date(`${item.dateText}T00:00:00+09:00`).getTime()
                if (
                    !Number.isFinite(itemTime) ||
                    itemTime < targetTime ||
                    (autoMatchEndTime !== null && itemTime >= autoMatchEndTime)
                ) {
                    return { item, score: Number.NEGATIVE_INFINITY }
                }

                const distanceDays = Math.floor((itemTime - targetTime) / (24 * 60 * 60 * 1000))
                score += Math.max(0, 500 - distanceDays * 120)
            }
            if (recipientNorm) {
                const itemRecipientNorm = (item.recipient || '').toLowerCase().replace(/[^a-z0-9]/g, '')
                const itemRowNorm = (item.rowText || '').toLowerCase().replace(/[^a-z0-9]/g, '')
                if (itemRecipientNorm.includes(recipientNorm) || itemRowNorm.includes(recipientNorm)) score += 1000
            }
            if (item.statusText && /(송금완료|입금완료|완료)/.test(item.statusText)) score += 200
            return { item, score }
        })
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)

    return scored.length > 0 ? scored[0].item : null
}

const fillMissingHistoryRecipients = (
    items: MoinHistoryItem[],
    recipientHint: string | null | undefined,
) => {
    const hint = (recipientHint || '').trim()
    if (!hint) return items

    const hintNorm = hint.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (!hintNorm) return items

    return items.map((item) => {
        if (item.recipient) return item
        const rowNorm = (item.rowText || '').toLowerCase().replace(/[^a-z0-9]/g, '')
        const rawNorm = JSON.stringify(item.rawTransaction || '').toLowerCase().replace(/[^a-z0-9]/g, '')
        if (rowNorm.includes(hintNorm) || rawNorm.includes(hintNorm)) {
            return { ...item, recipient: hint }
        }
        return item
    })
}

type CapturedJsonResponse = {
    url: string
    json: unknown
}

const isMoinHostUrl = (url: string) =>
    /(?:^https?:\/\/)?(?:[a-z0-9-]+\.)*(?:moinbizplus\.com|themoin\.com)\b/i.test(url)

const findArrayInObject = (
    value: unknown,
    pathSoFar: string,
    depth: number,
): Array<{ path: string; array: unknown[] }> => {
    if (depth > 4) return []
    if (Array.isArray(value)) {
        return [{ path: pathSoFar || '<root>', array: value }]
    }
    if (!value || typeof value !== 'object') return []
    const collected: Array<{ path: string; array: unknown[] }> = []
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        const nextPath = pathSoFar ? `${pathSoFar}.${key}` : key
        collected.push(...findArrayInObject(child, nextPath, depth + 1))
    }
    return collected
}

const TX_DATE_KEY_HINTS = ['date', 'at', 'time', 'created', 'apply', 'requested', 'transfer', 'completed', 'submitted']
const TX_AMOUNT_KEY_HINTS = ['amount', 'krw', 'usd', 'fee', 'rate', 'send', 'receive', 'total']
const TX_ID_KEY_HINTS = ['id', 'no', 'number', 'transactionid', 'transferid', 'historyid']

const objectHasHints = (obj: Record<string, unknown>) => {
    const lowerKeys = Object.keys(obj).map((k) => k.toLowerCase())
    let dateScore = 0
    let amountScore = 0
    let idScore = 0
    for (const key of lowerKeys) {
        if (TX_DATE_KEY_HINTS.some((hint) => key.includes(hint))) dateScore += 1
        if (TX_AMOUNT_KEY_HINTS.some((hint) => key.includes(hint))) amountScore += 1
        if (TX_ID_KEY_HINTS.some((hint) => key.includes(hint))) idScore += 1
    }
    return { dateScore, amountScore, idScore }
}

const looksLikeTransactionArray = (arr: unknown[]) => {
    if (arr.length === 0 || arr.length > 500) return false
    const sample = arr[0]
    if (!sample || typeof sample !== 'object' || Array.isArray(sample)) return false
    const { dateScore, amountScore, idScore } = objectHasHints(sample as Record<string, unknown>)
    const signals = (dateScore > 0 ? 1 : 0) + (amountScore > 0 ? 1 : 0) + (idScore > 0 ? 1 : 0)
    return signals >= 2
}

const extractTransactionsFromCapturedResponses = (
    responses: CapturedJsonResponse[],
): { array: Record<string, unknown>[]; sourceUrl: string; sourcePath: string } | null => {
    let best: { array: Record<string, unknown>[]; sourceUrl: string; sourcePath: string; score: number } | null = null
    for (const response of responses) {
        const found = findArrayInObject(response.json, '', 0)
        for (const candidate of found) {
            if (!looksLikeTransactionArray(candidate.array)) continue
            const sample = candidate.array[0] as Record<string, unknown>
            const { dateScore, amountScore, idScore } = objectHasHints(sample)
            const score = candidate.array.length + dateScore * 10 + amountScore * 10 + idScore * 5
            if (!best || score > best.score) {
                best = {
                    array: candidate.array as Record<string, unknown>[],
                    sourceUrl: response.url,
                    sourcePath: candidate.path,
                    score,
                }
            }
        }
    }
    if (!best) return null
    return { array: best.array, sourceUrl: best.sourceUrl, sourcePath: best.sourcePath }
}

const findObjectsInJson = (
    value: unknown,
    pathSoFar: string,
    depth: number,
): Array<{ path: string; obj: Record<string, unknown> }> => {
    if (depth > 4) return []
    if (!value || typeof value !== 'object' || Array.isArray(value)) return []
    const collected: Array<{ path: string; obj: Record<string, unknown> }> = [
        { path: pathSoFar || '<root>', obj: value as Record<string, unknown> },
    ]
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        if (child && typeof child === 'object' && !Array.isArray(child)) {
            const nextPath = pathSoFar ? `${pathSoFar}.${key}` : key
            collected.push(...findObjectsInJson(child, nextPath, depth + 1))
        }
    }
    return collected
}

const looksLikeSingleTransactionObject = (obj: Record<string, unknown>): number => {
    const lowerKeys = Object.keys(obj).map((k) => k.toLowerCase())
    const looksLikeUserProfile =
        lowerKeys.includes('user_uuid') ||
        lowerKeys.includes('email_verified') ||
        (
            lowerKeys.includes('email') &&
            lowerKeys.includes('first_name') &&
            lowerKeys.includes('last_name')
        )
    const hasTransactionIdentityKey = lowerKeys.some((key) =>
        key === 'transaction_id' ||
        key === 'transactionid' ||
        key === 'transfer_id' ||
        key === 'transferid' ||
        key === 'history_id' ||
        key === 'historyid' ||
        key === 'remittance_id' ||
        key === 'remittanceid',
    )

    if (looksLikeUserProfile && !hasTransactionIdentityKey) {
        return 0
    }

    const { dateScore, amountScore, idScore } = objectHasHints(obj)
    const signals = (dateScore > 0 ? 1 : 0) + (amountScore > 0 ? 1 : 0) + (idScore > 0 ? 1 : 0)
    if (signals < 2) return 0
    if (amountScore === 0 || idScore === 0) return 0

    return dateScore * 5 + amountScore * 10 + idScore * 3
}

const extractDetailObjectFromCapturedResponses = (
    responses: CapturedJsonResponse[],
    targetTransactionId?: string | null,
): { obj: Record<string, unknown>; sourceUrl: string; sourcePath: string } | null => {
    let best: { obj: Record<string, unknown>; sourceUrl: string; sourcePath: string; score: number } | null = null
    for (const response of responses) {
        const objects = findObjectsInJson(response.json, '', 0)
        for (const candidate of objects) {
            const baseScore = looksLikeSingleTransactionObject(candidate.obj)
            if (baseScore === 0) continue
            let score = baseScore
            // Bonus if URL contains the transaction id
            if (targetTransactionId && response.url.includes(targetTransactionId)) score += 50
            // Bonus if object has a fee/rate field (detail pages usually have these)
            const lowerKeys = Object.keys(candidate.obj).map((k) => k.toLowerCase())
            if (lowerKeys.some((k) => k.includes('fee'))) score += 20
            if (lowerKeys.some((k) => k.includes('rate') || k.includes('exchange'))) score += 20
            if (lowerKeys.some((k) => k.includes('usd'))) score += 10
            if (!best || score > best.score) {
                best = {
                    obj: candidate.obj,
                    sourceUrl: response.url,
                    sourcePath: candidate.path,
                    score,
                }
            }
        }
    }
    if (!best) return null
    return { obj: best.obj, sourceUrl: best.sourceUrl, sourcePath: best.sourcePath }
}

const isGenericMoinHistoryListUrl = (value: string | null | undefined) =>
    !value || /\/history\/(?:individual|bulk)?(?:$|[?#])/i.test(value)

const mergeMoinHistoryItems = (base: MoinHistoryItem, detail: MoinHistoryItem): MoinHistoryItem => ({
    ...base,
    detailUrl: isGenericMoinHistoryListUrl(detail.detailUrl) ? base.detailUrl : detail.detailUrl,
    dateText: detail.dateText || base.dateText,
    recipient: detail.recipient || base.recipient,
    amountUsdText: detail.amountUsdText || base.amountUsdText,
    statusText: detail.statusText || base.statusText,
    transactionId: detail.transactionId || base.transactionId,
    sendAmountKrwText: detail.sendAmountKrwText || base.sendAmountKrwText,
    totalFeeKrwText: detail.totalFeeKrwText || base.totalFeeKrwText,
    exchangeRateText: detail.exchangeRateText || base.exchangeRateText,
    appliedAtIso: detail.appliedAtIso || base.appliedAtIso,
    rawTransaction: detail.rawTransaction || base.rawTransaction,
})

const findValueByKeyHints = (
    obj: Record<string, unknown>,
    hints: string[],
    excludeHints: string[] = [],
): unknown => {
    const lowerEntries = Object.entries(obj).map(([key, value]) => ({ key, lowerKey: key.toLowerCase(), value }))
    const isMatch = (entry: { lowerKey: string }) =>
        hints.some((hint) => entry.lowerKey.includes(hint)) &&
        !excludeHints.some((hint) => entry.lowerKey.includes(hint))

    const directPrimitive = lowerEntries.find((entry) => isMatch(entry) && stringifyValue(entry.value).trim())
    if (directPrimitive) return directPrimitive.value

    const directObject = lowerEntries.find((entry) => isMatch(entry) && entry.value && typeof entry.value === 'object')
    if (directObject) {
        const objectValue = stringifyValue(directObject.value).trim()
        if (objectValue) return objectValue
    }

    for (const entry of lowerEntries) {
        if (!entry.value || typeof entry.value !== 'object' || Array.isArray(entry.value)) continue
        if (excludeHints.some((hint) => entry.lowerKey.includes(hint))) continue
        const nested = findValueByKeyHints(entry.value as Record<string, unknown>, hints, excludeHints)
        if (stringifyValue(nested).trim()) return nested
    }

    return undefined
}

const stringifyValue = (value: unknown): string => {
    if (value === null || value === undefined) return ''
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
    if (typeof value === 'string') return value
    if (typeof value === 'boolean') return String(value)
    if (Array.isArray(value)) {
        return value
            .map((item) => stringifyValue(item).trim())
            .filter(Boolean)
            .join(' ')
    }
    if (typeof value === 'object') {
        const objectValue = value as Record<string, unknown>
        for (const key of [
            'name',
            'companyName',
            'company_name',
            'recipientName',
            'recipient_name',
            'receiverName',
            'receiver_name',
            'beneficiaryName',
            'beneficiary_name',
            'partnerName',
            'partner_name',
            'displayName',
            'display_name',
            'alias',
            'nickname',
        ]) {
            const text = stringifyValue(objectValue[key]).trim()
            if (text) return text
        }
    }
    return ''
}

const formatDateValueToYmd = (value: unknown): string => {
    const raw = stringifyValue(value).trim()
    if (!raw) return ''
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
    const isoLike = raw.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/)
    if (isoLike) {
        const [, y, m, d] = isoLike
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
    const parsed = new Date(raw)
    if (!Number.isNaN(parsed.getTime())) {
        const offsetMs = parsed.getTimezoneOffset() * 60000
        const local = new Date(parsed.getTime() - offsetMs)
        return local.toISOString().slice(0, 10)
    }
    return ''
}

const formatDateValueToIso = (value: unknown): string | null => {
    const raw = stringifyValue(value).trim()
    if (!raw) return null
    const parsed = new Date(raw)
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
    return null
}

const formatNumberWithCurrency = (value: unknown, currency: 'USD' | 'KRW'): string => {
    const raw = stringifyValue(value).trim()
    if (!raw) return ''
    const cleaned = raw.replace(/[^\d.\-]/g, '')
    if (!cleaned) return ''
    const numeric = Number(cleaned)
    if (!Number.isFinite(numeric)) return ''
    const formatted = currency === 'USD'
        ? numeric.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : numeric.toLocaleString('en-US', { maximumFractionDigits: 0 })
    return `${formatted} ${currency}`
}

const formatExchangeRateValue = (value: unknown): string => {
    const raw = stringifyValue(value).trim()
    if (!raw) return ''
    const cleaned = raw.replace(/[^\d.\-]/g, '')
    if (!cleaned) return ''
    const numeric = Number(cleaned)
    if (!Number.isFinite(numeric) || numeric <= 0) return ''
    return `1 USD = ${Math.round(numeric).toLocaleString('en-US')} KRW`
}

const normalizeExchangeRateText = (value: string) => {
    const matches = value.match(/-?\d[\d,]*(?:\.\d+)?/g)
    if (!matches || matches.length === 0) return value
    const numeric = Number(matches[matches.length - 1].replace(/,/g, ''))
    if (!Number.isFinite(numeric) || numeric <= 0) return value
    return `1 USD = ${Math.round(numeric).toLocaleString('en-US')} KRW`
}

const normalizeMoinTransaction = (raw: Record<string, unknown>): MoinHistoryItem => {
    const idValue = findValueByKeyHints(raw, ['transactionid', 'transferid', 'historyid', 'orderid', 'id', 'transactionno', 'transferno', 'no'])
    const transactionId = stringifyValue(idValue) || null

    const dateValue = findValueByKeyHints(raw, ['applieddate', 'appliedat', 'requesteddate', 'requestedat', 'transferdate', 'transferat', 'createdat', 'createddate', 'date', 'submitted', 'completedat', 'completeddate'])
    const dateText = formatDateValueToYmd(dateValue)
    const appliedAtIso = formatDateValueToIso(dateValue)

    const recipientValue = findValueByKeyHints(
        raw,
        [
            'recipient',
            'beneficiary',
            'receivername',
            'receiver_name',
            'receivercompany',
            'receiver_company',
            'receiver',
            'partnername',
            'partner_name',
            'partner',
            'companyname',
            'company_name',
            'recipientcompany',
            'recipient_company',
            'counterparty',
            'payee',
            'vendor',
            'alias',
            'nickname',
        ],
        ['country', 'phone', 'email', 'address', 'bank', 'account'],
    )
        ?? findValueByKeyHints(raw, ['name'], ['file', 'event', 'method', 'status', 'product', 'sender', 'currency', 'bank', 'account'])
    const recipient = stringifyValue(recipientValue).trim()

    const usdValue = findValueByKeyHints(raw, ['usd', 'receiveamount', 'receivingamount', 'beneficiaryamount', 'destamount', 'finalamount'], ['krw'])
    const amountUsdText = formatNumberWithCurrency(usdValue, 'USD')

    const krwValue = findValueByKeyHints(raw, ['sendamount', 'krw', 'sourceamount', 'totalamount', 'amount'], ['usd', 'fee', 'rate'])
    const sendAmountKrwText = formatNumberWithCurrency(krwValue, 'KRW')

    const feeValue = findValueByKeyHints(raw, ['fee', 'commission'])
    const totalFeeKrwText = formatNumberWithCurrency(feeValue, 'KRW')

    const rateValue = findValueByKeyHints(raw, ['rate', 'exchange'])
    const exchangeRateText = formatExchangeRateValue(rateValue)

    const statusValue = findValueByKeyHints(raw, ['status', 'state'])
    const statusText = stringifyValue(statusValue).trim()

    return {
        detailUrl: transactionId
            ? `https://www.moinbizplus.com/history/${transactionId}`
            : 'https://www.moinbizplus.com/history/individual',
        rowText: JSON.stringify(raw).slice(0, 400),
        dateText,
        recipient,
        amountUsdText,
        statusText,
        transactionId,
        sendAmountKrwText,
        totalFeeKrwText,
        exchangeRateText,
        appliedAtIso,
        rawTransaction: raw,
    }
}

const summaryFromMoinHistoryItem = (item: MoinHistoryItem): MoinRemittancePricingSummary => ({
    finalReceiveAmount: item.amountUsdText || '',
    sendAmount: item.sendAmountKrwText || '',
    totalFee: item.totalFeeKrwText || '',
    exchangeRate: item.exchangeRateText || '',
})

export const fetchMoinRemittanceHistory = async (
    input: MoinHistoryFetchInput,
): Promise<MoinHistoryFetchResult> => {
    let browser: BrowserLike | null = null
    const steps: string[] = []
    const abortSignal = input.abortSignal
    let abortListenerCleanup: (() => void) | null = null

    const capturedResponses: CapturedJsonResponse[] = []
    let responseHandler: ((response: ResponseLike) => void) | null = null

    try {
        throwIfAbortRequested(abortSignal, 'Launch browser')
        const launched = await launchBrowser(input.headless ?? true)
        browser = launched.browser
        steps.push(`runtime:${launched.runtime}`)

        if (abortSignal) {
            const onAbort = () => {
                steps.push('cancel-requested')
                if (browser) void browser.close().catch(() => undefined)
            }
            abortSignal.addEventListener('abort', onAbort, { once: true })
            abortListenerCleanup = () => abortSignal.removeEventListener('abort', onAbort)
            throwIfAbortRequested(abortSignal, 'Initialize browser')
        }

        const context = await browser.newContext({ locale: 'ko-KR' })
        const page = await context.newPage()
        page.setDefaultTimeout(DEFAULT_TIMEOUT_MS)
        page.setDefaultNavigationTimeout(LONG_TIMEOUT_MS)

        responseHandler = (response: ResponseLike) => {
            try {
                const url = response.url()
                if (!isMoinHostUrl(url)) return
                const method = response.request().method()
                if (method === 'OPTIONS') return
                const status = response.status()
                if (status < 200 || status >= 400) return
                const headers = response.headers()
                const contentType = headers['content-type'] || headers['Content-Type'] || ''
                if (!contentType.toLowerCase().includes('json')) return
                void response.json().then((json) => {
                    capturedResponses.push({ url, json })
                }).catch(() => undefined)
            } catch {
                // Ignore listener errors — must not block navigation.
            }
        }
        page.on('response', responseHandler)

        await performMoinLogin(page, input.loginId, input.loginPassword, steps, abortSignal)

        const targetTransactionId = input.targetTransactionId?.trim() || null

        throwIfAbortRequested(abortSignal, 'Open history page')
        const initialHistoryUrl = targetTransactionId
            ? `https://www.moinbizplus.com/history/${targetTransactionId}`
            : 'https://www.moinbizplus.com/history/individual'
        await page.goto(initialHistoryUrl, {
            waitUntil: 'domcontentloaded',
            timeout: LONG_TIMEOUT_MS,
        }).catch(async () => {
            steps.push(`history-initial-goto-retry-from:${page.url()}`)
            await page.goto('https://www.moinbizplus.com/history/individual', {
                waitUntil: 'domcontentloaded',
                timeout: LONG_TIMEOUT_MS,
            }).catch((error) => {
                steps.push(`history-goto-interrupted:${getErrorMessage(error).slice(0, 120)}`)
            })
        })
        if (!page.url().includes('/history')) {
            await page.goto('https://www.moinbizplus.com/history/individual', {
                waitUntil: 'domcontentloaded',
                timeout: LONG_TIMEOUT_MS,
            }).catch((error) => {
                steps.push(`history-final-goto-interrupted:${getErrorMessage(error).slice(0, 120)}`)
            })
        }
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined)
        await page.waitForTimeout(2500)
        steps.push(`history-page-url:${page.url()}`)
        steps.push(`captured-responses-count:${capturedResponses.length}`)

        // ---------- API-first path ----------
        const transactionExtraction = extractTransactionsFromCapturedResponses(capturedResponses)
        const apiItems: MoinHistoryItem[] = []
        if (transactionExtraction) {
            steps.push(`captured-tx-array-key:${transactionExtraction.sourcePath}`)
            steps.push(`captured-tx-count:${transactionExtraction.array.length}`)
            for (const raw of transactionExtraction.array) {
                if (!raw || typeof raw !== 'object') continue
                apiItems.push(normalizeMoinTransaction(raw as Record<string, unknown>))
            }
        }
        const enrichedApiItems = fillMissingHistoryRecipients(apiItems, input.recipientHint)

        let matched: MoinHistoryItem | null = null
        let matchStrategy: 'api' | 'dom' | null = null
        let summary: MoinRemittancePricingSummary | null = null
        let appliedAtIso: string | null = null
        let detailBodyText: string | null = null

        if (targetTransactionId) {
            matched = enrichedApiItems.find((item) => item.transactionId === targetTransactionId)
                || {
                    detailUrl: `https://www.moinbizplus.com/history/${targetTransactionId}`,
                    rowText: '',
                    dateText: '',
                    recipient: input.recipientHint || '',
                    amountUsdText: '',
                    statusText: '',
                    transactionId: targetTransactionId,
                }
            matchStrategy = 'api'
            steps.push('targeted-transaction-id-mode')
        } else if (enrichedApiItems.length > 0) {
            matched = matchHistoryItem(enrichedApiItems, input.targetDate || null, input.recipientHint || null)
            if (matched) {
                matchStrategy = 'api'
                steps.push(`api-matched:${matched.transactionId || matched.detailUrl}`)
            }
        }

        if (matched && matchStrategy === 'api') {
            summary = summaryFromMoinHistoryItem(matched)
            appliedAtIso = matched.appliedAtIso || null

            // Try to enrich from already-captured detail object (most common when targetTransactionId
            // was set and we landed on /history/{id} directly).
            if (matched.transactionId) {
                const earlyDetail = extractDetailObjectFromCapturedResponses(
                    capturedResponses,
                    matched.transactionId,
                )
                if (earlyDetail) {
                    steps.push(`early-detail-obj-source:${earlyDetail.sourcePath}`)
                    const earlyItem = normalizeMoinTransaction(earlyDetail.obj)
                    matched = mergeMoinHistoryItems(matched, earlyItem)
                    summary = summaryFromMoinHistoryItem(matched)
                    appliedAtIso = matched.appliedAtIso || appliedAtIso
                }
            }

            const summaryComplete = Boolean(summary.finalReceiveAmount && summary.sendAmount && summary.totalFee && summary.exchangeRate)
            if (!summaryComplete && matched.transactionId) {
                steps.push('api-summary-incomplete-fetching-detail')
                throwIfAbortRequested(abortSignal, 'Fetch detail')
                const beforeCount = capturedResponses.length
                if (!page.url().includes(`/history/${matched.transactionId}`)) {
                    await page.goto(matched.detailUrl, {
                        waitUntil: 'domcontentloaded',
                        timeout: LONG_TIMEOUT_MS,
                    }).catch(() => undefined)
                    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined)
                    await page.waitForTimeout(1500)
                    steps.push(`history-detail-url:${page.url()}`)
                } else {
                    steps.push('detail-url-already-loaded')
                    await page.waitForTimeout(1500)
                }
                const detailResponses = capturedResponses.slice(beforeCount)
                steps.push(`detail-responses-count:${detailResponses.length}`)
                const detailObjExtraction = extractDetailObjectFromCapturedResponses(
                    detailResponses,
                    matched.transactionId,
                )
                const detailTxExtraction = extractTransactionsFromCapturedResponses(detailResponses)
                let detailItem: MoinHistoryItem | null = null
                if (detailObjExtraction) {
                    steps.push(`detail-obj-source:${detailObjExtraction.sourcePath}`)
                    detailItem = normalizeMoinTransaction(detailObjExtraction.obj)
                } else if (detailTxExtraction && detailTxExtraction.array.length > 0) {
                    const preferred =
                        detailTxExtraction.array.find((entry) => {
                            if (!entry || typeof entry !== 'object') return false
                            const idValue = findValueByKeyHints(entry as Record<string, unknown>, [
                                'transactionid', 'transferid', 'historyid', 'orderid', 'id', 'no',
                            ])
                            return matched?.transactionId
                                ? stringifyValue(idValue) === matched.transactionId
                                : false
                        }) || detailTxExtraction.array[0]
                    if (preferred && typeof preferred === 'object') {
                        detailItem = normalizeMoinTransaction(preferred as Record<string, unknown>)
                    }
                }

                if (detailItem) {
                    matched = mergeMoinHistoryItems(matched, detailItem)
                    summary = summaryFromMoinHistoryItem(matched)
                    appliedAtIso = matched.appliedAtIso || appliedAtIso
                }

                const stillIncomplete = !summary
                    || !summary.finalReceiveAmount
                    || !summary.sendAmount
                    || !summary.totalFee
                    || !summary.exchangeRate
                if (stillIncomplete) {
                    const domSummary = await inspectRemittancePricingSummary(page)
                    if (domSummary.finalReceiveAmount || domSummary.sendAmount || domSummary.totalFee || domSummary.exchangeRate) {
                        steps.push('detail-summary-via-dom')
                        const currentRate = parseFloat((summary?.exchangeRate || '').replace(/[^0-9.\-]/g, ''))
                        const shouldPreferDomFinalReceive =
                            !summary?.finalReceiveAmount ||
                            summary.finalReceiveAmount.includes(KO_SEND_AMOUNT) ||
                            summary.finalReceiveAmount.includes(KO_TOTAL_FEE) ||
                            summary.finalReceiveAmount.includes(KO_EXCHANGE_RATE)
                        const shouldPreferDomExchangeRate =
                            !summary?.exchangeRate ||
                            !Number.isFinite(currentRate) ||
                            currentRate < 100
                        summary = {
                            finalReceiveAmount: shouldPreferDomFinalReceive
                                ? domSummary.finalReceiveAmount || summary?.finalReceiveAmount || ''
                                : summary.finalReceiveAmount,
                            sendAmount: summary?.sendAmount || domSummary.sendAmount || '',
                            totalFee: summary?.totalFee || domSummary.totalFee || '',
                            exchangeRate: shouldPreferDomExchangeRate
                                ? domSummary.exchangeRate || summary?.exchangeRate || ''
                                : summary.exchangeRate,
                        }
                    }
                    if (!appliedAtIso) {
                        const fallbackAppliedAt = await inspectHistoryDetailAppliedAt(page)
                        if (fallbackAppliedAt) appliedAtIso = fallbackAppliedAt
                    }
                }

                try {
                    const detailText = (await page.locator('body').textContent().catch(() => '')) || ''
                    detailBodyText = detailText.replace(/\s+/g, ' ').trim().slice(0, 2000)
                } catch {
                    detailBodyText = null
                }
            }

            if (matched && summary) {
                matched = {
                    ...matched,
                    amountUsdText: summary.finalReceiveAmount || matched.amountUsdText,
                    sendAmountKrwText: summary.sendAmount || matched.sendAmountKrwText,
                    totalFeeKrwText: summary.totalFee || matched.totalFeeKrwText,
                    exchangeRateText: summary.exchangeRate || matched.exchangeRateText,
                }
            }

            steps.push('tx-match-strategy:api')
            return {
                steps,
                items: enrichedApiItems,
                matched,
                matchedSummary: summary,
                matchedAppliedAtIso: appliedAtIso,
                matchedDetailBodyText: detailBodyText,
                matchStrategy: 'api',
                diagnostic: null,
            }
        }

        // ---------- DOM fallback path ----------
        steps.push('falling-back-to-dom')
        const domItems = await inspectHistoryListItems(page)
        steps.push(`dom-items-count:${domItems.length}`)
        const combinedItems = enrichedApiItems.length > 0 ? enrichedApiItems : domItems
        const domMatched = matchHistoryItem(domItems, input.targetDate || null, input.recipientHint || null)

        if (domMatched) {
            matchStrategy = 'dom'
            steps.push(`dom-matched:${domMatched.detailUrl}`)
            await page.goto(domMatched.detailUrl, {
                waitUntil: 'domcontentloaded',
                timeout: LONG_TIMEOUT_MS,
            }).catch(() => undefined)
            await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined)
            await page.waitForTimeout(1500)
            steps.push(`history-detail-url:${page.url()}`)

            summary = await inspectRemittancePricingSummary(page)
            steps.push(`history-summary:${JSON.stringify(summary).slice(0, 220)}`)
            appliedAtIso = await inspectHistoryDetailAppliedAt(page)
            if (appliedAtIso) steps.push(`history-applied-at:${appliedAtIso}`)

            try {
                const detailText = (await page.locator('body').textContent().catch(() => '')) || ''
                detailBodyText = detailText.replace(/\s+/g, ' ').trim().slice(0, 2000)
            } catch {
                detailBodyText = null
            }

            steps.push('tx-match-strategy:dom')
            return {
                steps,
                items: fillMissingHistoryRecipients(combinedItems, input.recipientHint),
                matched: domMatched,
                matchedSummary: summary,
                matchedAppliedAtIso: appliedAtIso,
                matchedDetailBodyText: detailBodyText,
                matchStrategy: 'dom',
                diagnostic: null,
            }
        }

        // ---------- No match: build diagnostic ----------
        steps.push('history-no-match')
        const diagnosticRaw = await inspectHistoryListDiagnostic(page)
        const baseDiagnostic = diagnosticRaw && typeof diagnosticRaw === 'object'
            ? {
                listUrl: typeof diagnosticRaw.listUrl === 'string' ? diagnosticRaw.listUrl : page.url(),
                bodyTextPreview: typeof diagnosticRaw.bodyTextPreview === 'string' ? diagnosticRaw.bodyTextPreview : '',
                anchorHrefs: Array.isArray(diagnosticRaw.anchorHrefs) ? diagnosticRaw.anchorHrefs : [],
                clickableTextSamples: Array.isArray(diagnosticRaw.clickableTextSamples) ? diagnosticRaw.clickableTextSamples : [],
            }
            : { listUrl: page.url(), bodyTextPreview: '', anchorHrefs: [], clickableTextSamples: [] }

        const capturedResponseUrls = capturedResponses.slice(-30).map((r) => r.url)
        const largest = capturedResponses.reduce<CapturedJsonResponse | null>((acc, current) => {
            const accLen = acc ? JSON.stringify(acc.json).length : 0
            const currentLen = JSON.stringify(current.json).length
            return currentLen > accLen ? current : acc
        }, null)
        const largestResponseSnippet = largest ? JSON.stringify(largest.json).slice(0, 1024) : ''

        return {
            steps,
            items: fillMissingHistoryRecipients(combinedItems, input.recipientHint),
            matched: null,
            matchedSummary: null,
            matchedAppliedAtIso: null,
            matchedDetailBodyText: null,
            matchStrategy: null,
            diagnostic: {
                ...baseDiagnostic,
                capturedResponseUrls,
                largestResponseSnippet,
            },
        }
    } finally {
        abortListenerCleanup?.()
        if (browser) await browser.close().catch(() => undefined)
    }
}

export const submitMoinRemittance = async (input: MoinRemittanceInput): Promise<MoinRemittanceResult> => {
    let browser: BrowserLike | null = null
    let page: PageLike | null = null
    const steps: string[] = []
    const startedAtMs = Date.now()
    const abortSignal = input.abortSignal
    const selectorsUsed = [
        'input[name="email"]',
        'input[name="password"]',
        'button[name="login_button"]',
        'input[placeholder="받는 분 이름, 회사명, 수취인 별칭"]',
        `page.locator('div[role="button"]').filter({ hasText: '${TARGET_COMPANY_NAME}' })`,
        `button:has-text("${KO_NEXT_STEP}")`,
        `button:has-text("${KO_NEXT_STEP_SPACED}")`,
    ]
    let abortListenerCleanup: (() => void) | null = null
    const pushTiming = (label: string) => {
        steps.push(`timing:${label}:${Date.now() - startedAtMs}ms`)
    }

    try {
        throwIfAbortRequested(abortSignal, 'Launch browser')
        const launched = await launchBrowser(input.headless ?? true)
        browser = launched.browser
        steps.push(`runtime:${launched.runtime}`)
        pushTiming('browser-launched')
        throwIfAbortRequested(abortSignal, 'Launch browser')

        if (abortSignal) {
            const onAbort = () => {
                steps.push('cancel-requested')
                if (browser) {
                    void browser.close().catch(() => undefined)
                }
            }
            abortSignal.addEventListener('abort', onAbort, { once: true })
            abortListenerCleanup = () => abortSignal.removeEventListener('abort', onAbort)
            throwIfAbortRequested(abortSignal, 'Initialize browser')
        }

        throwIfAbortRequested(abortSignal, 'Create browser context')
        const context = await browser.newContext({ locale: 'ko-KR' })
        page = await context.newPage()
        page.setDefaultTimeout(DEFAULT_TIMEOUT_MS)
        page.setDefaultNavigationTimeout(LONG_TIMEOUT_MS)

        // ???? Step 1: Go directly to login page ??????????????????????????????????????????????????????????
        throwIfAbortRequested(abortSignal, 'Open login page')
        const loginWaitUntil = await openMoinLoginPage(page, LONG_TIMEOUT_MS)
        steps.push(`open-login-page:${loginWaitUntil}`)
        pushTiming('login-page-opened')

        // ???? Step 2: Fill login credentials (type char-by-char for React) ????
        throwIfAbortRequested(abortSignal, 'Fill login ID')
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

        throwIfAbortRequested(abortSignal, 'Fill login password')
        await typeFirstVisible(
            page,
            ['input[name="password"]', 'input[type="password"]', 'input[autocomplete="current-password"]'],
            input.loginPassword,
            'Fill login password',
            DEFAULT_TIMEOUT_MS
        )
        steps.push('fill-login-password')

        // Let React process input events and enable the login button.
        const clickDelay = 180 + Math.floor(Math.random() * 160)
        throwIfAbortRequested(abortSignal, 'Submit login')
        await page.waitForTimeout(clickDelay)

        // ???? Step 3: Submit login ??????????????????????????????????????????????????????????????????????????????????????
        const loginUrlBefore = page.url()

        await clickMoinLoginSubmit(page, abortSignal)
        steps.push('submit-login')

        // ???? Step 3.5: Check for explicit login errors ??????????????????????????????????????????????
        // MOIN bizplus shows a red banner for invalid password or locked accounts.
        // Check login state quickly. Later navigation to the transfer page is the real success signal.
        let loginFailed = false
        try {
            throwIfAbortRequested(abortSignal, 'Verify login')
            await Promise.race([
                waitForUrlChange(page, loginUrlBefore, 5000).then((url) => {
                    if (url.includes('/login')) loginFailed = true
                }),
                page.getByText(KO_PASSWORD_MISMATCH).first().waitFor({ state: 'visible', timeout: 5000 }).then(() => { loginFailed = true }),
                page.getByText(KO_ATTEMPT_EXCEEDED).first().waitFor({ state: 'visible', timeout: 5000 }).then(() => { loginFailed = true }),
                page.getByText(KO_LOCK).first().waitFor({ state: 'visible', timeout: 5000 }).then(() => { loginFailed = true }),
                page.getByText(KO_LOCKED).first().waitFor({ state: 'visible', timeout: 5000 }).then(() => { loginFailed = true })
            ])
        } catch {
            // Ignore timeouts from race
        }
        await page.waitForTimeout(SHORT_SETTLE_MS)

        if (!loginFailed && page.url().includes('/login')) {
            try {
                await page.goto(MOIN_BIZPLUS_RECIPIENT_URL, {
                    waitUntil: 'domcontentloaded',
                    timeout: 8000,
                })
                steps.push('post-login-direct-recipient-check')
            } catch (error) {
                steps.push(`post-login-direct-recipient-check-error:${getErrorMessage(error).slice(0, 100)}`)
            }
            await page.waitForTimeout(SHORT_SETTLE_MS)
        }

        if (loginFailed || page.url().includes('/login')) {
            // Extract text from the page to see the exact error for the user
            const bodyText = await page.locator('body').textContent().catch(() => '') || ''

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
        pushTiming('login-complete')

        // ???? Step 4: Navigate to recipient page ??????????????????????????????????????????????????????????
        // After login, we should be on /transfer/recipient.
        // If not, navigate there via the "??酉????얄뵛" nav link.

        const postLoginPage = page.url()

        if (!postLoginPage.includes('/transfer/recipient')) {
            steps.push('navigating-to-recipient-page')

            let navigated = false
            try {
                await page.goto(MOIN_BIZPLUS_RECIPIENT_URL, {
                    waitUntil: 'domcontentloaded',
                    timeout: 18000,
                })
                navigated = true
                steps.push('nav-to-recipient:direct')
            } catch (error) {
                steps.push(`nav-direct-recipient-error:${getErrorMessage(error).slice(0, 100)}`)
            }

            if (!navigated) {
                const recipientNavSelectors = [
                    `a:has-text("${KO_REMIT}")`,
                    'a[href*="/transfer/recipient"]',
                    'a[href*="/transfer"]',
                    `a:has-text("${KO_REMIT_SHORT}")`,
                ]

                for (const selector of recipientNavSelectors) {
                    throwIfAbortRequested(abortSignal, 'Navigate recipient page')
                    try {
                        const link = page.locator(selector).first()
                        const isVisible = await link.isVisible()
                        if (isVisible) {
                            await link.click({ timeout: 5000 })
                            throwIfAbortRequested(abortSignal, 'Navigate recipient page')
                            await page.waitForTimeout(600)
                            navigated = true
                            steps.push(`nav-to-recipient:${selector}`)
                            break
                        }
                    } catch {
                        // Try next
                    }
                }
            }

            if (!navigated) {
                steps.push('nav-failed-staying-on-current')
            }
        } else {
            steps.push('already-on-recipient-page')
        }

        // Wait for the recipient list to load
        throwIfAbortRequested(abortSignal, 'Load recipient list')
        const recipientPage = page
        await waitForFastCondition(
            recipientPage,
            async () => (await inspectTransferInputs(recipientPage)).aliasSearchVisible,
            5000
        )
        await assertMoinRemittanceOpen(page, 'MOIN operating hours')
        pushTiming('recipient-page-ready')

        // New flow: the recipient list can be behind the "구매대행송금" tab.
        try {
            await clickFirstVisible(
                page,
                [
                    `button:has-text("${KO_PURCHASE_REMIT}")`,
                    `[role="button"]:has-text("${KO_PURCHASE_REMIT}")`,
                    `a:has-text("${KO_PURCHASE_REMIT}")`,
                ],
                'Open purchase-remit tab',
                3500
            )
            steps.push('open-purchase-remit-tab')
            await page.waitForTimeout(500)
            await assertMoinRemittanceOpen(page, 'MOIN operating hours')
        } catch (error) {
            if (error instanceof MoinAutomationError) throw error
            steps.push('purchase-remit-tab-not-found')
        }

        // The current MOIN recipient screen can virtualize or filter recipient cards.
        // Search first, then scan for the company text in the narrowed list.
        let recipientSearchPrefilled = false
        let lastRecipientSearchKeyword = TARGET_COMPANY_SEARCH_KEYWORD
        let companyTextEl: LocatorLike | null = null
        for (const keyword of TARGET_COMPANY_SEARCH_KEYWORDS) {
            throwIfAbortRequested(abortSignal, 'Search recipient')
            lastRecipientSearchKeyword = keyword
            try {
                if (recipientSearchPrefilled) {
                    const clearResult = await clearRecipientSearchKeyword(page)
                    steps.push(`recipient-search-clear:${clearResult}`)
                    await page.waitForTimeout(150)
                }

                const searchResult = await fillRecipientSearchKeyword(page, keyword)
                steps.push(`recipient-search-prefill:${keyword}:${searchResult}`)
                recipientSearchPrefilled = searchResult === 'recipient-search-filled'
                await page.waitForTimeout(450)

                companyTextEl = await findVisibleCompanyTextLocator(page, 2200)
                if (companyTextEl) {
                    steps.push(`company-text-visible-after-search:${keyword}`)
                    break
                }
            } catch {
                steps.push(`recipient-search-prefill-error:${keyword}`)
            }
        }
        pushTiming('recipient-search-complete')

        // ???? Step 4.5: Find the company card and click it ????????????????????????????????????????
        // The recipient page shows cards with company names.
        // Clicking a card opens a MODAL POPUP (not a page navigation!).
        // The modal shows recipient details and has "??瑜곸젧???얄뵛" / "??酉????얄뵛" buttons.

        // First, check if company name is visible (may need to scroll)
        let recipientSelectedFromSearchResult = false
        if (!companyTextEl) {
            companyTextEl = await findVisibleCompanyTextLocator(page, 3000)
        }
        if (companyTextEl) {
            steps.push('company-text-visible')
        } else {
            const scrolled = await scrollToCompanyTextCandidate(page)
            steps.push(scrolled ? 'company-scroll-hit' : 'company-scroll-miss')
            await page.waitForTimeout(350)
            companyTextEl = await findVisibleCompanyTextLocator(page, 4000)
            if (!companyTextEl) {
                if (recipientSearchPrefilled) {
                    const searchResultClick = await clickFirstRecipientSearchResult(page, lastRecipientSearchKeyword)
                    steps.push(`recipient-search-result-click:${searchResultClick}`)
                    if (searchResultClick.startsWith('clicked-')) {
                        recipientSelectedFromSearchResult = true
                    }
                }

                if (recipientSelectedFromSearchResult) {
                    steps.push('company-text-hidden-selected-search-result')
                } else {
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
                        `Could not find target company text (${TARGET_COMPANY_NAME}). ${pageInfo}`
                    )
                }
            }
            if (companyTextEl) {
                steps.push('company-text-visible-after-scroll')
            }
        }

        // Click the company card to open the modal popup
        // The card area containing the company name is clickable (cursor:pointer)
        let remitClicked = false
        let remitClickReason = 'not-attempted'

        for (let attempt = 0; attempt < 2 && !remitClicked; attempt++) {
            throwIfAbortRequested(abortSignal, 'Open remit modal')
            try {
                const visibleCompanyEl = await findVisibleCompanyTextLocator(page, 2000)
                if (!visibleCompanyEl) {
                    steps.push(`company-text-click-failed:not-visible:attempt${attempt}`)
                } else {
                    await visibleCompanyEl.click({ timeout: 5000 })
                    steps.push(`clicked-company-text:attempt${attempt}`)
                }
            } catch {
                steps.push(`company-text-click-failed:attempt${attempt}`)
            }

            try {
                const rowSelectResult = await clickCompanyRowCandidate(page, TARGET_COMPANY_NAME_VARIANTS)
                steps.push(`recipient-row-select-click:${rowSelectResult}:attempt${attempt}`)
            } catch (err) {
                steps.push(`recipient-row-select-click-error:${err instanceof Error ? err.message.slice(0, 120) : 'unknown'}:attempt${attempt}`)
            }

            throwIfAbortRequested(abortSignal, 'Open remit modal')
            await page.waitForTimeout(450)

            try {
                remitClickReason = await clickCompanyScopedRemit(page, TARGET_COMPANY_NAME_VARIANTS, KO_REMIT)
                steps.push(`company-scoped-remit:${remitClickReason}:attempt${attempt}`)
                if (remitClickReason.startsWith('clicked-')) {
                    remitClicked = true
                    break
                }
            } catch (err) {
                steps.push(`company-scoped-remit-error:${err instanceof Error ? err.message.slice(0, 120) : 'unknown'}:attempt${attempt}`)
            }

            throwIfAbortRequested(abortSignal, 'Open remit modal')
            await page.waitForTimeout(350)
        }

        if (!remitClicked) {
            try {
                await clickNextStep(page, 12000)
                steps.push('recipient-next-step-after-company')
                await page.waitForTimeout(600)
                const nextStepInspection = await inspectTransferInputs(page)
                if (nextStepInspection.amountKeywordVisible || !nextStepInspection.aliasSearchVisible) {
                    remitClicked = true
                    steps.push(`recipient-next-step-loaded:${JSON.stringify({
                        aliasSearchVisible: nextStepInspection.aliasSearchVisible,
                        amountKeywordVisible: nextStepInspection.amountKeywordVisible,
                        inputCount: nextStepInspection.visibleInputs.length,
                    })}`)
                } else {
                    steps.push(`recipient-next-step-still-recipient:${JSON.stringify({
                        aliasSearchVisible: nextStepInspection.aliasSearchVisible,
                        amountKeywordVisible: nextStepInspection.amountKeywordVisible,
                        buttons: nextStepInspection.nextButtons.slice(0, 8),
                    })}`)
                }
            } catch (err) {
                steps.push(`recipient-next-step-after-company-error:${err instanceof Error ? err.message.slice(0, 120) : 'unknown'}`)
            }
        }
        pushTiming('remit-clicked')

        if (!remitClicked) {
            throw new MoinAutomationError(
                'Click remit button in modal',
                `Could not click the "${KO_REMIT}" button or continue with "${KO_NEXT_STEP_SPACED}" in the target company context. Last result: ${remitClickReason}. (url: ${page.url()})`
            )
        }

        // Wait for Step 2 (amount entry) to load and recover if we are still on recipient search.
        let step2Ready = false
        let transferInspection = await inspectTransferInputs(page)

        for (let attempt = 0; attempt < 2; attempt++) {
            throwIfAbortRequested(abortSignal, 'Open amount step')
            const amountPage = page
            await waitForFastCondition(amountPage, async () => {
                const current = await inspectTransferInputs(amountPage)
                const nonRecipientInputs = current.visibleInputs.filter((visibleInput) => !isRecipientSearchInputInfo(visibleInput))
                return current.amountKeywordVisible && nonRecipientInputs.length > 0
            }, attempt === 0 ? 6500 : 3500)

            const urlAfterRemit = page.url()
            transferInspection = await inspectTransferInputs(page)
            steps.push(`url-after-remit:${urlAfterRemit.replace('https://www.moinbizplus.com', '')}:attempt${attempt}`)
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

            if (transferInspection.aliasSearchVisible && attempt < 1) {
                steps.push(`step2-recovery-attempt:${attempt + 1}`)

                try {
                    throwIfAbortRequested(abortSignal, 'Open amount step')
                    const clearResult = await clearRecipientSearchKeyword(page)
                    steps.push(`recovery-recipient-search-clear:${clearResult}`)
                    const searchResult = await fillRecipientSearchKeyword(page, lastRecipientSearchKeyword)
                    steps.push(`recovery-recipient-search:${lastRecipientSearchKeyword}:${searchResult}`)
                    await page.waitForTimeout(400)
                    const recoveryCompanyEl = await findVisibleCompanyTextLocator(page, 2500)
                    if (recoveryCompanyEl) {
                        await recoveryCompanyEl.click({ timeout: 3000 })
                        steps.push('recovery-clicked-company-text')
                        await page.waitForTimeout(250)
                    } else {
                        steps.push('recovery-company-text-not-found')
                    }
                    const recoveryReason = await clickCompanyScopedRemit(page, TARGET_COMPANY_NAME_VARIANTS, KO_REMIT)
                    steps.push(`recovery-company-scoped-remit:${recoveryReason}`)
                } catch (err) {
                    steps.push(`recovery-remit-click-error:${err instanceof Error ? err.message.slice(0, 120) : 'unknown'}`)
                }

                try {
                    throwIfAbortRequested(abortSignal, 'Open amount step')
                    const clearResult = await clearRecipientSearchKeyword(page)
                    steps.push(`recovery-recipient-search-clear-2:${clearResult}`)
                    const searchResult = await fillRecipientSearchKeyword(page, lastRecipientSearchKeyword)
                    steps.push(`recovery-recipient-search-2:${lastRecipientSearchKeyword}:${searchResult}`)
                    await page.waitForTimeout(350)
                    const secondRecoveryReason = await clickCompanyScopedRemit(page, TARGET_COMPANY_NAME_VARIANTS, KO_REMIT)
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
        pushTiming('amount-step-ready')

        // Give React a short moment to finish mounting the input handlers.
        throwIfAbortRequested(abortSignal, 'Fill USD amount')
        await page.waitForTimeout(300)

        // ???? Step 6: Fill USD amount ????????????????????????????????????????????????????????????????????????????????
        // The amount page has two sections:
        //   - "?곌랜?亦???ル?녽뇡? (KRW) ??auto-calculated
        //   - "?꾩룇猷???ル?녽뇡? (USD) ??this is where we enter our amount
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
            // Near "?꾩룇猷???ル?녽뇡? / "USD" text
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
            throwIfAbortRequested(abortSignal, 'Fill USD amount')
            if (amountFilled) break
            try {
                const target = page.locator(sel).first()
                await target.waitFor({ state: 'visible', timeout: 3000 })
                await target.click({ timeout: 3000 })
                await target.fill('')
                await target.pressSequentially(input.amountUsd, { delay: 30 })
                await page.waitForTimeout(200)
                const inspect = await inspectAmountFieldValue(page, input.amountUsd)
                if (inspect.matched) {
                    amountFilled = true
                    steps.push(`fill-usd:${sel.slice(0, 40)}:ok`)
                } else {
                    steps.push(`fill-usd:${sel.slice(0, 40)}:mismatch:${inspect.bestValue || 'empty'}`)
                }
            } catch {
                // Continue
            }
        }

        // Strategy 2: Find the second visible text/number input on the page
        // (first is usually KRW, second is USD)
        if (!amountFilled) {
            try {
                throwIfAbortRequested(abortSignal, 'Fill USD amount')
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

                // Try to fill a visible input that does not look like the recipient search box.
                const visibleInputs = JSON.parse(result) as Array<{i: number; type: string; name: string; id: string; placeholder: string}>
                const candidateInputs = visibleInputs.filter((visibleInput) => !isRecipientSearchInputInfo(visibleInput))
                if (candidateInputs.length > 0) {
                    const targetInfo = candidateInputs.find((visibleInput) => {
                        const hint = `${visibleInput.name} ${visibleInput.id} ${visibleInput.placeholder}`.toLowerCase()
                        return hint.includes('usd') || hint.includes('amount') || hint.includes('receive')
                    }) || candidateInputs[Math.min(1, candidateInputs.length - 1)]
                    
                    let selector = ''
                    if (targetInfo.id) {
                        selector = `input#${targetInfo.id}`
                    } else if (targetInfo.name) {
                        selector = `input[name=${JSON.stringify(targetInfo.name)}]`
                    } else {
                        // Use nth-of-type or generic
                        selector = `input[type="${targetInfo.type || 'text'}"]`
                    }

                    const target = page.locator(selector).first()
                    await target.click({ timeout: 3000, force: true })
                    await target.fill('')
                    await target.pressSequentially(input.amountUsd, { delay: 30 })
                    await page.waitForTimeout(200)
                    const inspect = await inspectAmountFieldValue(page, input.amountUsd)
                    if (inspect.matched) {
                        amountFilled = true
                        steps.push(`fill-usd-generic:${selector}:ok`)
                    } else {
                        steps.push(`fill-usd-generic:${selector}:mismatch:${inspect.bestValue || 'empty'}`)
                    }
                }
            } catch (err) {
                steps.push(`fill-usd-generic-error:${err instanceof Error ? err.message.slice(0, 100) : 'unknown'}`)
            }
        }

        // Strategy 3: JavaScript direct value set on the input
        if (!amountFilled) {
            try {
                throwIfAbortRequested(abortSignal, 'Fill USD amount')
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
                        const blocked = [${JSON.stringify(KO_RECIPIENT_SEARCH_PLACEHOLDER)}, 'recipient', 'alias', 'company', 'name'];
                        const target = visible.find((inp) => {
                            const hint = [inp.name || '', inp.id || '', inp.placeholder || ''].join(' ').toLowerCase();
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
                    const inspect = await inspectAmountFieldValue(page, input.amountUsd)
                    if (inspect.matched) {
                        amountFilled = true
                        steps.push(`fill-usd-js:${jsResult}:ok`)
                    } else {
                        steps.push(`fill-usd-js:${jsResult}:mismatch:${inspect.bestValue || 'empty'}`)
                    }
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

        const finalAmountInspect = await inspectAmountFieldValue(page, input.amountUsd)
        if (!finalAmountInspect.matched) {
            throw new MoinAutomationError(
                'Fill USD amount',
                `USD amount did not apply as expected. expected=${input.amountUsd}, actual=${finalAmountInspect.bestValue || 'empty'}, url=${page.url()}`
            )
        }
        steps.push('fill-usd-amount')
        pushTiming('amount-filled')

        // ???? Step 7: Next step after amount ??????????????????????????????????????????????????????????????????
        let uploadStepReady = false
        for (let attempt = 0; attempt < 2; attempt += 1) {
            throwIfAbortRequested(abortSignal, 'Next after amount')
            const beforeUrl = page.url()
            await clickNextStep(page, FAST_ELEMENT_TIMEOUT_MS)
            const uploadWaitPage = page
            await waitForFastCondition(uploadWaitPage, async () => {
                const currentUrl = uploadWaitPage.url()
                return await hasUploadInput(uploadWaitPage) || currentUrl !== beforeUrl || !currentUrl.includes('/transfer/amount')
            }, attempt === 0 ? 6000 : 3000)
            const afterUrl = page.url()
            const uploadInputPresent = await hasUploadInput(page)
            steps.push(`next-after-amount-attempt:${attempt + 1}:url:${afterUrl.replace('https://www.moinbizplus.com', '')}:uploadInput:${uploadInputPresent}`)
            if (uploadInputPresent || afterUrl !== beforeUrl || !afterUrl.includes('/transfer/amount')) {
                uploadStepReady = true
                break
            }
        }
        if (!uploadStepReady) {
            throw new MoinAutomationError('Next after amount', `Failed to move to upload step after amount entry. (url: ${page.url()})`)
        }
        steps.push('next-after-amount')
        pushTiming('upload-step-ready')

        // ???? Step 8: Upload invoice PDF ??????????????????????????????????????????????????????????????????????????
        throwIfAbortRequested(abortSignal, 'Upload invoice')
        await uploadFirstFileInput(
            page,
            ['input[type="file"][accept*="pdf" i]', 'input[type="file"]'],
            {
                name: input.invoiceFileName,
                mimeType: input.invoiceMimeType,
                buffer: input.invoiceBuffer,
            },
            FAST_ELEMENT_TIMEOUT_MS
        )
        steps.push('upload-invoice')
        pushTiming('invoice-uploaded')

        // ???? Step 9: Next step after upload ??????????????????????????????????????????????????????????????????
        throwIfAbortRequested(abortSignal, 'Next after upload')
        const uploadUrl = page.url()
        await clickNextStep(page, FAST_ELEMENT_TIMEOUT_MS)
        const confirmationPage = page
        await waitForFastCondition(confirmationPage, async () => {
            const currentUrl = confirmationPage.url()
            if (currentUrl !== uploadUrl && !currentUrl.includes('/transfer/amount')) return true
            const snapshot = await inspectPreSubmitState(confirmationPage)
            return snapshot.finalActionCandidates.length > 0 || snapshot.bodyPreview.includes(KO_AGREEMENT)
        }, 6000)
        steps.push('next-after-upload')
        pushTiming('confirmation-step-ready')

        // ???? Step 10: Check agreement ??????????????????????????????????????????????????????????????????????????????
        throwIfAbortRequested(abortSignal, 'Agreement')
        await checkAgreement(page, FAST_ELEMENT_TIMEOUT_MS)
        steps.push('check-agreement')

        throwIfAbortRequested(abortSignal, 'Inspect pricing summary')
        const pricingSummary = await inspectRemittancePricingSummary(page)
        steps.push(`pricing-summary:${JSON.stringify(pricingSummary).slice(0, 220)}`)
        pushTiming('pricing-summary-read')

        if (input.prepareOnly !== false) {
            const preSubmitSnapshot = await inspectPreSubmitState(page)
            steps.push(`prepare-only-final-candidates:${JSON.stringify(preSubmitSnapshot.finalActionCandidates).slice(0, 220)}`)
            steps.push('stopped-before-final-confirmation')

            return {
                finalUrl: page.url(),
                completedAt: new Date().toISOString(),
                steps,
                pricingSummary,
                submitted: false,
                stoppedBeforeConfirmation: true,
                finalActionCandidates: preSubmitSnapshot.finalActionCandidates,
                selectorsUsed,
                finalPageTitle: preSubmitSnapshot.title,
                finalBodyPreview: preSubmitSnapshot.bodyPreview,
            }
        }

        // Step 11: Submit remittance. The final page can render several similar
        // action buttons, so click the last visible matching action.
        throwIfAbortRequested(abortSignal, 'Submit remittance')
        const submitSelectorUsed = await clickFinalRemittanceSubmit(page, FAST_ELEMENT_TIMEOUT_MS)
        steps.push(`submit-remittance:${submitSelectorUsed}`)
        pushTiming('final-submit-clicked')

        // Step 12: Verify completion without waiting for network idle. MOIN pages
        // can keep background requests open, so short DOM polls are much faster.
        let completionConfirmed = false
        const submitUrl = page.url()
        let completionSnapshot = await inspectRemittanceCompletion(page)
        const completionDeadline = Date.now() + COMPLETION_FAST_TIMEOUT_MS
        for (let attempt = 0; Date.now() < completionDeadline; attempt += 1) {
            throwIfAbortRequested(abortSignal, 'Verify completion')
            await page.waitForTimeout(COMPLETION_POLL_INTERVAL_MS)

            const textMatched = await page.getByText(KO_SUCCESS_PATTERN).first().isVisible().catch(() => false)
            completionSnapshot = await inspectRemittanceCompletion(page)
            steps.push(`completion-check:${JSON.stringify({
                attempt,
                url: completionSnapshot.url.replace('https://www.moinbizplus.com', ''),
                textMatched,
                hasSuccessKeyword: completionSnapshot.hasSuccessKeyword,
                hasAcceptedStateKeyword: completionSnapshot.hasAcceptedStateKeyword,
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

            if (!completionSnapshot.hasRecipientSearchInput && completionSnapshot.hasAcceptedStateKeyword) {
                completionConfirmed = true
                steps.push('completion-inferred-by-accepted-state')
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
        pushTiming('completion-confirmed')

        return {
            finalUrl: page.url(),
            completedAt: new Date().toISOString(),
            steps,
            pricingSummary,
            submitted: true,
            stoppedBeforeConfirmation: false,
            selectorsUsed,
        }
    } catch (error) {
        if (error instanceof MoinAutomationCanceledError) {
            error.message = `${error.message} [steps: ${steps.join(' -> ')}]`
            throw error
        }

        if (abortSignal?.aborted) {
            throw new MoinAutomationCanceledError(
                'Automation',
                `Remittance automation was canceled by user. [steps: ${steps.join(' -> ')}]`
            )
        }

        if (error instanceof MoinAutomationError) {
            // Append accumulated steps to help debugging
            if (error.diagnostic === undefined) {
                error.diagnostic = await collectMoinFailureDiagnostic(page, steps)
            }
            error.message = `${error.message} [steps: ${steps.join(' -> ')}]`
            throw error
        }

        const diagnostic = await collectMoinFailureDiagnostic(page, steps)
        if (isTargetClosedAutomationError(error)) {
            throw new MoinAutomationError(
                'Browser closed unexpectedly',
                `MOIN automation browser closed before completion. This usually means Chromium crashed or the MOIN page closed during the current step. [lastSteps: ${steps.slice(-8).join(' -> ')}] [steps: ${steps.join(' -> ')}]`,
                diagnostic,
            )
        }

        throw new MoinAutomationError(
            'Automation',
            `${error instanceof Error ? error.message : 'Unknown automation error.'} [steps: ${steps.join(' -> ')}] [url: ${browser ? 'see-steps' : 'no-browser'}]`,
            diagnostic,
        )
    } finally {
        if (abortListenerCleanup) {
            abortListenerCleanup()
            abortListenerCleanup = null
        }
        if (browser) {
            await browser.close().catch(() => undefined)
        }
    }
}

export const __moinBizplusTestHooks = {
    clickMoinLoginSubmit,
    clickLastVisible,
    getMoinRemittanceWindowState,
    normalizeMoinTransaction,
    fillMissingHistoryRecipients,
}
