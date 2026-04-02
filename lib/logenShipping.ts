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

const formatPhone = (raw: string) => {
    const digits = String(raw ?? '').replace(/\D/g, '')
    if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
    if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
    return String(raw ?? '').trim()
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

/** Get all browsing contexts: main page + all frames */
const getAllContexts = (page: PageLike): FrameLike[] => {
    const frames = page.frames()
    return [page as FrameLike, ...frames.filter(f => f.url() !== 'about:blank')]
}

/** Dump ALL elements (inputs, buttons, links, images) across all frames for debugging */
const dumpAllElements = async (page: PageLike): Promise<string> => {
    const results: string[] = []
    for (const ctx of getAllContexts(page)) {
        try {
            const frameUrl = ctx.url()
            const elements = await ctx.evaluate(() => {
                const els = document.querySelectorAll('input, select, textarea, button, a, img')
                return Array.from(els).map(el => {
                    const h = el as HTMLElement
                    return {
                        tag: el.tagName,
                        type: (el as HTMLInputElement).type || '',
                        name: (el as HTMLInputElement).name || '',
                        id: h.id || '',
                        src: (el as HTMLImageElement).src ? (el as HTMLImageElement).src.slice(-50) : '',
                        alt: (el as HTMLImageElement).alt || '',
                        onclick: h.getAttribute('onclick')?.slice(0, 80) || '',
                        href: (el as HTMLAnchorElement).href ? (el as HTMLAnchorElement).href.slice(-60) : '',
                        text: (h.textContent || '').trim().slice(0, 30),
                        className: (h.className || '').toString().slice(0, 40),
                        visible: h.offsetParent !== null,
                    }
                }).filter(e => e.visible)
            }) as Array<Record<string, unknown>>
            results.push(`Frame[${frameUrl}]: ${elements.length} visible elements`)
            for (const el of elements) {
                const parts = [`<${el.tag}`]
                if (el.type) parts.push(`type="${el.type}"`)
                if (el.name) parts.push(`name="${el.name}"`)
                if (el.id) parts.push(`id="${el.id}"`)
                if (el.src) parts.push(`src="...${el.src}"`)
                if (el.alt) parts.push(`alt="${el.alt}"`)
                if (el.onclick) parts.push(`onclick="${el.onclick}"`)
                if (el.href) parts.push(`href="...${el.href}"`)
                if (el.text) parts.push(`text="${el.text}"`)
                results.push(`  ${parts.join(' ')}>`)
            }
        } catch (e) {
            results.push(`Frame error: ${getErrorMessage(e)}`)
        }
    }
    return results.join('\n')
}

/** Fill input by evaluating JS to find input near a Korean label text */
const fillByLabelText = async (
    page: PageLike,
    labelTexts: string[],
    value: string,
    step: string,
): Promise<boolean> => {
    for (const ctx of getAllContexts(page)) {
        for (const labelText of labelTexts) {
            try {
                const filled = await ctx.evaluate((args: unknown) => {
                    const [text, val] = args as [string, string]
                    // Strategy 1: Find <td>/<th>/<label> containing label text, then find input in same or next row/cell
                    const allElements = document.querySelectorAll('td, th, label, span, div')
                    for (const el of allElements) {
                        if (!el.textContent?.includes(text)) continue
                        // Look in parent row first
                        const row = el.closest('tr')
                        if (row) {
                            const input = row.querySelector('input[type="text"]:not([readonly]), input:not([type]):not([readonly])') as HTMLInputElement
                            if (input && input.offsetParent !== null) {
                                input.focus()
                                input.value = val
                                input.dispatchEvent(new Event('input', { bubbles: true }))
                                input.dispatchEvent(new Event('change', { bubbles: true }))
                                return true
                            }
                        }
                        // Look in parent container
                        const container = el.closest('div, fieldset')
                        if (container) {
                            const input = container.querySelector('input[type="text"]:not([readonly]), input:not([type]):not([readonly])') as HTMLInputElement
                            if (input && input.offsetParent !== null) {
                                input.focus()
                                input.value = val
                                input.dispatchEvent(new Event('input', { bubbles: true }))
                                input.dispatchEvent(new Event('change', { bubbles: true }))
                                return true
                            }
                        }
                        // Look at next sibling
                        const next = el.nextElementSibling
                        if (next) {
                            const input = (next.tagName === 'INPUT' ? next : next.querySelector('input[type="text"], input:not([type])')) as HTMLInputElement
                            if (input && input.offsetParent !== null) {
                                input.focus()
                                input.value = val
                                input.dispatchEvent(new Event('input', { bubbles: true }))
                                input.dispatchEvent(new Event('change', { bubbles: true }))
                                return true
                            }
                        }
                    }
                    return false
                }, [labelText, value])
                if (filled) {
                    console.log(`[LogenShipping] fillByLabelText: filled "${labelText}" via evaluate`)
                    return true
                }
            } catch {
                // Try next frame/label
            }
        }
    }
    return false
}

/** Click by evaluating JS to find clickable element near a label text */
const clickByLabelText = async (
    page: PageLike,
    labelTexts: string[],
    step: string,
): Promise<boolean> => {
    for (const ctx of getAllContexts(page)) {
        for (const labelText of labelTexts) {
            try {
                const clicked = await ctx.evaluate((text: unknown) => {
                    const t = text as string
                    const allElements = document.querySelectorAll('td, th, label, span, div')
                    for (const el of allElements) {
                        if (!el.textContent?.includes(t)) continue
                        // Look in same row for img/button/a
                        const row = el.closest('tr')
                        if (row) {
                            const clickable = row.querySelector('img, button, a[onclick], input[type="button"], input[type="image"]') as HTMLElement
                            if (clickable && clickable.offsetParent !== null) {
                                clickable.click()
                                return true
                            }
                        }
                        // Look in parent container
                        const container = el.closest('div, fieldset, td')
                        if (container) {
                            const clickable = container.querySelector('img, button, a[onclick], input[type="button"], input[type="image"]') as HTMLElement
                            if (clickable && clickable.offsetParent !== null) {
                                clickable.click()
                                return true
                            }
                        }
                    }
                    return false
                }, labelText)
                if (clicked) {
                    console.log(`[LogenShipping] clickByLabelText: clicked near "${labelText}" via evaluate`)
                    return true
                }
            } catch { /* next */ }
        }
    }
    return false
}

/** Click the first visible element matching any selector across ALL frames.
 *  Optionally tries label-based evaluate fallback. */
const clickFirstVisible = async (
    page: PageLike,
    selectors: string[],
    step: string,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    labelFallbacks?: string[],
): Promise<void> => {
    // Strategy 1: evaluate-based click near label (fast)
    if (labelFallbacks) {
        const clicked = await clickByLabelText(page, labelFallbacks, step)
        if (clicked) return
    }

    // Strategy 2: CSS selectors (1.5s each)
    const perSelectorTimeout = Math.min(timeoutMs, 1500)
    const contexts = getAllContexts(page)
    for (const ctx of contexts) {
        for (const selector of selectors) {
            try {
                const target = ctx.locator(selector).first()
                await target.waitFor({ state: 'visible', timeout: perSelectorTimeout })
                const disabled = await target.isDisabled().catch(() => false)
                if (disabled) continue
                await target.click({ timeout: 3000 })
                return
            } catch {
                // Try next selector/frame
            }
        }
    }

    // Dump debug info on failure
    const debugInfo = await dumpAllElements(page)
    console.error(`[LogenShipping] clickFirstVisible FAILED for step: ${step}\n${debugInfo}`)
    throw new LogenAutomationError(step, `Could not find clickable element for: ${step}\n\nDebug:\n${debugInfo}`)
}

/** Fill the first visible input matching any selector across ALL frames.
 *  Strategy order: 1) label-text evaluate (fast), 2) CSS selectors, 3) dump debug */
const fillFirstVisible = async (
    page: PageLike,
    selectors: string[],
    value: string,
    step: string,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    labelFallbacks?: string[],
): Promise<void> => {
    // Strategy 1: Try label-text evaluate FIRST (fastest - one call per frame)
    if (labelFallbacks) {
        const filled = await fillByLabelText(page, labelFallbacks, value, step)
        if (filled) return
    }

    // Strategy 2: Try CSS selectors (1.5s per selector per frame)
    const perSelectorTimeout = Math.min(timeoutMs, 1500)
    const contexts = getAllContexts(page)
    for (const ctx of contexts) {
        for (const selector of selectors) {
            try {
                const target = ctx.locator(selector).first()
                await target.waitFor({ state: 'visible', timeout: perSelectorTimeout })
                await target.click({ timeout: 3000 })
                await target.fill(value)
                return
            } catch {
                // Try next selector/frame
            }
        }
    }

    // Dump debug info on failure
    const debugInfo = await dumpAllElements(page)
    console.error(`[LogenShipping] fillFirstVisible FAILED for step: ${step}\n${debugInfo}`)
    throw new LogenAutomationError(step, `Could not find input for: ${step}\n\nDebug:\n${debugInfo}`)
}

/** Try to check the first row checkbox via IBSheet API, then CSS fallback */
const checkOrderCheckboxInIBSheet = async (page: PageLike, step: string): Promise<void> => {
    // Wait longer for IBSheet grid to populate after save
    await page.waitForTimeout(4000)

    // Pre-step: focus/click first row so print target row is selected
    for (const ctx of getAllContexts(page)) {
        try {
            const focused = await ctx.evaluate(() => {
                const row =
                    document.querySelector('.IBMain tbody tr')
                    ?? document.querySelector('.IBMain table tbody tr')
                    ?? document.querySelector('table tbody tr')
                if (!row) return false
                const cell = (row.querySelector('td') as HTMLElement | null) ?? (row as HTMLElement)
                try {
                    cell.dispatchEvent(new MouseEvent('click', { bubbles: true }))
                    ;(row as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }))
                } catch {
                    // ignore
                }
                return true
            })
            if (focused) {
                console.log('[LogenShipping] checkOrderCheckboxInIBSheet: focused first row')
                break
            }
        } catch {
            // next frame
        }
    }

    // Strategy 1: Strict grid header row ("No." + "전체") checkbox
    for (const ctx of getAllContexts(page)) {
        try {
            const result = await ctx.evaluate(() => {
                const headerRows = Array.from(document.querySelectorAll('tr')).filter((tr) => {
                    const txt = (tr.textContent || '').replace(/\s+/g, ' ').trim()
                    return txt.includes('No.') && txt.includes('전체')
                })
                for (const row of headerRows) {
                    const cb = row.querySelector('input[type="checkbox"]') as HTMLInputElement | null
                    if (!cb) continue
                    cb.click()
                    return 'strict-grid-header-checkbox'
                }
                return null
            })
            if (result) {
                console.log(`[LogenShipping] checkOrderCheckboxInIBSheet: ${result}`)
                return
            }
        } catch { /* next frame */ }
    }

    // Strategy 2: Click "전체" header checkbox by DOM (preferred)
    for (const ctx of getAllContexts(page)) {
        try {
            const result = await ctx.evaluate(() => {
                const clickIfCheckbox = (el: Element | null): boolean => {
                    if (!el) return false
                    if (el instanceof HTMLInputElement && el.type === 'checkbox') {
                        if (!el.checked) {
                            el.checked = true
                            el.dispatchEvent(new Event('input', { bubbles: true }))
                            el.dispatchEvent(new Event('change', { bubbles: true }))
                        }
                        ;(el as HTMLElement).click()
                        return true
                    }
                    return false
                }

                const textNodes = Array.from(document.querySelectorAll('th, td, span, label, div, a'))
                for (const node of textNodes) {
                    const txt = (node.textContent || '').replace(/\s+/g, ' ').trim()
                    if (!txt || !txt.includes('전체')) continue
                    if (clickIfCheckbox(node.querySelector('input[type="checkbox"]'))) return 'header-checkbox-direct'
                    if (clickIfCheckbox(node.previousElementSibling?.querySelector('input[type="checkbox"]') ?? null)) return 'header-checkbox-prev'
                    if (clickIfCheckbox(node.nextElementSibling?.querySelector('input[type="checkbox"]') ?? null)) return 'header-checkbox-next'
                    if (clickIfCheckbox(node.closest('tr, thead, table, .IBMain')?.querySelector('input[type="checkbox"]') ?? null)) return 'header-checkbox-near'
                }
                return null
            })
            if (result) {
                console.log(`[LogenShipping] checkOrderCheckboxInIBSheet: ${result}`)
                return
            }
        } catch { /* next frame */ }
    }

    // Strategy 3: IBSheet JavaScript API via evaluate across all frames
    for (const ctx of getAllContexts(page)) {
        try {
            const result = await ctx.evaluate(() => {
                const win = window as unknown as Record<string, unknown>
                for (const key of Object.keys(win)) {
                    const obj = win[key]
                    if (!obj || typeof obj !== 'object') continue
                    const sheet = obj as Record<string, unknown>
                    if (typeof sheet.allCheck === 'function') {
                        try {
                            ;(sheet.allCheck as (v: number) => void)(1)
                            return `allCheck on ${key}`
                        } catch { /* next */ }
                    }
                    if (typeof sheet.getRowCount === 'function') {
                        try {
                            const rowCount = (sheet.getRowCount as () => number)()
                            if (rowCount > 0 && typeof sheet.setCheckVal === 'function') {
                                ;(sheet.setCheckVal as (r: number, v: number) => void)(0, 1)
                                return `setCheckVal on ${key}`
                            }
                        } catch { /* next */ }
                    }
                }
                return null
            })
            if (result) {
                console.log(`[LogenShipping] checkOrderCheckboxInIBSheet: ${result}`)
                return
            }
        } catch { /* next frame */ }
    }

    // Strategy 4: CSS selectors (longer timeout)
    try {
        await clickFirstVisible(
            page,
            [
                'th:has-text("전체") input[type="checkbox"]',
                'td:has-text("전체") input[type="checkbox"]',
                'label:has-text("전체") input[type="checkbox"]',
                'table tbody tr input[type="checkbox"]',
                'input[type="checkbox"][name*="chk"]',
                'input[type="checkbox"][name*="select"]',
                'input[type="checkbox"]',
            ],
            step,
            10000
        )
        return
    } catch {
        // fallback below
    }

    // Strategy 5: Force first-row checkbox only
    for (const ctx of getAllContexts(page)) {
        try {
            const checked = await ctx.evaluate(() => {
                const row =
                    document.querySelector('.IBMain tbody tr')
                    ?? document.querySelector('.IBMain table tbody tr')
                    ?? document.querySelector('table tbody tr')
                if (!row) return false
                const cb = row.querySelector('input[type="checkbox"]') as HTMLInputElement | null
                if (!cb) return false
                if (!cb.checked) {
                    cb.checked = true
                    cb.dispatchEvent(new Event('input', { bubbles: true }))
                    cb.dispatchEvent(new Event('change', { bubbles: true }))
                }
                cb.click()
                return true
            })
            if (checked) {
                console.log('[LogenShipping] checkOrderCheckboxInIBSheet: checked first row only')
                return
            }
        } catch {
            // next frame
        }
    }

    throw new LogenAutomationError(step, 'Could not select/check print target row in 미출력 grid.')
}

