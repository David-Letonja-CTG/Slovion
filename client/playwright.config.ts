import { defineConfig, devices } from '@playwright/test';

const ci = !!process.env['CI'];

/**
 * End-to-end tests against the real API and client. PostgreSQL must be running
 * (`docker compose up -d db` locally, a service container in CI).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: ci ? 1 : 0,
  reporter: ci ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4200',
    viewport: { width: 1280, height: 720 },
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
    },
  ],
  webServer: [
    {
      // /health answers 200 only once the database is reachable and migrations ran.
      command: 'dotnet run --project ../src/Slovion.Api --no-launch-profile',
      url: 'http://localhost:5080/health',
      env: { ASPNETCORE_URLS: 'http://localhost:5080', ASPNETCORE_ENVIRONMENT: 'Development' },
      reuseExistingServer: !ci,
      timeout: 180_000,
    },
    {
      command: 'npm start -- --port 4200',
      url: 'http://localhost:4200',
      reuseExistingServer: !ci,
      timeout: 180_000,
    },
  ],
});
