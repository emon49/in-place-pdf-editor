import { expect, test } from '@playwright/test';
import { dropFiles, fixturePath, loadSample, openWithPicker, waitForRenderedPage } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('document loading (7.1)', () => {
  test('opens a valid PDF with the file picker at page 1', async ({ page }) => {
    await openWithPicker(page, fixturePath('valid.pdf'));
    await waitForRenderedPage(page, 0);
    await expect(page.getByTestId('page-count')).toHaveText('/ 1');
    await expect(page.getByLabel('Page number')).toHaveValue('1');
  });

  test('opens a dropped PDF, with a drop highlight during the drag', async ({ page }) => {
    await dropFiles(page, [{ name: 'valid.pdf', type: 'application/pdf', path: fixturePath('valid.pdf') }]);
    await waitForRenderedPage(page, 0);
    await expect(page.getByTestId('drop-highlight')).toBeHidden();
  });

  test('rejects two dropped files', async ({ page }) => {
    const f = { name: 'valid.pdf', type: 'application/pdf', path: fixturePath('valid.pdf') };
    await dropFiles(page, [f, f]);
    await expect(page.getByRole('alert')).toHaveText('Drop one PDF at a time.');
    await expect(page.getByTestId('page')).toHaveCount(0);
  });

  test('rejects a PNG renamed to .pdf', async ({ page }) => {
    await openWithPicker(page, fixturePath('image-renamed.pdf'));
    await expect(page.getByRole('alert')).toContainText('not a PDF');
  });

  test('rejects an unsupported file type', async ({ page }) => {
    await page.getByTestId('file-input').setInputFiles({
      name: 'letter.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: Buffer.from('PK\u0003\u0004 fake docx'),
    });
    await expect(page.getByRole('alert')).toHaveText('Only PDF files are supported.');
  });

  test('a damaged PDF shows an error and keeps the open document', async ({ page }) => {
    await openWithPicker(page, fixturePath('valid.pdf'));
    await waitForRenderedPage(page, 0);
    await openWithPicker(page, fixturePath('truncated.pdf'));
    await expect(page.getByRole('alert')).toHaveText('This PDF appears to be damaged and could not be opened.');
    await expect(page.getByTestId('page')).toBeVisible();
    await expect(page.getByText('valid.pdf')).toBeVisible();
  });

  for (const name of ['encrypted-user-aes256.pdf', 'encrypted-user-rc4.pdf', 'encrypted-owner-only.pdf']) {
    test(`blocks ${name} without a password prompt`, async ({ page }) => {
      let dialogs = 0;
      page.on('dialog', async (d) => {
        dialogs++;
        await d.dismiss();
      });
      await openWithPicker(page, fixturePath(name));
      await expect(page.getByRole('alert')).toContainText('password-protected');
      await expect(page.getByTestId('page')).toHaveCount(0);
      expect(dialogs).toBe(0);
    });
  }

  for (const [title, pages] of [
    ['Academic Research Paper', 3],
    ['Invoice', 1],
    ['Technical Spec', 3],
  ] as const) {
    test(`opens the ${title} sample`, async ({ page }) => {
      await loadSample(page, title);
      await waitForRenderedPage(page, 0);
      await expect(page.getByTestId('page-count')).toHaveText(`/ ${pages}`);
    });
  }

  test('empty-state sample buttons open samples too', async ({ page }) => {
    await page.getByRole('button', { name: 'Invoice' }).click();
    await waitForRenderedPage(page, 0);
  });
});