const getUnprintedGridState = async (page: PageLike): Promise<{ rowCount: number; checkboxCount: number; checkedCount: number }> => {
    for (const ctx of getAllContexts(page)) {
        try {
            const state = await ctx.evaluate(() => {
                const rowCount =
                    document.querySelectorAll('.IBMain tbody tr').length
                    || document.querySelectorAll('.IBMain table tbody tr').length
                    || document.querySelectorAll('table tbody tr').length
                const checkboxCount =
                    document.querySelectorAll('.IBMain tbody tr input[type="checkbox"]').length
                    || document.querySelectorAll('table tbody tr input[type="checkbox"]').length
                    || document.querySelectorAll('input[type="checkbox"]').length
                const checkedCount =
                    document.querySelectorAll('.IBMain tbody tr input[type="checkbox"]:checked').length
                    || document.querySelectorAll('table tbody tr input[type="checkbox"]:checked').length
                    || 0
                return { rowCount, checkboxCount, checkedCount }
            }) as { rowCount: number; checkboxCount: number; checkedCount: number }
            if (state.rowCount > 0 || state.checkboxCount > 0) return state
        } catch {
            // next context
        }
    }
    return { rowCount: 0, checkboxCount: 0, checkedCount: 0 }
}

const waitForUnprintedGridReady = async (page: PageLike, timeoutMs = 12000): Promise<void> => {
    const started = Date.now()
    while (Date.now() - started < timeoutMs) {
        const state = await getUnprintedGridState(page)
        if (state.rowCount > 0 && state.checkboxCount > 0) return
        await page.waitForTimeout(180)
    }
}

