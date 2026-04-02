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

type FrameLike = {
    url: () => string
    locator: (selector: string) => LocatorLike
    getByText: (text: string | RegExp, options?: Record<string, unknown>) => LocatorLike
    waitForLoadState: (state?: string, options?: Record<string, unknown>) => Promise<void>
    waitForTimeout: (ms: number) => Promise<void>
    content: () => Promise<string>
    evaluate: (fn: string | ((...args: unknown[]) => unknown), ...args: unknown[]) => Promise<unknown>
}

type PageLike = FrameLike & {
    goto: (url: string, options?: Record<string, unknown>) => Promise<void>
    setDefaultTimeout: (timeout: number) => void
    setDefaultNavigationTimeout: (timeout: number) => void
    waitForURL: (url: string | RegExp, options?: Record<string, unknown>) => Promise<void>
    keyboard: { press: (key: string) => Promise<void> }
    waitForEvent: (event: string, options?: Record<string, unknown>) => Promise<unknown>
    on: (event: string, handler: (...args: unknown[]) => void) => void
    frames: () => FrameLike[]
    frame: (options: { url?: string | RegExp; name?: string }) => FrameLike | null
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

/** Find the active content frame in LOGEN's iframe-based layout. Falls back to main page. */
const getContentFrame = (page: PageLike): FrameLike => {
    const frames = page.frames()
    // LOGEN loads content in iframes - look for the one that's NOT the main frame
    for (const frame of frames) {
        const url = frame.url()
        // Skip about:blank and the main login page
        if (url === 'about:blank' || url === LOGEN_LOGIN_URL) continue
        // Look for LOGEN's content frames (reservation pages, etc.)
        if (url.includes('ilogen.com') && !url.endsWith('/')) {
            return frame
        }
    }
    return page
}

const clickFirstVisible = async (
    ctx: FrameLike,
    selectors: string[],
    step: string,
    timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<void> => {
    for (const selector of selectors) {
        try {
            const target = ctx.locator(selector).first()
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

    throw new LogenAutomationError(step, `Could not find a clickable element for step: ${step}`)
}

const fillFirstVisible = async (
    ctx: FrameLike,
    selectors: string[],
    value: string,
    step: string,
    timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<void> => {
    for (const selector of selectors) {
        try {
            const target = ctx.locator(selector).first()
            await target.waitFor({ state: 'visible', timeout: Math.min(timeoutMs, 9000) })
            await target.click({ timeout: 5000 })
            await target.fill(value)
            return
        } catch {
            // Try next selector.
        }
    }

    throw new LogenAutomationError(step, `Could not find a fillable input for step: ${step}`)
}

/** Safe wait - use domcontentloaded instead of networkidle to avoid timeout on sites with persistent connections */
const safeWaitForLoad = async (ctx: FrameLike, timeoutMs = 10000) => {
    try {
        await ctx.waitForLoadState('domcontentloaded', { timeout: timeoutMs })
    } catch {
        // Ignore load state timeout - page may already be loaded
    }
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

        // Handle dialog popups automatically (alert/confirm)
        page.on('dialog', async (dialog: unknown) => {
            try {
                await (dialog as { accept: () => Promise<void> }).accept()
            } catch {
                // Ignore dialog errors
            }
        })

        reportStep('로젠 사이트 접속')
        await page.goto(LOGEN_LOGIN_URL, { waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(2000)

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

        await page.waitForTimeout(3000)
        await safeWaitForLoad(page)

        // Step 3: Close any popup/modal that might appear after login (유통판매채널 등)
        throwIfAbortRequested(signal, 'Close Popup')
        reportStep('팝업 닫기')

        for (let attempt = 0; attempt < 3; attempt++) {
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
            // Also check inside frames for popups
            for (const frame of page.frames()) {
                for (const selector of closeSelectors) {
                    try {
                        const btn = frame.locator(selector).first()
                        const visible = await btn.isVisible().catch(() => false)
                        if (visible) {
                            await btn.click({ timeout: 3000 })
                            await page.waitForTimeout(500)
                        }
                    } catch {
                        // continue
                    }
                }
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
            ],
            'Navigate - 예약관리 Menu'
        )

        await page.waitForTimeout(2000)

        await clickFirstVisible(
            page,
            [
                'a:has-text("주문등록/출력(단건)")',
                'span:has-text("주문등록/출력(단건)")',
                'li a:has-text("주문등록")',
            ],
            'Navigate - 주문등록/출력(단건) Submenu'
        )

        await page.waitForTimeout(4000)

        // Step 5: Find the content frame where the form is loaded
        // LOGEN loads the order form in an iframe after menu click
        throwIfAbortRequested(signal, 'Fill Recipient Info')
        reportStep('수하인(받으시는 분) 정보 입력')

        // Log available frames for debugging
        const allFrames = page.frames()
        console.log(`[LogenShipping] Found ${allFrames.length} frames:`)
        for (const f of allFrames) {
            console.log(`  - ${f.url()}`)
        }

        const contentFrame = getContentFrame(page)
        const isFrame = contentFrame !== page
        console.log(`[LogenShipping] Using ${isFrame ? 'iframe' : 'main page'} for form interaction`)

        // Wait for form to be ready
        await contentFrame.waitForTimeout(1000)

        // Fill recipient phone - 전화번호 in 수하인 section
        await fillFirstVisible(
            contentFrame,
            [
                'input[name*="rcvTelNo"]',
                'input[name*="rcv_tel"]',
                'input[name*="recv"][name*="tel"]',
                'input[name*="rcvHpNo"]',
                'input[name*="rcv_hp"]',
            ],
            recipientPhone,
            'Recipient Phone'
        )

        // Fill recipient name - 수하인명
        await fillFirstVisible(
            contentFrame,
            [
                'input[name*="rcvNm"]',
                'input[name*="rcv_nm"]',
                'input[name*="recv"][name*="nm"]',
                'input[name*="rcvName"]',
            ],
            recipientName,
            'Recipient Name'
        )

        // Step 6: Address search - click magnifying glass
        throwIfAbortRequested(signal, 'Address Search')
        reportStep('주소 검색')

        await clickFirstVisible(
            contentFrame,
            [
                'img[src*="search"]',
                'button[onclick*="addr"]',
                'a[onclick*="addr"]',
                'button[onclick*="zip"]',
                'a[onclick*="zip"]',
                'button[title*="주소"]',
                'a[title*="주소"]',
                'img[alt*="검색"]',
                'img[alt*="주소"]',
            ],
            'Address Search - Open Dialog'
        )

        await page.waitForTimeout(3000)

        // Address search popup may open in a new frame or as a layer
        // Check all frames for the address search input
        let addrCtx: FrameLike = contentFrame
        const addrInputSelectors = [
            'input[name="keyword"]',
            'input[name="searchAddr"]',
            'input[name="newAddr"]',
            'input[placeholder*="주소"]',
            'input[placeholder*="도로명"]',
            '#keyword',
        ]

        // Search in all frames for the address popup
        for (const frame of page.frames()) {
            for (const sel of addrInputSelectors) {
                try {
                    const el = frame.locator(sel).first()
                    const visible = await el.isVisible().catch(() => false)
                    if (visible) {
                        addrCtx = frame
                        break
                    }
                } catch { /* continue */ }
            }
            if (addrCtx !== contentFrame) break
        }
        // Also check the main page
        if (addrCtx === contentFrame) {
            for (const sel of addrInputSelectors) {
                try {
                    const el = page.locator(sel).first()
                    const visible = await el.isVisible().catch(() => false)
                    if (visible) {
                        addrCtx = page
                        break
                    }
                } catch { /* continue */ }
            }
        }

        console.log(`[LogenShipping] Address popup context: ${addrCtx === page ? 'main page' : addrCtx === contentFrame ? 'content frame' : 'popup frame'}`)

        await fillFirstVisible(
            addrCtx,
            addrInputSelectors,
            recipientAddress,
            'Address Search - Fill Address',
            15000
        )

        // Click 검색 button in the popup
        await clickFirstVisible(
            addrCtx,
            [
                'button:has-text("검색")',
                'input[type="button"][value="검색"]',
                'a:has-text("검색")',
                '#searchBtn',
            ],
            'Address Search - Click Search'
        )

        await page.waitForTimeout(3000)

        // Double-click the first search result row
        const resultSelectors = [
            'table tbody tr:first-child td',
            'table tbody tr td',
            '.search-result tr:first-child',
            'ul.list li:first-child',
        ]

        let resultClicked = false
        // Try in the address context first
        for (const selector of resultSelectors) {
            try {
                const row = addrCtx.locator(selector).first()
                const visible = await row.isVisible().catch(() => false)
                if (visible) {
                    await row.dblclick({ timeout: 5000 })
                    resultClicked = true
                    break
                }
            } catch { /* next */ }
        }
        if (!resultClicked) {
            console.log('[LogenShipping] Could not double-click search result, trying single click')
            try {
                await clickFirstVisible(addrCtx, resultSelectors, 'Address Search - Select Result')
            } catch (err) {
                console.log(`[LogenShipping] Address result click failed: ${getErrorMessage(err)}`)
            }
        }

        await page.waitForTimeout(2000)

        // Fill detail address if prompted
        if (recipientDetailAddress) {
            const detailSelectors = [
                'input[name*="detail"]',
                'input[name*="addr2"]',
                'input[placeholder*="상세"]',
                'input[placeholder*="나머지"]',
                '#detailAddr',
            ]
            // Try in all frames
            let detailFilled = false
            for (const frame of page.frames()) {
                try {
                    await fillFirstVisible(frame, detailSelectors, recipientDetailAddress, 'Detail Address', 5000)
                    detailFilled = true
                    break
                } catch { /* next frame */ }
            }
            if (!detailFilled) {
                try {
                    await fillFirstVisible(addrCtx, detailSelectors, recipientDetailAddress, 'Detail Address', 5000)
                } catch {
                    console.log('[LogenShipping] Detail address input not found, may not be required')
                }
            }
        }

        // Close the address popup by clicking 확인
        try {
            // Try in address context first, then all frames
            await clickFirstVisible(
                addrCtx,
                [
                    'button:has-text("확인")',
                    'input[type="button"][value="확인"]',
                    'a:has-text("확인")',
                ],
                'Address Search - Confirm',
                8000
            )
        } catch {
            console.log('[LogenShipping] Address confirm auto-closed or not found')
        }

        await page.waitForTimeout(2000)

        // Step 7: Save the order - click 저장(F5) button
        throwIfAbortRequested(signal, 'Save Order')
        reportStep('주문 저장')

        // Re-get content frame in case it changed
        const saveFrame = getContentFrame(page)

        try {
            await clickFirstVisible(
                saveFrame,
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
            // Also try the main page
            try {
                await clickFirstVisible(
                    page,
                    [
                        'button:has-text("저장")',
                        'a:has-text("저장(F5)")',
                        'a:has-text("저장")',
                    ],
                    'Save Order - Button (main)',
                    5000
                )
            } catch {
                // Fallback: press F5 key
                console.log('[LogenShipping] Save button not found, pressing F5')
                await page.keyboard.press('F5')
            }
        }

        await page.waitForTimeout(4000)

        // Handle confirmation dialog after save (note: dialog handler already accepts automatically)
        // But also check for HTML-based confirm buttons
        try {
            for (const frame of page.frames()) {
                try {
                    await clickFirstVisible(
                        frame,
                        [
                            'button:has-text("예")',
                            'button:has-text("확인")',
                            'input[type="button"][value="예"]',
                        ],
                        'Save Confirm',
                        3000
                    )
                    break
                } catch { /* next frame */ }
            }
        } catch {
            // No confirmation dialog
        }

        await page.waitForTimeout(2000)

        // Step 8: Click 미출력 tab and select the order
        throwIfAbortRequested(signal, 'Print Label')
        reportStep('운송장 출력 준비')

        const printFrame = getContentFrame(page)

        try {
            await clickFirstVisible(
                printFrame,
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
            // Also try main page
            try {
                await clickFirstVisible(page, ['a:has-text("미출력")'], 'Print - 미출력 Tab (main)', 5000)
                await page.waitForTimeout(2000)
            } catch {
                console.log('[LogenShipping] 미출력 tab already selected or not found')
            }
        }

        // Check the checkbox for the order row - search in all frames
        let checkboxClicked = false
        const checkboxSelectors = [
            'table tbody tr input[type="checkbox"]',
            'input[type="checkbox"][name*="chk"]',
            'input[type="checkbox"][name*="select"]',
        ]
        for (const frame of page.frames()) {
            try {
                await clickFirstVisible(frame, checkboxSelectors, 'Checkbox', 5000)
                checkboxClicked = true
                break
            } catch { /* next frame */ }
        }
        if (!checkboxClicked) {
            await clickFirstVisible(printFrame, checkboxSelectors, 'Print - Select Order Checkbox')
        }

        await page.waitForTimeout(500)

        // Click 운송장출력 button
        reportStep('운송장 출력')
        const printBtnSelectors = [
            'button:has-text("운송장출력")',
            'a:has-text("운송장출력")',
            'span:has-text("운송장출력")',
            'input[type="button"][value*="운송장출력"]',
            'button:has-text("운송장 출력")',
        ]
        try {
            await clickFirstVisible(printFrame, printBtnSelectors, '운송장출력 Button')
        } catch {
            await clickFirstVisible(page, printBtnSelectors, '운송장출력 Button (main)')
        }

        await page.waitForTimeout(3000)

        // Step 9: In 운송장 발행 popup, click 운송장출력 button
        throwIfAbortRequested(signal, 'Print Confirmation')
        reportStep('운송장 발행 팝업에서 출력')

        try {
            // The popup may appear in a new frame
            for (const frame of page.frames()) {
                try {
                    await clickFirstVisible(frame, printBtnSelectors, 'Print Popup - 운송장출력', 8000)
                    break
                } catch { /* next frame */ }
            }
        } catch {
            console.log('[LogenShipping] Print popup button not found')
        }

        await page.waitForTimeout(2000)

        // Step 10: Confirmation dialog "출력하시겠습니까?" - Click 예
        // (dialog handler auto-accepts, but also check HTML buttons)
        try {
            for (const frame of page.frames()) {
                try {
                    await clickFirstVisible(
                        frame,
                        ['button:has-text("예")', 'input[type="button"][value="예")', 'button:has-text("확인")'],
                        'Print Confirm',
                        5000
                    )
                    break
                } catch { /* next frame */ }
            }
        } catch {
            console.log('[LogenShipping] Print confirmation dialog not found')
        }

        await page.waitForTimeout(3000)
        await safeWaitForLoad(page)

        // Step 11: Extract tracking number
        throwIfAbortRequested(signal, 'Extract Tracking Number')
        reportStep('송장번호 추출')

        let trackingNumber = ''

        // Try to extract tracking number from ALL frames' content
        const allPages = [page as FrameLike, ...page.frames()]
        for (const ctx of allPages) {
            try {
                const content = await ctx.content()
                const trackingPatterns = [
                    /송장번호[:\s]*(\d{3}-\d{4}-\d{4})/,
                    /송장번호[:\s]*(\d{10,12})/,
                    /운송장[번호]*[:\s]*(\d{3}-\d{4}-\d{4})/,
                    /운송장[번호]*[:\s]*(\d{10,12})/,
                    /(\d{3}-\d{4}-\d{4})/,
                ]
                for (const pattern of trackingPatterns) {
                    const match = content.match(pattern)
                    if (match && match[1]) {
                        trackingNumber = match[1]
                        break
                    }
                }
                if (trackingNumber) break
            } catch { /* next frame */ }
        }

        // Also try reading from specific elements across all frames
        if (!trackingNumber) {
            const trackingSelectors = [
                'td:has-text("송장번호") + td',
                'th:has-text("송장번호") + td',
                'td:has-text("운송장") + td',
            ]

            for (const ctx of allPages) {
                for (const selector of trackingSelectors) {
                    try {
                        const el = ctx.locator(selector).first()
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
                    } catch { /* next */ }
                }
                if (trackingNumber) break
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
