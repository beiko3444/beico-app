/**
 * Coupang personal purchase history scraper.
 *
 * Coupang does not expose an open API for consumer purchase history, so this
 * module logs into the consumer site with Playwright and scrapes the order list
 * page. It mirrors the browser-launch pattern used by `lib/moinBizplus.ts`.
 *
 * Anti-bot considerations:
 *   - Coupang frequently triggers a CAPTCHA or sends an OTP for new IPs/UAs.
 *     When that happens the scraper returns a `captcha` failure code so the UI
 *     can ask the user to log in once with `headless=false` to clear it.
 *   - Avoid running this on every page view — the API caches results in DB.
 */

const COUPANG_LOGIN_URL = 'https://login.coupang.com/login/login.pang'
const COUPANG_ORDER_LIST_URL = 'https://mc.coupang.com/ssr/desktop/order/list'
const DEFAULT_TIMEOUT_MS = 45000

type BrowserLike = {
    newContext: (options?: Record<string, unknown>) => Promise<BrowserContextLike>
    close: () => Promise<void>
}

type BrowserContextLike = {
    newPage: () => Promise<PageLike>
    addInitScript: (script: string) => Promise<void>
}

type PageLike = {
    goto: (url: string, options?: Record<string, unknown>) => Promise<unknown>
    url: () => string
    locator: (selector: string) => LocatorLike
    setDefaultTimeout: (timeout: number) => void
    setDefaultNavigationTimeout: (timeout: number) => void
    waitForLoadState: (state?: string, options?: Record<string, unknown>) => Promise<void>
    waitForURL: (url: string | RegExp, options?: Record<string, unknown>) => Promise<void>
    waitForTimeout: (ms: number) => Promise<void>
    waitForSelector: (selector: string, options?: Record<string, unknown>) => Promise<unknown>
    content: () => Promise<string>
    evaluate: (fn: string | ((...args: unknown[]) => unknown), ...args: unknown[]) => Promise<unknown>
}

type LocatorLike = {
    first: () => LocatorLike
    waitFor: (options?: Record<string, unknown>) => Promise<void>
    click: (options?: Record<string, unknown>) => Promise<void>
    fill: (value: string) => Promise<void>
    pressSequentially: (text: string, options?: Record<string, unknown>) => Promise<void>
    isVisible: () => Promise<boolean>
    count: () => Promise<number>
    textContent: () => Promise<string | null>
}

export type CoupangPurchaseItem = {
    name: string
    quantity: number
    price: number | null
    imageUrl: string | null
    productUrl: string | null
}

export type CoupangPurchaseRecord = {
    orderId: string
    orderedAt: string // ISO string
    totalAmount: number
    paymentMethod: string | null
    itemSummary: string
    items: CoupangPurchaseItem[]
    raw: Record<string, unknown>
}

export type CoupangScrapeInput = {
    loginId: string
    loginPassword: string
    startDate: string // YYYY-MM-DD
    endDate: string   // YYYY-MM-DD
    headless?: boolean
}

export type CoupangScrapeResult = {
    purchases: CoupangPurchaseRecord[]
    pagesScraped: number
    finalUrl: string
}

export type CoupangScrapeFailureCode =
    | 'INVALID_INPUT'
    | 'LAUNCH_FAILED'
    | 'LOGIN_FAILED'
    | 'CAPTCHA_REQUIRED'
    | 'PARSE_FAILED'
    | 'NAVIGATION_FAILED'

export class CoupangScrapeError extends Error {
    code: CoupangScrapeFailureCode
    detail?: string

    constructor(code: CoupangScrapeFailureCode, message: string, detail?: string) {
        super(message)
        this.name = 'CoupangScrapeError'
        this.code = code
        this.detail = detail
    }
}

const getErrorMessage = (error: unknown) => {
    if (error instanceof Error && error.message) return error.message
    return String(error)
}

const launchBrowser = async (headless: boolean): Promise<{ browser: BrowserLike; runtime: string }> => {
    const runtimeErrors: string[] = []

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

    throw new CoupangScrapeError(
        'LAUNCH_FAILED',
        '쿠팡 자동화에 사용할 브라우저를 시작할 수 없습니다.',
        runtimeErrors.join(' | '),
    )
}

