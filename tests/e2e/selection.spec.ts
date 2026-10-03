import { expect, test, type Page } from '@playwright/test';
import { loadSample, waitForRenderedPage } from './helpers';

type Sample = 'Academic Research Paper' | 'Invoice' | 'Technical Spec';

async function openSample(page: Page, sample: Sample, pageIndex = 0) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await loadSample(page, sample);
  await waitForRenderedPage(page, 0);
  if (pageIndex > 0) {
    await page.getByLabel('Page number').fill(String(pageIndex + 1));
    await page.getByLabel('Page number').press('Enter');
    await waitForRenderedPage(page, pageIndex);
  }
  await expect(page.getByTestId('text-box').first()).toBeVisible();
}

const box = (page: Page, name: string | RegExp) => page.getByTestId('page').getByRole('button', { name, exact: typeof name === 'string' });
const row = (page: Page, id: string) => page.locator(`[data-testid="text-row"][data-line-id="${id}"]`);
const zoomPercent = async (page: Page) => parseInt((await page.getByTestId('zoom-level').textContent()) ?? '0', 10) / 100;

/** Clicks the middle of a box with the real pointer. */
async function clickBox(page: Page, name: string) {
  const target = box(page, name);
  await target.scrollIntoViewIfNeeded();
  const rect = await target.boundingBox();
  if (!rect) throw new Error(`No box for ${name}`);
  await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
}

const FIRST_LINES: Record<Sample, string> = {
  'Academic Research Paper': 'On the Invisibility of In-Place Edits',
  Invoice: 'INVOICE',
  'Technical Spec': 'Widget Controller - Technical Specification',
};

test.describe('selecting text on the page (9.1)', () => {
  for (const sample of Object.keys(FIRST_LINES) as Sample[]) {
    test(`${sample}: click shows the box, the selection ring and the matching sidebar row`, async ({ page }) => {
      await openSample(page, sample);
      const name = FIRST_LINES[sample];
      await clickBox(page, name);
      const selected = box(page, name);
      await expect(selected).toHaveAttribute('aria-pressed', 'true');
      await expect(selected).toHaveClass(/ring-blue-600/);
      await expect(selected.locator('span[aria-hidden="true"]')).toHaveCount(4);
      const id = await selected.getAttribute('data-line-id');
      await expect(row(page, id ?? '')).toHaveAttribute('aria-pressed', 'true');
      await expect(row(page, id ?? '')).toContainText(name);
      await expect(page.getByTestId('page').getByRole('button', { pressed: true })).toHaveCount(1);
    });
  }

  test('clicking empty page space clears the selection', async ({ page }) => {
    await openSample(page, 'Invoice');
    await clickBox(page, 'INVOICE');
    await expect(box(page, 'INVOICE')).toHaveAttribute('aria-pressed', 'true');
    const pageBox = await page.getByTestId('page').boundingBox();
    const viewerBox = await page.getByTestId('viewer').boundingBox();
    if (!pageBox || !viewerBox) throw new Error('no page');
    // The right-hand margin of the page, level with the middle of what is visible: no text there.
    const visibleMiddle = Math.max(pageBox.y, viewerBox.y) + Math.min(pageBox.height, viewerBox.height) / 2;
    await page.mouse.click(pageBox.x + pageBox.width - 8, visibleMiddle);
    await expect(page.getByTestId('page').getByRole('button', { pressed: true })).toHaveCount(0);
  });

  test('a row selects its object and a page selection reveals its row', async ({ page }) => {
    await openSample(page, 'Academic Research Paper');
    const lastRow = page.getByTestId('text-row').last();
    await lastRow.click();
    const id = (await lastRow.getAttribute('data-line-id')) ?? '';
    await expect(page.locator(`[data-testid="text-box"][data-line-id="${id}"]`)).toHaveAttribute('aria-pressed', 'true');
    // And the other way: select the first object on the page, its row is highlighted.
    await clickBox(page, FIRST_LINES['Academic Research Paper']);
    await expect(row(page, '0:0')).toHaveAttribute('aria-pressed', 'true');
  });

  test('the word-by-word line is one object and the invoice row cells stay separate', async ({ page }) => {
    await openSample(page, 'Academic Research Paper');
    await expect(box(page, 'Keywords: layout, typography, fonts, masks')).toBeVisible();
    await loadSample(page, 'Invoice');
    await waitForRenderedPage(page, 0);
    for (const cell of ['Design consultation (hours)', '6', '$85.00', '$510.00']) await expect(box(page, cell)).toBeVisible();
  });

  test('selection resets when the page changes', async ({ page }) => {
    await openSample(page, 'Technical Spec');
    await clickBox(page, FIRST_LINES['Technical Spec']);
    await page.getByRole('button', { name: 'Next page' }).click();
    await waitForRenderedPage(page, 1);
    await expect(page.getByTestId('page').getByRole('button', { pressed: true })).toHaveCount(0);
  });
});

