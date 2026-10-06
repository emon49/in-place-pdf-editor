import { expect, test } from '@playwright/test';
import { loadSample, waitForRenderedPage } from './helpers';

// E2E tests for m5-export: export PDF functionality.

async function openInvoiceAndEdit(page: import('@playwright/test').Page) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await loadSample(page, 'Invoice');
  await waitForRenderedPage(page, 0);
  await expect(page.getByTestId('text-box').first()).toBeVisible();

  // Edit the INVOICE heading
  const invoiceBox = page.getByTestId('text-box').filter({ hasText: 'INVOICE' }).first();
  await invoiceBox.dblclick();
  const editor = page.getByTestId('inline-text-editor');
  await expect(editor).toBeVisible();
  await editor.fill('EDITED_INVOICE');
  await editor.press('Enter');
  await expect(page.getByTestId('patch').first()).toBeVisible({ timeout: 3000 });
}

test.describe('EX-1 — export modal opens and accepts filename', () => {
  test('Export PDF button in header opens the export modal', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await loadSample(page, 'Invoice');
    await waitForRenderedPage(page, 0);

    await page.getByTestId('export-button').click();
    await expect(page.getByTestId('export-modal')).toBeVisible();
    await expect(page.getByTestId('export-filename')).toBeVisible();
    // Default filename ends with -edited
    const value = await page.getByTestId('export-filename').inputValue();
    expect(value).toMatch(/-edited$/);
  });

  test('Ctrl+S opens the export modal', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await loadSample(page, 'Invoice');
    await waitForRenderedPage(page, 0);

    await page.keyboard.press('Control+s');
    await expect(page.getByTestId('export-modal')).toBeVisible();
  });

  test('Close button dismisses the modal', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await loadSample(page, 'Invoice');
    await waitForRenderedPage(page, 0);

    await page.getByTestId('export-button').click();
    await expect(page.getByTestId('export-modal')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByTestId('export-modal')).not.toBeVisible();
  });
});

test.describe('EX-2 — export download produces a valid PDF', () => {
  test('export after text edit triggers a PDF download with non-zero size', async ({ page }) => {
    await openInvoiceAndEdit(page);

    await page.getByTestId('export-button').click();
    await expect(page.getByTestId('export-modal')).toBeVisible();

    // Start waiting for download before clicking the button
    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
    await page.getByTestId('export-download-button').click();

    // Wait for export to complete (size label appears)
    await expect(page.getByTestId('export-size')).toBeVisible({ timeout: 30_000 });
    const sizeText = await page.getByTestId('export-size').textContent();
    expect(sizeText).toMatch(/\d+(\.\d+)?\s*(B|KB|MB)/);

    // Download happened
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  });
});

test.describe('EX-3 — no document data leaves the origin during export', () => {
  test('export does not make external network requests', async ({ page, baseURL }) => {
    const origin = new URL(baseURL ?? '').origin;
    const externalRequests: string[] = [];

    page.on('request', (r) => {
      const url = r.url();
      if (!url.startsWith(origin) && !url.startsWith('blob:') && !url.startsWith('data:')) {
        externalRequests.push(url);
      }
    });

    await openInvoiceAndEdit(page);

    await page.getByTestId('export-button').click();
    await expect(page.getByTestId('export-modal')).toBeVisible();
    await page.getByTestId('export-download-button').click();

    // Wait for export to complete
    await expect(page.getByTestId('export-size')).toBeVisible({ timeout: 30_000 });

    // No external requests should have been made
    expect(externalRequests).toEqual([]);
  });
});
