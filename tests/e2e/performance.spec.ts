import { expect, test } from '@playwright/test';
import { statSync } from 'node:fs';
import { PERF_FIXTURE } from './global-setup';
import { openWithPicker, waitForRenderedPage } from './helpers';

test('first page of a 10-page, 5 MB PDF renders within 2 s (7.5)', async ({ page }) => {
  const size = statSync(PERF_FIXTURE).size;
  expect(size).toBeGreaterThan(4.5 * 1024 * 1024);
  await page.goto('/');
  // Warm up the PDF.js worker once so the measurement reflects opening a document, as in normal use.
  await page.waitForLoadState('networkidle');

  const start = Date.now();
  await openWithPicker(page, PERF_FIXTURE);
  await waitForRenderedPage(page, 0);
  const elapsed = Date.now() - start;

  await expect(page.getByTestId('page-count')).toHaveText('/ 10');
  test.info().annotations.push({ type: 'first-page-ms', description: `${elapsed} ms for ${(size / 1048576).toFixed(1)} MB` });
  console.log(`First page rendered in ${elapsed} ms (${(size / 1048576).toFixed(1)} MB, 10 pages)`);
  expect(elapsed).toBeLessThan(2000);
});
