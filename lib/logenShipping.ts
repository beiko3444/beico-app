const LOGEN_LOGIN_URL = 'https://logis.ilogen.com/'
const DEFAULT_TIMEOUT_MS = 30000
const LONG_TIMEOUT_MS = 60000

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
    keyboard: { press: (key: string) => Promise<void> }
    waitForEvent: (event: string, options?: Record<string, unknown>) => Promise<unknown>
    on: (event: string, handler: (...args: unknown[]) => void) => void
}

type LocatorLike = {
    first: () => LocatorLike
    nth: (index: number) => LocatorLike
    locator: (selector: string) => LocatorLike
    waitFor: (options?: Record<string, unknown>) => Promise<void>
    click: (options?: Record<string, unknown>) => Promise<void>
    dblclick: (options?: Record<string, unknown>) => Promise<void>
    fill: (value: string) => Promise<void>
    pressSequentially: (text: string, options?: Record<string, unknown>) => Promise<void>
    setInputFiles: (files: { name: string; mimeType: string; buffer: Buffer }) => Promise<void>
    check: (options?: Record<string, unknown>) => Promise<void>
    isVisible: () => Promise<boolean>
    isEnabled: () => Promise<boolean>
    isDisabled: () => Promise<boolean>
    count: () => Promise<number>
    textContent: () => Promise<string | null>
    inputValue: () => Promise<string>
}

export type LogenShippingInput = {
    loginId: string
    loginPassword: string
    recipientPhone: string
    recipientName: string
    recipientAddress: string
    recipientDetailAddress: string
    senderPhone: string
    senderName: string
    headless?: boolean
    signal?: AbortSignal
    onStep?: (step: string) => void
}

export type LogenShippingResult = {
    trackingNumber: string
}

export class LogenAutomationError extends Error {
    step: string

    constructor(step: string, message: string) {
        super(message)
        this.name = 'LogenAutomationError'
        this.step = step
    }
}

export class LogenAutomationCanceledError extends LogenAutomationError {
    constructor(step: string, message = 'Logen shipping automation was canceled by user.') {
        super(step, message)
        this.name = 'LogenAutomationCanceledError'
    }
}

const getErrorMessage = (error: unknown) => {
    if (error instanceof Error && error.message) return error.message
    return String(error)
}

const throwIfAbortRequested = (signal: AbortSignal | undefined, step: string) => {
    if (signal?.aborted) {
        throw new LogenAutomationCanceledError(step)
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

    throw new LogenAutomationError(
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

    throw new LogenAutomationError(step, `Could not find a clickable element for step: ${step} (url: ${page.url()})`)
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

    throw new LogenAutomationError(step, `Could not find a fillable input for step: ${step} (url: ${page.url()})`)
}

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
            await target.fill('')
            const typingDelay = 80 + Math.floor(Math.random() * 70)
            await target.pressSequentially(value, { delay: typingDelay })
            return
        } catch {
            // Try next selector.
        }
    }

    throw new LogenAutomationError(step, `Could not find a typeable input for step: ${step} (url: ${page.url()})`)
}

