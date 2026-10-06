import { expect, test } from '@playwright/test';
import { cspHeaderValue } from '../../csp';

test.describe('app shell build (6.1, 6.2)', () => {
  test('pages are served with the strict CSP header', async ({ request }) => {
    const res = await request.get('/');
    expect(res.headers()['content-security-policy']).toBe(cspHeaderValue());
  });

  test('service worker precaches the shell, PDF.js worker and data, icons and samples', async ({ request }) => {
    const sw = await (await request.get('/sw.js')).text();
    for (const asset of [
      'index.html',
      'pdf.worker.min',
      'pdfjs/cmaps/',
      'pdfjs/standard_fonts/LiberationSans-Regular.ttf',
      'pdfjs/wasm/openjpeg.wasm',
      'pdfjs/iccs/',
      'icon-192.png',
      'icon-512.png',
      'sample-documents',
      'manifest.webmanifest',
    ]) {
      expect(sw, `precache should include ${asset}`).toContain(asset);
    }
  });

  test('web app manifest makes the app installable', async ({ request }) => {
    const manifest = await (await request.get('/manifest.webmanifest')).json();
    expect(manifest).toMatchObject({ name: 'Seamless PDF', display: 'standalone', start_url: '/' });
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
    for (const icon of manifest.icons as { src: string }[]) {
      expect((await request.get(`/${icon.src}`)).ok()).toBe(true);
    }
  });
});
