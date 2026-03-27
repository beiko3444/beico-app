const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

async function testLogin() {
    const browser = await chromium.launch({
        headless: false,
        channel: 'chrome', // Use local Chrome
    });
    const page = await browser.newPage();

    console.log('Navigating to login...');
    await page.goto('https://www.moinbizplus.com/login', { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(__dirname, 'login_start.png') });

    console.log('Typing email...');
    const emailInput = page.locator('input[name="email"]').first();
    await emailInput.fill('');
    await emailInput.pressSequentially('xtracker@naver.com', { delay: 50 });

    console.log('Typing password...');
    const passInput = page.locator('input[name="password"]').first();
    await passInput.fill('');
    await passInput.pressSequentially('dummy_password123!', { delay: 50 });

    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(__dirname, 'login_filled.png') });

    console.log('Finding submit button...');
    const btn = page.locator('button[type="submit"]:has-text("로그인")').first();
    const isDisabled = await btn.isDisabled();
    console.log('Button isDisabled:', isDisabled);

    if (!isDisabled) {
        console.log('Clicking login...');
        await btn.click();
        await page.waitForTimeout(3000);
        console.log('After click URL:', page.url());
        await page.screenshot({ path: path.join(__dirname, 'login_after_click.png') });
    }

    await browser.close();
    console.log('Done');
}

testLogin().catch(console.error);
