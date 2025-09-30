import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    actionTimeout: 15_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },

  // Separate projects for web and electron tests
  projects: [
    {
      name: 'web',
      testMatch: /tests\/web\/.*\.spec\.(ts|js)/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:1420',
      }
    },
    {
      name: 'electron',
      testMatch: /tests\/electron\/.*\.spec\.(ts|js)/,
      use: {
        ...devices['Desktop Chrome']
      }
    }
  ],

  // Auto-start dev server for web tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:1420',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe'
  }
});


