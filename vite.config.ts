/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { cspMetaValue, headersFile, securityHeaders } from './csp.ts';

/** Injects the CSP <meta> fallback and emits `_headers` in production builds only (dev needs inline HMR scripts). */
function cspPlugin(): Plugin {
  return {
    name: 'app-csp',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: cspMetaValue() },
        injectTo: 'head-prepend',
      },
    ],
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: '_headers', source: headersFile() });
    },
  };
}

const TITLE = 'Seamless PDF';
const DESCRIPTION = 'Fix any PDF in place: click a line, type the change, keep the same font, size and colour. Runs in your browser; nothing is uploaded.';

/** Open Graph / Twitter tags. Link previews need absolute URLs, so they are built from the public site URL. */
function socialMetaPlugin(siteUrl: string): Plugin {
  const image = new URL('og-image.png', siteUrl).href;
  const meta = (attr: 'property' | 'name', key: string, content: string) => ({
    tag: 'meta',
    attrs: { [attr]: key, content },
    injectTo: 'head' as const,
  });
  return {
    name: 'app-social-meta',
    transformIndexHtml: () => [
      meta('property', 'og:type', 'website'),
      meta('property', 'og:site_name', TITLE),
      meta('property', 'og:title', `${TITLE}: fix any PDF in place`),
      meta('property', 'og:description', DESCRIPTION),
      meta('property', 'og:url', siteUrl),
      meta('property', 'og:image', image),
      meta('property', 'og:image:width', '1200'),
      meta('property', 'og:image:height', '630'),
      meta('property', 'og:image:alt', 'Seamless PDF editing a line of an invoice in place'),
      meta('name', 'twitter:card', 'summary_large_image'),
      meta('name', 'twitter:title', `${TITLE}: fix any PDF in place`),
      meta('name', 'twitter:description', DESCRIPTION),
      meta('name', 'twitter:image', image),
    ],
  };
}

// Served from a subpath on GitHub Pages (`/<repo>/`); the deploy workflow sets BASE_PATH.
const base = process.env.BASE_PATH ?? '/';
// Public address of the site, for absolute link-preview URLs; the deploy workflow sets SITE_URL.
const siteUrl = process.env.SITE_URL ?? 'https://emon49.github.io/seamlessPDF/';

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    cspPlugin(),
    socialMetaPlugin(siteUrl),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icon.svg', 'pdfjs/**/*'],
      manifest: {
        name: 'Seamless PDF',
        short_name: 'Seamless PDF',
        description: 'Edit PDFs in place, privately, in your browser.',
        display: 'standalone',
        start_url: base,
        scope: base,
        background_color: '#f8fafc',
        theme_color: '#1e293b',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,ico,wasm,bcmap,pfb,ttf,icc,webmanifest}'],
        // Substitute fonts (~13 MB) load on demand and are kept by the font fetcher's own cache.
        globIgnores: ['fonts/**'],
        // PDF.js worker and CMap/font data are large; precache everything the app may need offline.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    }),
  ],
  preview: { headers: securityHeaders(), port: 4173, strictPort: true },
  worker: { format: 'es' },
  test: {
    include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/integration/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    testTimeout: 20000,
  },
});
