# Automation Tests — JL You Portal

Tests are written with **Playwright** (end-to-end) and **Vitest** (unit/integration).  
Keep test files separate from source. Never import test utilities into production code.

## Structure

```
tests/
├── e2e/                  # Playwright end-to-end tests (466 tests, 47 spec files)
│   ├── analytics/
│   ├── assets/
│   ├── audit-logs/
│   ├── auth/
│   ├── collaboration/
│   ├── communications/
│   ├── dashboard/
│   ├── defect-tracker/
│   ├── directory/
│   ├── employee-dashboard/
│   ├── invoice/
│   ├── it-services/
│   ├── knowledge-base/
│   ├── leaves/
│   ├── linkedin/
│   ├── master-data/
│   ├── okr/
│   ├── onboarding/
│   ├── payroll/
│   ├── performance/
│   ├── permissions/
│   ├── preboarding/
│   ├── projects/
│   ├── rbac/
│   ├── recruitment/
│   ├── security/
│   ├── training/
│   ├── user-management/
│   ├── workflow/
│   └── shared/           # Fixtures, helpers, BASE_URL
├── unit/                 # Vitest unit tests (786 tests, 26 files)
│   ├── hooks/
│   └── utils/
└── README.md
```

---

## ⚡ Running E2E Tests

### In Figma Make (cloud environment — dev server already running)

```bash
# Run all E2E tests
pnpm exec playwright test

# Run tests for a specific app
pnpm exec playwright test tests/e2e/workflow/

# Run with browser UI visible (headed)
pnpm exec playwright test --headed --workers=1

# Open Playwright interactive UI
pnpm exec playwright test --ui
```

### Fix: All tests failing? Most likely cause: wrong credentials

If all E2E tests fail, login is failing. Two things to check:

**1. Create test users in Supabase** — the test users must exist in your Supabase Auth + `app_users` table. Create them in Supabase Dashboard → Authentication → Users.

**2. Set credentials via `.env.test`:**
```bash
cp .env.test.example .env.test
# Edit .env.test — set the real email/password for each role
```

The form uses `id="email"` and `id="password"` (not `name` attributes).  
Credentials default to `admin123` but can be overridden via env vars.

---

### On your local machine — step by step

**Step 1 — Install browsers (only once):**
```bash
npx playwright install chromium
```

**Step 2 — Start the dev server in Terminal 1:**
```bash
npx vite --port 8443
```
Keep this terminal open. Wait until you see `Local: http://localhost:8443/`.

**Step 3 — Run tests in Terminal 2:**

```bash
# Run all tests in real browser (visible window)
HEADED=1 SKIP_WEBSERVER=1 npx playwright test --workers=1

# Interactive UI — watch each test step in the Playwright Test Runner
SKIP_WEBSERVER=1 npx playwright test --ui

# Slow motion — watch at 500ms per action (easiest for debugging)
HEADED=1 SLOW_MO=500 SKIP_WEBSERVER=1 npx playwright test --workers=1

# Run just one spec file
HEADED=1 SKIP_WEBSERVER=1 npx playwright test tests/e2e/auth/login.spec.ts --workers=1
```

> **`SKIP_WEBSERVER=1`** tells Playwright to use the server you already started in Terminal 1
> instead of trying to launch another one. Without it, Playwright tries to auto-start
> `node ./node_modules/.bin/vite --port 8443` — which works too, but two terminals is clearer.

> **`HEADED=1`** opens a real Chromium window so you can watch the tests run.
> Without it, tests run headless (no visible browser).

---

#### Or let Playwright auto-start the server (one terminal)

```bash
# Playwright starts vite automatically then runs tests headed
HEADED=1 npx playwright test --workers=1
```

This uses `node_modules/.bin/vite` directly — no `pnpm` or `npm` required in PATH.

```bash
# Install dependencies first (only needed once)
pnpm install

# Install Playwright browsers (only needed once)
pnpm exec playwright install chromium

# Run all E2E tests (dev server auto-starts)
pnpm test:e2e:local

# Watch in a real browser window
pnpm test:e2e:headed

# Run a specific test file
pnpm exec playwright test tests/e2e/workflow/workflow-dashboard.spec.ts --workers=1
```

> **Why was I getting `net::ERR_CONNECTION_REFUSED`?**  
> Playwright was trying to connect to `http://localhost:8443` but the Vite dev server
> was not running on your machine. The `webServer` block added to `playwright.config.ts`
> fixes this by launching `pnpm dev --port 8443` automatically before the test suite
> starts. If port 8443 is already in use, Playwright reuses it (`reuseExistingServer: true`).

---

## Running Unit Tests

```bash
# Run all unit tests once
pnpm exec vitest run tests/unit

# Watch mode (re-runs on file save)
pnpm exec vitest tests/unit

# Run a single file
pnpm exec vitest run tests/unit/utils/okrUtils.test.ts
```

---

## Writing Tests

### E2E test rules
- Each app folder has one or more `*.spec.ts` files.
- Import from `'../shared/fixtures'` — it exports `test`, `expect`, `BASE_URL`, and `loginAs`.
- Use the **defensive `or()` pattern** for selectors to handle multiple possible markup shapes.
- Use **early return** when optional data is absent: `if (!await el.isVisible()) return;`
- Do not hard-code data-dependent assertions — the DB may be empty.

```ts
import { test, expect, loginAs, BASE_URL } from '../shared/fixtures';

test('workflow dashboard loads', async ({ page }) => {
  await loginAs(page, 'admin');
  await page.goto(`${BASE_URL}/workflow`);
  await expect(
    page.getByRole('heading', { name: /workflow/i })
      .or(page.getByText(/trigger/i))
  ).toBeVisible({ timeout: 10000 });
});
```

### Unit test rules
- Vitest runs in `node` environment — no DOM, no React.
- Test pure functions extracted from hooks and utilities.
- Do not import `supabase`, `axios`, or other network clients — mock them or avoid them.

---

## Coverage

| | Count | Files |
|---|---|---|
| Unit tests | **786** | 26 |
| E2E tests | **466** | 47 |

Every module (M-01 through M-24) and every dev guideline (G-01 through G-26) in `FSD_GAP_ANALYSIS.md` has corresponding test coverage.
