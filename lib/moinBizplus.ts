const MOIN_BIZPLUS_LOGIN_URL = 'https://www.moinbizplus.com/login'
const TARGET_COMPANY_NAME = 'Shanghai Oikki Trading Co.,Ltd'
const TARGET_COMPANY_SEARCH_KEYWORD = 'Oikki'
const TARGET_COMPANY_NAME_VARIANTS = [
    TARGET_COMPANY_NAME,
    'Shanghai Oikki Trading Co Ltd',
    'Shanghai Oikki Trading Co., Ltd',
    'Shanghai Oikki Trading',
    'Oikki Trading',
    'Oikki',
]
const TARGET_COMPANY_NAME_REGEX = /Shanghai\s*Oikki\s*Trading\s*Co\.?\s*,?\s*Ltd/i
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
    abortSignal?: AbortSignal
}

export type MoinRemittanceResult = {
    finalUrl: string
    completedAt: string
    steps: string[]
    pricingSummary: MoinRemittancePricingSummary | null
}

export type MoinRemittancePricingSummary = {
    finalReceiveAmount: string
    sendAmount: string
    totalFee: string
    exchangeRate: string
}

export class MoinAutomationError extends Error {
    step: string

    constructor(step: string, message: string) {
        super(message)
        this.name = 'MoinAutomationError'
        this.step = step
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
            await target.waitFor({ state: 'visible', timeout: Math.min(timeoutMs, 9000) })
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
    const trySetFiles = async () => {
        for (const selector of selectors) {
            try {
                const target = page.locator(selector).first()
                await target.waitFor({ state: 'attached', timeout: Math.min(timeoutMs, 12000) })
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
            await page.waitForTimeout(500)
            if (await trySetFiles()) return
        } catch {
            // Continue
        }
    }

    // Last attempt after short wait (lazy render).
    await page.waitForTimeout(1000)
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

const fillRecipientSearchKeyword = async (page: PageLike, keyword: string) => {
    const result = await page.evaluate(`
        (() => {
            const recipientPlaceholder = ${JSON.stringify(KO_RECIPIENT_SEARCH_PLACEHOLDER)};
            const keyword = ${JSON.stringify(keyword)};
            const isVisible = (el) => {
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
            };
            const input = Array.from(document.querySelectorAll('input'))
                .find((el) => isVisible(el) && (el.placeholder || '').includes(recipientPlaceholder));
            if (!input) return 'recipient-search-not-found';

            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
            if (!nativeSetter) return 'native-setter-not-found';

            nativeSetter.call(input, keyword);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
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
            const isVisible = (el) => {
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
            };
            const input = Array.from(document.querySelectorAll('input'))
                .find((el) => isVisible(el) && (el.placeholder || '').includes(recipientPlaceholder));
            if (!input) return 'recipient-search-not-found';

            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
            if (!nativeSetter) return 'native-setter-not-found';

            nativeSetter.call(input, '');
            input.dispatchEvent(new Event('input', { bubbles: true }));
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

            const buttons = Array.from(document.querySelectorAll('button, [role="button"], a'))
                .filter((el) => isVisible(el))
                .map((el) => normalize(el.textContent || ''))
                .filter(Boolean)
                .slice(0, 30);

            const visibleInputs = Array.from(document.querySelectorAll('input'))
                .filter((el) => isVisible(el))
                .map((el) => ({
                    type: el.type || '',
                    name: el.name || '',
                    id: el.id || '',
                    placeholder: el.placeholder || '',
                }));

            const hasSuccessKeyword = successKeywords.some((kw) => bodyText.includes(String(kw)));
            const hasRecipientSearchInput = visibleInputs.some((inp) => (inp.placeholder || '').includes(recipientPlaceholder));
            const hasSubmitLikeButton = buttons.some((txt) =>
                txt.includes(remitRequest) ||
                txt.includes(remitRequestCompact) ||
                txt.includes(nextStep) ||
                txt.includes(nextStepSpaced) ||
                txt === applyLabel ||
                txt === submitLabel
            );

            return {
                url: location.href,
                hasSuccessKeyword,
                hasRecipientSearchInput,
                hasSubmitLikeButton,
                buttons,
                bodyPreview: bodyText.slice(0, 500),
            };
        })()
    `) as {
        url: string
        hasSuccessKeyword: boolean
        hasRecipientSearchInput: boolean
        hasSubmitLikeButton: boolean
        buttons: string[]
        bodyPreview: string
    }

    return result
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

            const extractSameLine = (line, words) => {
                const escapeRegex = (input) => String(input).replace(/[\\^$.*+?()[\\]{}|]/g, '\\\\$&');
                for (const word of words) {
                    const pattern = new RegExp(escapeRegex(word) + '\\\\s*[:：-]?\\\\s*(.+)$', 'i');
                    const match = line.match(pattern);
                    if (match && hasDigit(match[1])) return clean(match[1]);
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
                    const direct = extractSameLine(candidate.text, words);
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

                    const sameLine = extractSameLine(line, words);
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
            exchangeRate: typeof parsed.exchangeRate === 'string' ? parsed.exchangeRate.trim() : '',
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

            const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
            const normalizeAlphaNum = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
            const textOf = (el) => norm((el && el.textContent) || '');
            const hasText = (el, text) => textOf(el).includes(norm(text));
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
                const exactMatch = text === norm(remit) ? -100000 : 0;
                const hasRemit = text.includes(norm(remit)) ? -10000 : 0;
                const semanticBoost = isSemanticButton(target) ? -5000 : 0;
                const tagBoost = (target.tagName || '').toLowerCase() === 'a' ? -1500 : 0;
                let distance = 0;
                if (reference) {
                    const rect = target.getBoundingClientRect();
                    const tx = rect.left + rect.width / 2;
                    const ty = rect.top + rect.height / 2;
                    const dx = tx - reference.x;
                    const dy = ty - reference.y;
                    distance = dx * dx + dy * dy;
                }
                return exactMatch + hasRemit + semanticBoost + tagBoost + distance;
            };
            const collectRemitCandidates = (scope) => {
                const clickableRemit = Array.from(scope.querySelectorAll('button, [role="button"], a, input[type="button"], input[type="submit"], [onclick]'))
                    .filter((el) => isVisible(el) && hasText(el, remit))
                    .map((el) => toClickable(el))
                    .filter(Boolean);
                const textNodes = Array.from(scope.querySelectorAll('div, span, p, strong, b'))
                    .filter((el) => isVisible(el) && hasText(el, remit))
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
    const abortSignal = input.abortSignal
    let abortListenerCleanup: (() => void) | null = null

    try {
        throwIfAbortRequested(abortSignal, 'Launch browser')
        const launched = await launchBrowser(input.headless ?? true)
        browser = launched.browser
        steps.push(`runtime:${launched.runtime}`)
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
        const page = await context.newPage()
        page.setDefaultTimeout(DEFAULT_TIMEOUT_MS)
        page.setDefaultNavigationTimeout(LONG_TIMEOUT_MS)

        // ???? Step 1: Go directly to login page ??????????????????????????????????????????????????????????
        throwIfAbortRequested(abortSignal, 'Open login page')
        const loginWaitUntil = await openMoinLoginPage(page, LONG_TIMEOUT_MS)
        steps.push(`open-login-page:${loginWaitUntil}`)

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

        // Wait for React to process input events and enable the login button
        // Add a random human-like delay before clicking submit (1.5 to 2.5 seconds)
        const clickDelay = 1500 + Math.floor(Math.random() * 1000)
        throwIfAbortRequested(abortSignal, 'Submit login')
        await page.waitForTimeout(clickDelay)

        // ???? Step 3: Submit login ??????????????????????????????????????????????????????????????????????????????????????
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
            throwIfAbortRequested(abortSignal, 'Submit login')
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
                    throwIfAbortRequested(abortSignal, 'Submit login')
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

        // ???? Step 3.5: Check for explicit login errors ??????????????????????????????????????????????
        // MOIN bizplus shows a red banner for invalid password or locked accounts.
        // We wait up to 10 seconds to see if the URL changes OR an error banner appears.
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
                page.getByText(KO_LOCKED).first().waitFor({ state: 'visible', timeout: 10000 }).then(() => { loginFailed = true })
            ])
        } catch {
            // Ignore timeouts from race
        }

        // Wait for page to settle
        throwIfAbortRequested(abortSignal, 'Verify login')
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined)

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

        // ???? Step 4: Navigate to recipient page ??????????????????????????????????????????????????????????
        // After login, we should be on /transfer/recipient.
        // If not, navigate there via the "??酉????얄뵛" nav link.

        const postLoginPage = page.url()

        if (!postLoginPage.includes('/transfer/recipient')) {
            steps.push('navigating-to-recipient-page')

            const recipientNavSelectors = [
                `a:has-text("${KO_REMIT}")`,      // "??酉????얄뵛" nav link
                'a[href*="/transfer/recipient"]',
                'a[href*="/transfer"]',
                `a:has-text("${KO_REMIT_SHORT}")`,
            ]

            let navigated = false
            for (const selector of recipientNavSelectors) {
                throwIfAbortRequested(abortSignal, 'Navigate recipient page')
                try {
                    const link = page.locator(selector).first()
                    const isVisible = await link.isVisible()
                    if (isVisible) {
                        await link.click({ timeout: 8000 })
                        throwIfAbortRequested(abortSignal, 'Navigate recipient page')
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
        throwIfAbortRequested(abortSignal, 'Load recipient list')
        await page.waitForTimeout(2000)
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined)

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
                6000
            )
            steps.push('open-purchase-remit-tab')
            await page.waitForTimeout(1200)
            await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
        } catch {
            steps.push('purchase-remit-tab-not-found')
        }

        // ???? Step 4.5: Find the company card and click it ????????????????????????????????????????
        // The recipient page shows cards with company names.
        // Clicking a card opens a MODAL POPUP (not a page navigation!).
        // The modal shows recipient details and has "??瑜곸젧???얄뵛" / "??酉????얄뵛" buttons.

        // First, check if company name is visible (may need to scroll)
        let companyTextEl = await findVisibleCompanyTextLocator(page, 8000)
        if (companyTextEl) {
            steps.push('company-text-visible')
        } else {
            const scrolled = await scrollToCompanyTextCandidate(page)
            steps.push(scrolled ? 'company-scroll-hit' : 'company-scroll-miss')
            await page.waitForTimeout(1000)
            companyTextEl = await findVisibleCompanyTextLocator(page, 10000)
            if (!companyTextEl) {
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
            steps.push('company-text-visible-after-scroll')
        }

        // Narrow candidate list by company keyword when recipient search input is present.
        try {
            const searchResult = await fillRecipientSearchKeyword(page, TARGET_COMPANY_SEARCH_KEYWORD)
            steps.push(`recipient-search-prefill:${searchResult}`)
            await page.waitForTimeout(600)
            await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined)
        } catch {
            steps.push('recipient-search-prefill-error')
        }

        // Click the company card to open the modal popup
        // The card area containing the company name is clickable (cursor:pointer)
        let remitClicked = false
        let remitClickReason = 'not-attempted'

        for (let attempt = 0; attempt < 3 && !remitClicked; attempt++) {
            throwIfAbortRequested(abortSignal, 'Open remit modal')
            try {
                const visibleCompanyEl = await findVisibleCompanyTextLocator(page, 3500)
                if (!visibleCompanyEl) {
                    steps.push(`company-text-click-failed:not-visible:attempt${attempt}`)
                } else {
                    await visibleCompanyEl.click({ timeout: 5000 })
                    steps.push(`clicked-company-text:attempt${attempt}`)
                }
            } catch {
                steps.push(`company-text-click-failed:attempt${attempt}`)
            }

            throwIfAbortRequested(abortSignal, 'Open remit modal')
            await page.waitForTimeout(1000)

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

        for (let attempt = 0; attempt < 5; attempt++) {
            throwIfAbortRequested(abortSignal, 'Open amount step')
            await page.waitForTimeout(2000)
            await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => undefined)

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

            if (transferInspection.aliasSearchVisible && attempt < 4) {
                steps.push(`step2-recovery-attempt:${attempt + 1}`)

                try {
                    throwIfAbortRequested(abortSignal, 'Open amount step')
                    const clearResult = await clearRecipientSearchKeyword(page)
                    steps.push(`recovery-recipient-search-clear:${clearResult}`)
                    const searchResult = await fillRecipientSearchKeyword(page, TARGET_COMPANY_SEARCH_KEYWORD)
                    steps.push(`recovery-recipient-search:${searchResult}`)
                    await page.waitForTimeout(900)
                    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined)
                    const recoveryCompanyEl = await findVisibleCompanyTextLocator(page, 5000)
                    if (recoveryCompanyEl) {
                        await recoveryCompanyEl.click({ timeout: 3000 })
                        steps.push('recovery-clicked-company-text')
                        await page.waitForTimeout(400)
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
                    const searchResult = await fillRecipientSearchKeyword(page, TARGET_COMPANY_SEARCH_KEYWORD)
                    steps.push(`recovery-recipient-search-2:${searchResult}`)
                    await page.waitForTimeout(700)
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

        // Give the input fields extra time to render (React hydration)
        throwIfAbortRequested(abortSignal, 'Fill USD amount')
        await page.waitForTimeout(2000)

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

        // ???? Step 7: Next step after amount ??????????????????????????????????????????????????????????????????
        let uploadStepReady = false
        for (let attempt = 0; attempt < 4; attempt += 1) {
            throwIfAbortRequested(abortSignal, 'Next after amount')
            const beforeUrl = page.url()
            await clickNextStep(page, DEFAULT_TIMEOUT_MS)
            await page.waitForTimeout(1200)
            await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
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
            DEFAULT_TIMEOUT_MS
        )
        steps.push('upload-invoice')

        // ???? Step 9: Next step after upload ??????????????????????????????????????????????????????????????????
        throwIfAbortRequested(abortSignal, 'Next after upload')
        await clickNextStep(page, DEFAULT_TIMEOUT_MS)
        steps.push('next-after-upload')

        // ???? Step 10: Check agreement ??????????????????????????????????????????????????????????????????????????????
        throwIfAbortRequested(abortSignal, 'Agreement')
        await checkAgreement(page, DEFAULT_TIMEOUT_MS)
        steps.push('check-agreement')

        throwIfAbortRequested(abortSignal, 'Inspect pricing summary')
        const pricingSummary = await inspectRemittancePricingSummary(page)
        steps.push(`pricing-summary:${JSON.stringify(pricingSummary).slice(0, 220)}`)

        // ???? Step 11: Submit remittance ??????????????????????????????????????????????????????????????????????????
        // On the ?筌먲퐢沅??筌먦끉逾?page, the submit button says "??酉????ル―?? (not "???깅쾳 ??節띉?)
        throwIfAbortRequested(abortSignal, 'Submit remittance')
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
            throwIfAbortRequested(abortSignal, 'Verify completion')
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
            pricingSummary,
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
            error.message = `${error.message} [steps: ${steps.join(' -> ')}]`
            throw error
        }

        throw new MoinAutomationError(
            'Automation',
            `${error instanceof Error ? error.message : 'Unknown automation error.'} [steps: ${steps.join(' -> ')}] [url: ${browser ? 'see-steps' : 'no-browser'}]`
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
