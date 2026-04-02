import { chromium } from 'playwright-core';

const LOGIN_ID = process.env.LOGEN_LOGIN_ID || '54751300';
const LOGIN_PASSWORD = process.env.LOGEN_LOGIN_PASSWORD || 'dprtmxmfozj1!';
const WAIT_MS = 1000;

const MENU_RESERVATION = '\uC608\uC57D\uAD00\uB9AC';
const MENU_SINGLE_ORDER = '\uC8FC\uBB38\uB4F1\uB85D/\uCD9C\uB825(\uB2E8\uAC74)';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const closeBlockingPopups = async (page) => {
  const selectors = [
    '#popupModal1 button.btn.outline.close',
    '#popupModal1 .btn.close',
    '[onclick^="fn_popClose"]',
    '.modalContainer .btn.outline.close',
  ];

  for (let i = 0; i < 5; i += 1) {
    let clicked = false;
    for (const selector of selectors) {
      const loc = page.locator(selector).first();
      if (await loc.isVisible().catch(() => false)) {
        await loc.click({ force: true }).catch(() => {});
        clicked = true;
        await sleep(300);
      }
    }
    if (!clicked) break;
  }
};

const run = async () => {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: false,
    slowMo: 250,
  });

  const context = await browser.newContext({
    locale: 'ko-KR',
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();

  page.on('dialog', async (dialog) => {
    try {
      console.log(`[Dialog] ${dialog.type()}: ${dialog.message()}`);
      await dialog.accept();
    } catch {
      // Ignore
    }
  });

  console.log('[LiveDebug] Opening login page...');
  await page.goto('https://logis.ilogen.com/', { waitUntil: 'domcontentloaded' });
  await sleep(1500);

  console.log('[LiveDebug] Logging in...');
  await page.fill('[id="user.id"]', LOGIN_ID);
  await page.fill('[id="user.pw"]', LOGIN_PASSWORD);
  await page.click('a[onclick="basicLogin()"]');

  await sleep(5000);
  await closeBlockingPopups(page);

  console.log('[LiveDebug] Navigating to 주문등록/출력(단건)...');
  await page.locator(`a.lnb.toggle-menu:has(span.text[title="${MENU_RESERVATION}"])`).first().click({ timeout: 15000 });
  await sleep(900);
  await page.locator(`li.menu-item.deps2 > a[title="${MENU_SINGLE_ORDER}"]`).first().click({ timeout: 15000 });

  await sleep(4000);
  console.log('[LiveDebug] Ready. Browser will stay open for interactive debugging.');
  console.log('[LiveDebug] Close the browser window when done.');

  // Keep session alive for collaborative debugging.
  await page.waitForTimeout(1000 * 60 * 30);
  await browser.close();
};

run().catch((error) => {
  console.error('[LiveDebug] Failed:', error);
  process.exit(1);
});
