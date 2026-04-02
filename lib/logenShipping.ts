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

        // LOGEN uses id="user.id" and id="user.pw" (dots in IDs)
        await fillFirstVisible(
            page,
            [
                '[id="user.id"]',
                'input#user\\.id',
                'input.fText[placeholder="사용자 ID"]',
            ],
            loginId,
            'Login - Username'
        )

        await fillFirstVisible(
            page,
            [
                '[id="user.pw"]',
                'input#user\\.pw',
                'input.fText[placeholder="Password"]',
                'input[type="password"]',
            ],
            loginPassword,
            'Login - Password'
        )

        await clickFirstVisible(
            page,
            [
                'a[onclick="basicLogin()"]',
                'a:has-text("로그인")',
                'button:has-text("로그인")',
            ],
            'Login - Submit'
        )

        await page.waitForTimeout(2000)
        await page.waitForLoadState('networkidle')

        // Step 3: Close any popup/modal that might appear after login (유통판매채널 등)
        throwIfAbortRequested(signal, 'Close Popup')
        reportStep('팝업 닫기')

        // LOGEN shows a 유통판매채널 popup or notice after login. Try closing all visible modals.
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const closeSelectors = [
                    'button:has-text("닫기")',
                    'input[type="button"][value="닫기"]',
                    'a:has-text("닫기")',
                    '.popup-close',
                    'button.close',
                    '.btn-close',
                ]
                for (const selector of closeSelectors) {
                    try {
                        const btn = page.locator(selector).first()
                        const visible = await btn.isVisible().catch(() => false)
                        if (visible) {
                            await btn.click({ timeout: 3000 })
                            await page.waitForTimeout(800)
                        }
                    } catch {
                        // Popup button not found, continue
                    }
                }
            } catch {
                // No popup
            }
            await page.waitForTimeout(500)
        }

        // Step 4: Navigate to 예약관리 > 주문등록/출력(단건)
        throwIfAbortRequested(signal, 'Navigate Menu')
        reportStep('메뉴 이동: 예약관리 > 주문등록/출력(단건)')

        // LOGEN sidebar uses dynamic menu - click parent first to expand, then submenu
        await clickFirstVisible(
            page,
            [
                'a:has-text("예약관리")',
                'span:has-text("예약관리")',
                'li:has-text("예약관리") > a',
                'li:has-text("예약관리")',
            ],
            'Navigate - 예약관리 Menu'
        )

        await page.waitForTimeout(1500)

        await clickFirstVisible(
            page,
            [
                'a:has-text("주문등록/출력(단건)")',
                'span:has-text("주문등록/출력(단건)")',
                'a:has-text("주문등록/출력(단건")',
                'li a:has-text("주문등록")',
            ],
            'Navigate - 주문등록/출력(단건) Submenu'
        )

        await page.waitForTimeout(3000)
        await page.waitForLoadState('networkidle')

        // Step 5: Fill recipient info (수하인 / 받으시는 분)
        // LOGEN form fields are inside the main content area (may be iframe-based)
        throwIfAbortRequested(signal, 'Fill Recipient Info')
        reportStep('수하인(받으시는 분) 정보 입력')

        // Fill recipient phone - 전화번호 in 수하인 section
        await fillFirstVisible(
            page,
            [
                'input[name*="rcvTelNo"]',
                'input[name*="rcv_tel"]',
                'input[name*="recv"][name*="tel"]',
                'input[name*="rec"][name*="tel"]',
                'input[name*="r_tel"]',
            ],
            recipientPhone,
            'Recipient Phone'
        )

        // Fill recipient name - 수하인명
        await fillFirstVisible(
            page,
            [
                'input[name*="rcvNm"]',
                'input[name*="rcv_nm"]',
                'input[name*="recv"][name*="nm"]',
                'input[name*="rec"][name*="nm"]',
                'input[name*="r_nm"]',
            ],
            recipientName,
            'Recipient Name'
        )

        // Step 6: Address search - click magnifying glass below phone field
        throwIfAbortRequested(signal, 'Address Search')
        reportStep('주소 검색')

        // Click the address search button (돋보기 icon under 전화번호 in 수하인 section)
        await clickFirstVisible(
            page,
            [
                'img[src*="search"][alt*="주소"]',
                'button[onclick*="addr"]',
                'a[onclick*="addr"]',
                'img[src*="search"]',
                'button[onclick*="zip"]',
                'a[onclick*="zip"]',
                'button[title*="주소"]',
                'a[title*="주소"]',
                'img[alt*="검색"]',
            ],
            'Address Search - Open Dialog'
        )

        await page.waitForTimeout(2500)

        // The address search popup (주소 검색(입력)) opens as a modal dialog
        // Fill address in the popup input
        await fillFirstVisible(
            page,
            [
                'input[placeholder*="주소를 입력"]',
                'input[placeholder*="주소"]',
                'input[placeholder*="도로명"]',
                '#keyword',
                'input[name="keyword"]',
                'input[name="searchAddr"]',
                'input[name="newAddr"]',
            ],
            recipientAddress,
            'Address Search - Fill Address',
            15000
        )

        // Click 검색 button in the popup
        await clickFirstVisible(
            page,
            [
                'button:has-text("검색")',
                'input[type="button"][value="검색"]',
                'a:has-text("검색")',
                '#searchBtn',
            ],
            'Address Search - Click Search'
        )

        await page.waitForTimeout(2500)

        // Double-click the first search result row
        try {
            const resultSelectors = [
                'table tbody tr:first-child td',
                'table tbody tr td',
                '.search-result tr:first-child',
                'ul.list li:first-child',
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
                console.log('[LogenShipping] Could not double-click search result, trying single click')
                await clickFirstVisible(page, resultSelectors, 'Address Search - Select Result')
            }
        } catch (error) {
            console.log(`[LogenShipping] Address result selection: ${getErrorMessage(error)}`)
        }

        await page.waitForTimeout(2000)

        // Fill detail address if prompted
        if (recipientDetailAddress) {
            try {
                await fillFirstVisible(
                    page,
                    [
                        'input[name*="detail"]',
                        'input[name*="addr2"]',
                        'input[placeholder*="상세"]',
                        'input[placeholder*="나머지"]',
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

        // Close the address popup by clicking 확인
        try {
            await clickFirstVisible(
                page,
                [
                    'button:has-text("확인")',
                    'input[type="button"][value="확인"]',
                    'a:has-text("확인")',
                ],
                'Address Search - Confirm',
                10000
            )
        } catch {
            console.log('[LogenShipping] Address confirm auto-closed')
        }

        await page.waitForTimeout(2000)

        // Step 7: Save the order - click 저장(F5) button or press F5
        throwIfAbortRequested(signal, 'Save Order')
        reportStep('주문 저장')

        // Try clicking the 저장 button first (more reliable than F5 key)
        try {
            await clickFirstVisible(
                page,
                [
                    'button:has-text("저장")',
                    'a:has-text("저장(F5)")',
                    'a:has-text("저장")',
                    'input[type="button"][value*="저장"]',
                    'span:has-text("저장(F5)")',
                ],
                'Save Order - Button',
                10000
            )
        } catch {
            // Fallback: press F5 key
            console.log('[LogenShipping] Save button not found, pressing F5')
            await page.keyboard.press('F5')
        }

        await page.waitForTimeout(3000)
        await page.waitForLoadState('networkidle')

        // Handle confirmation dialog after save
        try {
            await clickFirstVisible(
                page,
                [
                    'button:has-text("예")',
                    'button:has-text("확인")',
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

        // Step 8: Click 미출력 tab and select the order
        throwIfAbortRequested(signal, 'Print Label')
        reportStep('운송장 출력 준비')

        try {
            await clickFirstVisible(
                page,
                [
                    'a:has-text("미출력")',
                    'span:has-text("미출력")',
                    'li:has-text("미출력")',
                    'button:has-text("미출력")',
                ],
                'Print - 미출력 Tab',
                10000
            )
            await page.waitForTimeout(2000)
        } catch {
            console.log('[LogenShipping] 미출력 tab already selected or not found')
        }

        // Check the checkbox for the order row
        await clickFirstVisible(
            page,
            [
                'table tbody tr input[type="checkbox"]',
                'input[type="checkbox"][name*="chk"]',
                'input[type="checkbox"][name*="select"]',
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
                'span:has-text("운송장출력")',
                'input[type="button"][value*="운송장출력"]',
                'button:has-text("운송장 출력")',
            ],
            'Print - 운송장출력 Button'
        )

        await page.waitForTimeout(3000)

        // Step 9: In 운송장 발행 popup, click 운송장출력 button
        throwIfAbortRequested(signal, 'Print Confirmation')
        reportStep('운송장 발행 팝업에서 출력')

        try {
            // The 운송장 발행 popup has its own 운송장출력 button at the bottom
            await clickFirstVisible(
                page,
                [
                    'button:has-text("운송장출력")',
                    'a:has-text("운송장출력")',
                    'input[type="button"][value*="운송장출력"]',
                    'button:has-text("운송장 출력")',
                    'span:has-text("운송장출력")',
                ],
                'Print Popup - 운송장출력',
                15000
            )
        } catch {
            console.log('[LogenShipping] Print popup button not found')
        }

        await page.waitForTimeout(2000)

        // Step 10: Confirmation dialog "출력하시겠습니까?" - Click 예
        try {
            await clickFirstVisible(
                page,
                [
                    'button:has-text("예")',
                    'input[type="button"][value="예"]',
                    'button:has-text("확인")',
                ],
                'Print Confirm - 예',
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