const performLogin = async (page: PageLike, loginId: string, loginPassword: string) => {
    await page.goto(COUPANG_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: DEFAULT_TIMEOUT_MS })
    await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT_MS }).catch(() => undefined)

    // Detect Akamai / WAF bot blocks before trying to interact with the page.
    // The CDN returns a static "Access Denied" HTML with no inputs at all, which
    // would otherwise surface as a confusing "input not found" error.
    const blockSnapshot = await page
        .evaluate(`(() => ({
            title: document.title || '',
            bodyText: (document.body && document.body.innerText || '').slice(0, 400),
            url: location.href,
            inputCount: document.querySelectorAll('input').length,
        }))()`)
        .catch(() => null) as { title: string; bodyText: string; url: string; inputCount: number } | null

    if (blockSnapshot) {
        const haystack = `${blockSnapshot.title}\n${blockSnapshot.bodyText}`
        if (/Access Denied|don't have permission|Reference\s*#\d|errors\.edgesuite\.net/i.test(haystack)) {
            throw new CoupangScrapeError(
                'NAVIGATION_FAILED',
                '쿠팡 CDN(Akamai)이 서버 IP를 차단했습니다. 다른 네트워크/프록시(QUOTAGUARDSTATIC_URL, FIXIE_URL, HTTPS_PROXY)로 우회하거나 로컬에서 실행해 주세요.',
                `title="${blockSnapshot.title}" url=${blockSnapshot.url}`,
            )
        }
        if (blockSnapshot.inputCount === 0) {
            throw new CoupangScrapeError(
                'NAVIGATION_FAILED',
                '쿠팡 로그인 페이지가 정상적으로 로드되지 않았습니다 (입력 필드 0개).',
                `title="${blockSnapshot.title}" url=${blockSnapshot.url} body="${blockSnapshot.bodyText.slice(0, 120)}"`,
            )
        }
    }

    // Verified against the live login page DOM (login.coupang.com/login/login.pang).
    const idSelectors = ['input#login-email-input', 'input[name="email"]', 'input.member__input._loginIdInput', 'input[type="email"]']
    const pwSelectors = ['input#login-password-input', 'input[name="password"]', 'input[type="password"]']
    const submitSelectors = ['button._loginSubmitButton', 'button.login__button--submit', 'button[type="submit"]:has-text("로그인")', 'button[type="submit"]']

    const fillField = async (selectors: string[], value: string, label: string) => {
        for (const selector of selectors) {
            try {
                const target = page.locator(selector).first()
                await target.waitFor({ state: 'visible', timeout: 12000 })
                await target.click({ timeout: 4000 })
                await target.fill('')
                await target.pressSequentially(value, { delay: 60 + Math.floor(Math.random() * 60) })
                return true
            } catch {
                // try next
            }
        }
        const diag = blockSnapshot ? `inputs=${blockSnapshot.inputCount} title="${blockSnapshot.title}" url=${blockSnapshot.url}` : `url=${page.url()}`
        throw new CoupangScrapeError('LOGIN_FAILED', `로그인 ${label} 입력 필드를 찾지 못했습니다.`, diag)
    }

    await fillField(idSelectors, loginId, '아이디')
    await fillField(pwSelectors, loginPassword, '비밀번호')

    let submitted = false
    for (const selector of submitSelectors) {
        try {
            const target = page.locator(selector).first()
            await target.waitFor({ state: 'visible', timeout: 4000 })
            await target.click({ timeout: 4000 })
            submitted = true
            break
        } catch {
            // try next
        }
    }
    if (!submitted) {
        throw new CoupangScrapeError('LOGIN_FAILED', '로그인 버튼을 찾을 수 없습니다.')
    }

    await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT_MS }).catch(() => undefined)

    // CAPTCHA classes confirmed by inspecting the live login page DOM.
    const captchaVisible = await page
        .locator(
            '._loginCaptchaContainer, .login__content--captcha, .captcha-box__image, .captcha-box, iframe[src*="recaptcha"]',
        )
        .first()
        .isVisible()
        .catch(() => false)
    if (captchaVisible) {
        throw new CoupangScrapeError(
            'CAPTCHA_REQUIRED',
            '쿠팡에서 자동입력 방지(CAPTCHA) 인증을 요구합니다. COUPANG_USER_HEADLESS=false 로 한 번 직접 로그인 후 다시 시도해 주세요.',
        )
    }

    if (page.url().includes('/login/login.pang')) {
        const errorText = await page
            .locator('._loginCommonError, ._loginPasswordError, .member__message-area--error, .error-message, [role="alert"]')
            .first()
            .textContent()
            .catch(() => null)
        throw new CoupangScrapeError('LOGIN_FAILED', errorText?.trim() || '쿠팡 로그인에 실패했습니다. 아이디/비밀번호를 확인해 주세요.')
    }
}

