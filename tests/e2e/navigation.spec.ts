import { expect, test } from '@playwright/test';
import { loadSample, waitForRenderedPage } from './helpers';

const zoomLevel = (page: import('@playwright/test').Page) => page.getByTestId('zoom-level');

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await loadSample(page, 'Technical Spec');
  await waitForRenderedPage(page, 0);
});

test.describe('page navigation (7.2)', () => {
  test('buttons, page input and keyboard', async ({ page }) => {
    await page.getByRole('button', { name: 'Next page' }).click();
    await waitForRenderedPage(page, 1);
    await expect(page.getByLabel('Page number')).toHaveValue('2');

    const input = page.getByLabel('Page number');
    await input.fill('3');
    await input.press('Enter');
    await waitForRenderedPage(page, 2);

    await input.fill('12');
    await input.press('Enter');
    await expect(input).toHaveValue('3');

    await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled();
    await page.getByTestId('viewer').focus();
    await page.keyboard.press('PageDown');
    await waitForRenderedPage(page, 2);
    await page.keyboard.press('Home');
    await waitForRenderedPage(page, 0);
    await page.keyboard.press('End');
    await waitForRenderedPage(page, 2);
    await page.keyboard.press('PageUp');
    await waitForRenderedPage(page, 1);
  });

  test('rapid next-page presses end on the latest page', async ({ page }) => {
    await loadSample(page, 'Academic Research Paper');
    await waitForRenderedPage(page, 0);
    const next = page.getByRole('button', { name: 'Next page' });
    await next.click();
    await next.click();
    await waitForRenderedPage(page, 2);
    await expect(page.getByLabel('Page number')).toHaveValue('3');
  });
});

test.describe('zoom (7.2)', () => {
  test('presets, bounds and keyboard shortcuts', async ({ page }) => {
    await page.getByRole('button', { name: /reset to 100%/ }).click();
    await expect(zoomLevel(page)).toHaveText('100%');
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await expect(zoomLevel(page)).toHaveText('125%');
    await page.getByRole('button', { name: 'Zoom out' }).click();
    await page.getByRole('button', { name: 'Zoom out' }).click();
    await expect(zoomLevel(page)).toHaveText('75%');

    await page.getByTestId('viewer').focus();
    await page.keyboard.press('Control+0');
    await expect(zoomLevel(page)).toHaveText('100%');
    for (let i = 0; i < 6; i++) await page.keyboard.press('Control+=');
    await expect(zoomLevel(page)).toHaveText('400%');
    await expect(page.getByRole('button', { name: 'Zoom in' })).toBeDisabled();
    await page.keyboard.press('Control+-');
    await expect(zoomLevel(page)).toHaveText('300%');
  });

  test('fit to page fits the /Rotate 90 page in landscape', async ({ page }) => {
    await page.getByRole('button', { name: 'Fit to page' }).click();
    await page.getByRole('button', { name: 'Next page' }).click();
    await waitForRenderedPage(page, 1);
    const pageBox = await page.getByTestId('page').boundingBox();
    const viewerBox = await page.getByTestId('viewer').boundingBox();
    expect(pageBox && viewerBox).toBeTruthy();
    if (!pageBox || !viewerBox) return;
    expect(pageBox.width).toBeGreaterThan(pageBox.height); // landscape, consistent with /Rotate 90
    expect(pageBox.width / pageBox.height).toBeCloseTo(792 / 612, 2);
    expect(pageBox.width).toBeLessThanOrEqual(viewerBox.width);
    expect(pageBox.height).toBeLessThanOrEqual(viewerBox.height);
    await expect(page.getByRole('button', { name: 'Fit to page' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('page').screenshot({ path: test.info().outputPath('rotated-page.png') });
    await test.info().attach('rotated-page', { path: test.info().outputPath('rotated-page.png'), contentType: 'image/png' });
  });

  test('explicit zoom leaves fit-to-width', async ({ page }) => {
    await page.getByRole('button', { name: 'Fit to width' }).click();
    await expect(page.getByRole('button', { name: 'Fit to width' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await expect(page.getByRole('button', { name: 'Fit to width' })).toHaveAttribute('aria-pressed', 'false');
  });
});