const waitUntilSavePopupsClosed = async (page: PageLike, timeoutMs = 8000): Promise<void> => {
    const started = Date.now()
    while (Date.now() - started < timeoutMs) {
        const open = await page.evaluate(() => {
            const isVisible = (sel: string) => {
                const el = document.querySelector(sel) as HTMLElement | null
                if (!el) return false
                const style = window.getComputedStyle(el)
                return style.display !== 'none' && style.visibility !== 'hidden'
            }
            return isVisible('#popupModal1') || isVisible('#popupModal') || isVisible('#popupModal_MultiCust')
        }).catch(() => false) as boolean
        if (!open) return
        await page.waitForTimeout(140)
    }
}

const clickCheckboxNearText = async (page: PageLike, text: string): Promise<boolean> => {
    for (const ctx of getAllContexts(page)) {
        try {
            const clicked = await ctx.evaluate((targetText: unknown) => {
                const t = String(targetText ?? '')
                const nodes = Array.from(document.querySelectorAll('label, span, th, td, div, a'))
                for (const node of nodes) {
                    const txt = (node.textContent || '').replace(/\s+/g, ' ').trim()
                    if (!txt || !txt.includes(t)) continue
                    const cb =
                        (node.querySelector('input[type="checkbox"]') as HTMLInputElement | null)
                        ?? (node.previousElementSibling?.querySelector('input[type="checkbox"]') as HTMLInputElement | null)
                        ?? (node.nextElementSibling?.querySelector('input[type="checkbox"]') as HTMLInputElement | null)
                        ?? (node.closest('tr, div, li')?.querySelector('input[type="checkbox"]') as HTMLInputElement | null)
                        ?? null
                    if (!cb) continue
                    cb.click()
                    return true
                }
                return false
            }, text).catch(() => false) as boolean
            if (clicked) return true
        } catch {
            // next context
        }
    }
    return false
}

/** Safe wait - use domcontentloaded instead of networkidle to avoid timeout on sites with persistent connections */
const safeWaitForLoad = async (ctx: FrameLike, timeoutMs = 10000) => {
    try {
        await ctx.waitForLoadState('domcontentloaded', { timeout: timeoutMs })
    } catch {
        // Ignore load state timeout - page may already be loaded
    }
}

