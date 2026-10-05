import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  reporter: [['list']],
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // smoke suite: cross-browser coverage for the core workflow (task 7.1).
    { name: 'smoke-firefox', testMatch: '**/smoke.spec.ts', use: { ...devices['Desktop Firefox'] } },
    { name: 'smoke-webkit', testMatch: '**/smoke.spec.ts', use: { ...devices['Desktop Safari'] } },
  ],
  // E2E always runs against the production build so the real CSP and service worker are exercised.
  webServer: {
    command: 'npm run build && npm run preview',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