test.describe('alignment and locked objects (9.2)', () => {
  test('boxes stay aligned with the page across zoom levels', async ({ page }) => {
    await openSample(page, 'Invoice');
    await page.getByRole('button', { name: /reset to 100%/ }).click();
    await expect(page.getByTestId('zoom-level')).toHaveText('100%');
    const measure = async () => {
      const zoom = await zoomPercent(page);
      const pageRect = await page.getByTestId('page').boundingBox();
      const rect = await box(page, 'INVOICE').boundingBox();
      if (!pageRect || !rect) throw new Error('missing geometry');
      // Page Space x = 450 pt; the box starts there in Display points × zoom.
      return { left: (rect.x - pageRect.x) / zoom, width: rect.width / zoom };
    };
    const at100 = await measure();
    expect(at100.left).toBeCloseTo(450, 0);
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Zoom in' }).click();
    expect(await zoomPercent(page)).toBeGreaterThan(2);
    await waitForRenderedPage(page, 0);
    const zoomed = await measure();
    expect(zoomed.left).toBeCloseTo(at100.left, 0);
    expect(zoomed.width).toBeCloseTo(at100.width, 0);
  });

  test('boxes cover the drawn glyphs: ink lies inside the box and not in blank space above it', async ({ page }) => {
    await openSample(page, 'Invoice');
    await page.getByRole('button', { name: /reset to 100%/ }).click();
    await waitForRenderedPage(page, 0);
    const result = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="page"] canvas');
      const target = document.querySelector<HTMLElement>('[data-testid="text-box"][aria-label="INVOICE"]');
      const host = document.querySelector<HTMLElement>('[data-testid="page"]');
      if (!canvas || !target || !host) throw new Error('missing elements');
      const scale = canvas.width / host.clientWidth;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      const inkIn = (x: number, y: number, w: number, h: number) => {
        const data = ctx.getImageData(Math.round(x * scale), Math.round(y * scale), Math.round(w * scale), Math.round(h * scale)).data;
        let ink = 0;
        for (let i = 0; i < data.length; i += 4) if ((data[i] ?? 255) < 128) ink++;
        return ink;
      };
      const r = { x: target.offsetLeft, y: target.offsetTop, w: target.offsetWidth, h: target.offsetHeight };
      return { inside: inkIn(r.x, r.y, r.w, r.h), above: inkIn(r.x, r.y - r.h - 2, r.w, r.h) };
    });
    expect(result.inside).toBeGreaterThan(50);
    expect(result.above).toBe(0);
  });

  test('on the /Rotate 90 page boxes appear over the landscape text', async ({ page }, testInfo) => {
    await openSample(page, 'Technical Spec', 1);
    await page.getByRole('button', { name: /reset to 100%/ }).click();
    await waitForRenderedPage(page, 1);
    const pageRect = await page.getByTestId('page').boundingBox();
    expect(pageRect && pageRect.width > pageRect.height).toBe(true);
    const title = box(page, 'Register map (landscape)');
    await expect(title).toBeVisible();
    const rect = await title.boundingBox();
    if (!pageRect || !rect) throw new Error('missing geometry');
    expect(rect.width).toBeGreaterThan(rect.height * 4); // horizontal in the displayed orientation
    expect(rect.x - pageRect.x).toBeCloseTo(54, 0);
    await expect(page.getByTestId('text-box').and(page.locator('[data-locked]'))).toHaveCount(0);
    // Show both states in the evidence: one selected object and one hovered object.
    await title.click();
    await box(page, 'CTRL').hover();
    const screenshot = await page.getByTestId('viewer').screenshot({ path: testInfo.outputPath('overlay-on-rotated-page.png') });
    await testInfo.attach('overlay-on-rotated-page', { body: screenshot, contentType: 'image/png' });
  });

  test('the rotated watermark is locked, explains itself on hover, and can still be selected', async ({ page }) => {
    await openSample(page, 'Technical Spec');
    const watermark = box(page, /DRAFT SAMPLE/);
    await expect(watermark).toHaveAttribute('data-locked', 'true');
    await watermark.hover({ force: true });
    await expect(page.getByRole('tooltip')).toHaveText('Rotated or skewed text cannot be edited in this version.');
    await watermark.click({ force: true });
    await expect(watermark).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-testid="text-row"]', { hasText: 'DRAFT SAMPLE' })).toContainText('Locked');
  });

  test('a line over the logo image warns that a mask may be visible once backgrounds are sampled', async ({ page }) => {
    await openSample(page, 'Invoice');
    await expect(page.getByTestId('text-overlay')).toHaveAttribute('data-sampled', 'true', { timeout: 10_000 });
    await box(page, /^LOGO/).click({ force: true });
    await expect(page.getByTestId('mask-warning')).toContainText('may leave a visible mark');
    await box(page, 'INVOICE').click({ force: true });
    await expect(page.getByTestId('mask-warning')).toHaveCount(0);
  });
});

