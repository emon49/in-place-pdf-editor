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

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    cspPlugin(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icon.svg', 'pdfjs/**/*'],
      manifest: {
        name: 'PDF In-Place Editor',
        short_name: 'PDF Editor',
        description: 'Edit PDFs in place, privately, in your browser.',
        display: 'standalone',
        start_url: '/',
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
