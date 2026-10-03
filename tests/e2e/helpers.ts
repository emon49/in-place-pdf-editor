import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';

export const fixturePath = (name: string) => join(import.meta.dirname, '..', 'fixtures', name);

/** Opens a file through the header's "Open PDF" file input. */
export async function openWithPicker(page: Page, path: string): Promise<void> {
  await page.getByTestId('file-input').setInputFiles(path);
}

/** Simulates dragging files from the desktop and dropping them on the app. */
export async function dropFiles(page: Page, files: { name: string; type: string; path: string }[]): Promise<void> {
  const payload = files.map((f) => ({ name: f.name, type: f.type, data: Array.from(readFileSync(f.path)) }));
  const dataTransfer = await page.evaluateHandle((items) => {
    const dt = new DataTransfer();
    for (const f of items) dt.items.add(new File([new Uint8Array(f.data)], f.name, { type: f.type }));
    return dt;
  }, payload);
  const target = page.getByTestId('drop-target');
  await target.dispatchEvent('dragenter', { dataTransfer });
  await target.dispatchEvent('dragover', { dataTransfer });
  await expect(page.getByTestId('drop-highlight')).toBeVisible();
  await target.dispatchEvent('drop', { dataTransfer });
}

/** Waits until the given 0-based page index has finished rendering. */
export async function waitForRenderedPage(page: Page, pageIndex: number): Promise<void> {
  await expect(page.getByTestId('page')).toHaveAttribute('data-rendered-page-index', String(pageIndex));
}

export async function loadSample(page: Page, title: 'Academic Research Paper' | 'Invoice' | 'Technical Spec'): Promise<void> {
  await page.getByLabel('Load sample').selectOption({ label: title });
}
