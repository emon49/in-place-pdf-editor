import { expect, test } from '@playwright/test';

test('app shell loads with Tailwind styles and Lucide icons', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('PDF In-Place Editor');
  const heading = page.getByRole('heading', { name: 'PDF In-Place Editor' });
  await expect(heading).toHaveCSS('font-weight', '600');
  await expect(page.locator('svg.lucide').first()).toBeVisible();
});