test.describe('keyboard and sidebar (9.3)', () => {
  test('Tab steps through objects in reading order, Escape clears, and the selection scrolls into view', async ({ page }) => {
    await openSample(page, 'Academic Research Paper');
    await page.getByTestId('viewer').focus();
    const pressed = page.getByTestId('page').getByRole('button', { pressed: true });
    await page.keyboard.press('Tab');
    await expect(pressed).toHaveAttribute('data-line-id', '0:0');
    await page.keyboard.press('Tab');
    await expect(pressed).toHaveAttribute('data-line-id', '0:1');
    await page.keyboard.press('Shift+Tab');
    await expect(pressed).toHaveAttribute('data-line-id', '0:0');
    await page.keyboard.press('Escape');
    await expect(pressed).toHaveCount(0);

    // Walk far enough down the page that the selected object has to be scrolled into view.
    await page.getByTestId('viewer').focus();
    const total = await page.getByTestId('text-box').count();
    for (let i = 0; i < total; i++) await page.keyboard.press('Tab');
    await expect(pressed).toHaveAttribute('data-line-id', `0:${total - 1}`);
    await expect(pressed).toBeInViewport();
  });

  test('the sidebar tab and its list work without a pointer', async ({ page }) => {
    await openSample(page, 'Invoice');
    const tab = page.getByRole('tab', { name: 'Text Objects' });
    await tab.focus();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowRight'); // the only tab: selection stays
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('button', { name: 'Collapse sidebar' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('sidebar')).toHaveAttribute('data-open', 'false');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('sidebar')).toHaveAttribute('data-open', 'true');
    await expect(page.getByRole('tab', { name: 'Text Objects' })).toHaveAttribute('aria-selected', 'true');
    // Rows are reachable by keyboard and Enter selects.
    await page.locator('[data-testid="text-row"][data-line-id="0:3"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-testid="text-box"][data-line-id="0:3"]')).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('layout (8.4)', () => {
  test('fit-to-width recomputes the zoom when the sidebar collapses', async ({ page }) => {
    await openSample(page, 'Invoice');
    await page.getByRole('button', { name: /fit to width/i }).click();
    await waitForRenderedPage(page, 0);
    const narrow = await zoomPercent(page);
    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    await expect.poll(() => zoomPercent(page)).toBeGreaterThan(narrow);
    await page.getByRole('button', { name: 'Open sidebar' }).click();
    await expect.poll(() => zoomPercent(page)).toBeCloseTo(narrow, 1);
  });
});
