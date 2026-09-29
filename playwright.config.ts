import { defineConfig, devices } from '@playwright/test';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Load .env.test for local credential overrides (gitignored)
// ---------------------------------------------------------------------------
const envFile = resolve(process.cwd(), '.env.test');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8443';

// ---------------------------------------------------------------------------
// RUNNING LOCALLY
// ---------------------------------------------------------------------------
// Option A — two terminals (recommended, most reliable):
//   Terminal 1:  npx vite --port 8443
//   Terminal 2:  npx playwright test --headed --workers=1
//
// Option B — interactive UI (watch tests in real browser):
//   Terminal 1:  npx vite --port 8443
//   Terminal 2:  npx playwright test --ui
//
// Option C — let Playwright start the server automatically:
//   npx playwright test --headed --workers=1
//   (requires npx to find vite — set SKIP_WEBSERVER=1 if you already started it)
// ---------------------------------------------------------------------------

const skipWebServer = process.env.SKIP_WEBSERVER === '1';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  retries: process.env.CI ? 2 : 1,

  // Auto-start dev server (skipped when SKIP_WEBSERVER=1 or server already up)
  webServer: skipWebServer ? undefined : {
    // Use node to run vite directly from node_modules — works without pnpm/yarn in PATH
    command: 'node ./node_modules/.bin/vite --port 8443 --host',
    url: BASE_URL,
    // If port 8443 is already serving (Figma Make cloud / manual terminal start),
    // Playwright will reuse it and skip spawning a new process.
    reuseExistingServer: true,
    timeout: 120000,
  },

  use: {
    baseURL: BASE_URL,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    navigationTimeout: 30000,
    actionTimeout: 15000,
    // Open DevTools when headed — helps debug selector issues locally
    launchOptions: {
      slowMo: process.env.SLOW_MO ? Number(process.env.SLOW_MO) : 0,
    },
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // headed mode when HEADED=1 env var is set
        headless: process.env.HEADED !== '1',
      },
    },
  ],
});