/**
 * Parse the order list page DOM into structured purchase records.
 *
 * The order list at mc.coupang.com renders each order group as a card with the
 * order date, order id, total amount, and one-or-more product rows. The DOM is
 * not stable across releases so we fall back to several selectors.
 */
const extractOrdersFromPage = async (page: PageLike): Promise<CoupangPurchaseRecord[]> => {
    const raw = await page.evaluate(`
        (() => {
            const text = (el) => (el && el.textContent || '').replace(/\\s+/g, ' ').trim();
            const num = (s) => {
                const cleaned = String(s || '').replace(/[^0-9-]/g, '');
                if (!cleaned) return null;
                const n = parseInt(cleaned, 10);
                return Number.isFinite(n) ? n : null;
            };
            const parseDateKo = (s) => {
                if (!s) return null;
                const m = String(s).match(/(20\\d{2})[.\\-\\/년\\s]+(\\d{1,2})[.\\-\\/월\\s]+(\\d{1,2})/);
                if (!m) return null;
                const yyyy = m[1];
                const mm = String(m[2]).padStart(2, '0');
                const dd = String(m[3]).padStart(2, '0');
                return yyyy + '-' + mm + '-' + dd + 'T00:00:00+09:00';
            };

            const orderCards = Array.from(document.querySelectorAll(
                '[data-orderid], .order-list .order, .order-history .order-item, li.order, section.order, div.order-item'
            ));

            const out = [];
            const seen = new Set();

            orderCards.forEach((card) => {
                const orderIdAttr = card.getAttribute('data-orderid') || card.getAttribute('data-order-id');
                let orderId = orderIdAttr || '';
                if (!orderId) {
                    const idEl = card.querySelector('[class*="order-id"], [class*="orderNumber"], a[href*="orderId"], a[href*="orderListNumber"]');
                    const idText = text(idEl);
                    const idMatch = idText.match(/\\d{8,}/);
                    if (idMatch) orderId = idMatch[0];
                    if (!orderId && idEl) {
                        const href = idEl.getAttribute('href') || '';
                        const hrefMatch = href.match(/orderId=(\\d+)|orderListNumber=(\\d+)/);
                        if (hrefMatch) orderId = hrefMatch[1] || hrefMatch[2] || '';
                    }
                }
                if (!orderId) return;
                if (seen.has(orderId)) return;
                seen.add(orderId);

                const dateEl = card.querySelector('[class*="order-date"], [class*="orderedAt"], .date, time');
                const orderedAt = parseDateKo(text(dateEl));

                const totalEl = card.querySelector('[class*="total-amount"], [class*="totalPrice"], [class*="payment-amount"], .price');
                const totalAmount = num(text(totalEl));

                const payEl = card.querySelector('[class*="payment-method"], [class*="payMethod"]');
                const paymentMethod = text(payEl) || null;

                const itemEls = Array.from(card.querySelectorAll(
                    '[class*="product-item"], [class*="orderItem"], [class*="order-item"], .item, li.product'
                ));
                const items = itemEls.map((it) => {
                    const nameEl = it.querySelector('[class*="title"], [class*="name"], a, .product-name');
                    const qtyEl = it.querySelector('[class*="quantity"], [class*="count"]');
                    const priceEl = it.querySelector('[class*="price"]');
                    const imgEl = it.querySelector('img');
                    const linkEl = it.querySelector('a[href*="products"], a[href*="vp/products"]');
                    return {
                        name: text(nameEl) || text(it).slice(0, 80),
                        quantity: num(text(qtyEl)) || 1,
                        price: num(text(priceEl)),
                        imageUrl: imgEl ? (imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || null) : null,
                        productUrl: linkEl ? linkEl.getAttribute('href') : null,
                    };
                }).filter((x) => x.name);

                out.push({
                    orderId: String(orderId),
                    orderedAt,
                    totalAmount,
                    paymentMethod,
                    items,
                });
            });

            return out;
        })()
    `).catch((err) => {
        throw new CoupangScrapeError('PARSE_FAILED', '주문목록 페이지 파싱에 실패했습니다.', getErrorMessage(err))
    })

    if (!Array.isArray(raw)) return []

    return (raw as Array<Record<string, unknown>>)
        .map((entry) => {
            const orderId = String(entry.orderId || '').trim()
            const orderedAt = typeof entry.orderedAt === 'string' && entry.orderedAt
                ? entry.orderedAt
                : new Date().toISOString()
            const totalAmount = typeof entry.totalAmount === 'number' ? entry.totalAmount : 0
            const paymentMethod = typeof entry.paymentMethod === 'string' ? entry.paymentMethod : null
            const items: CoupangPurchaseItem[] = Array.isArray(entry.items)
                ? (entry.items as Array<Record<string, unknown>>).map((it) => ({
                      name: String(it.name || '').trim(),
                      quantity: typeof it.quantity === 'number' ? it.quantity : 1,
                      price: typeof it.price === 'number' ? it.price : null,
                      imageUrl: typeof it.imageUrl === 'string' ? it.imageUrl : null,
                      productUrl: typeof it.productUrl === 'string' ? it.productUrl : null,
                  })).filter((it) => it.name)
                : []

            const itemSummary = items.length === 0
                ? ''
                : items.length === 1
                    ? items[0].name
                    : `${items[0].name} 외 ${items.length - 1}건`

            if (!orderId || !totalAmount) return null

            return {
                orderId,
                orderedAt,
                totalAmount,
                paymentMethod,
                itemSummary,
                items,
                raw: entry,
            } satisfies CoupangPurchaseRecord
        })
        .filter((row): row is CoupangPurchaseRecord => row !== null)
}

