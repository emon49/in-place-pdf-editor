// Renders scripts/og-image/og-image.html to public/og-image.png (1200×630 link-preview image).
// Usage: node scripts/og-image/render.mjs
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const html = new URL('./og-image.html', import.meta.url);
const out = fileURLToPath(new URL('../../public/og-image.png', import.meta.url));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(html.href);
// Runs in the page, where `document` exists.
await page.evaluate('document.fonts.ready');
await page.screenshot({ path: out });
await browser.close();
console.log(`Wrote ${out}`);
