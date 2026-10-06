import { expect, test } from '@playwright/test';
import { fixturePath, loadSample, openWithPicker, waitForRenderedPage } from './helpers';

test('works offline after the first visit (7.4)', async ({ page, context }) => {
  await page.goto('/');
  // Wait until the service worker has installed, precached everything and controls the page.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Open a PDF to start editing' })).toBeVisible();

  await openWithPicker(page, fixturePath('valid.pdf'));
  await waitForRenderedPage(page, 0);

  await loadSample(page, 'Invoice');
  await expect(page.getByText('invoice.pdf')).toBeVisible();
  await waitForRenderedPage(page, 0);
  await context.setOffline(false);
});