/** Auto-handle 다수고객관리 popup when duplicate recipients exist */
const resolveMultiCustomerPopupIfPresent = async (ctx: FrameLike): Promise<boolean> => {
    return await ctx.evaluate(() => {
        const popup = document.querySelector('#popupModal_MultiCust') as HTMLElement | null
        if (!popup) return false

        const style = window.getComputedStyle(popup)
        const visible = style.display !== 'none' && style.visibility !== 'hidden'
        if (!visible) return false

        // Select first row in popup grid
        const firstRowCell =
            (document.querySelector('#popupModal_MultiCust table tbody tr td') as HTMLElement | null)
            ?? (document.querySelector('#popupModal_MultiCust .IBMain td') as HTMLElement | null)
        if (firstRowCell) {
            firstRowCell.dispatchEvent(new MouseEvent('click', { bubbles: true }))
            firstRowCell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
        }

        // Prefer explicit "선택" button in this popup
        const selectBtn =
            (document.querySelector('#selectBtn') as HTMLElement | null)
            ?? Array.from(document.querySelectorAll('#popupModal_MultiCust button, #popupModal_MultiCust a'))
                .find(el => (el.textContent || '').replace(/\s+/g, '').includes('선택')) as HTMLElement | undefined

        if (selectBtn) {
            selectBtn.click()
            return true
        }

        return false
    }).catch(() => false) as boolean
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

    const recipientPhoneFormatted = formatPhone(recipientPhone)
    const recipientNameFinal = String(recipientName ?? '').trim() || '엑스트래커'

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

        await page.waitForTimeout(1200)
        await safeWaitForLoad(page)

        // Step 3: Close any popup/modal that might appear after login (유통판매채널 등)
        throwIfAbortRequested(signal, 'Close Popup')
        reportStep('팝업 닫기')

        for (let attempt = 0; attempt < 8; attempt++) {
            const closeSelectors = [
                '#btn-popupModal1',
                '#popupModal1 button.btn.base.close',
                '#popupModal1 button.btn.outline.close',
                '[onclick^="fn_popClose"]',
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
                        await btn.click({ timeout: 1500, force: true })
                        await page.waitForTimeout(120)
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
                            await btn.click({ timeout: 1500, force: true })
                            await page.waitForTimeout(120)
                        }
                    } catch {
                        // continue
                    }
                }
            }
            await page.evaluate(() => {
                const win = window as unknown as Record<string, unknown>
                const fn = win.fn_popClose as ((mode?: string) => void) | undefined
                if (typeof fn === 'function') {
                    fn('N')
                }
            }).catch(() => undefined)
            await page.waitForTimeout(120)
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

        await page.waitForTimeout(5000)

        // Log available frames for debugging
        const frameUrls = page.frames().map(f => f.url())
        console.log(`[LogenShipping] Found ${frameUrls.length} frames:`, frameUrls)

        // Dump all elements for diagnostic purposes
        const elemDump = await dumpAllElements(page)
        console.log(`[LogenShipping] All elements after menu navigation:\n${elemDump}`)
        // Send frame count info via SSE
        const frameCount = page.frames().length
        reportStep(`폼 분석 완료 (${frameCount}개 프레임)`)

        const orderFrame =
            page.frames().find(f => f.url().includes('/lrm01f-reserve/lrm01f0050.html'))
            ?? page.frames().find(f => f.url().includes('/lrm01f0050.html'))

        if (!orderFrame) {
            throw new LogenAutomationError('Navigate - Order Form', 'Order frame (lrm01f0050) not found')
        }

        // Block auto multi-customer popup while filling recipient fields.
        // LOGEN can trigger this popup from name/phone change handlers (SelectCustInfo chain).
        await orderFrame.evaluate(() => {
            const win = window as unknown as Record<string, unknown>
            const noOp = () => undefined

            win.SelectCustInfo = noOp
            win.fn_MultCustSearch = noOp
            win.fn_lcm_MultiCustPopup = noOp
            win.fn_getMultiCustList = noOp
            win.fn_custInfoByRcvCustNm = noOp
            win.fn_btnRcvCustName_Click = noOp
            win.fn_custInfoByRcvTelNo = noOp
            win.fn_btnRcvCustTelNo_Click = noOp

            const removeInlineHandlers = (selector: string) => {
                const el = document.querySelector(selector) as HTMLInputElement | null
                if (!el) return
                el.onblur = null
                el.onchange = null
                el.onkeyup = null
                el.removeAttribute('onblur')
                el.removeAttribute('onchange')
                el.removeAttribute('onkeyup')
            }

            removeInlineHandlers('#strRcvCustNm')
            removeInlineHandlers('#strRcvCustTelNo')
            removeInlineHandlers('#strRcvCustCellNo')
        }).catch(() => undefined)

        // Step 5: Fill recipient info
        throwIfAbortRequested(signal, 'Fill Recipient Info')
        reportStep('수하인(받으시는 분) 정보 입력')

        // IMPORTANT: For recipient phone/name, only set input values.
        // Do not click any magnifier/search buttons in this step.
        const recipientInputsApplied = await orderFrame.evaluate((args: unknown) => {
            const [phone, name] = args as [string, string]

            const setInputValue = (selector: string, value: string) => {
                const input = document.querySelector(selector) as HTMLInputElement | null
                if (!input) return false
                input.value = value
                // Keep this as a plain assignment only.
                // LOGEN binds multi-customer lookup to input/blur/change handlers.
                return true
            }

            const telOk = setInputValue('#strRcvCustTelNo', phone)
            const nameOk = setInputValue('#strRcvCustNm', name)
            return telOk && nameOk
        }, [recipientPhoneFormatted, recipientNameFinal]).catch(() => false)

        if (!recipientInputsApplied) {
            throw new LogenAutomationError(
                'Fill Recipient Info',
                'Could not set recipient phone/name fields directly (#strRcvCustTelNo, #strRcvCustNm)'
            )
        }

        // Step 6: Address flow
        // User-required sequence:
        // 1) fill address keyword in recipient address search input (under recipient phone),
        // 2) click magnifier button on the right,
        // 3) double-click postal-code row in popup,
        // 4) fill detail address,
        // 5) click confirm button.
        throwIfAbortRequested(signal, 'Address Search')
        reportStep('주소 검색/선택 및 상세주소 입력')

        // 6-1) Fill keyword in recipient address input (same row as magnifier)
        try {
            const addrKeywordInput = orderFrame.locator('#strRcvZipCd').first()
            await addrKeywordInput.waitFor({ state: 'visible', timeout: 12000 })
            await addrKeywordInput.fill(recipientAddress)
        } catch {
            const filled = await orderFrame.evaluate((keyword: unknown) => {
                const input = document.querySelector('#strRcvZipCd') as HTMLInputElement | null
                if (!input) return false
                input.value = String(keyword ?? '')
                input.dispatchEvent(new Event('input', { bubbles: true }))
                input.dispatchEvent(new Event('change', { bubbles: true }))
                return true
            }, recipientAddress).catch(() => false)
            if (!filled) {
                throw new LogenAutomationError('Address Search - Input', 'Could not fill recipient address search input')
            }
        }

        // 6-2) Click recipient-address magnifier button (right side of address input)
        let magnifierClicked = false
        const magnifierSelectors = [
            '#btnRcvZipCd',
            '#rcvForm .mZip #btnRcvZipCd',
            '#rcvForm .mZip span.form-btn[onclick*="fn_popRcvAddrSearch"]',
            '.mZip span.form-btn[onclick*="fn_popRcvAddrSearch"]',
            '.mZip span.form-btn',
            '.mZip .las.la-search',
        ]
        for (const selector of magnifierSelectors) {
            try {
                const btn = orderFrame.locator(selector).first()
                await btn.waitFor({ state: 'visible', timeout: 1800 })
                const disabled = await btn.isDisabled().catch(() => false)
                if (disabled) continue
                await btn.click({ timeout: 3000, force: true })
                magnifierClicked = true
                break
            } catch {
                // Try next selector
            }
        }
        if (!magnifierClicked) {
            // Strict fallback: click only the magnifier inside the same container as #strRcvZipCd
            magnifierClicked = await orderFrame.evaluate(() => {
                const zipInput = document.querySelector('#strRcvZipCd') as HTMLInputElement | null
                if (!zipInput) return false
                const container = zipInput.closest('.mZip, .form-conts, .w-line, .relative') ?? zipInput.parentElement
                if (!container) return false
                const clickTarget =
                    (container.querySelector('#btnRcvZipCd') as HTMLElement | null)
                    ?? (container.querySelector('span.form-btn[onclick*="fn_popRcvAddrSearch"]') as HTMLElement | null)
                    ?? (container.querySelector('span.form-btn') as HTMLElement | null)
                    ?? (container.querySelector('.las.la-search') as HTMLElement | null)
                    ?? null

                if (clickTarget) {
                    clickTarget.click()
                    return true
                }

                const win = window as unknown as Record<string, unknown>
                const fn = win.fn_popRcvAddrSearch as (() => void) | undefined
                if (typeof fn === 'function') {
                    fn()
                    return true
                }
                return false
            }).catch(() => false) as boolean
        }
        if (!magnifierClicked) {
            throw new LogenAutomationError('Address Search - Magnifier', 'Could not click recipient address magnifier button (#btnRcvZipCd / fn_popRcvAddrSearch)')
        }
        await orderFrame.evaluate(() => {
            const win = window as unknown as Record<string, unknown>
            const fn = win.fn_popRcvAddrSearch as (() => void) | undefined
            if (typeof fn === 'function') {
                fn()
            }
        }).catch(() => undefined)

        // 6-3) Popup search
        await orderFrame.waitForTimeout(1200)
        let popupInOrderFrame = false
        let popupInPage = false
        for (let i = 0; i < 12; i++) {
            popupInOrderFrame = await orderFrame.locator('#popupModal').first().isVisible().catch(() => false) as boolean
            popupInPage = popupInOrderFrame ? false : await page.locator('#popupModal').first().isVisible().catch(() => false) as boolean
            if (popupInOrderFrame || popupInPage) break
            await orderFrame.waitForTimeout(250)
        }
        const popupCtx: FrameLike = popupInOrderFrame ? orderFrame : (popupInPage ? page : orderFrame)

        const keywordCandidates = Array.from(
            new Set([
                recipientAddress,
                recipientAddress.split(/\s+/).slice(0, 3).join(' '),
                recipientAddress.split(/\s+/).slice(0, 2).join(' '),
                recipientAddress.split(/\s+/).slice(0, 1).join(' '),
            ].filter(Boolean))
        )

        const readPopupRowCount = async () => {
            return await popupCtx.evaluate(() => {
                const sheetRows = (() => {
                    const sheet = (window as unknown as Record<string, unknown>).popGridSheet as Record<string, unknown> | undefined
                    if (!sheet || typeof sheet.getDataRows !== 'function') return 0
                    const rows = (sheet.getDataRows as () => unknown[])()
                    return Array.isArray(rows) ? rows.length : 0
                })()
                const domRows = document.querySelectorAll('#popupModal .IBMain tbody tr, #popupModal table tbody tr').length
                return Math.max(sheetRows, domRows)
            }).catch(() => 0) as number
        }

        let popupRowCount = 0
        const popupVisible = await popupCtx.locator('#popupModal').first().isVisible().catch(() => false)
        const popupKeywordInput = popupCtx.locator('#commPopSchVal1').first()
        const popupKeywordVisible = await popupKeywordInput.isVisible().catch(() => false)

        if (popupVisible && popupKeywordVisible) {
            for (const keyword of keywordCandidates) {
                await popupKeywordInput.fill(keyword).catch(() => undefined)

                let popupSearchClicked = false
                const popupSearchSelectors = [
                    '#popupModal button[onclick*="fn_comm_getDataList"]',
                    '#popupModal span.form-btn[onclick*="fn_comm_getDataList"]',
                    '#popupModal .form-btn[onclick*="fn_comm_getDataList"]',
                    '#popupModal button:has-text("검색")',
                    '#popupModal .btn.base:has-text("검색")',
                    '#popupModal input[type="button"][value="검색"]',
                ]
                for (const selector of popupSearchSelectors) {
                    try {
                        const searchBtn = popupCtx.locator(selector).first()
                        await searchBtn.waitFor({ state: 'visible', timeout: 1000 })
                        await searchBtn.click({ timeout: 2500, force: true })
                        popupSearchClicked = true
                        break
                    } catch {
                        // Try next selector
                    }
                }

                if (!popupSearchClicked) {
                    await popupCtx.evaluate(() => {
                        const fn = (window as unknown as Record<string, unknown>).fn_comm_getDataList
                        if (typeof fn === 'function') {
                            ;(fn as (mode?: string) => void)('fst')
                        }
                    }).catch(() => undefined)
                }

                for (let i = 0; i < 15; i++) {
                    popupRowCount = await readPopupRowCount()
                    if (popupRowCount > 0) break
                    await orderFrame.waitForTimeout(250)
                }
                if (popupRowCount > 0) break
            }
        } else {
            for (let i = 0; i < 20; i++) {
                popupRowCount = await readPopupRowCount()
                if (popupRowCount > 0) break
                await orderFrame.waitForTimeout(250)
            }
        }

        if (popupRowCount === 0) {
            throw new LogenAutomationError('Address Search - Result', 'No address rows found in popup')
        }

        // 6-5) Double-click postal-code row
        const firstPostalCode = await popupCtx.evaluate(() => {
            const sheet = (window as unknown as Record<string, unknown>).popGridSheet as Record<string, unknown> | undefined
            if (!sheet || typeof sheet.getDataRows !== 'function') return ''
            const rows = (sheet.getDataRows as () => Array<Record<string, unknown>>)()
            if (!Array.isArray(rows) || rows.length === 0) return ''
            return String(rows[0].bsiZonNo ?? '')
        }).catch(() => '') as string

        let rowDblClicked = false
        const safePostalCode = firstPostalCode.replace(/"/g, '\\"')
        const popupRowSelectors = safePostalCode
            ? [
                `#popupModal td:has-text("${safePostalCode}")`,
                '#popupModal .IBMain td',
                '#popupModal table tbody tr td',
            ]
            : [
                '#popupModal .IBMain td',
                '#popupModal table tbody tr td',
            ]

        for (const selector of popupRowSelectors) {
            try {
                const row = popupCtx.locator(selector).first()
                await row.waitFor({ state: 'visible', timeout: 1800 })
                await row.dblclick({ timeout: 3500, force: true })
                rowDblClicked = true
                break
            } catch {
                // Try next selector
            }
        }

        if (!rowDblClicked) {
            rowDblClicked = await popupCtx.evaluate(() => {
                const rows = Array.from(document.querySelectorAll('#popupModal .IBMain tr, #popupModal table tbody tr'))
                for (const tr of rows) {
                    const text = (tr.textContent || '').replace(/\s+/g, ' ').trim()
                    if (!text) continue
                    tr.dispatchEvent(new MouseEvent('click', { bubbles: true }))
                    tr.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
                    return true
                }
                return false
            }).catch(() => false) as boolean
        }

        await orderFrame.waitForTimeout(1300)

        // Some IBSheet states only highlight the row and do not fire the double-click return callback.
        // In that case, invoke popup return explicitly with the first row.
        const returnInvoked = await popupCtx.evaluate(() => {
            const win = window as unknown as Record<string, unknown>
            const sheet = win.popGridSheet as Record<string, unknown> | undefined
            if (!sheet || typeof sheet.getDataRows !== 'function') return false
            const rows = (sheet.getDataRows as () => Array<Record<string, unknown>>)()
            if (!Array.isArray(rows) || rows.length === 0) return false
            const popReturn = win.fn_comm_popReturn as ((row: Record<string, unknown>) => void) | undefined
            if (typeof popReturn !== 'function') return false
            popReturn(rows[0])
            return true
        }).catch(() => false) as boolean

        if (returnInvoked) {
            await orderFrame.waitForTimeout(500)
        }

        // If double-click did not populate address fields, force-apply first popup row as fallback.
        const addressFilledByDblClick = await orderFrame.evaluate(() => {
            const bldgCd = (document.querySelector('#strRcvBldgCd') as HTMLInputElement | null)?.value || ''
            const addr1 = (document.querySelector('#strRcvCustAddr1') as HTMLInputElement | null)?.value || ''
            return !!bldgCd && !!addr1
        }).catch(() => false)

        if (!addressFilledByDblClick) {
            const firstPopupRow = await popupCtx.evaluate(() => {
                const win = window as unknown as Record<string, unknown>
                const sheet = win.popGridSheet as Record<string, unknown> | undefined
                if (!sheet || typeof sheet.getDataRows !== 'function') return null
                const rows = (sheet.getDataRows as () => Array<Record<string, unknown>>)()
                if (!Array.isArray(rows) || rows.length === 0) return null
                const raw = rows[0]
                return {
                    bsiZonNo: String(raw.bsiZonNo ?? ''),
                    bldgCd: String(raw.bldgCd ?? ''),
                    sidoNam: String(raw.sidoNam ?? ''),
                    sigunguNam: String(raw.sigunguNam ?? ''),
                    dongRiNam: String(raw.dongRiNam ?? ''),
                    bunjiHo: String(raw.bunjiHo ?? ''),
                    roadNam: String(raw.roadNam ?? ''),
                    strcNum: String(raw.strcNum ?? ''),
                    branCd: String(raw.branCd ?? ''),
                    branNm: String(raw.branNm ?? ''),
                }
            }).catch(() => null) as Record<string, string> | null

            const forcedApplied = await orderFrame.evaluate((raw: unknown) => {
                const row = raw as Record<string, string> | null
                if (!row) return false
                const win = window as unknown as Record<string, unknown>
                const setValue = (selector: string, value: string) => {
                    const input = document.querySelector(selector) as HTMLInputElement | null
                    if (!input) return
                    input.value = value
                    input.dispatchEvent(new Event('input', { bubbles: true }))
                    input.dispatchEvent(new Event('change', { bubbles: true }))
                }

                const makeAddr = win.makeAddr as
                    | ((a1: string, a2: string, a3: string, a4: string, a5: string, n3: string, n4: string) => string)
                    | undefined

                const addr1 = typeof makeAddr === 'function'
                    ? makeAddr(
                        String(row.sidoNam ?? ''),
                        String(row.sigunguNam ?? ''),
                        String(row.dongRiNam ?? ''),
                        String(row.bunjiHo ?? ''),
                        '',
                        String(row.roadNam ?? ''),
                        String(row.strcNum ?? ''),
                    )
                    : [row.sidoNam, row.sigunguNam, row.roadNam, row.strcNum]
                        .map(v => String(v ?? '').trim())
                        .filter(Boolean)
                        .join(' ')

                setValue('#strRcvZipCd', String(row.bsiZonNo ?? ''))
                setValue('#strRcvBldgCd', String(row.bldgCd ?? ''))
                setValue('#strRcvCustAddr1', addr1)
                setValue('#strDlvBranCd', String(row.branCd ?? ''))
                setValue('#strDlvBranNm', String(row.branNm ?? ''))
                return true
            }, firstPopupRow).catch(() => false)

            if (!forcedApplied) {
                throw new LogenAutomationError('Address Search - Select Row', 'Could not apply popup address row')
            }
        }

        // 6-6) Fill detail address and confirm.
        // If popup detail field exists, fill/confirm in popup first; otherwise fill parent detail field directly.
        const popupDetailVisible = await popupCtx.locator('#commAddr2').first().isVisible().catch(() => false) as boolean
        if (popupDetailVisible) {
            if (recipientDetailAddress) {
                await popupCtx.locator('#commAddr2').first().fill(recipientDetailAddress).catch(async () => {
                    await popupCtx.evaluate((detail: unknown) => {
                        const input = document.querySelector('#commAddr2') as HTMLInputElement | null
                        if (!input) return
                        input.value = String(detail ?? '')
                        input.dispatchEvent(new Event('input', { bubbles: true }))
                        input.dispatchEvent(new Event('change', { bubbles: true }))
                    }, recipientDetailAddress).catch(() => undefined)
                })
            }

            // Ensure popup return payload exists. In some IBSheet states, detail page opens without hddAddrObj.
            await popupCtx.evaluate(() => {
                const getTextLines = (cell: Element | null) => (cell?.textContent || '').split(/\n+/).map(s => s.trim()).filter(Boolean)
                const firstRow = document.querySelector('#popupModal .IBMain tbody tr, #popupModal table tbody tr')
                const cells = firstRow ? Array.from(firstRow.querySelectorAll('td')) : []
                const line = (idx: number, n = 0) => {
                    const lines = getTextLines(cells[idx] ?? null)
                    return lines[n] || ''
                }
                const fromDom = cells.length >= 5
                    ? {
                        bsiZonNo: line(0, 0),
                        sidoNam: line(1, 0),
                        sigunguNam: line(2, 0),
                        roadNam: line(3, 0),
                        dongRiNam: line(3, 1),
                        strcNum: line(4, 0),
                        bunjiHo: line(4, 1),
                        bldgNm: line(5, 0),
                        branNm: line(7, 0),
                    }
                    : null

                const sheetRows = ((window as unknown as Record<string, unknown>).popGridSheet as { getDataRows?: () => unknown[] } | undefined)?.getDataRows?.() || []
                const fromSheet = Array.isArray(sheetRows) && sheetRows.length > 0 ? sheetRows[0] as Record<string, unknown> : null
                const raw = fromSheet ?? fromDom
                if (!raw) return

                const win = window as unknown as Record<string, unknown>
                const makeAddr = win.makeAddr as
                    | ((a1: string, a2: string, a3: string, a4: string, a5: string, n3: string, n4: string) => string)
                    | undefined
                const addr1 = typeof makeAddr === 'function'
                    ? makeAddr(
                        String(raw.sidoNam ?? ''),
                        String(raw.sigunguNam ?? ''),
                        String(raw.dongRiNam ?? ''),
                        String(raw.bunjiHo ?? ''),
                        '',
                        String(raw.roadNam ?? ''),
                        String(raw.strcNum ?? ''),
                    )
                    : [raw.sidoNam, raw.sigunguNam, raw.roadNam, raw.strcNum]
                        .map(v => String(v ?? '').trim())
                        .filter(Boolean)
                        .join(' ')

                const hddAddrObj = document.querySelector('#hddAddrObj') as HTMLInputElement | null
                if (hddAddrObj && !hddAddrObj.value) {
                    hddAddrObj.value = JSON.stringify(raw)
                }
                const hddAddr1 = document.querySelector('#hddAddr1') as HTMLInputElement | null
                if (hddAddr1 && !hddAddr1.value) {
                    hddAddr1.value = addr1
                }
            }).catch(() => undefined)

            let popupConfirmed = false
            const popupConfirmSelectors = [
                '#btnCommAddrConfim',
                '#popupModal button[onclick*="fn_comm_addr_return"]',
                '#popupModal .btn.base.w100.mt-3',
                '#popupModal button:has-text("확인")',
                '#popupModal input[type="button"][value="확인"]',
            ]

            // Fast path: invoke popup confirm-return function first.
            await popupCtx.evaluate(() => {
                const win = window as unknown as Record<string, unknown>
                const fn = win.fn_comm_addr_return as (() => void) | undefined
                if (typeof fn === 'function') fn()
            }).catch(() => undefined)
            await orderFrame.waitForTimeout(120)
            popupConfirmed = !(await popupCtx.locator('#popupModal').first().isVisible().catch(() => false) as boolean)

            // Quick one-pass click fallback.
            if (!popupConfirmed) {
                for (const selector of popupConfirmSelectors) {
                    try {
                        const confirmBtn = popupCtx.locator(selector).first()
                        const visible = await confirmBtn.isVisible().catch(() => false)
                        if (!visible) continue
                        await confirmBtn.click({ timeout: 1800, force: true })
                        break
                    } catch {
                        // Try next selector
                    }
                }
                await popupCtx.evaluate(() => {
                    const win = window as unknown as Record<string, unknown>
                    const fn = win.fn_comm_addr_return as (() => void) | undefined
                    if (typeof fn === 'function') fn()
                }).catch(() => undefined)
                await orderFrame.waitForTimeout(120)
                popupConfirmed = !(await popupCtx.locator('#popupModal').first().isVisible().catch(() => false) as boolean)
            }

            if (!popupConfirmed) {
                const popupStillOpen = await popupCtx.locator('#popupModal').first().isVisible().catch(() => false) as boolean
                if (popupStillOpen) {
                    const forcedClosed = await popupCtx.evaluate((detail: unknown) => {
                        const setValue = (selector: string, value: string) => {
                            const input = document.querySelector(selector) as HTMLInputElement | null
                            if (!input) return
                            input.value = value
                            input.dispatchEvent(new Event('input', { bubbles: true }))
                            input.dispatchEvent(new Event('change', { bubbles: true }))
                        }

                        try {
                            const fnAddrReturn = (window as unknown as Record<string, unknown>).fn_comm_addr_return
                            if (typeof fnAddrReturn === 'function') {
                                ;(fnAddrReturn as () => void)()
                            }
                        } catch {
                            // ignore
                        }

                        const getTextLines = (cell: Element | null) => (cell?.textContent || '').split(/\n+/).map(s => s.trim()).filter(Boolean)
                        const firstRow = document.querySelector('#popupModal .IBMain tbody tr, #popupModal table tbody tr')
                        const cells = firstRow ? Array.from(firstRow.querySelectorAll('td')) : []
                        if (cells.length >= 5) {
                            const line = (idx: number, n = 0) => {
                                const lines = getTextLines(cells[idx] ?? null)
                                return lines[n] || ''
                            }
                            const row = {
                                bsiZonNo: line(0, 0),
                                sidoNam: line(1, 0),
                                sigunguNam: line(2, 0),
                                roadNam: line(3, 0),
                                dongRiNam: line(3, 1),
                                strcNum: line(4, 0),
                                bunjiHo: line(4, 1),
                                branNm: line(7, 0),
                            }
                            const win = window as unknown as Record<string, unknown>
                            const makeAddr = win.makeAddr as
                                | ((a1: string, a2: string, a3: string, a4: string, a5: string, n3: string, n4: string) => string)
                                | undefined
                            const addr1 = typeof makeAddr === 'function'
                                ? makeAddr(row.sidoNam, row.sigunguNam, row.dongRiNam, row.bunjiHo, '', row.roadNam, row.strcNum)
                                : [row.sidoNam, row.sigunguNam, row.roadNam, row.strcNum].filter(Boolean).join(' ')
                            setValue('#strRcvZipCd', row.bsiZonNo)
                            setValue('#strRcvCustAddr1', addr1)
                            if (row.branNm) setValue('#strDlvBranNm', row.branNm)
                        }

                        if (detail) {
                            setValue('#strRcvCustAddr2', String(detail))
                        }

                        try {
                            const fnPopClose = (window as unknown as Record<string, unknown>).fn_comm_popClose
                            if (typeof fnPopClose === 'function') {
                                ;(fnPopClose as () => void)()
                            }
                        } catch {
                            // ignore
                        }

                        const popup = document.querySelector('#popupModal') as HTMLElement | null
                        if (popup) {
                            popup.style.display = 'none'
                            popup.style.visibility = 'hidden'
                        }
                        if (!popup) return true
                        const style = window.getComputedStyle(popup)
                        return style.display === 'none' || style.visibility === 'hidden'
                    }, recipientDetailAddress).catch(() => false) as boolean

                    if (!forcedClosed) {
                        throw new LogenAutomationError('Address Search - Confirm', 'Detail address entered but popup confirm did not close')
                    }
                }
            }
        } else if (recipientDetailAddress) {
            try {
                const detailInput = orderFrame.locator('#strRcvCustAddr2').first()
                await detailInput.waitFor({ state: 'visible', timeout: 7000 })
                await detailInput.fill(recipientDetailAddress)
            } catch {
                await orderFrame.evaluate((detail: unknown) => {
                    const input = document.querySelector('#strRcvCustAddr2') as HTMLInputElement | null
                    if (!input) return
                    input.value = String(detail ?? '')
                    input.dispatchEvent(new Event('input', { bubbles: true }))
                    input.dispatchEvent(new Event('change', { bubbles: true }))
                }, recipientDetailAddress).catch(() => undefined)
            }
        }

        await orderFrame.waitForTimeout(450)

        const addressFinalState = await orderFrame.evaluate(() => {
            const getVal = (selector: string) => (document.querySelector(selector) as HTMLInputElement | null)?.value || ''
            return {
                zip: getVal('#strRcvZipCd'),
                bldgCd: getVal('#strRcvBldgCd'),
                addr1: getVal('#strRcvCustAddr1'),
                addr2: getVal('#strRcvCustAddr2'),
                branCd: getVal('#strDlvBranCd'),
                branNm: getVal('#strDlvBranNm'),
            }
        }).catch(() => null) as {
            zip: string
            bldgCd: string
            addr1: string
            addr2: string
            branCd: string
            branNm: string
        } | null

        if (!addressFinalState || !addressFinalState.bldgCd || !addressFinalState.addr1) {
            throw new LogenAutomationError(
                'Address Search - Final Check',
                `Address was not finalized after popup confirm: ${JSON.stringify(addressFinalState)}`
            )
        }

        // Step 7: Save
        throwIfAbortRequested(signal, 'Save Order')
        reportStep('주문 저장')

        try {
            await clickFirstVisible(
                page,
                [
                    '.button-area button.btn.base.save[onclick*="fn_save"]',
                    'button.btn.base.save[onclick*="fn_save"]',
                    'button[onclick="fn_save()"]',
                ],
                'Save Order',
                10000
            )
        } catch {
            console.log('[LogenShipping] Save button click failed, invoking fn_save directly')
            const savedByFn = await page.evaluate(() => {
                const win = window as unknown as Record<string, unknown>
                const fn = win.fn_save as (() => void) | undefined
                if (typeof fn === 'function') {
                    fn()
                    return true
                }
                return false
            }).catch(() => false)
            if (!savedByFn) {
                console.log('[LogenShipping] fn_save not found, pressing F5')
                await page.keyboard.press('F5')
            }
        }

        await page.waitForTimeout(4000)

        // Save confirmation (dialog handler auto-accepts, check HTML buttons too)
        try {
            await clickFirstVisible(
                page,
                ['button:has-text("예")', 'button:has-text("확인")', 'input[type="button"][value="예"]'],
                'Save Confirm',
                3000
            )
        } catch { /* no dialog */ }

        // If duplicate customer candidates exist, resolve popup by selecting first row
        for (let i = 0; i < 6; i++) {
            const resolved = await resolveMultiCustomerPopupIfPresent(orderFrame)
            if (!resolved) break
            await orderFrame.waitForTimeout(700)
        }

        await waitUntilSavePopupsClosed(page, 8000)
        await page.waitForTimeout(250)

        // Step 8: 미출력 tab → checkbox → 운송장출력
        throwIfAbortRequested(signal, 'Print Label')
        reportStep('운송장 출력 준비')

        try {
            await clickFirstVisible(
                page,
                ['a:has-text("미출력")', 'span:has-text("미출력")', 'li:has-text("미출력")'],
                '미출력 Tab',
                10000
            )
            await page.waitForTimeout(300)
        } catch {
            console.log('[LogenShipping] 미출력 tab already selected or not found')
        }

        await waitForUnprintedGridReady(page, 12000)
        const gridReadyState = await getUnprintedGridState(page)
        console.log(`[LogenShipping] Print prep: grid rows=${gridReadyState.rowCount}, cbs=${gridReadyState.checkboxCount}`)

        const utilityChecked = await clickCheckboxNearText(page, '관내우선')
        if (utilityChecked) {
            console.log('[LogenShipping] Print prep: checked utility checkbox near 관내우선')
        }

        // Check the checkbox (IBSheet-aware with CSS fallback) and verify checked rows.
        let checkedRows = 0
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                await checkOrderCheckboxInIBSheet(page, 'Select Order Checkbox')
            } catch {
                // retry after short wait
            }
            await page.waitForTimeout(220)
            const state = await getUnprintedGridState(page)
            checkedRows = state.checkedCount
            if (checkedRows > 0) break
            await waitForUnprintedGridReady(page, 2500)
        }
        if (checkedRows === 0) {
            throw new LogenAutomationError('Select Order Checkbox', '미출력 체크가 적용되지 않아 운송장출력을 진행할 수 없습니다.')
        }
        await page.waitForTimeout(260)

        // Click 운송장출력
        reportStep('운송장 출력')
        await clickFirstVisible(
            page,
            [
                'button:has-text("운송장출력")',
                'a:has-text("운송장출력")',
                'input[type="button"][value*="운송장출력"]',
            ],
            '운송장출력 Button'
        )
        await page.waitForTimeout(3000)

        // Step 9: Print popup → 운송장출력 → 예
        throwIfAbortRequested(signal, 'Print Confirmation')
        reportStep('운송장 발행 확인')

        try {
            await clickFirstVisible(
                page,
                ['button:has-text("운송장출력")', 'a:has-text("운송장출력")', 'input[type="button"][value*="운송장출력"]'],
                'Print Popup - 운송장출력',
                10000
            )
        } catch {
            console.log('[LogenShipping] Print popup button not found')
        }
        await page.waitForTimeout(2000)

        try {
            await clickFirstVisible(
                page,
                ['button:has-text("예")', 'input[type="button"][value="예"]', 'button:has-text("확인")'],
                'Print Confirm - 예',
                8000
            )
        } catch {
            console.log('[LogenShipping] Print confirmation not found')
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
