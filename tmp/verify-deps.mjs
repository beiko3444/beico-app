import { createRequire } from 'module';
const require = createRequire(import.meta.url);

try {
    const c = require('@sparticuz/chromium');
    console.log('✅ @sparticuz/chromium loaded, executablePath:', typeof c.executablePath);
} catch (e) {
    console.log('❌ @sparticuz/chromium ERROR:', e.message);
}

try {
    const p = require('playwright-core');
    console.log('✅ playwright-core loaded, chromium:', typeof p.chromium);
} catch (e) {
    console.log('❌ playwright-core ERROR:', e.message);
}
