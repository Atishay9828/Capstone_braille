import { defineConfig, devices } from '@playwright/test';

/**
 * Journey tests. These are the "evidence, not assertion" half of CLAUDE.md Law 7: a build that
 * compiles has proven nothing, so every arc closes with a headless walk of the real screens plus
 * screenshots at three widths.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://127.0.0.1:4173',
    // Always build and serve fresh. Reusing a server that is holding an older dist produced a
    // genuinely confusing false failure once already; a slower gate that tells the truth is
    // worth more than a fast one that does not.
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
