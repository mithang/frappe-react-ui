import { defineConfig, devices } from '@playwright/test';

/**
 * E2E runs same-site cross-origin, not through the Vite dev proxy — the whole point of this
 * suite is to exercise the real cookie/CORS/CSRF path a standalone-SPA deployment gets in
 * production. `*.localtest.me` resolves to 127.0.0.1 with no /etc/hosts changes needed.
 */
export const SPA_ORIGIN = 'http://app.localtest.me:5173';
export const BENCH_ORIGIN = 'http://erp.localtest.me:8000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: SPA_ORIGIN,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // vite.config.ts already binds 0.0.0.0:5000 with allowedHosts: true, so *.localtest.me
    // resolving to 127.0.0.1 reaches it without any extra host flag here.
    command: 'npm run dev',
    url: SPA_ORIGIN,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