const inRange = (orderedAt: string, startDate: string, endDate: string) => {
    const t = Date.parse(orderedAt)
    if (Number.isNaN(t)) return false
    const start = Date.parse(`${startDate}T00:00:00+09:00`)
    const end = Date.parse(`${endDate}T23:59:59+09:00`)
    return t >= start && t <= end
}

export async function scrapeCoupangPurchases(input: CoupangScrapeInput): Promise<CoupangScrapeResult> {
    if (!input.loginId || !input.loginPassword) {
        throw new CoupangScrapeError('INVALID_INPUT', '쿠팡 로그인 ID와 비밀번호가 필요합니다.')
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(input.endDate)) {
        throw new CoupangScrapeError('INVALID_INPUT', '시작일/종료일 형식이 올바르지 않습니다 (YYYY-MM-DD).')
    }

    const headless = input.headless ?? true
    const { browser } = await launchBrowser(headless)

    try {
        const context = await browser.newContext({
            viewport: { width: 1280, height: 900 },
            userAgent:
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            locale: 'ko-KR',
            timezoneId: 'Asia/Seoul',
        })
        await context.addInitScript(`Object.defineProperty(navigator, 'webdriver', { get: () => undefined });`).catch(() => undefined)
        const page = await context.newPage()
        page.setDefaultTimeout(DEFAULT_TIMEOUT_MS)
        page.setDefaultNavigationTimeout(DEFAULT_TIMEOUT_MS)

        await performLogin(page, input.loginId, input.loginPassword)

        const purchases: CoupangPurchaseRecord[] = []
        const seenOrderIds = new Set<string>()
        let pagesScraped = 0

        for (let pageIndex = 1; pageIndex <= 10; pageIndex++) {
            const url = `${COUPANG_ORDER_LIST_URL}?listType=ORDERS&page=${pageIndex}`
            try {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: DEFAULT_TIMEOUT_MS })
                await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT_MS }).catch(() => undefined)
            } catch (error) {
                throw new CoupangScrapeError('NAVIGATION_FAILED', '주문목록 페이지로 이동하지 못했습니다.', getErrorMessage(error))
            }
            pagesScraped++

            const pageOrders = await extractOrdersFromPage(page)
            if (pageOrders.length === 0) break

            let addedThisPage = 0
            let outOfRangeOnPage = 0
            for (const order of pageOrders) {
                if (seenOrderIds.has(order.orderId)) continue
                seenOrderIds.add(order.orderId)
                if (inRange(order.orderedAt, input.startDate, input.endDate)) {
                    purchases.push(order)
                    addedThisPage++
                } else {
                    outOfRangeOnPage++
                }
            }

            // Stop when an entire page is older than startDate (orders are newest-first).
            if (addedThisPage === 0 && outOfRangeOnPage > 0) break
        }

        const finalUrl = page.url()
        await context.newPage().catch(() => undefined)
        return { purchases, pagesScraped, finalUrl }
    } finally {
        await browser.close().catch(() => undefined)
    }
}
