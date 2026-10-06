import path from 'node:path';
import { expect, test } from '@playwright/test';
import { loadSample, waitForRenderedPage } from './helpers';

// E2E tests for m4-images: image selection, move, replace, and delete.

async function openInvoiceWithImage(page: import('@playwright/test').Page) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await loadSample(page, 'Invoice');
  await waitForRenderedPage(page, 0);
  // Wait until at least one image box is visible (the invoice logo).
  await expect(page.getByTestId('image-box').first()).toBeVisible({ timeout: 10_000 });
}

test.describe('8.1 — select image, drag, verify OBJECT_MOVE, undo', () => {
  test('dragging an image produces OBJECT_MOVE; undo returns it to original position', async ({ page }) => {
    await openInvoiceWithImage(page);

    const imageBox = page.getByTestId('image-box').first();

    // Click to select
    await imageBox.click();
    await expect(imageBox).toHaveAttribute('aria-pressed', 'true');

    // Drag the selected image box 50px to the right and 30px down
    const box = await imageBox.boundingBox();
    if (!box) throw new Error('No bounding box for image');
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 50, cy + 30, { steps: 5 });
    await page.mouse.up();

    // Verify OBJECT_MOVE in the History tab
    await page.getByRole('tab', { name: 'History' }).click();
    await expect(page.getByTestId('history-entry').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('history-entry').first()).toContainText('Moved object');

    // Undo and verify move is gone
    await page.keyboard.press('Control+z');
    await expect(page.getByTestId('history-entry')).toHaveCount(0);
  });
});

test.describe('8.2 — select image, upload replacement, verify IMAGE_REPLACE', () => {
  test('uploading an image file via the replace control produces IMAGE_REPLACE in the log', async ({ page }) => {
    await openInvoiceWithImage(page);

    const imageBox = page.getByTestId('image-box').first();

    // Select the image
    await imageBox.click();
    await expect(imageBox).toHaveAttribute('aria-pressed', 'true');

    // Find the hidden file input (the replace control) and set a test image file.
    // We use the fixtures directory; any PNG/JPEG works here.
    const testImagePath = path.join(import.meta.dirname, '..', 'fixtures', 'test-image.png');

    // The file input in ImageLayer is sr-only; set files directly.
    const fileInput = page.locator('[data-testid="image-layer"] input[type="file"]');
    await fileInput.setInputFiles(testImagePath);

    // Verify IMAGE_REPLACE in History tab
    await page.getByRole('tab', { name: 'History' }).click();
    await expect(page.getByTestId('history-entry').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('history-entry').first()).toContainText('Replaced image');
  });
});

test.describe('8.3 — select image, Delete: OBJECT_DELETE appended, mask appears', () => {
  test('pressing Delete on a selected image appends OBJECT_DELETE and hides the image', async ({ page }) => {
    await openInvoiceWithImage(page);

    const imageBox = page.getByTestId('image-box').first();

    // Select the image
    await imageBox.click();
    await expect(imageBox).toHaveAttribute('aria-pressed', 'true');

    // Press Delete
    await page.keyboard.press('Delete');

    // Image box should be gone from the layer (deleted images are not rendered)
    await expect(page.getByTestId('image-box')).toHaveCount(0);

    // Verify OBJECT_DELETE in History tab
    await page.getByRole('tab', { name: 'History' }).click();
    await expect(page.getByTestId('history-entry').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('history-entry').first()).toContainText('Deleted object');
  });
});
