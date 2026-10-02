import { defineConfig, devices } from '@playwright/test';

const ci = !!process.env['CI'];
// Ports are configurable so the tests can run next to a developer's own servers.
const apiPort = process.env['E2E_API_PORT'] ?? '5080';
const clientPort = process.env['E2E_CLIENT_PORT'] ?? '4200';
const apiUrl = `http://localhost:${apiPort}`;

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
    baseURL: `http://localhost:${clientPort}`,
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
      // Release build: its output folder is not locked by a developer's running Debug API.
      command:
        'dotnet run --project ../src/Slovion.Api --configuration Release --no-launch-profile',
      url: `${apiUrl}/health`,
      env: { ASPNETCORE_URLS: apiUrl, ASPNETCORE_ENVIRONMENT: 'Development' },
      reuseExistingServer: !ci,
      timeout: 180_000,
    },
    {
      command: `npm start -- --port ${clientPort}`,
      url: `http://localhost:${clientPort}`,
      env: { SLOVION_API_URL: apiUrl },
      reuseExistingServer: !ci,
      timeout: 180_000,
    },
  ],
});
