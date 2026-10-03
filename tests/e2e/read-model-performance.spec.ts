import { expect, test, type Page } from '@playwright/test';
import { PERF_FIXTURE } from './global-setup';
import { loadSample, openWithPicker, waitForRenderedPage } from './helpers';

/**
 * Task 9.4: extraction and sampling stay off the interaction path (text-extraction and color-detection specs).
 * Times are reported, and generous bounds only guard against a regression that blocks the UI.
 */
async function measure(page: Page, label: string, open: () => Promise<void>) {
  const start = Date.now();
  await open();
  await waitForRenderedPage(page, 0);
  const rendered = Date.now() - start;

  // Controls respond while extraction and sampling are still running.
  const zoomBefore = await page.getByTestId('zoom-level').textContent();
  const clickedAt = Date.now();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(page.getByTestId('zoom-level')).not.toHaveText(zoomBefore ?? '');
  const controlLatency = Date.now() - clickedAt;

  await expect(page.getByTestId('text-row').first()).toBeVisible({ timeout: 15_000 });
  const extracted = Date.now() - start;
  await expect(page.getByTestId('text-overlay')).toHaveAttribute('data-sampled', 'true', { timeout: 15_000 });
  const sampled = Date.now() - start;

  const summary = `${label}: first page ${rendered} ms, text detected ${extracted} ms, backgrounds sampled ${sampled} ms, zoom click answered in ${controlLatency} ms`;
  console.log(summary);
  test.info().annotations.push({ type: 'read-model-timing', description: summary });
  return { rendered, extracted, sampled, controlLatency };
}

test('10-page 5 MB fixture: the first page stays within 2 s while text is detected (9.4)', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const t = await measure(page, 'perf fixture (10 pages, 5 MB)', () => openWithPicker(page, PERF_FIXTURE));
  expect(t.rendered).toBeLessThan(2000);
  expect(t.controlLatency).toBeLessThan(1000);
});

test('heaviest sample: controls respond while text is detected and sampled (9.4)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const t = await measure(page, 'Academic Research Paper', () => loadSample(page, 'Academic Research Paper'));
  expect(t.rendered).toBeLessThan(2000);
  expect(t.controlLatency).toBeLessThan(1000);
});