export async function submitLogenShipping(params: LogenShippingInput): Promise<LogenShippingResult> {
    const {
        loginId,
        loginPassword,
        recipientPhone,
        recipientName,
        recipientAddress,
        recipientDetailAddress,
        senderPhone,
        senderName,
        headless = true,
        signal,
        onStep,
    } = params

    const reportStep = (step: string) => {
        if (onStep) onStep(step)
    }

    let browser: BrowserLike | null = null

    try {
        // Step 1: Launch browser and navigate
        reportStep('브라우저 시작')
        throwIfAbortRequested(signal, 'Launch Browser')

        const { browser: launched, runtime } = await launchBrowser(headless)
        browser = launched
        console.log(`[LogenShipping] Browser launched with runtime: ${runtime}`)

        const context = await browser.newContext({
            viewport: { width: 1280, height: 900 },
            locale: 'ko-KR',
        })
        const page = await context.newPage()
        page.setDefaultTimeout(DEFAULT_TIMEOUT_MS)
        page.setDefaultNavigationTimeout(LONG_TIMEOUT_MS)

        // Handle dialog popups automatically
        page.on('dialog', async (dialog: unknown) => {
            try {
                await (dialog as { accept: () => Promise<void> }).accept()
            } catch {
                // Ignore dialog errors
            }
        })

        reportStep('로젠 사이트 접속')
        await page.goto(LOGEN_LOGIN_URL, { waitUntil: 'networkidle' })
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(1000)

        // Step 2: Login
        throwIfAbortRequested(signal, 'Login')
        reportStep('로그인')

        await typeFirstVisible(
            page,
            [
                'input[name="login_id"]',
                'input[name="userId"]',
                'input[name="id"]',
                'input[type="text"][id*="id"]',
                'input[type="text"]',
            ],
            loginId,
            'Login - Username'
        )

        await typeFirstVisible(
            page,
            [
                'input[name="login_pw"]',
                'input[name="userPw"]',
                'input[name="password"]',
                'input[type="password"]',
            ],
            loginPassword,
            'Login - Password'
        )

        await clickFirstVisible(
            page,
            [
                'button:has-text("로그인")',
                'input[type="submit"][value*="로그인"]',
                'a:has-text("로그인")',
                'button[type="submit"]',
                '.login_btn',
                '#loginBtn',
            ],
            'Login - Submit'
        )

        await page.waitForTimeout(2000)
        await page.waitForLoadState('networkidle')

        // Step 3: Close any popup/modal that might appear after login
        throwIfAbortRequested(signal, 'Close Popup')
        reportStep('팝업 닫기')

        try {
            const closeButtons = [
                'button:has-text("닫기")',
                '.modal button:has-text("닫기")',
                '.popup button:has-text("닫기")',
                'button:has-text("확인")',
                '.modal .close',
                'button.close',
                '[class*="close"]:has-text("닫기")',
            ]
            for (const selector of closeButtons) {
                try {
                    const btn = page.locator(selector).first()
                    const visible = await btn.isVisible().catch(() => false)
                    if (visible) {
                        await btn.click({ timeout: 3000 })
                        await page.waitForTimeout(500)
                    }
                } catch {
                    // Popup might not exist, continue
                }
            }
        } catch {
            // No popup to close
        }

        await page.waitForTimeout(500)

        // Step 4: Navigate to 예약관리 > 주문등록/출력(단건)
        throwIfAbortRequested(signal, 'Navigate Menu')
        reportStep('메뉴 이동: 예약관리 > 주문등록/출력(단건)')

        await clickFirstVisible(
            page,
            [
                'a:has-text("예약관리")',
                'span:has-text("예약관리")',
                'li:has-text("예약관리") > a',
                '[class*="menu"]:has-text("예약관리")',
            ],
            'Navigate - 예약관리 Menu'
        )

        await page.waitForTimeout(1000)

        await clickFirstVisible(
            page,
            [
                'a:has-text("주문등록/출력(단건)")',
                'span:has-text("주문등록/출력(단건)")',
                'a:has-text("주문등록")',
                'li:has-text("주문등록/출력") a',
                '[class*="sub"] a:has-text("주문등록")',
            ],
            'Navigate - 주문등록/출력(단건) Submenu'
        )

        await page.waitForTimeout(2000)
        await page.waitForLoadState('networkidle')

        // Step 5: Fill sender info
        throwIfAbortRequested(signal, 'Fill Sender Info')
        reportStep('보내는 분 정보 입력')

        try {
            await fillFirstVisible(
                page,
                [
                    'input[name*="send"][name*="tel"]',
                    'input[name*="send"][name*="phone"]',
                    'input[name*="s_tel"]',
                    'input[name*="snd_tel"]',
                ],
                senderPhone,
                'Sender Phone',
                15000
            )
        } catch {
            console.log('[LogenShipping] Sender phone field not found or pre-filled, skipping')
        }

        try {
            await fillFirstVisible(
                page,
                [
                    'input[name*="send"][name*="nm"]',
                    'input[name*="send"][name*="name"]',
                    'input[name*="s_nm"]',
                    'input[name*="snd_nm"]',
                ],
                senderName,
                'Sender Name',
                15000
            )
        } catch {
            console.log('[LogenShipping] Sender name field not found or pre-filled, skipping')
        }

        // Step 6: Fill recipient info
        throwIfAbortRequested(signal, 'Fill Recipient Info')
        reportStep('받으시는 분 정보 입력')

        await fillFirstVisible(
            page,
            [
                'input[name*="rec"][name*="tel"]',
                'input[name*="rec"][name*="phone"]',
                'input[name*="r_tel"]',
                'input[name*="rcv_tel"]',
                'input[name*="recv"][name*="tel"]',
            ],
            recipientPhone,
            'Recipient Phone'
        )

        await fillFirstVisible(
            page,
            [
                'input[name*="rec"][name*="nm"]',
                'input[name*="rec"][name*="name"]',
                'input[name*="r_nm"]',
                'input[name*="rcv_nm"]',
                'input[name*="recv"][name*="nm"]',
            ],
            recipientName,
            'Recipient Name'
        )

        // Step 7: Address search
        throwIfAbortRequested(signal, 'Address Search')
        reportStep('주소 검색')

        // Click the address search button (magnifying glass icon or search button in recipient section)
        await clickFirstVisible(
            page,
            [
                'button:has-text("주소")',
                'a:has-text("주소")',
                'button[onclick*="addr"]',
                'a[onclick*="addr"]',
                'img[src*="search"]',
                'button[onclick*="zip"]',
                'a[onclick*="zip"]',
                'input[type="button"][value*="주소"]',
                'input[type="button"][value*="검색"]',
                'button:has-text("검색")',
                '.btn_search',
                '[class*="addr"] button',
                'button[title*="주소"]',
            ],
            'Address Search - Open Dialog'
        )

        await page.waitForTimeout(2000)

        // Handle address search in popup or same page
        // The LOGEN site may open a popup window or inline dialog
        try {
            // Try to fill the address search input in a dialog/popup
            await fillFirstVisible(
                page,
                [
                    '.modal input[type="text"]',
                    '#keyword',
                    'input[name="keyword"]',
                    'input[name="searchAddr"]',
                    'input[name="addr"]',
                    'input[name="newAddr"]',
                    'input[placeholder*="주소"]',
                    'input[placeholder*="도로명"]',
                    '.popup input[type="text"]',
                    '[class*="addr"] input[type="text"]',
                    'input[id*="addr"]',
                    'input[name*="query"]',
                ],
                recipientAddress,
                'Address Search - Fill Address',
                15000
            )

            // Click search button in the dialog
            await clickFirstVisible(
                page,
                [
                    '.modal button:has-text("검색")',
                    '.popup button:has-text("검색")',
                    'button:has-text("검색")',
                    'input[type="button"][value="검색"]',
                    'a:has-text("검색")',
                    '#searchBtn',
                    '[class*="addr"] button:has-text("검색")',
                ],
                'Address Search - Click Search'
            )

            await page.waitForTimeout(2000)

            // Double-click the first result
            try {
                const resultSelectors = [
                    '.modal table tbody tr',
                    '.popup table tbody tr',
                    'table tbody tr',
                    '.search_result tr',
                    '[class*="result"] tr',
                    '.list_area tr',
                    'ul.list li',
                ]
                let clicked = false
                for (const selector of resultSelectors) {
                    try {
                        const row = page.locator(selector).first()
                        const visible = await row.isVisible().catch(() => false)
                        if (visible) {
                            await row.dblclick({ timeout: 5000 })
                            clicked = true
                            break
                        }
                    } catch {
                        // Try next
                    }
                }
                if (!clicked) {
                    // Fallback: try clicking the first result
                    await clickFirstVisible(
                        page,
                        resultSelectors,
                        'Address Search - Select Result'
                    )
                }
            } catch {
                console.log('[LogenShipping] Could not double-click address result, trying single click')
            }

            await page.waitForTimeout(1500)

            // Fill detail address if there is a detail address input
            if (recipientDetailAddress) {
                try {
                    await fillFirstVisible(
                        page,
                        [
                            'input[name*="detail"]',
                            'input[name*="addr2"]',
                            'input[name*="addrDetail"]',
                            'input[placeholder*="상세"]',
                            'input[placeholder*="나머지"]',
                            '.modal input[name*="detail"]',
                            '#detailAddr',
                        ],
                        recipientDetailAddress,
                        'Address Search - Detail Address',
                        10000
                    )
                } catch {
                    console.log('[LogenShipping] Detail address input not found, may not be required')
                }
            }

            // Close the address dialog
            try {
                await clickFirstVisible(
                    page,
                    [
                        '.modal button:has-text("확인")',
                        '.popup button:has-text("확인")',
                        'button:has-text("확인")',
                        'input[type="button"][value="확인"]',
                        '.modal button:has-text("적용")',
                    ],
                    'Address Search - Confirm',
                    10000
                )
            } catch {
                console.log('[LogenShipping] Address confirm button not found, dialog may have auto-closed')
            }
        } catch (error) {
            console.log(`[LogenShipping] Address search dialog handling: ${getErrorMessage(error)}`)
        }

        await page.waitForTimeout(1500)

        // Step 8: Save the order (F5 key)
        throwIfAbortRequested(signal, 'Save Order')
        reportStep('주문 저장 (F5)')

        await page.keyboard.press('F5')
        await page.waitForTimeout(3000)
        await page.waitForLoadState('networkidle')

        // Handle any confirmation dialog that appears after F5
        try {
            await clickFirstVisible(
                page,
                [
                    'button:has-text("예")',
                    'button:has-text("확인")',
                    'button:has-text("Yes")',
                    'input[type="button"][value="예"]',
                    'input[type="button"][value="확인"]',
                ],
                'Save Order - Confirm',
                5000
            )
            await page.waitForTimeout(2000)
        } catch {
            // No confirmation dialog
        }

        // Step 9: Print shipping label - click 미출력 tab
        throwIfAbortRequested(signal, 'Print Label')
        reportStep('운송장 출력 준비')

        try {
            await clickFirstVisible(
                page,
                [
                    'a:has-text("미출력")',
                    'span:has-text("미출력")',
                    'li:has-text("미출력")',
                    '[class*="tab"]:has-text("미출력")',
                    'button:has-text("미출력")',
                ],
                'Print - 미출력 Tab',
                10000
            )
            await page.waitForTimeout(1500)
        } catch {
            console.log('[LogenShipping] 미출력 tab not found or already selected')
        }

        // Check the checkbox for the newly created order
        await clickFirstVisible(
            page,
            [
                'table tbody tr:first-child input[type="checkbox"]',
                'table tbody tr:last-child input[type="checkbox"]',
                'input[type="checkbox"][name*="chk"]',
                'input[type="checkbox"][name*="select"]',
                'table input[type="checkbox"]',
            ],
            'Print - Select Order Checkbox'
        )

        await page.waitForTimeout(500)

        // Click 운송장출력 button
        reportStep('운송장 출력')
        await clickFirstVisible(
            page,
            [
                'button:has-text("운송장출력")',
                'a:has-text("운송장출력")',
                'input[type="button"][value*="운송장출력"]',
                'button:has-text("운송장 출력")',
                'a:has-text("운송장 출력")',
            ],
            'Print - 운송장출력 Button'
        )

        await page.waitForTimeout(2000)

        // Step 10: In the 운송장 발행 popup, click 운송장출력 button
        throwIfAbortRequested(signal, 'Print Confirmation')
        reportStep('운송장 발행 확인')

        try {
            await clickFirstVisible(
                page,
                [
                    '.modal button:has-text("운송장출력")',
                    '.popup button:has-text("운송장출력")',
                    '.modal button:has-text("운송장 출력")',
                    'button:has-text("출력")',
                    'input[type="button"][value*="출력"]',
                ],
                'Print Popup - 운송장출력',
                15000
            )
        } catch {
            console.log('[LogenShipping] Print popup button not found, may have auto-proceeded')
        }

        await page.waitForTimeout(2000)

        // Step 11: Confirmation dialog - Click 예 (Yes) on "출력하시겠습니까?"
        try {
            await clickFirstVisible(
                page,
                [
                    'button:has-text("예")',
                    'button:has-text("Yes")',
                    'input[type="button"][value="예"]',
                    'button:has-text("확인")',
                ],
                'Print Confirm - Yes',
                10000
            )
        } catch {
            console.log('[LogenShipping] Print confirmation dialog not found')
        }

        await page.waitForTimeout(3000)
        await page.waitForLoadState('networkidle')

        // Step 12: Extract tracking number
        throwIfAbortRequested(signal, 'Extract Tracking Number')
        reportStep('송장번호 추출')

        let trackingNumber = ''

        // Try to extract tracking number from the page content
        const pageContent = await page.content()

        // Pattern: Korean tracking numbers like 441-1512-9866 or 44115129866
        const trackingPatterns = [
            /송장번호[:\s]*(\d{3}-\d{4}-\d{4})/,
            /송장번호[:\s]*(\d{10,12})/,
            /운송장[번호]*[:\s]*(\d{3}-\d{4}-\d{4})/,
            /운송장[번호]*[:\s]*(\d{10,12})/,
            /(\d{3}-\d{4}-\d{4})/,
        ]

        for (const pattern of trackingPatterns) {
            const match = pageContent.match(pattern)
            if (match && match[1]) {
                trackingNumber = match[1]
                break
            }
        }

        // Also try reading from specific elements
        if (!trackingNumber) {
            const trackingSelectors = [
                'td:has-text("송장번호") + td',
                'th:has-text("송장번호") + td',
                '[class*="invoice"]',
                '[class*="tracking"]',
                'td:has-text("운송장") + td',
            ]

            for (const selector of trackingSelectors) {
                try {
                    const el = page.locator(selector).first()
                    const visible = await el.isVisible().catch(() => false)
                    if (visible) {
                        const text = await el.textContent()
                        if (text) {
                            const match = text.match(/(\d{3}-\d{4}-\d{4})/) || text.match(/(\d{10,12})/)
                            if (match && match[1]) {
                                trackingNumber = match[1]
                                break
                            }
                        }
                    }
                } catch {
                    // Try next selector
                }
            }
        }

        if (!trackingNumber) {
            // Last resort: try to find any tracking-number-like pattern in the page
            const allTextMatch = pageContent.match(/\d{3}-\d{4}-\d{4}/)
            if (allTextMatch) {
                trackingNumber = allTextMatch[0]
            }
        }

        if (!trackingNumber) {
            throw new LogenAutomationError(
                'Extract Tracking Number',
                'Could not extract tracking number from the page after printing the shipping label.'
            )
        }

        reportStep(`완료 - 송장번호: ${trackingNumber}`)
        console.log(`[LogenShipping] Tracking number extracted: ${trackingNumber}`)

        return { trackingNumber }
    } catch (error) {
        if (error instanceof LogenAutomationError) {
            throw error
        }

        const detail = getErrorMessage(error)
        throw new LogenAutomationError('Unknown', `Unexpected error during Logen shipping automation: ${detail}`)
    } finally {
        if (browser) {
            try {
                await browser.close()
            } catch {
                // Ignore browser close errors
            }
        }
    }
}
