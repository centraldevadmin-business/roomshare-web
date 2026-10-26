import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './test/e2e',
  testMatch: '**/*.test.mjs',
  timeout: 30 * 1000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporters: ['list'],
  use: {
    // Default: local dev server. Point at another environment (e.g. the
    // Cloudflare Pages production site) with E2E_BASE_URL=... npx playwright test
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
})
